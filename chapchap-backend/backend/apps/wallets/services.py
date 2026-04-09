from __future__ import annotations

import logging
import os
import threading
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.db import transaction
from django.utils import timezone
from eth_account import Account

from apps.blockchain.services import (
    AssetBalance,
    BlockchainReadError,
    EtherlinkService,
    get_chain_metadata,
    get_supported_assets,
)

from .encryption_utils import (
    WalletDecryptionError,
    WalletEncryptionConfigurationError,
    decrypt_private_key,
    encrypt_private_key,
)
from .models import BalanceSnapshot, WalletProfile

logger = logging.getLogger(__name__)
User = get_user_model()
_refresh_lock = threading.Lock()
_refresh_in_flight: set[int] = set()

DEFAULT_BALANCES: tuple[dict[str, Decimal | str | None], ...] = (
    *(
        {
            "asset_symbol": asset.symbol,
            "asset_address": asset.contract_address,
            "balance": Decimal("0.00"),
            "balance_usd": Decimal("0.00"),
        }
        for asset in get_supported_assets()
    ),
)


class WalletProvisioningError(Exception):
    """Raised when a custodial wallet cannot be provisioned or decrypted."""


@transaction.atomic
def ensure_wallet_profile(user: User) -> WalletProfile:
    wallet = WalletProfile.objects.filter(user=user).first()
    if wallet:
        return _ensure_wallet_credentials(wallet)

    private_key, address = generate_wallet_credentials()
    encrypted_private_key = _encrypt_wallet_private_key(private_key)

    wallet, _ = WalletProfile.objects.get_or_create(
        user=user,
        defaults={
            "address": address,
            "encrypted_private_key": encrypted_private_key,
            "chain_name": settings.BLOCKCHAIN_CHAIN_NAME,
        },
    )
    return _ensure_wallet_credentials(wallet, private_key=private_key, address=address)


def generate_wallet_credentials() -> tuple[str, str]:
    account = Account.create(os.urandom(32))
    private_key = account.key.hex()
    if not private_key.startswith("0x"):
        private_key = f"0x{private_key}"
    return private_key, account.address


def get_wallet_private_key(wallet: WalletProfile) -> str:
    if not wallet.encrypted_private_key:
        raise WalletProvisioningError("Wallet private key is not available.")
    try:
        return decrypt_private_key(wallet.encrypted_private_key)
    except WalletDecryptionError as exc:
        logger.error(
            "wallets.private_key_decrypt_failed wallet_id=%s user_id=%s",
            wallet.id,
            wallet.user_id,
            exc_info=True,
        )
        raise WalletProvisioningError("Wallet private key could not be decrypted.") from exc


def get_latest_balance_snapshots(wallet: WalletProfile) -> list[BalanceSnapshot]:
    snapshots: list[BalanceSnapshot] = []
    seen_symbols: set[str] = set()
    for snapshot in wallet.balance_snapshots.order_by("asset_symbol", "-fetched_at"):
        if snapshot.asset_symbol in seen_symbols:
            continue
        snapshots.append(snapshot)
        seen_symbols.add(snapshot.asset_symbol)
    return sorted(snapshots, key=lambda item: item.asset_symbol)


def get_cached_wallet_balances(wallet: WalletProfile) -> list[BalanceSnapshot]:
    existing = get_latest_balance_snapshots(wallet)
    return existing or ensure_default_balance_snapshots(wallet)


def should_refresh_wallet_balances(wallet: WalletProfile, *, ttl_seconds: int | None = None) -> bool:
    ttl = ttl_seconds if ttl_seconds is not None else settings.BALANCE_REFRESH_TTL_SECONDS
    if wallet.last_balance_refresh_at is None:
        return True
    age = (timezone.now() - wallet.last_balance_refresh_at).total_seconds()
    return age >= ttl


def refresh_wallet_balances(wallet: WalletProfile, *, force: bool = False) -> list[BalanceSnapshot]:
    if not force and not should_refresh_wallet_balances(wallet):
        return get_cached_wallet_balances(wallet)

    etherlink = EtherlinkService()
    try:
        asset_balances = etherlink.get_supported_asset_balances(wallet.address)
    except BlockchainReadError:
        logger.warning(
            "wallets.balance_refresh_failed wallet_id=%s address=%s network_key=%s",
            wallet.id,
            wallet.address,
            settings.BLOCKCHAIN_NETWORK,
            exc_info=True,
        )
        return get_cached_wallet_balances(wallet)
    if not asset_balances:
        logger.warning(
            "wallets.balance_refresh_empty wallet_id=%s address=%s network_key=%s",
            wallet.id,
            wallet.address,
            settings.BLOCKCHAIN_NETWORK,
        )
        return get_cached_wallet_balances(wallet)

    snapshots = _persist_asset_balances(wallet, asset_balances)
    wallet.last_balance_refresh_at = timezone.now()
    wallet.save(update_fields=["last_balance_refresh_at", "updated_at"])
    logger.info(
        "wallets.balance_refresh_success wallet_id=%s address=%s asset_count=%s network_key=%s asset_registry=%s",
        wallet.id,
        wallet.address,
        len(snapshots),
        settings.BLOCKCHAIN_NETWORK,
        settings.BLOCKCHAIN_ASSET_REGISTRY_KEY,
    )
    return snapshots


