from __future__ import annotations

import json
import logging
import re
from urllib.parse import quote_plus
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from typing import Any, Literal

from django.db import DatabaseError, transaction
from django.utils import timezone
from google.genai import types
from pydantic import ValidationError

from apps.blockchain.services import get_payment_gas_summary
from apps.payments.models import PaymentIntent
from apps.payments.services import (
    PaymentIntentCreationError,
    build_payment_intent_from_parsed_intent,
    create_gift_card_request,
    create_savings_position,
)
from apps.wallets.services import (
    ensure_default_balance_snapshots,
    ensure_wallet_profile,
    refresh_wallet_balances,
)

from .models import ParsedIntent, PendingIntentSession, PromptRequest
from .schemas import (
    ParsedIntentSchema,
    PaymentConversationExtractionSchema,
    PaymentConversationReplySchema,
)
from .services import (
    GeminiAdviceService,
    GeminiConfigurationError,
    GeminiIntentParserService,
    GeminiQuotaExceededError,
    GeminiRequestError,
    GeminiResponseValidationError,
    GeminiTimeoutError,
)

logger = logging.getLogger(__name__)

IntentKind = Literal[
    "greeting",
    "small_talk",
    "payment",
    "product_search",
    "swap",
    "investment_advice",
    "portfolio_analysis",
    "save",
    "gift_card",
    "unknown",
]

DEFAULT_GREETING_MESSAGE = (
    "Hey - I can help you send money, swap assets, fund your wallet, or find products. "
    "What would you like to do?"
)
DEFAULT_SYSTEM_ERROR_MESSAGE = (
    "ChapChap hit a backend issue while preparing that request. Please try again shortly."
)

PAYMENT_EXTRACTION_SYSTEM_INSTRUCTION = """
You help complete a pending payment request for a crypto wallet assistant.
Return JSON only.
Never include markdown.
Never explain your reasoning.

Allowed extracted_fields keys:
- recipient_name
- recipient_address
- amount
- currency
- token_symbol
- schedule_in_minutes
- note

Rules:
- Do not invent wallet addresses.
- Only include fields the user clearly provided.
- If the user uses dollars or "$", set currency to USD.
- If the user clearly refers to dollars and no asset is specified, set token_symbol to USDC.
- schedule_in_minutes must be a non-negative integer when provided.
- Keep assistant_message short and helpful.

Return an object with exactly these keys:
- extracted_fields
- assistant_message
""".strip()

PAYMENT_REPLY_SYSTEM_INSTRUCTION = """
You are the assistant voice for a crypto wallet flow.
Return JSON only.
Never include markdown.
Never explain your reasoning.

Return an object with exactly this key:
- message
""".strip()

GREETING_PATTERNS = (
    "hello",
    "hi",
    "hey",
    "good morning",
    "good afternoon",
    "good evening",
    "help",
    "what can you do",
)
APPRECIATION_PATTERNS = ("thanks", "thank you", "thx")
PAYMENT_CONTINUE_PATTERNS = ("confirm", "continue", "proceed", "send it", "yes", "okay send")
PAYMENT_CANCEL_PATTERNS = ("cancel", "stop", "nevermind", "never mind")
PAYMENT_CHANGE_AMOUNT_PATTERNS = ("change amount", "edit amount")
PAYMENT_CHANGE_RECIPIENT_PATTERNS = ("change recipient", "edit recipient")
SHORT_CONTINUE_PATTERNS = ("yes", "ok", "okay")
SHORT_NEGATIVE_PATTERNS = ("no", "nope")
SHORT_CANCEL_PATTERNS = ("cancel", "cancel it", "stop", "never mind", "nevermind")
PAYMENT_KEYWORDS = ("send", "transfer", "pay", "payment")
PRODUCT_KEYWORDS = (
    "buy",
    "find",
    "cheap",
    "cheapest",
    "under",
    "below",
    "where can i get",
    "iphone",
    "airpods",
    "food",
    "hungry",
    "groceries",
    "restaurant",
)
SAVE_KEYWORDS = ("save", "lock", "earn", "deposit for yield", "yield")
GIFT_CARD_KEYWORDS = ("gift card", "airtime", "top up", "topup", "bitrefill", "amazon card", "netflix card")
STOP_WORDS = {
    "buy",
    "find",
    "me",
    "cheap",
    "cheapest",
    "under",
    "below",
    "for",
    "a",
    "an",
    "the",
    "where",
    "can",
    "i",
    "get",
    "want",
    "need",
    "to",
    "used",
    "new",
    "refurbished",
}
INVALID_RECIPIENT_WORDS = {
    "send",
    "pay",
    "transfer",
    "money",
    "payment",
    "wallet",
    "crypto",
    "fund",
    "me",
    "now",
    "later",
    "soon",
    "tomorrow",
    "today",
    "please",
    "in",
    "on",
}
PRODUCT_SESSION_HINTS = {"under", "below", "less than", "budget", "$", "used", "new", "refurbished"}
SWAP_KEYWORDS = ("swap", "convert", "exchange", "trade")
INVESTMENT_KEYWORDS = ("invest", "investment", "grow my money")
PORTFOLIO_KEYWORDS = ("portfolio", "analyze my portfolio", "suggest investment")
SUPPORTED_SWAP_TOKENS = {"XTZ", "USDC", "TEZ"}


@dataclass
class ChatResponseData:
    payload: dict[str, Any]


@dataclass
class ProductSearchContext:
    query: str | None
    budget: str | None
    currency: str | None
    condition: str | None
    cheap_preference: bool
    food_intent: bool


@dataclass
class SwapContext:
    source_token: str | None
    destination_token: str | None
    amount: str | None


@dataclass
class SavingsContext:
    asset: str | None
    amount: str | None


@dataclass
class GiftCardContext:
    brand: str | None
    query: str


class AgentChatError(Exception):
    def __init__(self, error_code: str, message: str, *, cause: Exception | None = None) -> None:
        super().__init__(message)
        self.error_code = error_code
        self.message = message
        self.cause = cause


