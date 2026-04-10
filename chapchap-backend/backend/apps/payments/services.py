from __future__ import annotations

from datetime import datetime
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
from apps.wallets.services import (
    WalletProvisioningError,
    ensure_default_balance_snapshots,
    ensure_wallet_profile,
    get_wallet_private_key,
    refresh_wallet_balances,
)

from .models import GiftCardRequest, PaymentIntent, SavingsPosition, TransactionHistory


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
    scheduled_for = _parse_datetime(payload.get("scheduled_for"))
    is_scheduled = scheduled_for is not None or (schedule_in_minutes is not None and schedule_in_minutes > 0)
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
            "is_scheduled": is_scheduled,
            "scheduled_for": scheduled_for,
            "execution_status": (
                PaymentIntent.EXECUTION_SCHEDULED if is_scheduled else PaymentIntent.EXECUTION_PENDING
            ),
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
    if payment_intent.is_scheduled != is_scheduled:
        payment_intent.is_scheduled = is_scheduled
        updated_fields.append("is_scheduled")
    if payment_intent.scheduled_for != scheduled_for:
        payment_intent.scheduled_for = scheduled_for
        updated_fields.append("scheduled_for")
    expected_execution_status = (
        PaymentIntent.EXECUTION_SCHEDULED if is_scheduled else PaymentIntent.EXECUTION_PENDING
    )
    if payment_intent.execution_status != expected_execution_status:
        payment_intent.execution_status = expected_execution_status
        updated_fields.append("execution_status")
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

    wallet = ensure_wallet_profile(payment_intent.user)
    try:
        sender_private_key = get_wallet_private_key(wallet)
    except WalletProvisioningError as exc:
        raise PaymentIntentSubmissionError(
            "Your wallet is unavailable right now.",
            code="wallet_unavailable",
        ) from exc

    if payment_intent.is_scheduled and payment_intent.scheduled_for and payment_intent.scheduled_for > timezone.now():
        payment_intent.status = PaymentIntent.STATUS_SCHEDULED
        payment_intent.execution_status = PaymentIntent.EXECUTION_SCHEDULED
        payment_intent.failure_reason = None
        payment_intent.save(
            update_fields=["status", "execution_status", "failure_reason", "updated_at"]
        )
        record_payment_history(payment_intent, status=TransactionHistory.STATUS_SCHEDULED)
        _record_payment_intent_onchain(payment_intent=payment_intent, sender_private_key=sender_private_key)
        return payment_intent

    try:
        submission = EtherlinkService().submit_native_transfer(
            recipient_address=recipient_address,
            amount=amount,
            sender_private_key=sender_private_key,
            sender_address=wallet.address,
        )
    except BlockchainSubmissionError as exc:
        payment_intent.status = PaymentIntent.STATUS_FAILED
        payment_intent.failure_reason = str(exc)
        payment_intent.save(update_fields=["status", "failure_reason", "updated_at"])
        raise PaymentIntentSubmissionError(str(exc), code=exc.code) from exc

    payment_intent.status = PaymentIntent.STATUS_SUBMITTED
    payment_intent.execution_status = PaymentIntent.EXECUTION_SUBMITTED
    payment_intent.tx_hash = submission.tx_hash
    payment_intent.explorer_url = submission.explorer_url
    payment_intent.submitted_at = timezone.now()
    payment_intent.failure_reason = None
    payment_intent.save(
        update_fields=[
            "status",
            "execution_status",
            "tx_hash",
            "explorer_url",
            "submitted_at",
            "failure_reason",
            "updated_at",
        ]
    )
    _record_payment_intent_onchain(payment_intent=payment_intent, sender_private_key=sender_private_key)
    record_payment_history(payment_intent, status=TransactionHistory.STATUS_SUBMITTED)
    return payment_intent


def record_payment_history(payment_intent: PaymentIntent, *, status: str) -> TransactionHistory:
    title = "Scheduled transfer" if status == TransactionHistory.STATUS_SCHEDULED else "Blockchain transfer"
    subtitle = payment_intent.recipient_name or payment_intent.recipient_address or "Recipient"
    history, _ = TransactionHistory.objects.update_or_create(
        payment_intent=payment_intent,
        defaults={
            "user": payment_intent.user,
            "wallet": payment_intent.wallet,
            "transaction_type": TransactionHistory.TYPE_SEND,
            "asset_symbol": payment_intent.token_symbol,
            "amount": payment_intent.amount,
            "network": payment_intent.network,
            "recipient_address": payment_intent.recipient_address,
            "sender_address": payment_intent.wallet.address,
            "tx_hash": payment_intent.tx_hash,
            "explorer_url": payment_intent.explorer_url,
            "status": status,
            "title": title,
            "subtitle": subtitle,
            "metadata_json": {
                "scheduled_for": payment_intent.scheduled_for.isoformat()
                if payment_intent.scheduled_for
                else None,
                "note": payment_intent.note,
            },
        },
    )
    return history


