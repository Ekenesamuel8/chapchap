from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from django.conf import settings
from django.utils import timezone

from apps.ai_agent.models import ParsedIntent
from apps.blockchain.services import (
    BlockchainSubmissionError,
    EtherlinkService,
    get_native_asset,
)
from apps.wallets.services import ensure_wallet_profile

from .models import PaymentIntent


class PaymentIntentCreationError(Exception):
    """Raised when a draft payment intent cannot be built."""


class PaymentIntentSubmissionError(Exception):
    """Raised when a payment intent cannot be submitted onchain."""

    def __init__(self, message: str, *, code: str = "submission_failed") -> None:
        super().__init__(message)
        self.code = code


def build_payment_intent_from_parsed_intent(parsed_intent: ParsedIntent) -> PaymentIntent:
    if parsed_intent.intent_type != "payment":
        raise PaymentIntentCreationError(
            "Execution is not supported for this intent yet."
        )

    payload = parsed_intent.payload_json
    if not isinstance(payload, dict):
        raise PaymentIntentCreationError("Parsed intent payload is invalid.")

    amount = _parse_amount(payload.get("amount"))
    recipient_name = _clean_optional(payload.get("recipient_name"))
    recipient_address = _clean_optional(payload.get("recipient_address"))

    if amount is None:
        raise PaymentIntentCreationError("Payment amount is missing or invalid.")

    if not recipient_name and not recipient_address:
        raise PaymentIntentCreationError("Recipient name or recipient address is required.")

    schedule_in_minutes = _parse_schedule(payload.get("schedule_in_minutes"))
    wallet = ensure_wallet_profile(parsed_intent.prompt_request.user)
    native_asset = get_native_asset()
    currency = native_asset.symbol
    amount_usd = None

    payment_intent, _ = PaymentIntent.objects.get_or_create(
        parsed_intent=parsed_intent,
        defaults={
            "user": parsed_intent.prompt_request.user,
            "wallet": wallet,
            "recipient_name": recipient_name,
            "recipient_address": recipient_address,
            "token_symbol": native_asset.symbol,
            "token_address": native_asset.contract_address,
            "amount": amount,
            "amount_usd": amount_usd,
            "currency": currency.upper(),
            "network": settings.BLOCKCHAIN_NETWORK_NAME,
            "note": _clean_optional(payload.get("note")),
            "schedule_in_minutes": schedule_in_minutes,
            "status": PaymentIntent.STATUS_AWAITING_CONFIRMATION,
        },
    )
    updated_fields: list[str] = []
    if payment_intent.recipient_name != recipient_name:
        payment_intent.recipient_name = recipient_name
        updated_fields.append("recipient_name")
    if payment_intent.recipient_address != recipient_address:
        payment_intent.recipient_address = recipient_address
        updated_fields.append("recipient_address")
    if payment_intent.amount != amount:
        payment_intent.amount = amount
        updated_fields.append("amount")
    if payment_intent.amount_usd != amount_usd:
        payment_intent.amount_usd = amount_usd
        updated_fields.append("amount_usd")
    if payment_intent.currency != currency.upper():
        payment_intent.currency = currency.upper()
        updated_fields.append("currency")
    if payment_intent.token_symbol != native_asset.symbol:
        payment_intent.token_symbol = native_asset.symbol
        updated_fields.append("token_symbol")
    if payment_intent.token_address != native_asset.contract_address:
        payment_intent.token_address = native_asset.contract_address
        updated_fields.append("token_address")
    if payment_intent.network != settings.BLOCKCHAIN_NETWORK_NAME:
        payment_intent.network = settings.BLOCKCHAIN_NETWORK_NAME
        updated_fields.append("network")
    if payment_intent.note != _clean_optional(payload.get("note")):
        payment_intent.note = _clean_optional(payload.get("note"))
        updated_fields.append("note")
    if payment_intent.schedule_in_minutes != schedule_in_minutes:
        payment_intent.schedule_in_minutes = schedule_in_minutes
        updated_fields.append("schedule_in_minutes")
    if payment_intent.status == PaymentIntent.STATUS_FAILED:
        payment_intent.status = PaymentIntent.STATUS_AWAITING_CONFIRMATION
        updated_fields.append("status")
    if updated_fields:
        payment_intent.save(update_fields=[*updated_fields, "updated_at"])
    return payment_intent


def submit_payment_intent(payment_intent: PaymentIntent) -> PaymentIntent:
    if payment_intent.status == PaymentIntent.STATUS_SUBMITTED and payment_intent.tx_hash:
        return payment_intent

    if payment_intent.status not in {
        PaymentIntent.STATUS_AWAITING_CONFIRMATION,
        PaymentIntent.STATUS_CONFIRMED,
    }:
        raise PaymentIntentSubmissionError(
            "This payment is not ready to submit.",
            code="invalid_payment_status",
        )

    recipient_address = _clean_optional(payment_intent.recipient_address)
    if not recipient_address:
        raise PaymentIntentSubmissionError(
            "Please provide the recipient wallet address before sending onchain.",
            code="missing_recipient_address",
        )

    amount = _parse_amount(payment_intent.amount)
    if amount is None:
        raise PaymentIntentSubmissionError(
            "Payment amount is missing or invalid.",
            code="invalid_amount",
        )

    try:
        submission = EtherlinkService().submit_native_transfer(
            recipient_address=recipient_address,
            amount=amount,
        )
    except BlockchainSubmissionError as exc:
        payment_intent.status = PaymentIntent.STATUS_FAILED
        payment_intent.failure_reason = str(exc)
        payment_intent.save(update_fields=["status", "failure_reason", "updated_at"])
        raise PaymentIntentSubmissionError(str(exc), code=exc.code) from exc

    payment_intent.status = PaymentIntent.STATUS_SUBMITTED
    payment_intent.tx_hash = submission.tx_hash
    payment_intent.explorer_url = submission.explorer_url
    payment_intent.submitted_at = timezone.now()
    payment_intent.failure_reason = None
    payment_intent.save(
        update_fields=[
            "status",
            "tx_hash",
            "explorer_url",
            "submitted_at",
            "failure_reason",
            "updated_at",
        ]
    )
    return payment_intent


def _parse_amount(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    if amount <= 0:
        return None
    return amount.quantize(Decimal("0.01"))


def _parse_schedule(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _clean_optional(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