class AgentConversationService:
    def handle_message(self, *, user: Any, message: str) -> ChatResponseData:
        prompt_request = PromptRequest.objects.create(
            user=user,
            raw_prompt=message,
            source_type=PromptRequest.SOURCE_TEXT,
        )
        active_session = self._get_active_session(user)
        new_intent = _classify_message(message)

        logger.info(
            "agent.chat.start user_id=%s active_session=%s active_intent=%s new_intent=%s message=%r",
            getattr(user, "id", None),
            getattr(active_session, "id", None),
            getattr(active_session, "intent_type", None),
            new_intent,
            message,
        )

        try:
            if active_session and _is_cancel_message(message):
                logger.info(
                    "agent.chat.session_override user_id=%s session_id=%s action=cancelled_by_user",
                    getattr(user, "id", None),
                    active_session.id,
                )
                self._cancel_session(active_session)
                response = ChatResponseData(
                    payload=_assistant_message_payload("No problem - I cancelled that request.")
                )
            elif active_session and self._should_override_session(active_session, message, new_intent):
                logger.info(
                    "agent.chat.session_override user_id=%s session_id=%s active_intent=%s new_intent=%s action=override",
                    getattr(user, "id", None),
                    active_session.id,
                    active_session.intent_type,
                    new_intent,
                )
                self._cancel_session(active_session)
                response = self._handle_new_message(
                    prompt_request=prompt_request,
                    classifier=new_intent,
                )
            elif active_session:
                logger.info(
                    "agent.chat.session_reuse user_id=%s session_id=%s active_intent=%s new_intent=%s action=reuse",
                    getattr(user, "id", None),
                    active_session.id,
                    active_session.intent_type,
                    new_intent,
                )
                if active_session.intent_type == PendingIntentSession.INTENT_PAYMENT:
                    response = self._handle_existing_payment_session(
                        prompt_request=prompt_request,
                        session=active_session,
                    )
                elif active_session.intent_type == PendingIntentSession.INTENT_SWAP:
                    response = self._handle_existing_swap_session(
                        prompt_request=prompt_request,
                        session=active_session,
                    )
                else:
                    response = self._handle_existing_product_session(
                        prompt_request=prompt_request,
                        session=active_session,
                    )
            else:
                response = self._handle_new_message(
                    prompt_request=prompt_request,
                    classifier=new_intent,
                )

            self._mark_prompt_parsed(prompt_request)
            logger.info(
                "agent.chat.success user_id=%s prompt_request_id=%s response_type=%s",
                getattr(user, "id", None),
                prompt_request.id,
                response.payload.get("type"),
            )
            return response
        except AgentChatError as exc:
            prompt_request.status = PromptRequest.STATUS_FAILED
            prompt_request.save(update_fields=["status", "updated_at"])
            logger.exception(
                "agent.chat.failure user_id=%s prompt_request_id=%s error_code=%s",
                getattr(user, "id", None),
                prompt_request.id,
                exc.error_code,
            )
            return ChatResponseData(
                payload=_build_system_error_payload(exc.error_code, exc.message)
            )
        except Exception:
            prompt_request.status = PromptRequest.STATUS_FAILED
            prompt_request.save(update_fields=["status", "updated_at"])
            logger.exception(
                "agent.chat.unexpected_failure user_id=%s prompt_request_id=%s",
                getattr(user, "id", None),
                prompt_request.id,
            )
            return ChatResponseData(
                payload=_build_system_error_payload("internal_error", DEFAULT_SYSTEM_ERROR_MESSAGE)
            )

    def _handle_new_message(
        self,
        *,
        prompt_request: PromptRequest,
        classifier: IntentKind | None = None,
    ) -> ChatResponseData:
        message = prompt_request.raw_prompt
        classifier = classifier or _classify_message(message)
        logger.info(
            "agent.chat.classifier user_id=%s prompt_request_id=%s classifier=%s",
            prompt_request.user_id,
            prompt_request.id,
            classifier,
        )

        if classifier == "greeting":
            return ChatResponseData(payload=_assistant_message_payload(_choose_greeting(message)))

        if classifier == "small_talk":
            return ChatResponseData(payload=_assistant_message_payload(_choose_small_talk_reply(message)))

        if classifier == "payment":
            return self._handle_payment_message(
                prompt_request=prompt_request,
                payment_data=_extract_payment_fields(message),
                used_provider=False,
            )

        if classifier == "swap":
            return self._handle_swap_message(
                prompt_request=prompt_request,
                swap_context=_extract_swap_fields(message),
            )

        if classifier == "product_search":
            return self._handle_product_message(
                prompt_request=prompt_request,
                product_context=_extract_product_search(message),
            )

        if classifier == "investment_advice":
            return self._handle_investment_advice_message(prompt_request=prompt_request)

        if classifier == "portfolio_analysis":
            return self._handle_portfolio_analysis_message(prompt_request=prompt_request)

        if classifier == "save":
            return self._handle_savings_message(
                prompt_request=prompt_request,
                savings_context=_extract_savings_fields(message),
            )

        if classifier == "gift_card":
            return self._handle_gift_card_message(
                prompt_request=prompt_request,
                gift_context=_extract_gift_card_context(message),
            )

        provider_result = self._try_provider_parse(message)
        if provider_result is None:
            fallback_product = _extract_product_search(message)
            if fallback_product.query or fallback_product.food_intent:
                return self._handle_product_message(
                    prompt_request=prompt_request,
                    product_context=fallback_product,
                )
            return ChatResponseData(payload=_assistant_message_payload(DEFAULT_GREETING_MESSAGE))

        parsed = provider_result
        if parsed.intent == "payment":
            return self._handle_payment_message(
                prompt_request=prompt_request,
                payment_data=_normalize_payment_payload(parsed.payload),
                used_provider=True,
            )
        if parsed.intent == "product_search":
            fallback_product = _extract_product_search(message)
            if not fallback_product.query:
                payload = parsed.payload if isinstance(parsed.payload, dict) else {}
                fallback_product = ProductSearchContext(
                    query=_clean_optional(payload.get("query")),
                    budget=_clean_optional(payload.get("budget")),
                    currency=_clean_optional(payload.get("currency")),
                    condition=None,
                    cheap_preference=False,
                    food_intent=False,
                )
            return self._handle_product_message(
                prompt_request=prompt_request,
                product_context=fallback_product,
            )
        if parsed.intent == "swap":
            return self._handle_swap_message(
                prompt_request=prompt_request,
                swap_context=_extract_swap_fields(message),
            )

        return ChatResponseData(payload=_assistant_message_payload(DEFAULT_GREETING_MESSAGE))

    def _handle_payment_message(
        self,
        *,
        prompt_request: PromptRequest,
        payment_data: dict[str, Any],
        used_provider: bool,
    ) -> ChatResponseData:
        missing_fields = _determine_payment_missing_fields(payment_data)
        parsed_intent = ParsedIntent.objects.create(
            prompt_request=prompt_request,
            intent_type="payment",
            payload_json=payment_data,
            confidence=0.98 if not used_provider else 0.9,
            missing_fields=missing_fields,
        )

        try:
            session = self._replace_active_session(
                user=prompt_request.user,
                prompt_request=prompt_request,
                intent_type=PendingIntentSession.INTENT_PAYMENT,
                collected_data=payment_data,
                missing_fields=missing_fields,
                status=(
                    PendingIntentSession.STATUS_COLLECTING
                    if missing_fields
                    else PendingIntentSession.STATUS_READY_FOR_CONFIRMATION
                ),
            )
        except DatabaseError as exc:
            raise AgentChatError("session_merge_failed", DEFAULT_SYSTEM_ERROR_MESSAGE, cause=exc) from exc

        if missing_fields:
            return ChatResponseData(
                payload={
                    "type": "assistant_followup",
                    "message": _build_missing_field_message(missing_fields, payment_data),
                    "intent": "payment",
                    "session": _serialize_session(session),
                }
            )

        payment_intent = self._build_payment_intent_or_error(parsed_intent)
        return ChatResponseData(
            payload={
                "type": "payment_confirmation",
                "message": _build_ready_for_confirmation_message(payment_data),
                "intent": "payment",
                "session": _serialize_session(session),
                "payment": _serialize_payment_intent(payment_intent),
            }
        )

    def _handle_product_message(
        self,
        *,
        prompt_request: PromptRequest,
        product_context: ProductSearchContext,
    ) -> ChatResponseData:
        collected_data = _product_context_to_payload(product_context)
        missing_fields = _determine_product_missing_fields(product_context)
        status = (
            PendingIntentSession.STATUS_COLLECTING
            if missing_fields
            else PendingIntentSession.STATUS_RESULTS_READY
        )

        try:
            session = self._replace_active_session(
                user=prompt_request.user,
                prompt_request=prompt_request,
                intent_type=PendingIntentSession.INTENT_PRODUCT_SEARCH,
                collected_data=collected_data,
                missing_fields=missing_fields,
                status=status,
            )
        except DatabaseError as exc:
            raise AgentChatError("session_merge_failed", DEFAULT_SYSTEM_ERROR_MESSAGE, cause=exc) from exc

        if missing_fields:
            return ChatResponseData(
                payload={
                    "type": "assistant_followup",
                    "message": _build_product_followup_message(product_context),
                    "intent": "product_search",
                    "session": _serialize_session(session),
                }
            )

        results = _build_product_search_results(product_context)
        logger.info(
            "agent.chat.product_results user_id=%s session_id=%s source=deterministic_links collected=%s",
            prompt_request.user_id,
            session.id,
            collected_data,
        )
        return ChatResponseData(
            payload={
                "type": "product_results",
                "message": "Here are some places you can find this product.",
                "intent": "product_search",
                "query": _build_product_search_query(product_context),
                "session": _serialize_session(session),
                "results": results,
            }
        )

    def _handle_swap_message(
        self,
        *,
        prompt_request: PromptRequest,
        swap_context: SwapContext,
    ) -> ChatResponseData:
        missing_fields = _determine_swap_missing_fields(swap_context)
        payload = _swap_context_to_payload(swap_context)
        status = (
            PendingIntentSession.STATUS_COLLECTING
            if missing_fields
            else PendingIntentSession.STATUS_READY_FOR_CONFIRMATION
        )

        try:
            session = self._replace_active_session(
                user=prompt_request.user,
                prompt_request=prompt_request,
                intent_type=PendingIntentSession.INTENT_SWAP,
                collected_data=payload,
                missing_fields=missing_fields,
                status=status,
            )
        except DatabaseError as exc:
            raise AgentChatError("session_merge_failed", DEFAULT_SYSTEM_ERROR_MESSAGE, cause=exc) from exc

        if missing_fields:
            return ChatResponseData(
                payload={
                    "type": "assistant_followup",
                    "message": _build_swap_followup_message(swap_context, missing_fields),
                    "intent": "swap",
                    "session": _serialize_session(session),
                }
            )

        return ChatResponseData(
            payload={
                "type": "swap_preview",
                "message": _build_swap_ready_message(swap_context),
                "intent": "swap",
                "session": _serialize_session(session),
                "swap": _serialize_swap_preview(swap_context),
            }
        )

    def _handle_investment_advice_message(
        self,
        *,
        prompt_request: PromptRequest,
    ) -> ChatResponseData:
        advice = self._generate_investment_advice(
            prompt=prompt_request.raw_prompt,
            portfolio_context=None,
        )
        return ChatResponseData(
            payload={
                "type": "assistant_message",
                "message": advice,
                "intent": "investment_advice",
            }
        )

    def _handle_portfolio_analysis_message(
        self,
        *,
        prompt_request: PromptRequest,
    ) -> ChatResponseData:
        wallet = ensure_wallet_profile(prompt_request.user)
        balances = refresh_wallet_balances(wallet)
        if not balances:
            balances = ensure_default_balance_snapshots(wallet)

        portfolio_context = _build_portfolio_context(wallet.address, balances)
        advice = self._generate_investment_advice(
            prompt=prompt_request.raw_prompt,
            portfolio_context=portfolio_context,
        )
        return ChatResponseData(
            payload={
                "type": "assistant_message",
                "message": advice,
                "intent": "portfolio_analysis",
            }
        )

    def _handle_savings_message(
        self,
        *,
        prompt_request: PromptRequest,
        savings_context: SavingsContext,
    ) -> ChatResponseData:
        if not savings_context.amount or not savings_context.asset:
            return ChatResponseData(
                payload={
                    "type": "assistant_followup",
                    "message": "How much would you like to save, and which asset should I use?",
                    "intent": "save",
                }
            )

        amount = _parse_decimal(savings_context.amount)
        if amount is None:
            return ChatResponseData(
                payload={
                    "type": "assistant_followup",
                    "message": "I need a valid amount before I can prepare a savings position.",
                    "intent": "save",
                }
            )

        position = create_savings_position(
            user=prompt_request.user,
            asset=savings_context.asset,
            amount=amount,
        )
        return ChatResponseData(
            payload={
                "type": "savings_result",
                "message": (
                    f"I've placed {position.amount} {position.asset} into {position.strategy_name}. "
                    "This is demo mode for now."
                ),
                "intent": "save",
                "savings": {
                    "id": position.id,
                    "asset": position.asset,
                    "amount": f"{position.amount}",
                    "strategy_name": position.strategy_name,
                    "strategy_type": position.strategy_type,
                    "apy_estimate": f"{position.apy_estimate}",
                    "mode": position.mode,
                    "status": position.status,
                },
            }
        )

    def _handle_gift_card_message(
        self,
        *,
        prompt_request: PromptRequest,
        gift_context: GiftCardContext,
    ) -> ChatResponseData:
        brand = gift_context.brand or "Gift card"
        results = _build_gift_card_results(gift_context)
        create_gift_card_request(
            user=prompt_request.user,
            brand=brand,
            query=gift_context.query,
            result_count=len(results),
        )
        return ChatResponseData(
            payload={
                "type": "giftcard_results",
                "message": "Here are a few gift card options you can continue with.",
                "intent": "gift_card",
                "results": results,
            }
        )

    def _handle_existing_swap_session(
        self,
        *,
        prompt_request: PromptRequest,
        session: PendingIntentSession,
    ) -> ChatResponseData:
        message = prompt_request.raw_prompt
        classifier = _classify_message(message)
        if classifier == "greeting":
            return ChatResponseData(payload=_assistant_message_payload(_choose_greeting(message)))
        if classifier == "small_talk":
            return ChatResponseData(payload=_assistant_message_payload(_choose_small_talk_reply(message)))

        current = _payload_to_swap_context(session.collected_data_json)
        updates = _extract_swap_follow_up_fields(message, current)
        merged = _merge_swap_context(current, updates)
        missing_fields = _determine_swap_missing_fields(merged)

        logger.info(
            "agent.chat.swap_merge.result user_id=%s session_id=%s before=%s after=%s missing=%s",
            prompt_request.user_id,
            session.id,
            session.collected_data_json,
            _swap_context_to_payload(merged),
            missing_fields,
        )

        session.collected_data_json = _swap_context_to_payload(merged)
        session.missing_fields_json = missing_fields
        session.last_prompt_request = prompt_request
        session.status = (
            PendingIntentSession.STATUS_COLLECTING
            if missing_fields
            else PendingIntentSession.STATUS_READY_FOR_CONFIRMATION
        )
        session.save(
            update_fields=[
                "collected_data_json",
                "missing_fields_json",
                "last_prompt_request",
                "status",
                "updated_at",
            ]
        )

        if missing_fields:
            return ChatResponseData(
                payload={
                    "type": "assistant_followup",
                    "message": _build_swap_followup_message(merged, missing_fields),
                    "intent": "swap",
                    "session": _serialize_session(session),
                }
            )

        return ChatResponseData(
            payload={
                "type": "swap_preview",
                "message": _build_swap_ready_message(merged),
                "intent": "swap",
                "session": _serialize_session(session),
                "swap": _serialize_swap_preview(merged),
            }
        )

    def _handle_existing_payment_session(
        self,
        *,
        prompt_request: PromptRequest,
        session: PendingIntentSession,
    ) -> ChatResponseData:
        message = prompt_request.raw_prompt
        classifier = _classify_message(message)
        if session.status == PendingIntentSession.STATUS_READY_FOR_CONFIRMATION:
            return self._handle_ready_payment_session(
                prompt_request=prompt_request,
                session=session,
            )
        if classifier == "greeting":
            return ChatResponseData(payload=_assistant_message_payload(_choose_greeting(message)))
        if classifier == "small_talk":
            return ChatResponseData(payload=_assistant_message_payload(_choose_small_talk_reply(message)))
        if self._looks_like_new_payment_request(message):
            self._cancel_session(session)
            return self._handle_new_message(prompt_request=prompt_request, classifier=classifier)

        before = dict(session.collected_data_json)
        deterministic_updates = _extract_payment_follow_up_fields(
            message,
            before,
            session.missing_fields_json,
        )

        logger.info(
            "agent.chat.merge.start user_id=%s session_id=%s before=%s deterministic_updates=%s",
            prompt_request.user_id,
            session.id,
            before,
            deterministic_updates,
        )

        used_provider = False
        if not deterministic_updates and _should_try_provider_for_follow_up(message):
            provider_extraction = self._try_provider_follow_up_extraction(
                latest_user_message=message,
                collected_data=before,
                missing_fields=session.missing_fields_json,
            )
            if provider_extraction is not None:
                deterministic_updates = provider_extraction
                used_provider = True

        merged_data = _merge_payment_payloads(before, deterministic_updates)
        missing_fields = _determine_payment_missing_fields(merged_data)
        repeated_missing = merged_data == before and missing_fields == session.missing_fields_json

        logger.info(
            "agent.chat.merge.result user_id=%s session_id=%s after=%s missing=%s repeated=%s",
            prompt_request.user_id,
            session.id,
            merged_data,
            missing_fields,
            repeated_missing,
        )

        try:
            parsed_intent = ParsedIntent.objects.create(
                prompt_request=prompt_request,
                intent_type="payment",
                payload_json=merged_data,
                confidence=0.97 if not used_provider else 0.88,
                missing_fields=missing_fields,
            )
            session.collected_data_json = merged_data
            session.missing_fields_json = missing_fields
            session.last_prompt_request = prompt_request
            session.status = (
                PendingIntentSession.STATUS_COLLECTING
                if missing_fields
                else PendingIntentSession.STATUS_READY_FOR_CONFIRMATION
            )
            session.save(
                update_fields=[
                    "status",
                    "collected_data_json",
                    "missing_fields_json",
                    "last_prompt_request",
                    "updated_at",
                ]
            )
        except DatabaseError as exc:
            raise AgentChatError("session_merge_failed", DEFAULT_SYSTEM_ERROR_MESSAGE, cause=exc) from exc

        if missing_fields:
            return ChatResponseData(
                payload={
                    "type": "assistant_followup",
                    "message": (
                        _build_repeated_missing_field_message(missing_fields, merged_data)
                        if repeated_missing
                        else _build_missing_field_message(missing_fields, merged_data)
                    ),
                    "intent": "payment",
                    "session": _serialize_session(session),
                }
            )

        payment_intent = self._build_payment_intent_or_error(parsed_intent)
        return ChatResponseData(
            payload={
                "type": "payment_confirmation",
                "message": _build_ready_for_confirmation_message(merged_data),
                "intent": "payment",
                "session": _serialize_session(session),
                "payment": _serialize_payment_intent(payment_intent),
            }
        )

    def _handle_existing_product_session(
        self,
        *,
        prompt_request: PromptRequest,
        session: PendingIntentSession,
    ) -> ChatResponseData:
        message = prompt_request.raw_prompt
        classifier = _classify_message(message)
        if session.status == PendingIntentSession.STATUS_RESULTS_READY:
            if classifier in {"greeting", "small_talk"}:
                return ChatResponseData(
                    payload=_assistant_message_payload(
                        "Hi - your product search is still ready if you'd like to continue."
                    )
                )
            if classifier == "product_search":
                self._cancel_session(session)
                return self._handle_new_message(prompt_request=prompt_request, classifier=classifier)
            if _matches_phrase_set(message.lower().strip(), SHORT_CONTINUE_PATTERNS):
                return ChatResponseData(
                    payload={
                        "type": "product_results",
                        "message": "Here are some places you can find this product.",
                        "intent": "product_search",
                        "query": _build_product_search_query(
                            _payload_to_product_context(session.collected_data_json)
                        ),
                        "session": _serialize_session(session),
                        "results": _build_product_search_results(
                            _payload_to_product_context(session.collected_data_json)
                        ),
                    }
                )
            return ChatResponseData(
                payload=_assistant_message_payload(
                    "Your latest product search is still ready if you'd like to continue or start something else."
                )
            )

        current = _payload_to_product_context(session.collected_data_json)
        if classifier == "greeting":
            return ChatResponseData(payload=_assistant_message_payload(_choose_greeting(message)))
        if classifier == "small_talk":
            return ChatResponseData(payload=_assistant_message_payload(_choose_small_talk_reply(message)))
        updates = _extract_product_follow_up_fields(message, current)
        merged = _merge_product_context(current, updates)
        missing_fields = _determine_product_missing_fields(merged)
        session.collected_data_json = _product_context_to_payload(merged)
        session.missing_fields_json = missing_fields
        session.last_prompt_request = prompt_request
        session.status = (
            PendingIntentSession.STATUS_COLLECTING
            if missing_fields
            else PendingIntentSession.STATUS_RESULTS_READY
        )
        session.save(
            update_fields=[
                "collected_data_json",
                "missing_fields_json",
                "last_prompt_request",
                "status",
                "updated_at",
            ]
        )

        if missing_fields:
            return ChatResponseData(
                payload={
                    "type": "assistant_followup",
                    "message": _build_product_followup_message(merged),
                    "intent": "product_search",
                    "session": _serialize_session(session),
                }
            )

        return ChatResponseData(
            payload={
                "type": "product_results",
                "message": "Here are some places you can find this product.",
                "intent": "product_search",
                "query": _build_product_search_query(merged),
                "session": _serialize_session(session),
                "results": _build_product_search_results(merged),
            }
        )

    def _respond_with_existing_ready_session(
        self,
        *,
        prompt_request: PromptRequest,
        session: PendingIntentSession,
    ) -> ChatResponseData:
        previous_prompt_request = session.last_prompt_request
        try:
            session.last_prompt_request = prompt_request
            session.save(update_fields=["last_prompt_request", "updated_at"])
        except DatabaseError as exc:
            raise AgentChatError("session_merge_failed", DEFAULT_SYSTEM_ERROR_MESSAGE, cause=exc) from exc

        parsed_intent = getattr(previous_prompt_request, "parsed_intent", None) if previous_prompt_request else None
        payment_intent = getattr(parsed_intent, "payment_intent", None) if parsed_intent else None
        if payment_intent is None:
            parsed_intent = ParsedIntent.objects.create(
                prompt_request=prompt_request,
                intent_type="payment",
                payload_json=session.collected_data_json,
                confidence=0.9,
                missing_fields=[],
            )
            payment_intent = self._build_payment_intent_or_error(parsed_intent)

        return ChatResponseData(
            payload={
                "type": "payment_confirmation",
                "message": _build_ready_for_confirmation_message(session.collected_data_json),
                "intent": "payment",
                "session": _serialize_session(session),
                "payment": _serialize_payment_intent(payment_intent),
            }
        )

    def _handle_ready_payment_session(
        self,
        *,
        prompt_request: PromptRequest,
        session: PendingIntentSession,
    ) -> ChatResponseData:
        raw_message = prompt_request.raw_prompt.strip()
        message = raw_message.lower()
        classifier = _classify_message(raw_message)
        if any(phrase in message for phrase in PAYMENT_CONTINUE_PATTERNS):
            return ChatResponseData(
                payload={
                    "type": "assistant_message",
                    "message": "Your payment is still prepared. Use the confirmation step when you're ready to submit the onchain transfer.",
                    "intent": "payment",
                    "session": _serialize_session(session),
                }
            )
        if _matches_phrase_set(message, SHORT_NEGATIVE_PATTERNS):
            return ChatResponseData(
                payload=_assistant_message_payload(
                    "Alright - I won't continue with that payment. You can change it, cancel it, or start something new."
                )
            )
        if any(phrase in message for phrase in PAYMENT_CANCEL_PATTERNS):
            self._cancel_session(session)
            return ChatResponseData(
                payload=_assistant_message_payload("No problem - I cancelled that prepared payment.")
            )
        if any(phrase in message for phrase in PAYMENT_CHANGE_AMOUNT_PATTERNS):
            session.status = PendingIntentSession.STATUS_COLLECTING
            session.missing_fields_json = ["amount"]
            session.save(update_fields=["status", "missing_fields_json", "updated_at"])
            return ChatResponseData(
                payload={
                    "type": "assistant_followup",
                    "message": _pick_variant(
                        [
                            f"How much would you like to send to {session.collected_data_json.get('recipient_name', 'them')}?",
                            f"What amount should I prepare for {session.collected_data_json.get('recipient_name', 'them')}?",
                        ],
                        prompt_request.id,
                    ),
                    "intent": "payment",
                    "session": _serialize_session(session),
                }
            )
        if any(phrase in message for phrase in PAYMENT_CHANGE_RECIPIENT_PATTERNS):
            session.status = PendingIntentSession.STATUS_COLLECTING
            session.missing_fields_json = ["recipient_name"]
            session.save(update_fields=["status", "missing_fields_json", "updated_at"])
            return ChatResponseData(
                payload={
                    "type": "assistant_followup",
                    "message": "Who would you like to send this to instead?",
                    "intent": "payment",
                    "session": _serialize_session(session),
                }
            )
        if classifier == "small_talk":
            return ChatResponseData(
                payload=_assistant_message_payload(
                    "You're welcome. Your payment is still prepared if you'd like to continue."
                )
            )
        if classifier == "greeting":
            return ChatResponseData(
                payload=_assistant_message_payload(
                    "Hi - your prepared payment is still here if you'd like to continue."
                )
            )
        if self._looks_like_new_payment_request(raw_message) or classifier == "product_search":
            self._cancel_session(session)
            return self._handle_new_message(prompt_request=prompt_request)

        return ChatResponseData(
            payload=_assistant_message_payload(
                "Your payment is still prepared if you'd like to continue, change it, or cancel it."
            )
        )

    def _try_provider_parse(self, message: str) -> ParsedIntentSchema | None:
        try:
            return GeminiIntentParserService().parse_prompt(message)
        except GeminiQuotaExceededError:
            logger.warning("agent.chat.provider_quota_exhausted during parse")
            return None
        except GeminiTimeoutError:
            logger.warning("agent.chat.provider_timeout during parse")
            return None
        except GeminiRequestError:
            logger.warning("agent.chat.provider_failure during parse")
            return None
        except GeminiResponseValidationError:
            logger.warning("agent.chat.invalid_ai_response during parse")
            return None
        except GeminiConfigurationError:
            logger.warning("agent.chat.provider_failure due to configuration")
            return None

    def _try_provider_follow_up_extraction(
        self,
        *,
        latest_user_message: str,
        collected_data: dict[str, Any],
        missing_fields: list[str],
    ) -> dict[str, Any] | None:
        try:
            extraction = GeminiPaymentConversationService().extract_payment_update(
                latest_user_message=latest_user_message,
                collected_data=collected_data,
                missing_fields=missing_fields,
            )
        except GeminiQuotaExceededError:
            logger.warning("agent.chat.provider_quota_exhausted during extraction")
            return None
        except GeminiTimeoutError:
            logger.warning("agent.chat.provider_timeout during extraction")
            return None
        except GeminiRequestError:
            logger.warning("agent.chat.provider_failure during extraction")
            return None
        except GeminiResponseValidationError:
            logger.warning("agent.chat.invalid_ai_response during extraction")
            return None
        return _normalize_payment_payload(extraction.extracted_fields)

    def _replace_active_session(
        self,
        *,
        user: Any,
        prompt_request: PromptRequest,
        intent_type: str,
        collected_data: dict[str, Any],
        missing_fields: list[str],
        status: str,
    ) -> PendingIntentSession:
        with transaction.atomic():
            PendingIntentSession.objects.filter(
                user=user,
                intent_type__in=[
                    PendingIntentSession.INTENT_PAYMENT,
                    PendingIntentSession.INTENT_PRODUCT_SEARCH,
                    PendingIntentSession.INTENT_SWAP,
                ],
                status__in=[
                    PendingIntentSession.STATUS_COLLECTING,
                    PendingIntentSession.STATUS_READY_FOR_CONFIRMATION,
                    PendingIntentSession.STATUS_RESULTS_READY,
                ],
            ).update(status=PendingIntentSession.STATUS_CANCELLED)

            return PendingIntentSession.objects.create(
                user=user,
                intent_type=intent_type,
                status=status,
                collected_data_json=collected_data,
                missing_fields_json=missing_fields,
                last_prompt_request=prompt_request,
            )

    def _build_payment_intent_or_error(self, parsed_intent: ParsedIntent) -> PaymentIntent:
        logger.info(
            "agent.chat.payment_intent.create_attempt user_id=%s parsed_intent_id=%s payload=%s",
            parsed_intent.prompt_request.user_id,
            parsed_intent.id,
            parsed_intent.payload_json,
        )
        try:
            return build_payment_intent_from_parsed_intent(parsed_intent)
        except PaymentIntentCreationError as exc:
            raise AgentChatError("payment_intent_failed", DEFAULT_SYSTEM_ERROR_MESSAGE, cause=exc) from exc

    def _get_active_session(self, user: Any) -> PendingIntentSession | None:
        sessions = list(
            PendingIntentSession.objects.filter(
                user=user,
                status__in=[
                    PendingIntentSession.STATUS_COLLECTING,
                    PendingIntentSession.STATUS_READY_FOR_CONFIRMATION,
                    PendingIntentSession.STATUS_RESULTS_READY,
                ],
            ).order_by("-updated_at")
        )
        if len(sessions) > 1:
            keeper = sessions[0]
            stale_ids = [session.id for session in sessions[1:]]
            PendingIntentSession.objects.filter(id__in=stale_ids).update(
                status=PendingIntentSession.STATUS_CANCELLED
            )
            logger.warning(
                "agent.chat.invalid_session_state user_id=%s kept_session=%s cancelled=%s",
                getattr(user, "id", None),
                keeper.id,
                stale_ids,
            )
            return keeper
        return sessions[0] if sessions else None

    def _mark_prompt_parsed(self, prompt_request: PromptRequest) -> None:
        prompt_request.status = PromptRequest.STATUS_PARSED
        prompt_request.save(update_fields=["status", "updated_at"])

    def _cancel_session(self, session: PendingIntentSession) -> None:
        session.status = PendingIntentSession.STATUS_CANCELLED
        session.save(update_fields=["status", "updated_at"])

    def _looks_like_new_payment_request(self, message: str) -> bool:
        lowered = message.lower().strip()
        return any(lowered.startswith(keyword) for keyword in PAYMENT_KEYWORDS)

    def _should_override_session(
        self,
        session: PendingIntentSession,
        message: str,
        new_intent: IntentKind,
    ) -> bool:
        if session.intent_type == PendingIntentSession.INTENT_PAYMENT:
            if new_intent == "payment":
                return False
            if new_intent == "unknown":
                if session.status == PendingIntentSession.STATUS_COLLECTING:
                    return False
                return not self._is_payment_continuation(message, session)
            return True

        if session.intent_type == PendingIntentSession.INTENT_PRODUCT_SEARCH:
            if new_intent == "product_search":
                return False
            if new_intent == "unknown":
                return not self._is_product_continuation(message, session)
            return True

        if session.intent_type == PendingIntentSession.INTENT_SWAP:
            if new_intent == "swap":
                return False
            if new_intent == "unknown":
                return not self._is_swap_continuation(message, session)
            return True

        return False

    def _is_payment_continuation(self, message: str, session: PendingIntentSession) -> bool:
        lowered = message.lower().strip()
        if _matches_phrase_set(lowered, SHORT_CONTINUE_PATTERNS + SHORT_NEGATIVE_PATTERNS):
            return True
        return bool(_extract_payment_follow_up_fields(message, session.collected_data_json, session.missing_fields_json))

    def _is_product_continuation(self, message: str, session: PendingIntentSession) -> bool:
        lowered = message.lower().strip()
        if _matches_phrase_set(lowered, SHORT_CONTINUE_PATTERNS):
            return session.status == PendingIntentSession.STATUS_RESULTS_READY
        if session.status == PendingIntentSession.STATUS_COLLECTING and _looks_like_product_follow_up(message):
            return True
        return False

    def _is_swap_continuation(self, message: str, session: PendingIntentSession) -> bool:
        if session.status == PendingIntentSession.STATUS_READY_FOR_CONFIRMATION:
            return _matches_phrase_set(message.lower().strip(), SHORT_CONTINUE_PATTERNS)
        current = _payload_to_swap_context(session.collected_data_json)
        updates = _extract_swap_follow_up_fields(message, current)
        return any(value is not None for value in updates.__dict__.values())

    def _generate_investment_advice(
        self,
        *,
        prompt: str,
        portfolio_context: str | None,
    ) -> str:
        try:
            service = GeminiAdviceService()
            return service.generate_response(prompt, context=portfolio_context)
        except GeminiConfigurationError:
            logger.warning("agent.chat.advice_provider_unconfigured")
        except GeminiQuotaExceededError:
            logger.warning("agent.chat.advice_provider_quota_exhausted")
        except GeminiTimeoutError:
            logger.warning("agent.chat.advice_provider_timeout")
        except GeminiRequestError:
            logger.warning("agent.chat.advice_provider_failure")
        except GeminiResponseValidationError:
            logger.warning("agent.chat.advice_invalid_ai_response")
        return _build_fallback_investment_advice(prompt=prompt, portfolio_context=portfolio_context)


