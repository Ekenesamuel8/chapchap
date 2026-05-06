from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from google import genai
from google.genai import types

from apps.ai_agent.services import (
    GeminiConfigurationError,
    GeminiQuotaExceededError,
    GeminiRequestError,
    GeminiResponseValidationError,
    GeminiTimeoutError,
)

from .models import ConfidentialAction, ConfidentialAgreementRecord, SavingsPosition

ETH_ADDRESS_RE = re.compile(r"\b0x[a-fA-F0-9]{40}\b")
ETH_AMOUNT_RE = re.compile(r"\b(\d+(?:\.\d{1,8})?)\s*eth\b", re.IGNORECASE)
SAVE_DURATION_RE = re.compile(
    r"\bfor\s+(\d+)\s+(minute|minutes|hour|hours|day|days)\b",
    re.IGNORECASE,
)
FRIDAY_RE = re.compile(r"\bbefore\s+friday\b", re.IGNORECASE)
TOMORROW_RE = re.compile(r"\bbefore\s+tomorrow\b", re.IGNORECASE)
NAME_TOKEN_RE = r"(?:[A-Z][a-zA-Z]{2,}|[A-Z]{2,})(?:\s+(?:[A-Z][a-zA-Z]{2,}|[A-Z]{2,}))?"
TO_NAME_RE = re.compile(
    rf"\bto\s+({NAME_TOKEN_RE})(?=\s+(?:privately|private|confidentially|confidential|publicly|public|normally|normal|0x[a-fA-F0-9]{{40}}|if\b|for\b)|\s*$)",
)
PAY_NAME_RE = re.compile(
    rf"\bpay\s+({NAME_TOKEN_RE})(?=\s+(?:0x[a-fA-F0-9]{{40}}|\d+(?:\.\d{{1,8}})?\s*eth\b|if\b|before\b|for\b|privately|private|confidentially|confidential|publicly|public|normally|normal)|\s*$)",
)
FOR_NAME_RE = re.compile(
    rf"\bfor\s+({NAME_TOKEN_RE})(?=\s+(?:0x[a-fA-F0-9]{{40}}|if\b|before\b)|\s*$)",
)
PAY_IF_RE = re.compile(r"pay\s+(.+?)\s+if\s+(.+)", re.IGNORECASE)
CONFIDENTIAL_TRANSFER_RE = re.compile(
    r"\b(privately|private|confidentially|confidential)\b",
    re.IGNORECASE,
)
PUBLIC_TRANSFER_RE = re.compile(
    r"\b(publicly|public|normally|normal)\b",
    re.IGNORECASE,
)

VERDICT_SYSTEM_INSTRUCTION = """
You review evidence for a confidential agreement.
Return JSON only.
Never include markdown.
Choose exactly one recommendation:
- release
- refund
- dispute

Return an object with exactly these keys:
- recommendation
- confidence
- reasoning
""".strip()


@dataclass
class ParsedConfidentialIntent:
    intent: str
    confidence: float
    missing_fields: list[str]
    payload: dict[str, Any]
    public_summary: str


@dataclass
class VerdictRecommendation:
    recommendation: str
    confidence: float
    reasoning: str


@dataclass
class SavingsWithdrawalPreparation:
    savings: SavingsPosition
    withdrawable_amount: str
    message: str