def schedule_wallet_balance_refresh(wallet: WalletProfile) -> bool:
    if not should_refresh_wallet_balances(wallet):
        return False

    with _refresh_lock:
        if wallet.id in _refresh_in_flight:
            logger.info(
                "wallets.balance_refresh_skipped wallet_id=%s reason=in_flight",
                wallet.id,
            )
            return False
        _refresh_in_flight.add(wallet.id)

    thread = threading.Thread(
        target=_run_background_balance_refresh,
        args=(wallet.id,),
        daemon=True,
        name=f"wallet-refresh-{wallet.id}",
    )
    thread.start()
    logger.info(
        "wallets.balance_refresh_scheduled wallet_id=%s ttl_seconds=%s",
        wallet.id,
        settings.BALANCE_REFRESH_TTL_SECONDS,
    )
    return True


def ensure_default_balance_snapshots(wallet: WalletProfile) -> list[BalanceSnapshot]:
    existing = get_latest_balance_snapshots(wallet)
    if existing:
        return existing

    created = [
        BalanceSnapshot.objects.create(
            wallet=wallet,
            asset_symbol=str(item["asset_symbol"]),
            asset_address=item["asset_address"],
            balance=item["balance"],
            balance_usd=item["balance_usd"],
        )
        for item in DEFAULT_BALANCES
    ]
    return created


def build_fund_wallet_options(wallet: WalletProfile) -> dict[str, object]:
    chain = get_chain_metadata()
    assets = [
        {
            "symbol": asset.symbol,
            "name": asset.name,
            "contract_address": asset.contract_address,
            "decimals": asset.decimals,
            "is_native": asset.is_native,
        }
        for asset in get_supported_assets()
    ]
    return {
        "receive": {
            "address": wallet.address,
            "address_short": shorten_wallet_address(wallet.address),
            "network": chain["network"],
            "chain_id": chain["chain_id"],
            "explorer_base_url": chain["explorer_base_url"],
            "supported_assets": assets,
            "note": "Only send supported assets on Etherlink.",
        },
        "ramp_options": [
            {"type": "onramp", "label": "Buy Crypto", "enabled": False},
            {"type": "offramp", "label": "Cash Out", "enabled": False},
        ],
    }


def shorten_wallet_address(address: str) -> str:
    return f"{address[:6]}...{address[-4:]}"


def _ensure_wallet_credentials(
    wallet: WalletProfile,
    *,
    private_key: str | None = None,
    address: str | None = None,
) -> WalletProfile:
    updates: list[str] = []
    if wallet.chain_name != settings.BLOCKCHAIN_CHAIN_NAME:
        wallet.chain_name = settings.BLOCKCHAIN_CHAIN_NAME
        updates.append("chain_name")

    if wallet.encrypted_private_key:
        if updates:
            wallet.save(update_fields=[*updates, "updated_at"])
        return wallet

    generated_private_key = private_key
    generated_address = address
    if generated_private_key is None or generated_address is None:
        generated_private_key, generated_address = generate_wallet_credentials()

    wallet.encrypted_private_key = _encrypt_wallet_private_key(generated_private_key)
    wallet.address = generated_address
    updates.extend(["encrypted_private_key", "address"])
    wallet.save(update_fields=[*updates, "updated_at"])
    logger.warning(
        "wallets.private_key_backfilled wallet_id=%s user_id=%s",
        wallet.id,
        wallet.user_id,
    )
    return wallet


def _encrypt_wallet_private_key(private_key: str) -> str:
    try:
        return encrypt_private_key(private_key)
    except WalletEncryptionConfigurationError as exc:
        raise WalletProvisioningError("Wallet encryption is not configured.") from exc


def _persist_asset_balances(
    wallet: WalletProfile,
    asset_balances: list[AssetBalance],
) -> list[BalanceSnapshot]:
    snapshots: list[BalanceSnapshot] = []
    for item in asset_balances:
        snapshots.append(
            BalanceSnapshot.objects.create(
                wallet=wallet,
                asset_symbol=item.asset.symbol,
                asset_address=item.asset.contract_address,
                balance=item.balance,
                balance_usd=item.balance_usd or Decimal("0.00"),
            )
        )
    return sorted(snapshots, key=lambda balance: balance.asset_symbol)


def _run_background_balance_refresh(wallet_id: int) -> None:
    close_old_connections()
    try:
        wallet = WalletProfile.objects.get(id=wallet_id)
        refresh_wallet_balances(wallet, force=True)
    except WalletProfile.DoesNotExist:
        logger.warning("wallets.balance_refresh_background_missing wallet_id=%s", wallet_id)
    except Exception:
        logger.exception("wallets.balance_refresh_background_failed wallet_id=%s", wallet_id)
    finally:
        with _refresh_lock:
            _refresh_in_flight.discard(wallet_id)
        close_old_connections()
