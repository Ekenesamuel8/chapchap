from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from .services import EtherlinkService, get_chain_metadata, get_supported_assets


class BlockchainServiceTests(SimpleTestCase):
    @override_settings(
        BLOCKCHAIN_NETWORK="dev_sepolia",
        BLOCKCHAIN_NETWORK_NAME="Sepolia Dev",
        BLOCKCHAIN_CHAIN_NAME="sepolia",
        BLOCKCHAIN_CHAIN_ID=11155111,
        BLOCKCHAIN_EXPLORER_BASE_URL="https://sepolia.etherscan.io",
        BLOCKCHAIN_ASSET_REGISTRY_KEY="dev_sepolia",
        SUPPORTED_ASSETS=[
            {
                "symbol": "ETH",
                "name": "Sepolia ETH",
                "contract_address": None,
                "decimals": 18,
                "is_native": True,
            },
            {
                "symbol": "USDC",
                "name": "USD Coin",
                "contract_address": "0x1234567890123456789012345678901234567890",
                "decimals": 6,
                "is_native": False,
            },
        ],
    )
    def test_chain_metadata_uses_active_blockchain_mode(self) -> None:
        metadata = get_chain_metadata()

        self.assertEqual(metadata["network_key"], "dev_sepolia")
        self.assertEqual(metadata["network"], "Sepolia Dev")
        self.assertEqual(metadata["chain_id"], 11155111)
        self.assertEqual(metadata["asset_registry_key"], "dev_sepolia")

    @override_settings(
        BLOCKCHAIN_NETWORK="etherlink_testnet",
        BLOCKCHAIN_NETWORK_NAME="Etherlink",
        BLOCKCHAIN_CHAIN_NAME="etherlink_testnet",
        BLOCKCHAIN_CHAIN_ID=128123,
        BLOCKCHAIN_EXPLORER_BASE_URL="https://testnet.explorer.etherlink.com",
        BLOCKCHAIN_ASSET_REGISTRY_KEY="etherlink_testnet",
        SUPPORTED_ASSETS=[
            {
                "symbol": "XTZ",
                "name": "Tezos",
                "contract_address": None,
                "decimals": 18,
                "is_native": True,
            },
            {
                "symbol": "USDC",
                "name": "USD Coin",
                "contract_address": None,
                "decimals": 6,
                "is_native": False,
            },
        ],
    )
    @patch.object(EtherlinkService, "get_native_balance", return_value=Decimal("1.25"))
    def test_invalid_erc20_configuration_is_skipped_safely(self, mock_get_native_balance: MagicMock) -> None:
        balances = EtherlinkService(rpc_url="https://rpc.example").get_supported_asset_balances(
            "0x1234567890123456789012345678901234567890"
        )

        self.assertEqual(len(balances), 2)
        xtz = next(balance for balance in balances if balance.asset.symbol == "XTZ")
        usdc = next(balance for balance in balances if balance.asset.symbol == "USDC")
        self.assertEqual(xtz.balance, Decimal("1.25"))
        self.assertEqual(usdc.balance, Decimal("0.00"))

    @override_settings(
        SUPPORTED_ASSETS=[
            {
                "symbol": "XTZ",
                "name": "Tezos",
                "contract_address": None,
                "decimals": 18,
                "is_native": True,
            },
            {
                "symbol": "USDC",
                "name": "USD Coin",
                "contract_address": "0x1234567890123456789012345678901234567890",
                "decimals": 6,
                "is_native": False,
            },
        ]
    )
    @patch.object(EtherlinkService, "get_native_balance", return_value=Decimal("2.50"))
    @patch.object(EtherlinkService, "get_token_balance", return_value=Decimal("42.00"))
    def test_erc20_asset_is_read_when_configured(
        self,
        mock_get_token_balance: MagicMock,
        mock_get_native_balance: MagicMock,
    ) -> None:
        balances = EtherlinkService(rpc_url="https://rpc.example").get_supported_asset_balances(
            "0x1234567890123456789012345678901234567890"
        )

        self.assertEqual(len(get_supported_assets()), 2)
        usdc = next(balance for balance in balances if balance.asset.symbol == "USDC")
        self.assertEqual(usdc.balance, Decimal("42.00"))