def parse_and_record_confidential_prompt(*, user: Any, message: str) -> dict[str, Any]:
    parsed = parse_confidential_prompt(message)
    serialized_payload = serialize_payload(parsed.payload)

    if parsed.intent == ConfidentialAction.INTENT_GENERAL_HELP:
        return {
            "action_id": None,
            "intent": parsed.intent,
            "confidence": parsed.confidence,
            "missing_fields": parsed.missing_fields,
            "public_summary": parsed.public_summary,
            "payload": serialized_payload,
        }

    with transaction.atomic():
        initial_status = (
            ConfidentialAction.STATUS_DRAFT
            if parsed.missing_fields
            else ConfidentialAction.STATUS_AWAITING_WALLET
        )
        default_contract_address = (
            settings.ZAMA_CORE_CONTRACT_ADDRESS or None
            if parsed.intent
            in {
                ConfidentialAction.INTENT_CONFIDENTIAL_PAYMENT,
                ConfidentialAction.INTENT_CONFIDENTIAL_SAVINGS,
                ConfidentialAction.INTENT_CONFIDENTIAL_AGREEMENT,
            }
            else None
        )
        action = ConfidentialAction.objects.create(
            user=user,
            intent=parsed.intent,
            status=initial_status,
            public_summary=parsed.public_summary,
            payload_json=serialized_payload,
            contract_address=default_contract_address,
            network=settings.ZAMA_NETWORK_NAME,
        )

        agreement_record_id = None
        savings_position_id = None

        if parsed.intent == ConfidentialAction.INTENT_CONFIDENTIAL_AGREEMENT:
            agreement = ConfidentialAgreementRecord.objects.create(
                action=action,
                user=user,
                recipient_address=parsed.payload.get("recipient_address"),
                metadata_hash=str(parsed.payload.get("metadata_hash") or default_metadata_hash(message)),
                condition_summary=str(parsed.payload.get("condition_summary") or parsed.public_summary),
                deadline=parsed.payload.get("deadline"),
                status=ConfidentialAgreementRecord.STATUS_PENDING,
                tx_hash=None,
            )
            agreement_record_id = agreement.id

        if parsed.intent == ConfidentialAction.INTENT_CONFIDENTIAL_SAVINGS:
            unlock_at = parsed.payload.get("unlock_at")
            savings = SavingsPosition.objects.create(
                action=action,
                user=user,
                asset=str(parsed.payload.get("asset") or "ETH"),
                amount_display=str(parsed.payload.get("amount_display") or ""),
                lock_rule=parsed.payload.get("lock_rule"),
                unlock_at=unlock_at,
                status=SavingsPosition.STATUS_ACTIVE,
            )
            savings_position_id = savings.id

    response = {
        "action_id": action.id,
        "intent": parsed.intent,
        "confidence": parsed.confidence,
        "missing_fields": parsed.missing_fields,
        "public_summary": parsed.public_summary,
        "payload": serialized_payload,
    }
    if agreement_record_id is not None:
        response["agreement_record_id"] = agreement_record_id
    if savings_position_id is not None:
        response["savings_position_id"] = savings_position_id
    return response


def parse_confidential_prompt(message: str) -> ParsedConfidentialIntent:
    lowered = message.strip().lower()

    if "agreement" in lowered or "pay " in lowered and " if " in lowered:
        return _parse_agreement_prompt(message)
    if any(keyword in lowered for keyword in ("save ", "lock ", "vault")):
        return _parse_savings_prompt(message)
    if any(keyword in lowered for keyword in ("send ", "transfer ", "pay ")) and " if " not in lowered:
        return _parse_payment_prompt(message)
    if "proof" in lowered or "evidence" in lowered:
        return ParsedConfidentialIntent(
            intent=ConfidentialAction.INTENT_PROOF_SUBMISSION,
            confidence=0.86,
            missing_fields=[],
            payload={"proof_text": message.strip()},
            public_summary="Proof submitted for confidential review.",
        )

    return ParsedConfidentialIntent(
        intent=ConfidentialAction.INTENT_GENERAL_HELP,
        confidence=0.7,
        missing_fields=[],
        payload={"message": message.strip()},
        public_summary="General help request for ChapChap Confidential.",
    )


def list_confidential_history(*, user: Any) -> list[ConfidentialAction]:
    return list(
        ConfidentialAction.objects.filter(user=user)
        .exclude(intent=ConfidentialAction.INTENT_GENERAL_HELP)
        .order_by("-created_at")
    )


def list_savings_positions(*, user: Any) -> list[SavingsPosition]:
    now = timezone.now()
    updated_ids: list[int] = []
    savings_positions = list(
        SavingsPosition.objects.filter(user=user).order_by("-created_at")
    )
    for savings in savings_positions:
        if (
            savings.status == SavingsPosition.STATUS_ACTIVE
            and savings.unlock_at is not None
            and savings.unlock_at <= now
        ):
            savings.status = SavingsPosition.STATUS_WITHDRAWABLE
            savings.save(update_fields=["status", "updated_at"])
            updated_ids.append(savings.id)
    if updated_ids:
        savings_positions = list(
            SavingsPosition.objects.filter(user=user).order_by("-created_at")
        )
    return savings_positions


