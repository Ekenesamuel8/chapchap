from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import ConfidentialAction, ConfidentialAgreementRecord, SavingsPosition

User = get_user_model()


class ConfidentialEndpointsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="confidential@example.com",
            password="password123",
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def test_parse_confidential_payment_creates_action(self):
        response = self.client.post(
            reverse("confidential-parse"),
            {"message": "Send 0.02 ETH to Ochi privately"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["intent"], "confidential_payment")
        self.assertIn("recipient_address", response.json()["missing_fields"])
        self.assertEqual(response.json()["payload"]["recipient_name"], "Ochi")
        self.assertEqual(ConfidentialAction.objects.count(), 1)

    def test_parse_confidential_payment_extracts_longer_name(self):
        response = self.client.post(
            reverse("confidential-parse"),
            {"message": "Send 0.0001 ETH privately to Emmanuel"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["intent"], "confidential_payment")
        self.assertEqual(response.json()["payload"]["recipient_name"], "Emmanuel")

    def test_parse_public_payment_creates_public_action(self):
        response = self.client.post(
            reverse("confidential-parse"),
            {"message": "Send 0.02 ETH to Ada publicly"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["intent"], "public_payment")
        self.assertEqual(response.json()["payload"]["transfer_mode"], "public")
        self.assertIn("recipient_address", response.json()["missing_fields"])

    def test_unspecified_payment_requests_transfer_mode(self):
        response = self.client.post(
            reverse("confidential-parse"),
            {"message": "Send 0.02 ETH to Ada"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["intent"], "confidential_payment")
        self.assertIn("transfer_mode", response.json()["missing_fields"])
        self.assertEqual(response.json()["payload"]["transfer_mode"], "unspecified")

    def test_parse_confidential_savings_creates_position(self):
        response = self.client.post(
            reverse("confidential-parse"),
            {"message": "Save 0.01 ETH for 10 minutes"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["intent"], "confidential_savings")
        self.assertEqual(response.json()["payload"]["lock_rule"], "10 minutes")
        self.assertIsNotNone(response.json()["payload"]["unlock_at"])
        self.assertEqual(SavingsPosition.objects.count(), 1)

    def test_parse_confidential_agreement_creates_record(self):
        response = self.client.post(
            reverse("confidential-parse"),
            {
                "message": "Create agreement: pay John Doe 0.002 ETH if he delivers the report"
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["intent"], "confidential_agreement")
        self.assertEqual(response.json()["payload"]["recipient_name"], "John Doe")
        self.assertEqual(ConfidentialAgreementRecord.objects.count(), 1)

    def test_history_returns_newest_first(self):
        ConfidentialAction.objects.create(
            user=self.user,
            intent=ConfidentialAction.INTENT_GENERAL_HELP,
            status=ConfidentialAction.STATUS_DRAFT,
            public_summary="First",
            payload_json={},
        )
        ConfidentialAction.objects.create(
            user=self.user,
            intent=ConfidentialAction.INTENT_CONFIDENTIAL_PAYMENT,
            status=ConfidentialAction.STATUS_AWAITING_WALLET,
            public_summary="Second",
            payload_json={},
        )

        response = self.client.get(reverse("confidential-history"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload[0]["public_summary"], "Second")
        self.assertEqual(len(payload), 1)

    def test_general_help_prompt_is_not_persisted(self):
        response = self.client.post(
            reverse("confidential-parse"),
            {"message": "What can ChapChap Confidential do for me?"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["intent"], "general_help")
        self.assertIsNone(response.json()["action_id"])
        self.assertEqual(ConfidentialAction.objects.count(), 0)

    def test_record_tx_updates_action(self):
        action = ConfidentialAction.objects.create(
            user=self.user,
            intent=ConfidentialAction.INTENT_CONFIDENTIAL_PAYMENT,
            status=ConfidentialAction.STATUS_AWAITING_WALLET,
            public_summary="Payment draft",
            payload_json={},
        )

        response = self.client.post(
            reverse("confidential-action-tx", kwargs={"id": action.id}),
            {
                "tx_hash": "0x123",
                "status": ConfidentialAction.STATUS_SUBMITTED,
                "contract_address": "0xabc",
                "intent": ConfidentialAction.INTENT_PUBLIC_PAYMENT,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        action.refresh_from_db()
        self.assertEqual(action.tx_hash, "0x123")
        self.assertEqual(action.status, ConfidentialAction.STATUS_SUBMITTED)
        self.assertEqual(action.intent, ConfidentialAction.INTENT_PUBLIC_PAYMENT)

    def test_savings_list_marks_position_withdrawable_after_unlock(self):
        action = ConfidentialAction.objects.create(
            user=self.user,
            intent=ConfidentialAction.INTENT_CONFIDENTIAL_SAVINGS,
            status=ConfidentialAction.STATUS_CONFIRMED,
            public_summary="Savings draft",
            payload_json={},
        )
        savings = SavingsPosition.objects.create(
            action=action,
            user=self.user,
            asset="ETH",
            amount_display="0.01",
            lock_rule="1 day",
            unlock_at=timezone.now() - timedelta(minutes=5),
            status=SavingsPosition.STATUS_ACTIVE,
        )

        response = self.client.get(reverse("confidential-savings-list"))

        self.assertEqual(response.status_code, 200)
        savings.refresh_from_db()
        self.assertEqual(savings.status, SavingsPosition.STATUS_WITHDRAWABLE)
        self.assertEqual(response.json()[0]["status"], SavingsPosition.STATUS_WITHDRAWABLE)

    def test_savings_withdraw_endpoint_returns_pending_message(self):
        action = ConfidentialAction.objects.create(
            user=self.user,
            intent=ConfidentialAction.INTENT_CONFIDENTIAL_SAVINGS,
            status=ConfidentialAction.STATUS_CONFIRMED,
            public_summary="Savings draft",
            payload_json={},
        )
        savings = SavingsPosition.objects.create(
            action=action,
            user=self.user,
            asset="ETH",
            amount_display="0.01",
            lock_rule="1 day",
            unlock_at=timezone.now() - timedelta(minutes=5),
            status=SavingsPosition.STATUS_ACTIVE,
        )

        response = self.client.post(
            reverse("confidential-savings-withdraw", kwargs={"id": savings.id}),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], SavingsPosition.STATUS_WITHDRAWABLE)
        self.assertFalse(payload["withdrawal_contract_ready"])
        self.assertIn("Withdrawal contract wiring is still pending", payload["message"])

    def test_proof_endpoint_returns_recommendation(self):
        action = ConfidentialAction.objects.create(
            user=self.user,
            intent=ConfidentialAction.INTENT_CONFIDENTIAL_AGREEMENT,
            status=ConfidentialAction.STATUS_AWAITING_WALLET,
            public_summary="Agreement draft",
            payload_json={},
        )
        agreement = ConfidentialAgreementRecord.objects.create(
            action=action,
            user=self.user,
            recipient_address="0x1111111111111111111111111111111111111111",
            metadata_hash="0x" + "a" * 64,
            condition_summary="deliver logo before Friday",
            status=ConfidentialAgreementRecord.STATUS_PENDING,
        )

        response = self.client.post(
            reverse("confidential-agreement-proof", kwargs={"id": agreement.id}),
            {"proof_text": "Ada delivered the logo and submitted the final files."},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn(payload["recommendation"], {"release", "refund", "dispute"})
        agreement.refresh_from_db()
        self.assertIsNotNone(agreement.ai_verdict)