def create_savings_position(
    *,
    user: Any,
    asset: str,
    amount: Decimal,
) -> SavingsPosition:
    wallet = ensure_wallet_profile(user)
    strategy_name = "Demo XTZ Yield Vault" if asset.upper() == "XTZ" else "Demo Stable Yield Pool"
    strategy_type = "demo_vault"
    apy_estimate = Decimal("4.80") if asset.upper() == "XTZ" else Decimal("6.20")
    position = SavingsPosition.objects.create(
        user=user,
        wallet=wallet,
        asset=asset.upper(),
        amount=amount,
        strategy_name=strategy_name,
        strategy_type=strategy_type,
        apy_estimate=apy_estimate,
        mode=SavingsPosition.MODE_DEMO,
        status=SavingsPosition.STATUS_ACTIVE,
    )
    TransactionHistory.objects.create(
        user=user,
        wallet=wallet,
        transaction_type=TransactionHistory.TYPE_SAVE,
        asset_symbol=asset.upper(),
        amount=amount,
        network=settings.BLOCKCHAIN_NETWORK_NAME,
        sender_address=wallet.address,
        status=TransactionHistory.STATUS_CONFIRMED,
        title="Savings position created",
        subtitle=strategy_name,
        metadata_json={
            "strategy_name": strategy_name,
            "strategy_type": strategy_type,
            "apy_estimate": str(apy_estimate),
            "mode": SavingsPosition.MODE_DEMO,
        },
    )
    return position


def create_gift_card_request(
    *,
    user: Any,
    brand: str,
    query: str,
    result_count: int,
    mode: str = GiftCardRequest.MODE_DEMO,
) -> GiftCardRequest:
    wallet = ensure_wallet_profile(user)
    request = GiftCardRequest.objects.create(
        user=user,
        wallet=wallet,
        brand=brand,
        query=query,
        mode=mode,
        status=GiftCardRequest.STATUS_READY,
        result_count=result_count,
    )
    TransactionHistory.objects.create(
        user=user,
        wallet=wallet,
        transaction_type=TransactionHistory.TYPE_GIFTCARD,
        asset_symbol="USD",
        amount=Decimal("0"),
        network=settings.BLOCKCHAIN_NETWORK_NAME,
        sender_address=wallet.address,
        status=TransactionHistory.STATUS_PENDING,
        title=f"{brand} gift card search",
        subtitle="Demo options ready" if mode == GiftCardRequest.MODE_DEMO else "Options ready",
        metadata_json={"query": query, "mode": mode, "result_count": result_count},
    )
    return request


def list_transaction_history(*, user: Any, limit: int | None = None) -> list[TransactionHistory]:
    queryset = TransactionHistory.objects.filter(user=user).select_related("wallet")
    if limit is not None:
        return list(queryset[:limit])
    return list(queryset)


def build_dashboard_balance_payload(*, user: Any) -> dict[str, Any]:
    wallet = ensure_wallet_profile(user)
    balances = refresh_wallet_balances(wallet, force=True)
    if not balances:
        balances = ensure_default_balance_snapshots(wallet)
    return {
        "wallet_address": wallet.address,
        "balances": [
            {
                "asset_symbol": balance.asset_symbol,
                "balance": f"{balance.balance}",
                "balance_usd": f"{balance.balance_usd}",
            }
            for balance in balances
        ],
    }


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


def _parse_datetime(value: Any):
    if value in (None, ""):
        return None
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        if timezone.is_naive(parsed):
            return timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed
    return None


def _clean_optional(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _record_payment_intent_onchain(
    *,
    payment_intent: PaymentIntent,
    sender_private_key: str,
) -> None:
    if not settings.CHAPCHAP_PAYMENT_REGISTRY_ENABLED or not settings.CHAPCHAP_PAYMENT_REGISTRY_ADDRESS:
        return
    if payment_intent.registry_tx_hash:
        return

    recipient_address = _clean_optional(payment_intent.recipient_address)
    amount = _parse_amount(payment_intent.amount)
    if not recipient_address or amount is None:
        return

    scheduled_for_timestamp = 0
    if payment_intent.scheduled_for is not None:
        scheduled_for_timestamp = int(payment_intent.scheduled_for.timestamp())

    try:
        submission = EtherlinkService().record_payment_intent(
            registry_address=settings.CHAPCHAP_PAYMENT_REGISTRY_ADDRESS,
            recipient_address=recipient_address,
            amount=amount,
            token_symbol=payment_intent.token_symbol,
            note=payment_intent.note,
            scheduled_for_timestamp=scheduled_for_timestamp,
            sender_private_key=sender_private_key,
            sender_address=payment_intent.wallet.address,
        )
    except BlockchainSubmissionError:
        return

    payment_intent.registry_tx_hash = submission.tx_hash
    payment_intent.registry_payment_intent_id = submission.registry_payment_intent_id
    payment_intent.registry_contract_address = submission.registry_address
    payment_intent.save(
        update_fields=[
            "registry_tx_hash",
            "registry_payment_intent_id",
            "registry_contract_address",
            "updated_at",
        ]
    )
