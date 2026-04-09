from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from cryptography.fernet import Fernet

from apps.ai_agent.models import PendingIntentSession
from apps.ai_agent.schemas import ParsedIntentSchema
from apps.ai_agent.services import GeminiQuotaExceededError
from apps.payments.models import PaymentIntent


@override_settings(WALLET_ENCRYPTION_KEY=Fernet.generate_key().decode("utf-8"))
class AgentChatViewTests(APITestCase):
    def setUp(self) -> None:
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            email="chat-tests@example.com",
            password="testpass123",
            full_name="Chat Tests",
        )
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.client.defaults["HTTP_HOST"] = "localhost"
        self.valid_address = "0x1111111111111111111111111111111111111111"

    def test_hello_returns_assistant_message_without_provider(self) -> None:
        response = self.client.post("/api/agent/chat/", {"message": "hello"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["type"], "assistant_message")

    def test_send_money_to_ada_starts_collecting_session(self) -> None:
        response = self.client.post(
            "/api/agent/chat/",
            {"message": "send money to Ada"},
            format="json",
        )

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_followup")
        self.assertEqual(payload["session"]["status"], "collecting")
        self.assertEqual(payload["session"]["missing_fields"], ["amount", "recipient_address"])

    def test_follow_up_amount_completes_payment(self) -> None:
        self.client.post("/api/agent/chat/", {"message": "send money to Ada"}, format="json")
        self.client.post("/api/agent/chat/", {"message": "$20"}, format="json")
        response = self.client.post(
            "/api/agent/chat/",
            {"message": self.valid_address},
            format="json",
        )

        payload = response.json()
        self.assertEqual(payload["type"], "payment_confirmation")
        self.assertEqual(payload["payment"]["summary"]["amount"], "20.00")
        self.assertEqual(PaymentIntent.objects.filter(user=self.user).count(), 1)

    def test_direct_name_only_prompt_asks_for_wallet_address(self) -> None:
        response = self.client.post(
            "/api/agent/chat/",
            {"message": "send $20 to Ada"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["type"], "assistant_followup")
        self.assertIn("wallet address", response.json()["message"])

    def test_direct_prompt_with_address_returns_confirmation(self) -> None:
        response = self.client.post(
            "/api/agent/chat/",
            {"message": f"i want to send $20 to ada {self.valid_address}"},
            format="json",
        )

        payload = response.json()
        self.assertEqual(payload["type"], "payment_confirmation")
        self.assertEqual(payload["payment"]["summary"]["recipient_name"], "Ada")
        self.assertEqual(payload["payment"]["summary"]["recipient_address"], self.valid_address)

    def test_repeated_follow_up_keeps_single_missing_prompt(self) -> None:
        self.client.post("/api/agent/chat/", {"message": "send money to Ada"}, format="json")
        response = self.client.post("/api/agent/chat/", {"message": "later"}, format="json")

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_followup")
        self.assertIn("still need the amount", payload["message"])

    def test_ready_payment_session_does_not_hijack_thank_you(self) -> None:
        self.client.post(
            "/api/agent/chat/",
            {"message": f"send $20 to Ada {self.valid_address}"},
            format="json",
        )
        response = self.client.post("/api/agent/chat/", {"message": "thank you"}, format="json")

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_message")
        self.assertTrue(payload["message"])
        self.assertEqual(PaymentIntent.objects.filter(user=self.user).count(), 1)

    def test_ready_payment_session_does_not_hijack_hello(self) -> None:
        self.client.post(
            "/api/agent/chat/",
            {"message": f"send $20 to Ada {self.valid_address}"},
            format="json",
        )
        response = self.client.post("/api/agent/chat/", {"message": "hello"}, format="json")

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_message")
        self.assertTrue(payload["message"])
        self.assertEqual(PaymentIntent.objects.filter(user=self.user).count(), 1)

    def test_ready_payment_session_acknowledges_confirm_without_recreating_intent(self) -> None:
        self.client.post(
            "/api/agent/chat/",
            {"message": f"send $20 to Ada {self.valid_address}"},
            format="json",
        )
        response = self.client.post("/api/agent/chat/", {"message": "confirm"}, format="json")

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_message")
        self.assertIn("still prepared", payload["message"])
        self.assertEqual(PaymentIntent.objects.filter(user=self.user).count(), 1)

    def test_product_search_returns_mock_results(self) -> None:
        response = self.client.post(
            "/api/agent/chat/",
            {"message": "Find me cheap AirPods under $50"},
            format="json",
        )

        payload = response.json()
        self.assertEqual(payload["type"], "product_results")
        self.assertEqual(len(payload["results"]), 3)
        self.assertEqual(payload["session"]["status"], "results_ready")
        self.assertEqual(payload["query"], "cheap Airpods under 50 usd")
        self.assertIn("amazon.com", payload["results"][0]["product_url"])
        self.assertIn("jumia.com.ng", payload["results"][1]["product_url"])
        self.assertIn("aliexpress.com", payload["results"][2]["product_url"])

    def test_food_prompt_returns_product_clarification(self) -> None:
        response = self.client.post("/api/agent/chat/", {"message": "I'm hungry"}, format="json")

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_followup")
        self.assertEqual(payload["intent"], "product_search")

    @patch("apps.ai_agent.chat_services.GeminiAdviceService.generate_response")
    def test_investment_prompt_returns_real_advice_response(self, mock_generate_response) -> None:
        mock_generate_response.return_value = (
            "Start with your goals and risk tolerance, then diversify gradually."
        )

        response = self.client.post(
            "/api/agent/chat/",
            {"message": "How do I invest?"},
            format="json",
        )

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_message")
        self.assertIn("risk tolerance", payload["message"])

    @patch("apps.ai_agent.chat_services.GeminiAdviceService.generate_response")
    def test_portfolio_prompt_returns_balance_aware_response(self, mock_generate_response) -> None:
        mock_generate_response.return_value = (
            "Your current wallet looks concentrated, so think about diversification."
        )

        response = self.client.post(
            "/api/agent/chat/",
            {"message": "Analyze my portfolio and suggest investment"},
            format="json",
        )

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_message")
        self.assertIn("diversification", payload["message"])

    def test_product_search_can_collect_budget_then_return_results(self) -> None:
        response = self.client.post(
            "/api/agent/chat/",
            {"message": "I want a cheap iPhone 13"},
            format="json",
        )

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_followup")
        self.assertEqual(payload["intent"], "product_search")
        self.assertEqual(payload["session"]["missing_fields"], ["budget"])

        follow_up = self.client.post("/api/agent/chat/", {"message": "under $400"}, format="json")
        follow_up_payload = follow_up.json()
        self.assertEqual(follow_up_payload["type"], "product_results")
        self.assertEqual(follow_up_payload["session"]["status"], "results_ready")
        self.assertEqual(follow_up_payload["session"]["collected_data"]["budget"], "400")
        self.assertEqual(len(follow_up_payload["results"]), 3)
        self.assertEqual(follow_up_payload["query"], "cheap Iphone 13 under 400 usd")

    def test_product_session_switches_to_payment_flow(self) -> None:
        self.client.post(
            "/api/agent/chat/",
            {"message": "I want a cheap iPhone 13"},
            format="json",
        )
        response = self.client.post(
            "/api/agent/chat/",
            {"message": f"send $20 to ada {self.valid_address}"},
            format="json",
        )

        payload = response.json()
        self.assertEqual(payload["type"], "payment_confirmation")
        self.assertEqual(payload["payment"]["summary"]["recipient_name"], "Ada")

    def test_product_session_greeting_does_not_return_product_results(self) -> None:
        self.client.post(
            "/api/agent/chat/",
            {"message": "I want a cheap iPhone 13"},
            format="json",
        )
        response = self.client.post("/api/agent/chat/", {"message": "hello"}, format="json")

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_message")
        self.assertNotIn("results", payload)

    def test_product_session_cancel_it_cancels_session(self) -> None:
        self.client.post(
            "/api/agent/chat/",
            {"message": "I want a cheap iPhone 13"},
            format="json",
        )
        response = self.client.post("/api/agent/chat/", {"message": "cancel it"}, format="json")

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_message")
        self.assertIn("cancelled", payload["message"])
        self.assertFalse(
            PendingIntentSession.objects.filter(
                user=self.user,
                status__in=[
                    PendingIntentSession.STATUS_COLLECTING,
                    PendingIntentSession.STATUS_RESULTS_READY,
                ],
            ).exists()
        )

    def test_payment_session_switches_to_product_search(self) -> None:
        self.client.post("/api/agent/chat/", {"message": "send money to Ada"}, format="json")
        response = self.client.post(
            "/api/agent/chat/",
            {"message": "find me cheap shoes"},
            format="json",
        )

        payload = response.json()
        self.assertIn(payload["type"], {"assistant_followup", "product_results"})
        self.assertEqual(payload["intent"], "product_search")

    def test_swap_prompt_returns_swap_preview_without_wallet_address(self) -> None:
        response = self.client.post(
            "/api/agent/chat/",
            {"message": "swap 0.1 xtz to usdc"},
            format="json",
        )

        payload = response.json()
        self.assertEqual(payload["type"], "swap_preview")
        self.assertEqual(payload["intent"], "swap")
        self.assertEqual(payload["swap"]["source_token"], "XTZ")
        self.assertEqual(payload["swap"]["destination_token"], "USDC")
        self.assertNotIn("wallet address", payload["message"].lower())

    def test_swap_prompt_missing_amount_asks_swap_specific_follow_up(self) -> None:
        response = self.client.post(
            "/api/agent/chat/",
            {"message": "Swap XTZ to USDC"},
            format="json",
        )

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_followup")
        self.assertEqual(payload["intent"], "swap")
        self.assertIn("how much", payload["message"].lower())

    @patch("apps.ai_agent.chat_services.GeminiIntentParserService.parse_prompt")
    def test_provider_quota_exhausted_on_unknown_prompt_degrades_gracefully(
        self,
        mock_parse_prompt,
    ) -> None:
        mock_parse_prompt.side_effect = GeminiQuotaExceededError("Gemini quota is exhausted.")

        response = self.client.post(
            "/api/agent/chat/",
            {"message": "tell me something random"},
            format="json",
        )

        payload = response.json()
        self.assertEqual(payload["type"], "assistant_message")
        self.assertIn("help you", payload["message"])

    @patch("apps.ai_agent.chat_services.GeminiIntentParserService.parse_prompt")
    def test_provider_parse_can_still_upgrade_unknown_to_payment(self, mock_parse_prompt) -> None:
        mock_parse_prompt.return_value = ParsedIntentSchema(
            intent="payment",
            confidence=0.91,
            missing_fields=[],
            payload={
                "recipient_name": "Ada",
                "amount": "25",
                "recipient_address": self.valid_address,
            },
        )

        response = self.client.post(
            "/api/agent/chat/",
            {"message": "please sort out 25 dollars for Ada"},
            format="json",
        )

        self.assertEqual(response.json()["type"], "payment_confirmation")

    def test_invalid_session_state_is_repaired(self) -> None:
        self.client.post("/api/agent/chat/", {"message": "send money to Ada"}, format="json")
        session = PendingIntentSession.objects.get(user=self.user)
        session.status = PendingIntentSession.STATUS_READY_FOR_CONFIRMATION
        session.save(update_fields=["status", "updated_at"])

        response = self.client.post(
            "/api/agent/chat/",
            {"message": f"send $20 to Ada {self.valid_address}"},
            format="json",
        )

        self.assertEqual(response.json()["type"], "payment_confirmation")
        self.assertEqual(
            PendingIntentSession.objects.filter(
                user=self.user,
                status__in=[
                    PendingIntentSession.STATUS_COLLECTING,
                    PendingIntentSession.STATUS_READY_FOR_CONFIRMATION,
                ],
            ).count(),
            1,
        )