class GeminiPaymentConversationService:
    def __init__(self) -> None:
        parser_service = GeminiIntentParserService()
        self.client = parser_service.client
        self.model = parser_service.model

    def extract_payment_update(
        self,
        *,
        latest_user_message: str,
        collected_data: dict[str, Any],
        missing_fields: list[str],
    ) -> PaymentConversationExtractionSchema:
        raw = self._generate_json(
            system_instruction=PAYMENT_EXTRACTION_SYSTEM_INSTRUCTION,
            prompt=json.dumps(
                {
                    "latest_user_message": latest_user_message,
                    "collected_data": collected_data,
                    "missing_fields": missing_fields,
                }
            ),
        )
        try:
            return PaymentConversationExtractionSchema.model_validate(raw)
        except ValidationError as exc:
            raise GeminiResponseValidationError("Gemini returned malformed structured output.") from exc

    def generate_reply(
        self,
        *,
        latest_user_message: str,
        collected_data: dict[str, Any],
        missing_fields: list[str],
        ready_for_confirmation: bool,
    ) -> str:
        raw = self._generate_json(
            system_instruction=PAYMENT_REPLY_SYSTEM_INSTRUCTION,
            prompt=json.dumps(
                {
                    "latest_user_message": latest_user_message,
                    "collected_data": collected_data,
                    "missing_fields": missing_fields,
                    "ready_for_confirmation": ready_for_confirmation,
                }
            ),
        )
        try:
            return PaymentConversationReplySchema.model_validate(raw).message
        except ValidationError as exc:
            raise GeminiResponseValidationError("Gemini returned malformed structured output.") from exc

    def _generate_json(self, *, system_instruction: str, prompt: str) -> dict[str, Any]:
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                    system_instruction=system_instruction,
                ),
            )
        except TimeoutError as exc:
            raise GeminiTimeoutError("Gemini request timed out.") from exc
        except Exception as exc:  # noqa: BLE001
            status_code = getattr(exc, "status_code", None)
            text = str(exc)
            if status_code == 429 or "RESOURCE_EXHAUSTED" in text or "quota" in text.lower():
                raise GeminiQuotaExceededError("Gemini quota is exhausted.") from exc
            raise GeminiRequestError("Gemini request failed.") from exc

        return _load_json_object(getattr(response, "text", ""))


