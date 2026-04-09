from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from cryptography.fernet import Fernet

from apps.ai_agent.models import ParsedIntent, PromptRequest
from apps.blockchain.services import BlockchainSubmissionError, NativeTransferSubmission

from .models import PaymentIntent
from .services import build_payment_intent_from_parsed_intent


@override_settings(WALLET_ENCRYPTION_KEY=Fernet.generate_key().decode("utf-8"))
class PaymentSubmissionViewTests(APITestCase):
    def setUp(self) -> None:
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            email="payments-tests@example.com",
            password="testpass123",
            full_name="Payments Tests",
        )
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.client.defaults["HTTP_HOST"] = "localhost"
        self.valid_address = "0x1111111111111111111111111111111111111111"

    def _create_payment_intent(
        self,
        *,
        amount: str = "0.10",
        recipient_name: str = "Ada",
        recipient_address: str | None = None,
    ) -> PaymentIntent:
        prompt_request = PromptRequest.objects.create(
            user=self.user,
            raw_prompt="send payment",
            source_type=PromptRequest.SOURCE_TEXT,
            status=PromptRequest.STATUS_PARSED,
        )
        parsed_intent = ParsedIntent.objects.create(
            prompt_request=prompt_request,
            intent_type="payment",
            payload_json={
                "recipient_name": recipient_name,
                "recipient_address": recipient_address,
                "amount": amount,
            },
            confidence=0.98,
            missing_fields=[] if recipient_address else ["recipient_address"],
        )
        return build_payment_intent_from_parsed_intent(parsed_intent)

    @patch("apps.payments.services.get_wallet_private_key")
    @patch("apps.payments.services.EtherlinkService.submit_native_transfer")
    def test_submit_payment_intent_returns_tx_hash(
        self,
        mock_submit_native_transfer,
        mock_get_wallet_private_key,
    ) -> None:
        payment_intent = self._create_payment_intent(recipient_address=self.valid_address)
        mock_get_wallet_private_key.return_value = "0x" + ("1" * 64)
        mock_submit_native_transfer.return_value = NativeTransferSubmission(
            tx_hash="0xabc123",
            explorer_url="https://explorer.example/tx/0xabc123",
            sender_address="0x2222222222222222222222222222222222222222",
            recipient_address=self.valid_address,
        )

        response = self.client.post(f"/api/payments/{payment_intent.id}/submit/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], PaymentIntent.STATUS_SUBMITTED)
        self.assertEqual(payload["tx_hash"], "0xabc123")
        payment_intent.refresh_from_db()
        self.assertEqual(payment_intent.status, PaymentIntent.STATUS_SUBMITTED)
        self.assertEqual(payment_intent.explorer_url, "https://explorer.example/tx/0xabc123")
        self.assertIsNotNone(payment_intent.submitted_at)
        mock_get_wallet_private_key.assert_called_once()
        mock_submit_native_transfer.assert_called_once()
        submit_kwargs = mock_submit_native_transfer.call_args.kwargs
        self.assertEqual(submit_kwargs["recipient_address"], self.valid_address)
        self.assertEqual(submit_kwargs["sender_private_key"], "0x" + ("1" * 64))
        self.assertEqual(submit_kwargs["sender_address"], payment_intent.wallet.address)

    def test_submit_payment_intent_requires_wallet_address(self) -> None:
        payment_intent = self._create_payment_intent(recipient_address=None)

        response = self.client.post(f"/api/payments/{payment_intent.id}/submit/", {}, format="json")

        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload["error_code"], "missing_recipient_address")
        payment_intent.refresh_from_db()
        self.assertEqual(payment_intent.status, PaymentIntent.STATUS_AWAITING_CONFIRMATION)

    @patch("apps.payments.services.EtherlinkService.submit_native_transfer")
    def test_submit_payment_intent_handles_sender_balance_failure(self, mock_submit_native_transfer) -> None:
        payment_intent = self._create_payment_intent(recipient_address=self.valid_address)
        mock_submit_native_transfer.side_effect = BlockchainSubmissionError(
            "The demo sender wallet does not have enough balance for this transfer.",
            code="insufficient_sender_balance",
        )

        response = self.client.post(f"/api/payments/{payment_intent.id}/submit/", {}, format="json")

        self.assertEqual(response.status_code, 502)
        payload = response.json()
        self.assertEqual(payload["error_code"], "insufficient_sender_balance")
        payment_intent.refresh_from_db()
        self.assertEqual(payment_intent.status, PaymentIntent.STATUS_FAILED)
        self.assertIn("does not have enough balance", payment_intent.failure_reason or "")

    @patch("apps.payments.services.EtherlinkService.submit_native_transfer")
    def test_reuses_existing_submitted_payment(self, mock_submit_native_transfer) -> None:
        payment_intent = self._create_payment_intent(recipient_address=self.valid_address)
        payment_intent.status = PaymentIntent.STATUS_SUBMITTED
        payment_intent.tx_hash = "0xexisting"
        payment_intent.explorer_url = "https://explorer.example/tx/0xexisting"
        payment_intent.submitted_at = timezone.now()
        payment_intent.save(
            update_fields=["status", "tx_hash", "explorer_url", "submitted_at", "updated_at"]
        )

        response = self.client.post(f"/api/payments/{payment_intent.id}/submit/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["tx_hash"], "0xexisting")
        mock_submit_native_transfer.assert_not_called()