def record_confidential_tx(
    *,
    action: ConfidentialAction,
    tx_hash: str,
    status: str,
    contract_address: str | None,
    intent: str | None = None,
) -> ConfidentialAction:
    action.tx_hash = tx_hash
    action.status = status
    if intent:
        action.intent = intent
    if contract_address is not None or intent == ConfidentialAction.INTENT_PUBLIC_PAYMENT:
        action.contract_address = contract_address
    update_fields = ["tx_hash", "status", "contract_address", "updated_at"]
    if intent:
        update_fields.append("intent")
    action.save(update_fields=update_fields)

    if hasattr(action, "agreement_record"):
        agreement = action.agreement_record
        agreement.tx_hash = tx_hash
        agreement.save(update_fields=["tx_hash", "updated_at"])

    if hasattr(action, "savings_position"):
        savings = action.savings_position
        savings.tx_hash = tx_hash
        if status in {
            ConfidentialAction.STATUS_SUBMITTED,
            ConfidentialAction.STATUS_CONFIRMED,
        }:
            savings.status = SavingsPosition.STATUS_ACTIVE
            savings.save(update_fields=["tx_hash", "status", "updated_at"])
        elif status == ConfidentialAction.STATUS_FAILED:
            savings.status = SavingsPosition.STATUS_FAILED
            savings.save(update_fields=["tx_hash", "status", "updated_at"])
        else:
            savings.save(update_fields=["tx_hash", "updated_at"])

    return action


def prepare_savings_withdrawal(*, savings: SavingsPosition) -> SavingsWithdrawalPreparation:
    now = timezone.now()
    if savings.status == SavingsPosition.STATUS_WITHDRAWN:
        raise ValueError("This savings position has already been withdrawn.")
    if savings.status == SavingsPosition.STATUS_FAILED:
        raise ValueError("This savings position is marked failed and cannot be withdrawn yet.")
    if savings.unlock_at is None:
        raise ValueError("This savings position does not have an unlock time yet.")
    if savings.unlock_at > now:
        raise ValueError(
            f"This savings position unlocks on {savings.unlock_at.isoformat()}."
        )

    if savings.status != SavingsPosition.STATUS_WITHDRAWABLE:
        savings.status = SavingsPosition.STATUS_WITHDRAWABLE
        savings.save(update_fields=["status", "updated_at"])

    return SavingsWithdrawalPreparation(
        savings=savings,
        withdrawable_amount=savings.amount_display,
        message=(
            "Your savings are now withdrawable. Withdrawal contract wiring is still pending, "
            "so record the eventual withdrawal tx only after that path is connected."
        ),
    )


def submit_proof_and_recommend(
    *,
    agreement: ConfidentialAgreementRecord,
    proof_text: str,
    proof_link: str | None,
) -> dict[str, Any]:
    verdict = generate_verdict_recommendation(
        condition_summary=agreement.condition_summary,
        proof_text=proof_text,
        proof_link=proof_link,
    )

    agreement.ai_verdict = verdict.recommendation
    agreement.ai_confidence = Decimal(str(verdict.confidence)).quantize(Decimal("0.01"))
    agreement.status = (
        ConfidentialAgreementRecord.STATUS_RELEASED
        if verdict.recommendation == "release"
        else ConfidentialAgreementRecord.STATUS_REFUNDED
        if verdict.recommendation == "refund"
        else ConfidentialAgreementRecord.STATUS_DISPUTE
    )
    agreement.save(
        update_fields=["ai_verdict", "ai_confidence", "status", "updated_at"]
    )

    ConfidentialAction.objects.create(
        user=agreement.user,
        intent=ConfidentialAction.INTENT_PROOF_SUBMISSION,
        status=ConfidentialAction.STATUS_REVIEWED,
        public_summary=f"Proof reviewed for confidential agreement #{agreement.id}.",
        payload_json={
            "agreement_id": agreement.id,
            "proof_text": proof_text,
            "proof_link": proof_link,
            "recommendation": verdict.recommendation,
            "confidence": verdict.confidence,
        },
        contract_address=agreement.action.contract_address if agreement.action else settings.ZAMA_CORE_CONTRACT_ADDRESS or None,
        network=settings.ZAMA_NETWORK_NAME,
    )

    return {
        "agreement_id": agreement.id,
        "recommendation": verdict.recommendation,
        "confidence": float(agreement.ai_confidence),
        "reasoning": verdict.reasoning,
    }


def generate_verdict_recommendation(
    *,
    condition_summary: str,
    proof_text: str,
    proof_link: str | None,
) -> VerdictRecommendation:
    try:
        return _generate_verdict_with_gemini(
            condition_summary=condition_summary,
            proof_text=proof_text,
            proof_link=proof_link,
        )
    except (
        GeminiConfigurationError,
        GeminiRequestError,
        GeminiTimeoutError,
        GeminiQuotaExceededError,
        GeminiResponseValidationError,
        ValueError,
        KeyError,
        json.JSONDecodeError,
    ):
        return _fallback_verdict(condition_summary=condition_summary, proof_text=proof_text, proof_link=proof_link)


