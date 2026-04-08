from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal, ROUND_DOWN
from typing import Any

from django.conf import settings
from eth_account import Account
from web3 import Web3
from web3.contract import Contract

logger = logging.getLogger(__name__)

ERC20_ABI: list[dict[str, Any]] = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function",
    },
]


class BlockchainReadError(Exception):
    """Raised when a read-only blockchain operation fails."""


class BlockchainSubmissionError(Exception):
    """Raised when a signed blockchain transaction cannot be submitted."""

    def __init__(self, message: str, *, code: str = "submission_failed") -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class SupportedAsset:
    symbol: str
    name: str
    contract_address: str | None
    decimals: int
    is_native: bool


@dataclass(frozen=True)
class AssetBalance:
    asset: SupportedAsset
    balance: Decimal
    balance_usd: Decimal | None


@dataclass(frozen=True)
class GasEstimate:
    network: str
    chain_id: int
    estimated_gas_xtz: Decimal
    explorer_base_url: str


@dataclass(frozen=True)
class NativeTransferSubmission:
    tx_hash: str
    explorer_url: str
    sender_address: str
    recipient_address: str


def get_supported_assets() -> list[SupportedAsset]:
    assets: list[SupportedAsset] = []
    for asset in settings.SUPPORTED_ASSETS:
        assets.append(
            SupportedAsset(
                symbol=str(asset["symbol"]),
                name=str(asset["name"]),
                contract_address=asset.get("contract_address"),
                decimals=int(asset["decimals"]),
                is_native=bool(asset["is_native"]),
            )
        )
    return assets


def get_native_asset() -> SupportedAsset:
    for asset in get_supported_assets():
        if asset.is_native:
            return asset
    raise BlockchainSubmissionError(
        "No native asset is configured for the active blockchain network.",
        code="native_asset_missing",
    )


def get_chain_metadata() -> dict[str, Any]:
    return {
        "network_key": settings.BLOCKCHAIN_NETWORK,
        "network": settings.BLOCKCHAIN_NETWORK_NAME,
        "chain_name": settings.BLOCKCHAIN_CHAIN_NAME,
        "chain_id": settings.BLOCKCHAIN_CHAIN_ID,
        "explorer_base_url": settings.BLOCKCHAIN_EXPLORER_BASE_URL,
        "asset_registry_key": settings.BLOCKCHAIN_ASSET_REGISTRY_KEY,
    }


