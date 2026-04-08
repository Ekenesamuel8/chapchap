from __future__ import annotations

import hashlib
import logging
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction

from apps.blockchain.services import (
    AssetBalance,
    BlockchainReadError,
    EtherlinkService,
    get_chain_metadata,
    get_supported_assets,
)

from .models import BalanceSnapshot, WalletProfile

logger = logging.getLogger(__name__)
User = get_user_model()

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


def generate_dev_wallet_address(user: User) -> str:
    seed = f"{user.pk}:{user.email}".encode("utf-8")
    digest = hashlib.sha256(seed).hexdigest()[:40]
    return f"0x{digest}"


@transaction.atomic
def ensure_wallet_profile(user: User) -> WalletProfile:
    wallet = WalletProfile.objects.filter(user=user).first()
    if wallet:
        if wallet.chain_name != settings.BLOCKCHAIN_CHAIN_NAME:
            wallet.chain_name = settings.BLOCKCHAIN_CHAIN_NAME
            wallet.save(update_fields=["chain_name", "updated_at"])
        return wallet

    return WalletProfile.objects.create(
        user=user,
        address=generate_dev_wallet_address(user),
        chain_name=settings.BLOCKCHAIN_CHAIN_NAME,
    )


def get_latest_balance_snapshots(wallet: WalletProfile) -> list[BalanceSnapshot]:
    snapshots: list[BalanceSnapshot] = []
    seen_symbols: set[str] = set()
    for snapshot in wallet.balance_snapshots.order_by("asset_symbol", "-fetched_at"):
        if snapshot.asset_symbol in seen_symbols:
            continue
        snapshots.append(snapshot)
        seen_symbols.add(snapshot.asset_symbol)
    return sorted(snapshots, key=lambda item: item.asset_symbol)


def refresh_wallet_balances(wallet: WalletProfile) -> list[BalanceSnapshot]:
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
        existing = get_latest_balance_snapshots(wallet)
        return existing or ensure_default_balance_snapshots(wallet)
    if not asset_balances:
        logger.warning(
            "wallets.balance_refresh_empty wallet_id=%s address=%s network_key=%s",
            wallet.id,
            wallet.address,
            settings.BLOCKCHAIN_NETWORK,
        )
        existing = get_latest_balance_snapshots(wallet)
        return existing or ensure_default_balance_snapshots(wallet)

    snapshots = _persist_asset_balances(wallet, asset_balances)
    logger.info(
        "wallets.balance_refresh_success wallet_id=%s address=%s asset_count=%s network_key=%s asset_registry=%s",
        wallet.id,
        wallet.address,
        len(snapshots),
        settings.BLOCKCHAIN_NETWORK,
        settings.BLOCKCHAIN_ASSET_REGISTRY_KEY,
    )
    return snapshots


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