def _classify_message(message: str) -> IntentKind:
    lowered = message.lower().strip()
    if _matches_phrase_set(lowered, GREETING_PATTERNS):
        return "greeting"
    if _matches_phrase_set(lowered, APPRECIATION_PATTERNS):
        return "small_talk"
    if any(keyword in lowered for keyword in GIFT_CARD_KEYWORDS):
        return "gift_card"
    if any(keyword in lowered for keyword in SAVE_KEYWORDS):
        return "save"
    if any(keyword in lowered for keyword in PORTFOLIO_KEYWORDS):
        return "portfolio_analysis"
    if any(keyword in lowered for keyword in INVESTMENT_KEYWORDS):
        return "investment_advice"
    if any(keyword in lowered for keyword in SWAP_KEYWORDS):
        return "swap"
    if any(keyword in lowered for keyword in PRODUCT_KEYWORDS):
        return "product_search"
    if any(keyword in lowered for keyword in PAYMENT_KEYWORDS):
        return "payment"
    if _contains_amount(message) and ("to " in lowered or any(keyword in lowered for keyword in ("usd", "$", "money"))):
        return "payment"
    return "unknown"


def _contains_amount(message: str) -> bool:
    return bool(re.search(r"(?:\$|\b)\d+(?:\.\d{1,2})?\s*(?:usd|dollars?)?\b", message, re.IGNORECASE))