def _parse_payment_prompt(message: str) -> ParsedConfidentialIntent:
    amount = extract_eth_amount(message)
    recipient_address = extract_address(message)
    recipient_name = extract_recipient_name(message)
    transfer_mode = extract_transfer_mode(message)
    missing_fields: list[str] = []
    if recipient_address is None:
        missing_fields.append("recipient_address")
    if transfer_mode == "unspecified":
        missing_fields.append("transfer_mode")

    payload = {
        "asset": "ETH",
        "amount_display": amount or "",
        "recipient_name": recipient_name,
        "recipient_address": recipient_address,
        "transfer_mode": transfer_mode,
    }
    summary_target = recipient_name or recipient_address or "recipient"
    amount_label = amount or "an ETH amount"
    if transfer_mode == "public":
        intent = ConfidentialAction.INTENT_PUBLIC_PAYMENT
        summary = f"Public Sepolia ETH transfer draft for {amount_label} ETH to {summary_target}."
    elif transfer_mode == "confidential":
        intent = ConfidentialAction.INTENT_CONFIDENTIAL_PAYMENT
        summary = (
            f"Confidential payment draft for {amount_label} ETH to {summary_target}."
        )
    else:
        intent = ConfidentialAction.INTENT_CONFIDENTIAL_PAYMENT
        summary = (
            f"Payment draft for {amount_label} ETH to {summary_target}. "
            "Transfer mode still needs to be chosen."
        )

    return ParsedConfidentialIntent(
        intent=intent,
        confidence=0.9 if amount else 0.78,
        missing_fields=missing_fields,
        payload=payload,
        public_summary=summary,
    )


def _parse_savings_prompt(message: str) -> ParsedConfidentialIntent:
    amount = extract_eth_amount(message)
    duration_match = SAVE_DURATION_RE.search(message)
    unlock_at = extract_deadline(message)
    lock_rule = format_lock_rule(duration_match)
    payload = {
        "asset": "ETH",
        "amount_display": amount or "",
        "lock_rule": lock_rule,
        "unlock_at": unlock_at,
    }
    amount_label = amount or "an ETH amount"
    return ParsedConfidentialIntent(
        intent=ConfidentialAction.INTENT_CONFIDENTIAL_SAVINGS,
        confidence=0.88 if amount else 0.76,
        missing_fields=[],
        payload=payload,
        public_summary=(
            f"Confidential savings draft for {amount_label} ETH with lock rule: {lock_rule}."
        ),
    )


def _parse_agreement_prompt(message: str) -> ParsedConfidentialIntent:
    recipient_address = extract_address(message)
    recipient_name = extract_recipient_name(message)
    deadline = extract_deadline(message)
    metadata_hash = default_metadata_hash(message)

    condition_summary = message.strip()
    match = PAY_IF_RE.search(message)
    if match:
        recipient_name = recipient_name or normalize_name(match.group(1))
        condition_summary = match.group(2).strip()

    missing_fields: list[str] = []
    if recipient_address is None:
        missing_fields.append("recipient_address")

    payload = {
        "recipient_name": recipient_name,
        "recipient_address": recipient_address,
        "deadline": deadline,
        "metadata_hash": metadata_hash,
        "condition_summary": condition_summary,
    }
    summary_target = recipient_name or recipient_address or "recipient"
    return ParsedConfidentialIntent(
        intent=ConfidentialAction.INTENT_CONFIDENTIAL_AGREEMENT,
        confidence=0.91,
        missing_fields=missing_fields,
        payload=payload,
        public_summary=f"Confidential agreement draft with {summary_target}: {condition_summary}",
    )


def extract_eth_amount(message: str) -> str | None:
    match = ETH_AMOUNT_RE.search(message)
    if not match:
        return None
    try:
        amount = Decimal(match.group(1))
    except (InvalidOperation, ValueError):
        return None
    return format(amount.normalize(), "f")


def extract_address(message: str) -> str | None:
    match = ETH_ADDRESS_RE.search(message)
    return match.group(0) if match else None


def extract_recipient_name(message: str) -> str | None:
    sanitized = ETH_ADDRESS_RE.sub(" ", message)
    for pattern in (TO_NAME_RE, PAY_NAME_RE, FOR_NAME_RE):
        match = pattern.search(sanitized)
        if not match:
            continue
        candidate = normalize_name(match.group(1))
        if candidate and candidate.upper() != "ETH":
            return candidate
    return None


