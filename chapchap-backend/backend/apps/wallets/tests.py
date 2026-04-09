from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from cryptography.fernet import Fernet

from apps.blockchain.services import AssetBalance, BlockchainReadError, SupportedAsset
from apps.wallets.encryption_utils import decrypt_private_key
from apps.wallets.services import ensure_wallet_profile


@override_settings(WALLET_ENCRYPTION_KEY=Fernet.generate_key().decode("utf-8"))
class WalletEndpointsTests(APITestCase):
    def setUp(self) -> None:
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            email="wallet-tests@example.com",
            password="testpass123",
            full_name="Wallet Tests",
        )
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.wallet = ensure_wallet_profile(self.user)

    def test_user_wallet_is_created_with_encrypted_private_key(self) -> None:
        self.assertTrue(self.wallet.address.startswith("0x"))
        self.assertIsNotNone(self.wallet.encrypted_private_key)
        decrypted_key = decrypt_private_key(self.wallet.encrypted_private_key or "")
        self.assertTrue(decrypted_key.startswith("0x"))
        self.assertNotEqual(decrypted_key, self.wallet.encrypted_private_key)

    def test_new_user_gets_wallet_automatically(self) -> None:
        user_model = get_user_model()
        new_user = user_model.objects.create_user(
            email="auto-wallet@example.com",
            password="testpass123",
            full_name="Auto Wallet",
        )

        self.assertTrue(hasattr(new_user, "wallet_profile"))
        self.assertTrue(new_user.wallet_profile.address.startswith("0x"))

    @patch("apps.wallets.services.EtherlinkService.get_supported_asset_balances")
    def test_dashboard_returns_chain_aware_balances(self, mock_get_supported_asset_balances) -> None:
        mock_get_supported_asset_balances.return_value = [
            AssetBalance(
                asset=SupportedAsset(
                    symbol="USDC",
                    name="USD Coin",
                    contract_address="0x1234567890123456789012345678901234567890",
                    decimals=6,
                    is_native=False,
                ),
                balance=Decimal("42.50"),
                balance_usd=Decimal("0.00"),
            ),
            AssetBalance(
                asset=SupportedAsset(
                    symbol="XTZ",
                    name="Tezos",
                    contract_address=None,
                    decimals=18,
                    is_native=True,
                ),
                balance=Decimal("1.25"),
                balance_usd=Decimal("0.00"),
            ),
        ]

        response = self.client.get("/api/me/dashboard/")
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["wallet"]["address"], self.wallet.address)
        self.assertEqual(payload["wallet"]["chain_name"], settings.BLOCKCHAIN_CHAIN_NAME)
        self.assertEqual(payload["wallet"]["chain_id"], settings.BLOCKCHAIN_CHAIN_ID)
        self.assertEqual(len(payload["balances"]), 2)
        self.assertEqual(payload["balances"][0]["asset_symbol"], "USDC")

    @patch(
        "apps.wallets.services.EtherlinkService.get_supported_asset_balances",
        side_effect=BlockchainReadError("RPC unavailable"),
    )
    def test_dashboard_falls_back_when_rpc_is_unavailable(self, mock_get_supported_asset_balances) -> None:
        response = self.client.get("/api/me/dashboard/")
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(payload["balances"]), 2)
        self.assertEqual(payload["balances"][0]["balance"], "0.00")
        self.assertEqual(payload["balances"][1]["balance"], "0.00")

    def test_fund_options_returns_wallet_and_supported_assets(self) -> None:
        response = self.client.get("/api/wallet/fund-options/")
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["receive"]["address"], self.wallet.address)
        self.assertEqual(payload["receive"]["network"], settings.BLOCKCHAIN_NETWORK_NAME)
        self.assertEqual(payload["receive"]["chain_id"], settings.BLOCKCHAIN_CHAIN_ID)
        self.assertEqual(len(payload["receive"]["supported_assets"]), 2)
