from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


IntentType = Literal[
    "payment",
    "fund_wallet",
    "product_search",
    "gift_card",
    "swap",
    "investment_advice",
    "portfolio_analysis",
    "unknown",
]


class ParsedIntentSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: IntentType
    confidence: float = Field(..., ge=0.0, le=1.0)
    missing_fields: list[str]
    payload: dict[str, object]


class PaymentConversationExtractionSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    extracted_fields: dict[str, object]
    assistant_message: str


class PaymentConversationReplySchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str