def extract_transfer_mode(message: str) -> str:
    if CONFIDENTIAL_TRANSFER_RE.search(message):
        return "confidential"
    if PUBLIC_TRANSFER_RE.search(message):
        return "public"
    return "unspecified"


def extract_deadline(message: str):
    now = timezone.now()
    duration_match = SAVE_DURATION_RE.search(message)
    if duration_match:
        duration_value = int(duration_match.group(1))
        duration_unit = duration_match.group(2).lower()
        if duration_unit.startswith("minute"):
            return now + timedelta(minutes=duration_value)
        if duration_unit.startswith("hour"):
            return now + timedelta(hours=duration_value)
        return now + timedelta(days=duration_value)
    if FRIDAY_RE.search(message):
        days_ahead = (4 - now.weekday()) % 7
        days_ahead = 7 if days_ahead == 0 else days_ahead
        return now + timedelta(days=days_ahead)
    if TOMORROW_RE.search(message):
        return now + timedelta(days=1)
    return None


def default_metadata_hash(text: str) -> str:
    return "0x" + hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def serialize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    serialized: dict[str, Any] = {}
    for key, value in payload.items():
        if hasattr(value, "isoformat"):
            serialized[key] = value.isoformat()
        else:
            serialized[key] = value
    return serialized


def format_lock_rule(duration_match: re.Match[str] | None) -> str:
    if not duration_match:
        return "Flexible"
    value = duration_match.group(1)
    unit = duration_match.group(2).lower()
    if unit.endswith("s"):
        return f"{value} {unit}"
    return f"{value} {unit}{'' if value == '1' else 's'}"


def normalize_name(candidate: str) -> str:
    return re.sub(r"\s+", " ", candidate).strip(" ,.")


def _generate_verdict_with_gemini(
    *,
    condition_summary: str,
    proof_text: str,
    proof_link: str | None,
) -> VerdictRecommendation:
    if not settings.GEMINI_API_KEY:
        raise GeminiConfigurationError("Gemini API key is not configured.")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    contents = (
        f"Agreement condition:\n{condition_summary}\n\n"
        f"Proof text:\n{proof_text}\n\n"
        f"Proof link:\n{proof_link or 'none'}"
    )
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
                system_instruction=VERDICT_SYSTEM_INSTRUCTION,
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

    text = getattr(response, "text", "").strip()
    if not text:
        raise GeminiResponseValidationError("Gemini returned an empty response.")
    parsed = json.loads(text)
    recommendation = str(parsed["recommendation"]).strip().lower()
    if recommendation not in {"release", "refund", "dispute"}:
        raise ValueError("Invalid Gemini recommendation.")

    confidence = float(parsed["confidence"])
    confidence = max(0.0, min(confidence, 1.0))
    reasoning = str(parsed.get("reasoning") or "AI reviewed the proof against the agreement.")
    return VerdictRecommendation(
        recommendation=recommendation,
        confidence=confidence,
        reasoning=reasoning,
    )


def _fallback_verdict(
    *,
    condition_summary: str,
    proof_text: str,
    proof_link: str | None,
) -> VerdictRecommendation:
    condition = condition_summary.lower()
    proof = proof_text.lower()
    strong_positive = any(keyword in proof for keyword in ("delivered", "completed", "done", "submitted", "finished"))
    strong_negative = any(keyword in proof for keyword in ("failed", "not delivered", "missed", "refund", "breach"))
    overlap = sum(1 for token in condition.split() if len(token) > 4 and token in proof)

    if strong_positive and overlap >= 1:
        return VerdictRecommendation(
            recommendation="release",
            confidence=0.78,
            reasoning="The proof appears to match the agreement condition strongly enough to recommend release.",
        )
    if strong_negative:
        return VerdictRecommendation(
            recommendation="refund",
            confidence=0.76,
            reasoning="The proof suggests the agreement condition was not met, so a refund is recommended.",
        )
    if proof_link and overlap >= 1:
        return VerdictRecommendation(
            recommendation="release",
            confidence=0.68,
            reasoning="The submitted proof link and text partially support the agreement condition.",
        )
    return VerdictRecommendation(
        recommendation="dispute",
        confidence=0.55,
        reasoning="The proof is inconclusive, so the safest recommendation is to mark this as a dispute.",
    )
