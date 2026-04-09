from __future__ import annotations

import json
from typing import Any

from django.conf import settings
from google import genai
from google.genai import types
from pydantic import ValidationError

from .schemas import ParsedIntentSchema

SYSTEM_INSTRUCTION = """
You are an intent parser for a crypto wallet assistant.
Return JSON only.
Never include markdown.
Never explain.
Classify the prompt into exactly one of these intents:
- payment
- fund_wallet
- product_search
- gift_card
- swap
- unknown
Do not invent wallet addresses.
If important information is missing, include the field names in missing_fields.
For payment prompts, default token_symbol to USDC only when the user clearly refers to dollars and no token is specified.
Keep payload minimal and structured.

Return an object with exactly these keys:
- intent
- confidence
- missing_fields
- payload

Example payment payload:
{
  "recipient_name": "Ada",
  "recipient_address": null,
  "amount": "29",
  "currency": "USD",
  "token_symbol": "USDC",
  "schedule_in_minutes": 50,
  "note": null
}

Example fund_wallet payload:
{
  "method": "copy_address"
}

Example product_search payload:
{
  "query": "iPhone 13",
  "budget": "500",
  "currency": "USD"
}

Example gift_card payload:
{
  "brand": "Amazon",
  "amount": "25",
  "currency": "USD"
}

Example swap payload:
{
  "from_token": "TEZ",
  "to_token": "USDC",
  "amount": "10"
}
""".strip()


class GeminiConfigurationError(Exception):
    """Raised when Gemini settings are incomplete."""


class GeminiRequestError(Exception):
    """Raised when Gemini request execution fails."""


class GeminiTimeoutError(GeminiRequestError):
    """Raised when Gemini request execution times out."""


class GeminiQuotaExceededError(GeminiRequestError):
    """Raised when Gemini quota is exhausted."""


class GeminiResponseValidationError(Exception):
    """Raised when Gemini returns malformed output."""


class GeminiIntentParserService:
    def __init__(self) -> None:
        if not settings.GEMINI_API_KEY:
            raise GeminiConfigurationError("Gemini API key is not configured.")

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = settings.GEMINI_MODEL

    def parse_prompt(self, prompt: str) -> ParsedIntentSchema:
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                    system_instruction=SYSTEM_INSTRUCTION,
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

        parsed = self._parse_response_text(getattr(response, "text", ""))

        try:
            return ParsedIntentSchema.model_validate(parsed)
        except ValidationError as exc:
            raise GeminiResponseValidationError(
                "Gemini returned malformed structured output."
            ) from exc

    def _parse_response_text(self, text: str) -> dict[str, Any]:
        if not text.strip():
            raise GeminiResponseValidationError("Gemini returned an empty response.")

        try:
            raw = json.loads(text)
        except json.JSONDecodeError as exc:
            raise GeminiResponseValidationError(
                "Gemini returned non-JSON output."
            ) from exc

        if not isinstance(raw, dict):
            raise GeminiResponseValidationError(
                "Gemini returned malformed structured output."
            )
        return raw


ADVICE_SYSTEM_INSTRUCTION = """
You are a helpful AI wallet assistant for beginner-friendly crypto guidance.
Be concise, practical, and educational.
Never promise returns.
Never claim certainty.
Prefer 2 to 4 short paragraphs or bullet-style lines in plain text.
When discussing investing, mention diversification, risk tolerance, and cautious sizing.
When portfolio context is provided, refer to it directly.
""".strip()


class GeminiAdviceService:
    def __init__(self) -> None:
        if not settings.GEMINI_API_KEY:
            raise GeminiConfigurationError("Gemini API key is not configured.")

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = settings.GEMINI_MODEL

    def generate_response(self, prompt: str, *, context: str | None = None) -> str:
        contents = prompt if not context else f"{prompt}\n\nContext:\n{context}"
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config=types.GenerateContentConfig(
                    temperature=0.4,
                    system_instruction=ADVICE_SYSTEM_INSTRUCTION,
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
        return text