def _choose_greeting(message: str) -> str:
    lowered = message.lower()
    if "help" in lowered or "what can you do" in lowered:
        return "Hi - I can help you make payments or find products at good prices."
    return _pick_variant(
        [
            DEFAULT_GREETING_MESSAGE,
            "Hi - I can help with payments or product search. What do you need?",
        ],
        sum(ord(char) for char in message),
    )


def _choose_small_talk_reply(message: str) -> str:
    lowered = message.lower()
    if "thank" in lowered or "thx" in lowered:
        return _pick_variant(
            [
                "You're welcome.",
                "No problem - what would you like to do next?",
            ],
            len(message),
        )
    return "Sure - what would you like to do next?"


def _extract_payment_fields(message: str) -> dict[str, Any]:
    extracted: dict[str, Any] = {}
    lowered = message.lower()
    message_without_address = message

    address_match = re.search(r"\b0x[a-fA-F0-9]{40}\b", message)
    if address_match:
        extracted["recipient_address"] = address_match.group(0)
        message_without_address = message.replace(address_match.group(0), " ")

    amount_match = re.search(
        r"(?<![a-fA-F0-9x])(?:\$|usd\s*)?(\d+(?:\.\d{1,2})?)\s*(?:usd|dollars?)?\b",
        message_without_address,
        flags=re.IGNORECASE,
    )
    if amount_match:
        extracted["amount"] = amount_match.group(1)
        if "$" in message_without_address or "usd" in lowered or "dollar" in lowered:
            extracted["currency"] = "USD"
            extracted["token_symbol"] = "USDC"

    recipient_name = _extract_recipient_name(message_without_address)
    if recipient_name:
        extracted["recipient_name"] = recipient_name

    schedule = _extract_schedule_details(message)
    if schedule["schedule_in_minutes"] is not None:
        extracted["schedule_in_minutes"] = schedule["schedule_in_minutes"]
    if schedule["scheduled_for"] is not None:
        extracted["scheduled_for"] = schedule["scheduled_for"]

    token_match = re.search(r"\b(USDC|XTZ|TEZ)\b", message, flags=re.IGNORECASE)
    if token_match:
        token = token_match.group(1).upper()
        extracted["token_symbol"] = token
        if token == "USDC":
            extracted.setdefault("currency", "USD")

    return _normalize_payment_payload(extracted)