class EtherlinkService:
    def __init__(self, rpc_url: str | None = None) -> None:
        self.rpc_url = rpc_url or settings.BLOCKCHAIN_RPC_URL
        self.web3: Web3 | None = None
        if self.rpc_url:
            self.web3 = Web3(Web3.HTTPProvider(self.rpc_url, request_kwargs={"timeout": 10}))
        logger.info(
            "blockchain.service_initialized network_key=%s network=%s chain_id=%s rpc_configured=%s asset_registry=%s",
            settings.BLOCKCHAIN_NETWORK,
            settings.BLOCKCHAIN_NETWORK_NAME,
            settings.BLOCKCHAIN_CHAIN_ID,
            bool(self.rpc_url),
            settings.BLOCKCHAIN_ASSET_REGISTRY_KEY,
        )

    def is_configured(self) -> bool:
        return bool(self.web3 and self.rpc_url)

    def get_native_balance(self, address: str) -> Decimal:
        web3 = self._require_web3()
        checksum_address = web3.to_checksum_address(address)
        balance_wei = web3.eth.get_balance(checksum_address)
        return self._format_units(balance_wei, 18)

    def get_token_balance(self, address: str, asset: SupportedAsset) -> Decimal:
        if asset.is_native or not asset.contract_address or asset.decimals is None:
            raise BlockchainReadError(f"Asset {asset.symbol} is not a configured ERC-20 asset.")

        web3 = self._require_web3()
        checksum_address = web3.to_checksum_address(address)
        contract = self._get_contract(asset.contract_address)
        raw_balance = contract.functions.balanceOf(checksum_address).call()
        decimals = self.get_token_decimals(asset)
        return self._format_units(raw_balance, decimals)

    def get_token_decimals(self, asset: SupportedAsset) -> int:
        if asset.is_native:
            return asset.decimals
        if not asset.contract_address:
            return asset.decimals

        try:
            contract = self._get_contract(asset.contract_address)
            return int(contract.functions.decimals().call())
        except Exception:  # noqa: BLE001
            logger.warning(
                "blockchain.token_decimals_fallback symbol=%s contract=%s",
                asset.symbol,
                asset.contract_address,
                exc_info=True,
            )
            return asset.decimals

    def get_token_symbol(self, asset: SupportedAsset) -> str:
        if asset.is_native or not asset.contract_address:
            return asset.symbol

        try:
            contract = self._get_contract(asset.contract_address)
            return str(contract.functions.symbol().call())
        except Exception:  # noqa: BLE001
            logger.warning(
                "blockchain.token_symbol_fallback symbol=%s contract=%s",
                asset.symbol,
                asset.contract_address,
                exc_info=True,
            )
            return asset.symbol

    def get_supported_asset_balances(self, address: str) -> list[AssetBalance]:
        balances: list[AssetBalance] = []
        for asset in get_supported_assets():
            logger.info(
                "blockchain.balance_read_start network_key=%s chain_id=%s asset_registry=%s symbol=%s asset_type=%s contract=%s",
                settings.BLOCKCHAIN_NETWORK,
                settings.BLOCKCHAIN_CHAIN_ID,
                settings.BLOCKCHAIN_ASSET_REGISTRY_KEY,
                asset.symbol,
                "native" if asset.is_native else "erc20",
                asset.contract_address,
            )
            try:
                if asset.is_native:
                    balance = self.get_native_balance(address)
                elif asset.contract_address and asset.decimals is not None:
                    balance = self.get_token_balance(address, asset)
                else:
                    logger.warning(
                        "blockchain.balance_read_skipped network_key=%s chain_id=%s asset_registry=%s symbol=%s reason=unconfigured_erc20_for_network contract=%s decimals=%s",
                        settings.BLOCKCHAIN_NETWORK,
                        settings.BLOCKCHAIN_CHAIN_ID,
                        settings.BLOCKCHAIN_ASSET_REGISTRY_KEY,
                        asset.symbol,
                        asset.contract_address,
                        asset.decimals,
                    )
                    balance = Decimal("0")
                logger.info(
                    "blockchain.balance_read_success address=%s symbol=%s balance=%s",
                    address,
                    asset.symbol,
                    balance,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "blockchain.balance_read_failed network_key=%s asset_registry=%s address=%s symbol=%s",
                    settings.BLOCKCHAIN_NETWORK,
                    settings.BLOCKCHAIN_ASSET_REGISTRY_KEY,
                    address,
                    asset.symbol,
                    exc_info=True,
                )
                balance = Decimal("0")

            balances.append(
                AssetBalance(
                    asset=asset,
                    balance=balance.quantize(Decimal("0.01"), rounding=ROUND_DOWN),
                    balance_usd=Decimal("0.00"),
                )
            )
        return balances

    def estimate_transfer_gas(self, *, is_token_transfer: bool = True) -> GasEstimate:
        fallback = GasEstimate(
            network=settings.BLOCKCHAIN_NETWORK_NAME,
            chain_id=settings.BLOCKCHAIN_CHAIN_ID,
            estimated_gas_xtz=Decimal("0.0003"),
            explorer_base_url=settings.BLOCKCHAIN_EXPLORER_BASE_URL,
        )
        if not self.web3:
            return fallback

        try:
            gas_price = Decimal(str(self.web3.eth.gas_price))
            gas_limit = Decimal("65000" if is_token_transfer else "21000")
            estimate = (gas_price * gas_limit) / Decimal("1000000000000000000")
            result = GasEstimate(
                network=settings.BLOCKCHAIN_NETWORK_NAME,
                chain_id=settings.BLOCKCHAIN_CHAIN_ID,
                estimated_gas_xtz=estimate.quantize(Decimal("0.0001"), rounding=ROUND_DOWN),
                explorer_base_url=settings.BLOCKCHAIN_EXPLORER_BASE_URL,
            )
            logger.info(
                "blockchain.gas_estimate_success network=%s chain_id=%s estimate=%s",
                result.network,
                result.chain_id,
                result.estimated_gas_xtz,
            )
            return result
        except Exception:  # noqa: BLE001
            logger.warning(
                "blockchain.gas_estimate_failed network=%s chain_id=%s",
                settings.BLOCKCHAIN_NETWORK_NAME,
                settings.BLOCKCHAIN_CHAIN_ID,
                exc_info=True,
            )
            return fallback

    def submit_native_transfer(
        self,
        *,
        recipient_address: str,
        amount: Decimal,
    ) -> NativeTransferSubmission:
        if settings.BLOCKCHAIN_NETWORK != "etherlink_testnet":
            raise BlockchainSubmissionError(
                "Real submission is only enabled for Etherlink testnet demo mode.",
                code="network_not_supported",
            )
        web3 = self._require_web3()
        private_key = settings.BLOCKCHAIN_SENDER_PRIVATE_KEY
        if not private_key:
            raise BlockchainSubmissionError(
                "Demo sender private key is not configured.",
                code="missing_sender_key",
            )
        if not Web3.is_address(recipient_address):
            raise BlockchainSubmissionError(
                "Recipient wallet address is invalid.",
                code="invalid_recipient_address",
            )

        account = Account.from_key(private_key)
        sender_address = account.address
        configured_sender = settings.BLOCKCHAIN_SENDER_ADDRESS
        if configured_sender and configured_sender.lower() != sender_address.lower():
            raise BlockchainSubmissionError(
                "Configured sender address does not match the demo private key.",
                code="sender_mismatch",
            )

        checksum_sender = web3.to_checksum_address(sender_address)
        checksum_recipient = web3.to_checksum_address(recipient_address)
        value = Web3.to_wei(amount, "ether")

        logger.info(
            "blockchain.transfer_build_start network_key=%s sender=%s recipient=%s amount=%s",
            settings.BLOCKCHAIN_NETWORK,
            sender_address,
            recipient_address,
            amount,
        )

        try:
            nonce = web3.eth.get_transaction_count(checksum_sender)
            gas_price = web3.eth.gas_price
            gas_limit = web3.eth.estimate_gas(
                {
                    "from": checksum_sender,
                    "to": checksum_recipient,
                    "value": value,
                }
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "blockchain.transfer_build_failed network_key=%s sender=%s recipient=%s",
                settings.BLOCKCHAIN_NETWORK,
                sender_address,
                recipient_address,
                exc_info=True,
            )
            raise BlockchainSubmissionError(
                "I couldn't estimate gas for that transfer.",
                code="gas_estimation_failed",
            ) from exc

        sender_balance = web3.eth.get_balance(checksum_sender)
        total_cost = int(value) + int(gas_price) * int(gas_limit)
        if sender_balance < total_cost:
            raise BlockchainSubmissionError(
                "The demo sender wallet does not have enough balance for this transfer.",
                code="insufficient_sender_balance",
            )

        transaction = {
            "chainId": settings.BLOCKCHAIN_CHAIN_ID,
            "nonce": nonce,
            "to": checksum_recipient,
            "value": value,
            "gas": gas_limit,
            "gasPrice": gas_price,
        }

        try:
            signed_tx = account.sign_transaction(transaction)
            raw_hash = web3.eth.send_raw_transaction(signed_tx.raw_transaction)
            tx_hash = raw_hash.hex()
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "blockchain.transfer_submit_failed network_key=%s sender=%s recipient=%s",
                settings.BLOCKCHAIN_NETWORK,
                sender_address,
                recipient_address,
                exc_info=True,
            )
            raise BlockchainSubmissionError(
                "The blockchain transaction could not be submitted.",
                code="broadcast_failed",
            ) from exc

        explorer_url = f"{settings.BLOCKCHAIN_EXPLORER_BASE_URL.rstrip('/')}/tx/{tx_hash}"
        logger.info(
            "blockchain.transfer_submit_success network_key=%s sender=%s recipient=%s tx_hash=%s",
            settings.BLOCKCHAIN_NETWORK,
            sender_address,
            recipient_address,
            tx_hash,
        )
        return NativeTransferSubmission(
            tx_hash=tx_hash,
            explorer_url=explorer_url,
            sender_address=sender_address,
            recipient_address=recipient_address,
        )

    def _require_web3(self) -> Web3:
        if not self.web3:
            raise BlockchainReadError("Blockchain RPC is not configured.")
        return self.web3

    def _get_contract(self, contract_address: str) -> Contract:
        web3 = self._require_web3()
        checksum_address = web3.to_checksum_address(contract_address)
        return web3.eth.contract(address=checksum_address, abi=ERC20_ABI)

    @staticmethod
    def _format_units(raw_value: int, decimals: int) -> Decimal:
        return Decimal(raw_value) / (Decimal(10) ** Decimal(decimals))


def get_payment_gas_summary(*, token_symbol: str | None = None) -> dict[str, Any]:
    estimate = EtherlinkService().estimate_transfer_gas(
        is_token_transfer=(token_symbol or "").upper() != "XTZ"
    )
    return {
        "network": estimate.network,
        "chain_id": estimate.chain_id,
        "estimated_gas_xtz": f"{estimate.estimated_gas_xtz:.4f}",
        "explorer_base_url": estimate.explorer_base_url,
    }
