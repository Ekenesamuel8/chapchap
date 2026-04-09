import logging

from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.blockchain.services import get_payment_gas_summary
from apps.payments.services import (
    PaymentIntentCreationError,
    build_payment_intent_from_parsed_intent,
)

from .chat_services import AgentConversationService
from .execute_serializers import AgentExecuteSerializer
from .models import ParsedIntent, PromptRequest
from .serializers import AgentChatRequestSerializer, PromptParseRequestSerializer
from .services import (
    GeminiConfigurationError,
    GeminiIntentParserService,
    GeminiRequestError,
    GeminiResponseValidationError,
)

logger = logging.getLogger(__name__)


class AgentParseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):  # type: ignore[override]
        serializer = PromptParseRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        prompt_request = PromptRequest.objects.create(
            user=request.user,
            raw_prompt=serializer.validated_data["prompt"],
            source_type=serializer.validated_data["source_type"],
        )

        try:
            parser = GeminiIntentParserService()
            parsed = parser.parse_prompt(prompt_request.raw_prompt)

            with transaction.atomic():
                parsed_intent = ParsedIntent.objects.create(
                    prompt_request=prompt_request,
                    intent_type=parsed.intent,
                    payload_json=parsed.payload,
                    confidence=parsed.confidence,
                    missing_fields=parsed.missing_fields,
                )
                prompt_request.status = PromptRequest.STATUS_PARSED
                prompt_request.save(update_fields=["status", "updated_at"])
        except GeminiConfigurationError as exc:
            prompt_request.status = PromptRequest.STATUS_FAILED
            prompt_request.save(update_fields=["status", "updated_at"])
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except GeminiRequestError as exc:
            prompt_request.status = PromptRequest.STATUS_FAILED
            prompt_request.save(update_fields=["status", "updated_at"])
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except GeminiResponseValidationError as exc:
            prompt_request.status = PromptRequest.STATUS_FAILED
            prompt_request.save(update_fields=["status", "updated_at"])
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "prompt_request_id": prompt_request.id,
                "parsed_intent_id": parsed_intent.id,
                "intent": parsed_intent.intent_type,
                "confidence": parsed_intent.confidence,
                "missing_fields": parsed_intent.missing_fields,
                "payload": parsed_intent.payload_json,
            },
            status=status.HTTP_200_OK,
        )


class AgentChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):  # type: ignore[override]
        serializer = AgentChatRequestSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except DRFValidationError:
            logger.warning(
                "agent.chat.validation_error user_id=%s payload=%s",
                getattr(request.user, "id", None),
                request.data,
            )
            return Response(
                {
                    "type": "system_error",
                    "message": "Please send a message to continue.",
                    "error_code": "validation_error",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            response = AgentConversationService().handle_message(
                user=request.user,
                message=serializer.validated_data["message"],
            )
        except Exception:
            logger.exception(
                "agent.chat.view_failure user_id=%s payload=%s",
                getattr(request.user, "id", None),
                request.data,
            )
            return Response(
                {
                    "type": "system_error",
                    "message": "ChapChap hit a backend issue while preparing that request. Please try again shortly.",
                    "error_code": "internal_error",
                },
                status=status.HTTP_200_OK,
            )

        return Response(response.payload, status=status.HTTP_200_OK)


class AgentExecuteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):  # type: ignore[override]
        serializer = AgentExecuteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        parsed_intent = serializer.context["parsed_intent"]

        try:
            payment_intent = build_payment_intent_from_parsed_intent(parsed_intent)
        except PaymentIntentCreationError as exc:
            detail = str(exc)
            status_code = (
                status.HTTP_400_BAD_REQUEST
                if detail == "Execution is not supported for this intent yet."
                else status.HTTP_422_UNPROCESSABLE_ENTITY
            )
            return Response({"detail": detail}, status=status_code)

        gas_summary = get_payment_gas_summary(token_symbol=payment_intent.token_symbol)
        return Response(
            {
                "action_type": "payment_confirmation",
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
                    "scheduled_for": payment_intent.scheduled_for.isoformat()
                    if payment_intent.scheduled_for
                    else None,
                    "explorer_base_url": gas_summary["explorer_base_url"],
                },
            },
            status=status.HTTP_200_OK,
        )