def _extract_payment_follow_up_fields(
    message: str,
    current: dict[str, Any],
    missing_fields: list[str],
) -> dict[str, Any]:
    extracted = _extract_payment_fields(message)
    if extracted.get("recipient_name", "").lower() in INVALID_RECIPIENT_WORDS:
        extracted.pop("recipient_name", None)
    if extracted:
        return extracted

    if (
        "recipient_name" in missing_fields
        and re.match(r"^[A-Za-z][A-Za-z'\- ]{1,30}$", message.strip())
        and message.strip().lower() not in INVALID_RECIPIENT_WORDS
    ):
        return {"recipient_name": message.strip().title()}

    if "amount" in missing_fields:
        amount_match = re.match(r"^\s*\$?(\d+(?:\.\d{1,2})?)\s*(?:usd|dollars?)?\s*$", message, re.IGNORECASE)
        if amount_match:
            return {"amount": amount_match.group(1), "currency": "USD", "token_symbol": "USDC"}

    return {}


def _extract_schedule_in_minutes(message: str) -> int | None:
    quick_match = re.search(r"\b(?:in\s+)?(\d+)\s*(?:mins?|minutes?)\b", message, re.IGNORECASE)
    if quick_match:
        return int(quick_match.group(1))
    if "tomorrow morning" in message.lower():
        return 24 * 60
    return None


def _extract_schedule_details(message: str) -> dict[str, Any]:
    lowered = message.lower()
    now = timezone.now()
    quick_match = re.search(r"\bin\s+(\d+)\s*(seconds?|mins?|minutes?|hours?)\b", lowered, re.IGNORECASE)
    if quick_match:
        value = int(quick_match.group(1))
        unit = quick_match.group(2).lower()
        seconds = value
        minutes = value
        if unit.startswith("hour"):
            seconds = value * 3600
            minutes = value * 60
        elif unit.startswith("sec"):
            seconds = value
            minutes = max(1, value // 60) if value >= 60 else 0
        else:
            seconds = value * 60
            minutes = value
        scheduled_for = now + timedelta(seconds=seconds)
        return {"schedule_in_minutes": minutes, "scheduled_for": scheduled_for.isoformat()}

    date_match = re.search(r"\bon\s+(\d{1,2})\s+([A-Za-z]+)\b", message, re.IGNORECASE)
    if date_match:
        day = int(date_match.group(1))
        month_name = date_match.group(2).strip().lower()
        month_map = {
            "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
            "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
            "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10,
            "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
        }
        month = month_map.get(month_name)
        if month:
            year = now.year
            try:
                scheduled = now.replace(year=year, month=month, day=day, hour=9, minute=0, second=0, microsecond=0)
            except ValueError:
                return {"schedule_in_minutes": None, "scheduled_for": None}
            if scheduled <= now:
                try:
                    scheduled = scheduled.replace(year=year + 1)
                except ValueError:
                    return {"schedule_in_minutes": None, "scheduled_for": None}
            delta_minutes = int((scheduled - now).total_seconds() // 60)
            return {"schedule_in_minutes": max(delta_minutes, 0), "scheduled_for": scheduled.isoformat()}

    schedule_minutes = _extract_schedule_in_minutes(message)
    if schedule_minutes is not None:
        scheduled_for = now + timedelta(minutes=schedule_minutes)
        return {"schedule_in_minutes": schedule_minutes, "scheduled_for": scheduled_for.isoformat()}
    return {"schedule_in_minutes": None, "scheduled_for": None}


def _extract_product_search(message: str) -> ProductSearchContext:
    lowered = message.lower()
    budget_match = re.search(
        r"(?:under|below|less than)\s*\$?(\d+(?:\.\d{1,2})?)|\$(\d+(?:\.\d{1,2})?)",
        message,
        re.IGNORECASE,
    )
    budget = None
    if budget_match:
        budget = budget_match.group(1) or budget_match.group(2)

    condition = None
    for candidate in ("new", "used", "refurbished"):
        if candidate in lowered:
            condition = candidate
            break

    food_intent = any(keyword in lowered for keyword in ("hungry", "food", "restaurant", "groceries"))
    product_signal = food_intent or any(keyword in lowered for keyword in PRODUCT_KEYWORDS)

    query = None
    if product_signal and not food_intent:
        clean = re.sub(r"\b(under|below|less than)\s*\$?\d+(?:\.\d{1,2})?\b", "", lowered)
        clean = re.sub(r"\$\d+(?:\.\d{1,2})?", "", clean)
        tokens = [token for token in re.findall(r"[a-z0-9']+", clean) if token not in STOP_WORDS]
        query = " ".join(tokens[:4]).title() if tokens else None

    return ProductSearchContext(
        query=query,
        budget=budget,
        currency="USD" if budget else None,
        condition=condition,
        cheap_preference=any(word in lowered for word in ("cheap", "cheapest", "deal")),
        food_intent=food_intent,
    )


def _build_product_response(context: ProductSearchContext) -> dict[str, Any]:
    raise RuntimeError("Use _handle_product_message for product responses.")


def _load_json_object(text: str) -> dict[str, Any]:
    if not text.strip():
        raise GeminiResponseValidationError("Gemini returned an empty response.")
    try:
        raw = json.loads(text)
    except json.JSONDecodeError as exc:
        raise GeminiResponseValidationError("Gemini returned non-JSON output.") from exc
    if not isinstance(raw, dict):
        raise GeminiResponseValidationError("Gemini returned malformed structured output.")
    return raw


def _normalize_payment_payload(payload: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}

    recipient_name = _clean_optional(payload.get("recipient_name"))
    if recipient_name:
        normalized["recipient_name"] = recipient_name

    recipient_address = _clean_optional(payload.get("recipient_address"))
    if recipient_address:
        normalized["recipient_address"] = recipient_address

    amount = _clean_optional(payload.get("amount"))
    if amount and _parse_decimal(amount):
        normalized["amount"] = amount

    currency = _clean_optional(payload.get("currency"))
    if currency:
        normalized["currency"] = currency.upper()

    token_symbol = _clean_optional(payload.get("token_symbol"))
    if token_symbol:
        normalized["token_symbol"] = token_symbol.upper()

    note = _clean_optional(payload.get("note"))
    if note:
        normalized["note"] = note

    schedule_in_minutes = _parse_schedule(payload.get("schedule_in_minutes"))
    if schedule_in_minutes is not None:
        normalized["schedule_in_minutes"] = schedule_in_minutes
    scheduled_for = _clean_optional(payload.get("scheduled_for"))
    if scheduled_for:
        normalized["scheduled_for"] = scheduled_for

    if normalized.get("currency") == "USD" and not normalized.get("token_symbol"):
        normalized["token_symbol"] = "USDC"
    return normalized


def _merge_payment_payloads(current: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    merged = dict(current)
    merged.update(_normalize_payment_payload(updates))
    if merged.get("currency") == "USD" and not merged.get("token_symbol"):
        merged["token_symbol"] = "USDC"
    return merged


def _determine_payment_missing_fields(payload: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    if not _clean_optional(payload.get("amount")):
        missing.append("amount")
    if not _clean_optional(payload.get("recipient_name")) and not _clean_optional(payload.get("recipient_address")):
        missing.append("recipient_name")
    if not _clean_optional(payload.get("recipient_address")):
        missing.append("recipient_address")
    return missing


def _serialize_session(session: PendingIntentSession) -> dict[str, Any]:
    return {
        "id": session.id,
        "status": session.status,
        "collected_data": session.collected_data_json,
        "missing_fields": session.missing_fields_json,
    }


def _serialize_payment_intent(payment_intent: PaymentIntent) -> dict[str, Any]:
    gas_summary = get_payment_gas_summary(token_symbol=payment_intent.token_symbol)
    return {
        "payment_intent_id": payment_intent.id,
        "summary": {
            "amount": f"{payment_intent.amount:.2f}",
            "currency": payment_intent.currency,
            "token_symbol": payment_intent.token_symbol,
            "recipient_name": payment_intent.recipient_name,
            "recipient_address": payment_intent.recipient_address,
            "network": gas_summary["network"],
            "estimated_gas_xtz": gas_summary["estimated_gas_xtz"],
            "note": payment_intent.note,
            "schedule_in_minutes": payment_intent.schedule_in_minutes,
            "scheduled_for": payment_intent.scheduled_for.isoformat() if payment_intent.scheduled_for else None,
            "explorer_base_url": gas_summary["explorer_base_url"],
        },
    }


def _build_system_error_payload(error_code: str, message: str) -> dict[str, Any]:
    return {"type": "system_error", "message": message, "error_code": error_code}


def _assistant_message_payload(message: str) -> dict[str, Any]:
    return {"type": "assistant_message", "message": message}


def _matches_phrase_set(message: str, phrases: tuple[str, ...]) -> bool:
    compact = re.sub(r"\s+", " ", message.strip())
    return compact in phrases


def _pick_variant(options: list[str], seed: int) -> str:
    return options[seed % len(options)]


def _extract_recipient_name(message: str) -> str | None:
    patterns = [
        r"\bto\s+([A-Za-z][A-Za-z' -]{0,30})$",
        r"\bto\s+([A-Za-z][A-Za-z' -]{0,30})(?:\b|$)",
        r"\bpay\s+([A-Za-z][A-Za-z' -]{0,30})\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, message, flags=re.IGNORECASE)
        if not match:
            continue
        candidate = " ".join(match.group(1).strip().split())
        first_word = candidate.split()[0].lower()
        if first_word in INVALID_RECIPIENT_WORDS:
            continue
        return candidate.title()

    stripped = message.strip()
    if re.match(r"^(?:to\s+)?[A-Za-z][A-Za-z' -]{1,30}$", stripped):
        candidate = re.sub(r"^to\s+", "", stripped, flags=re.IGNORECASE).strip()
        first_word = candidate.split()[0].lower()
        if first_word not in INVALID_RECIPIENT_WORDS:
            return candidate.title()
    return None


def _product_context_to_payload(context: ProductSearchContext) -> dict[str, Any]:
    return {
        "query": context.query,
        "budget": context.budget,
        "currency": context.currency,
        "condition": context.condition,
        "category": "food" if context.food_intent else None,
        "cheap_preference": context.cheap_preference,
    }


def _payload_to_product_context(payload: dict[str, Any]) -> ProductSearchContext:
    return ProductSearchContext(
        query=_clean_optional(payload.get("query")),
        budget=_clean_optional(payload.get("budget")),
        currency=_clean_optional(payload.get("currency")),
        condition=_clean_optional(payload.get("condition")),
        cheap_preference=bool(payload.get("cheap_preference")),
        food_intent=payload.get("category") == "food",
    )


def _determine_product_missing_fields(context: ProductSearchContext) -> list[str]:
    if context.food_intent and not context.query:
        return ["category"]
    if not context.query:
        return ["query"]
    if context.cheap_preference and not context.budget:
        return ["budget"]
    return []


def _build_product_followup_message(context: ProductSearchContext) -> str:
    if context.food_intent and not context.query:
        return "I can help with that. Do you want food delivery options, groceries, or restaurant deals?"
    if context.query and not context.budget:
        return _pick_variant(
            [
                f"Sure - what's your budget for the {context.query}?",
                f"What price range should I stay within for the {context.query}?",
            ],
            len(context.query),
        )
    return "What kind of product are you looking for?"


def _extract_product_follow_up_fields(message: str, current: ProductSearchContext) -> ProductSearchContext:
    lowered = message.lower().strip()
    budget_match = re.search(r"(?:under|below|less than)\s*\$?(\d+(?:\.\d{1,2})?)|\$(\d+(?:\.\d{1,2})?)", message, re.IGNORECASE)
    budget = current.budget
    currency = current.currency
    if budget_match:
        budget = budget_match.group(1) or budget_match.group(2)
        currency = "USD"

    query = current.query
    if current.food_intent and any(word in lowered for word in ("delivery", "groceries", "restaurant")):
        query = {"delivery": "Food Delivery", "groceries": "Groceries", "restaurant": "Restaurant Deals"}[
            next(word for word in ("delivery", "groceries", "restaurant") if word in lowered)
        ]
    elif not query and re.match(r"^[A-Za-z][A-Za-z0-9' -]{2,40}$", message.strip()):
        query = message.strip().title()

    condition = current.condition
    for candidate in ("new", "used", "refurbished"):
        if candidate in lowered:
            condition = candidate

    return ProductSearchContext(
        query=query,
        budget=budget,
        currency=currency,
        condition=condition,
        cheap_preference=current.cheap_preference or any(word in lowered for word in ("cheap", "cheapest", "deal")),
        food_intent=current.food_intent,
    )


def _merge_product_context(current: ProductSearchContext, updates: ProductSearchContext) -> ProductSearchContext:
    return ProductSearchContext(
        query=updates.query or current.query,
        budget=updates.budget or current.budget,
        currency=updates.currency or current.currency,
        condition=updates.condition or current.condition,
        cheap_preference=updates.cheap_preference or current.cheap_preference,
        food_intent=updates.food_intent or current.food_intent,
    )


def _build_product_search_query(context: ProductSearchContext) -> str:
    if context.food_intent and not context.query:
        return "food deals"

    parts: list[str] = []
    if context.cheap_preference:
        parts.append("cheap")
    if context.condition:
        parts.append(context.condition)
    if context.query:
        parts.append(context.query)
    if context.budget:
        parts.extend(["under", context.budget])
    if context.currency and context.budget:
        parts.append(context.currency.lower())

    query = " ".join(part.strip() for part in parts if part and part.strip())
    return query or (context.query or "product")


def _build_product_search_results(context: ProductSearchContext) -> list[dict[str, str]]:
    query = _build_product_search_query(context)
    encoded_query = quote_plus(query)
    return [
        {
            "title": "Amazon",
            "merchant_name": "Amazon",
            "price": "",
            "currency": "",
            "image_url": "",
            "product_url": f"https://www.amazon.com/s?k={encoded_query}",
            "tag": "Global marketplace",
        },
        {
            "title": "Jumia",
            "merchant_name": "Jumia Nigeria",
            "price": "",
            "currency": "",
            "image_url": "",
            "product_url": f"https://www.jumia.com.ng/catalog/?q={encoded_query}",
            "tag": "Nigeria pick",
        },
        {
            "title": "AliExpress",
            "merchant_name": "AliExpress",
            "price": "",
            "currency": "",
            "image_url": "",
            "product_url": f"https://www.aliexpress.com/wholesale?SearchText={encoded_query}",
            "tag": "Budget marketplace",
        },
    ]


def _extract_swap_fields(message: str) -> SwapContext:
    lowered = message.lower()
    amount_match = re.search(r"(?<![a-fA-F0-9x])(\d+(?:\.\d{1,8})?)", message)
    amount = amount_match.group(1) if amount_match else None

    token_matches = [
        _normalize_swap_token(match)
        for match in re.findall(r"\b(xtz|tez|usdc)\b", lowered, flags=re.IGNORECASE)
    ]
    token_matches = [token for token in token_matches if token]

    source_token = token_matches[0] if token_matches else None
    destination_token = token_matches[1] if len(token_matches) > 1 else None

    pair_match = re.search(
        r"\b(?:swap|convert|exchange|trade)\s+(?:\d+(?:\.\d{1,8})\s+)?([a-z]{2,10})\s+(?:to|for)\s+([a-z]{2,10})\b",
        lowered,
        flags=re.IGNORECASE,
    )
    if pair_match:
        source_token = _normalize_swap_token(pair_match.group(1)) or source_token
        destination_token = _normalize_swap_token(pair_match.group(2)) or destination_token

    return SwapContext(
        source_token=source_token,
        destination_token=destination_token,
        amount=amount,
    )


def _extract_swap_follow_up_fields(message: str, current: SwapContext) -> SwapContext:
    extracted = _extract_swap_fields(message)
    if any(value is not None for value in extracted.__dict__.values()):
        return extracted

    compact = message.strip()
    if current.amount is None:
        amount_match = re.match(r"^\$?(\d+(?:\.\d{1,8})?)$", compact)
        if amount_match:
            return SwapContext(
                source_token=None,
                destination_token=None,
                amount=amount_match.group(1),
            )

    token = _normalize_swap_token(compact)
    if token:
        if current.source_token is None:
            return SwapContext(source_token=token, destination_token=None, amount=None)
        if current.destination_token is None:
            return SwapContext(source_token=None, destination_token=token, amount=None)

    return SwapContext(source_token=None, destination_token=None, amount=None)


def _merge_swap_context(current: SwapContext, updates: SwapContext) -> SwapContext:
    return SwapContext(
        source_token=updates.source_token or current.source_token,
        destination_token=updates.destination_token or current.destination_token,
        amount=updates.amount or current.amount,
    )


def _swap_context_to_payload(context: SwapContext) -> dict[str, Any]:
    return {
        "source_token": context.source_token,
        "destination_token": context.destination_token,
        "amount": context.amount,
    }


def _payload_to_swap_context(payload: dict[str, Any]) -> SwapContext:
    return SwapContext(
        source_token=_normalize_swap_token(_clean_optional(payload.get("source_token"))),
        destination_token=_normalize_swap_token(_clean_optional(payload.get("destination_token"))),
        amount=_clean_optional(payload.get("amount")),
    )


def _determine_swap_missing_fields(context: SwapContext) -> list[str]:
    missing: list[str] = []
    if not context.amount:
        missing.append("amount")
    if not context.source_token:
        missing.append("source_token")
    if not context.destination_token:
        missing.append("destination_token")
    return missing


def _build_swap_followup_message(context: SwapContext, missing_fields: list[str]) -> str:
    if "amount" in missing_fields and context.source_token and context.destination_token:
        return f"How much {context.source_token} would you like to swap to {context.destination_token}?"
    if "source_token" in missing_fields and context.destination_token:
        return f"Which asset would you like to swap into {context.destination_token}?"
    if "destination_token" in missing_fields and context.source_token:
        return f"Which asset would you like to receive for your {context.source_token} swap?"
    if "amount" in missing_fields:
        return "How much would you like to swap?"
    if "source_token" in missing_fields or "destination_token" in missing_fields:
        return "Which assets would you like to swap between?"
    return "I need a bit more information before I can preview that swap."


def _build_swap_ready_message(context: SwapContext) -> str:
    amount = context.amount or "0"
    source_token = context.source_token or "your asset"
    destination_token = context.destination_token or "the destination asset"
    return (
        f"Got it - I've prepared a preview to swap {amount} {source_token} to "
        f"{destination_token}. This is only a preview for now."
    )


def _serialize_swap_preview(context: SwapContext) -> dict[str, str]:
    gas_summary = get_payment_gas_summary(token_symbol="XTZ")
    amount_in = context.amount or "0"
    source_token = context.source_token or "XTZ"
    destination_token = context.destination_token or "USDC"
    estimated_output = amount_in
    if source_token == destination_token:
        estimated_output = amount_in
    return {
        "amount_in": amount_in,
        "source_token": source_token,
        "destination_token": destination_token,
        "estimated_output": estimated_output,
        "network": gas_summary["network"],
        "estimated_fee_xtz": gas_summary["estimated_gas_xtz"],
        "slippage_note": "Execution is not wired yet. Review this preview before any future swap flow.",
    }


def _normalize_swap_token(value: str | None) -> str | None:
    if not value:
        return None
    token = value.strip().upper()
    if token == "TEZ":
        token = "XTZ"
    return token if token in {"XTZ", "USDC"} else None


def _extract_savings_fields(message: str) -> SavingsContext:
    amount_match = re.search(r"(?<![a-fA-F0-9x])(\d+(?:\.\d{1,8})?)", message)
    token_match = re.search(r"\b(XTZ|TEZ|USDC)\b", message, flags=re.IGNORECASE)
    asset = _normalize_swap_token(token_match.group(1)) if token_match else None
    return SavingsContext(
        asset=asset,
        amount=amount_match.group(1) if amount_match else None,
    )


def _extract_gift_card_context(message: str) -> GiftCardContext:
    lowered = message.lower()
    brand = None
    for candidate in ("amazon", "netflix", "airtime", "apple", "google play"):
        if candidate in lowered:
            brand = candidate.title()
            break
    return GiftCardContext(brand=brand, query=message.strip())


def _build_gift_card_results(context: GiftCardContext) -> list[dict[str, str]]:
    brand = context.brand or "Gift Card"
    return [
        {
            "brand": brand,
            "title": f"{brand} Gift Card",
            "denomination": "$10 - $100",
            "country": "Global",
            "availability": "Available now",
            "cta_label": "Continue",
            "mode": "demo",
        },
        {
            "brand": brand,
            "title": f"{brand} Digital Code",
            "denomination": "$20 - $200",
            "country": "Nigeria friendly",
            "availability": "Available now",
            "cta_label": "Continue",
            "mode": "demo",
        },
    ]


def _build_portfolio_context(address: str, balances: list[Any]) -> str:
    lines = [f"Wallet address: {address}"]
    total_usd = Decimal("0")
    for balance in balances:
        symbol = getattr(balance, "asset_symbol", "")
        amount = getattr(balance, "balance", Decimal("0"))
        balance_usd = getattr(balance, "balance_usd", Decimal("0"))
        lines.append(f"- {symbol}: {amount}")
        try:
            total_usd += Decimal(str(balance_usd))
        except (InvalidOperation, TypeError):
            continue
    lines.append(f"Portfolio USD total: {total_usd:.2f}")
    return "\n".join(lines)


def _build_fallback_investment_advice(*, prompt: str, portfolio_context: str | None) -> str:
    lowered = prompt.lower()
    if portfolio_context:
        xtz_match = re.search(r"- XTZ: ([0-9.]+)", portfolio_context)
        usdc_match = re.search(r"- USDC: ([0-9.]+)", portfolio_context)
        xtz_balance = xtz_match.group(1) if xtz_match else "0"
        usdc_balance = usdc_match.group(1) if usdc_match else "0"
        return (
            f"Your wallet currently holds about {xtz_balance} XTZ and {usdc_balance} USDC.\n\n"
            "If most of your value is concentrated in one asset, think about diversification rather than chasing quick gains. "
            "A simple beginner-friendly approach is to keep some stablecoin liquidity for flexibility and only size higher-risk positions conservatively.\n\n"
            "If you want, I can next help you think through a cautious split between long-term holdings, stablecoin reserves, and smaller experimental positions."
        )
    if "invest" in lowered:
        return (
            "A good place to start is with your goals, time horizon, and risk tolerance.\n\n"
            "For beginners, it usually helps to avoid going all-in on one coin. Think about diversification, keeping some liquidity, and sizing risky positions small enough that short-term volatility will not force bad decisions.\n\n"
            "If you want, I can help you turn that into a simple beginner allocation plan."
        )
    return DEFAULT_GREETING_MESSAGE


def _build_missing_field_message(missing_fields: list[str], payload: dict[str, Any]) -> str:
    recipient_name = _clean_optional(payload.get("recipient_name"))
    amount = _clean_optional(payload.get("amount"))
    if "amount" in missing_fields:
        return (
            f"How much would you like to send to {recipient_name}?"
            if recipient_name
            else "How much would you like to send?"
        )
    if "recipient_address" in missing_fields and recipient_name:
        if payload.get("scheduled_for"):
            return f"Please provide {recipient_name}'s wallet address so I can schedule the transfer."
        return f"Please provide {recipient_name}'s wallet address so I can prepare the onchain transfer."
    if "recipient_name" in missing_fields and amount:
        return f"Who would you like to send {amount} to?"
    if "recipient_name" in missing_fields or "recipient_address" in missing_fields:
        return f"Who would you like to send {amount} to?" if amount else "Who would you like to send this to?"
    return "I need a bit more information before I can prepare this."


def _build_repeated_missing_field_message(missing_fields: list[str], payload: dict[str, Any]) -> str:
    recipient_name = _clean_optional(payload.get("recipient_name"))
    if "amount" in missing_fields:
        return (
            f"I still need the amount before I can prepare a payment to {recipient_name}."
            if recipient_name
            else "I still need the amount before I can prepare this payment."
        )
    if "recipient_address" in missing_fields and recipient_name:
        if payload.get("scheduled_for"):
            return f"I still need {recipient_name}'s wallet address before I can schedule the transfer."
        return f"I still need {recipient_name}'s wallet address before I can prepare the onchain transfer."
    if "recipient_name" in missing_fields:
        return "I still need the recipient before I can prepare this payment."
    return "I still need the wallet address before I can prepare this onchain transfer."


def _build_ready_for_confirmation_message(payload: dict[str, Any]) -> str:
    amount = _clean_optional(payload.get("amount")) or "0"
    token_symbol = _clean_optional(payload.get("token_symbol")) or "XTZ"
    recipient = _clean_optional(payload.get("recipient_name")) or _clean_optional(payload.get("recipient_address")) or "your recipient"
    schedule = payload.get("schedule_in_minutes")
    scheduled_for = _clean_optional(payload.get("scheduled_for"))
    if scheduled_for:
        return (
            f"Got it - I've prepared a {amount} {token_symbol} blockchain transfer to {recipient} "
            f"for scheduling at {scheduled_for}."
        )
    if isinstance(schedule, int):
        return (
            f"Got it - I've prepared a {amount} {token_symbol} blockchain transfer to {recipient} "
            f"for your confirmation, scheduled in {schedule} minutes."
        )
    return f"Got it - I've prepared a {amount} {token_symbol} blockchain transfer to {recipient} for your confirmation."


def _should_try_provider_for_follow_up(message: str) -> bool:
    lowered = message.lower().strip()
    if re.match(r"^\$?\d+(?:\.\d{1,2})?\s*(?:usd|dollars?)?$", lowered):
        return False
    if re.match(r"^[a-z][a-z' -]{1,30}$", lowered):
        return False
    return len(lowered.split()) >= 4


def _parse_decimal(value: str) -> Decimal | None:
    try:
        parsed = Decimal(value)
    except (InvalidOperation, TypeError):
        return None
    return parsed if parsed > 0 else None


def _clean_optional(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _parse_schedule(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _is_cancel_message(message: str) -> bool:
    return _matches_phrase_set(message.lower().strip(), SHORT_CANCEL_PATTERNS)


def _looks_like_product_follow_up(message: str) -> bool:
    lowered = message.lower().strip()
    if not lowered:
        return False
    if re.match(r"^(?:under|below|less than)\s*\$?\d+(?:\.\d{1,2})?$", lowered):
        return True
    if re.match(r"^\$?\d+(?:\.\d{1,2})?$", lowered):
        return True
    if lowered in {"used", "new", "refurbished", "delivery", "groceries", "restaurant"}:
        return True
    return any(hint in lowered for hint in PRODUCT_SESSION_HINTS)
