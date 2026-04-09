import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import PaymentIntentSubmissionSerializer
from .services import PaymentIntentSubmissionError, submit_payment_intent

logger = logging.getLogger(__name__)


class PaymentIntentSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, payment_intent_id: int):  # type: ignore[override]
        serializer = PaymentIntentSubmissionSerializer(
            data=request.data,
            context={
                "request": request,
                "payment_intent_id": payment_intent_id,
            },
        )
        serializer.is_valid(raise_exception=True)
        payment_intent = serializer.context["payment_intent"]

        try:
            submitted_payment = submit_payment_intent(payment_intent)
        except PaymentIntentSubmissionError as exc:
            logger.warning(
                "payments.submit_failed user_id=%s payment_intent_id=%s error_code=%s",
                getattr(request.user, "id", None),
                payment_intent.id,
                exc.code,
                exc_info=True,
            )
            status_code = (
                status.HTTP_422_UNPROCESSABLE_ENTITY
                if exc.code in {"missing_recipient_address", "invalid_amount", "invalid_payment_status"}
                else status.HTTP_503_SERVICE_UNAVAILABLE
                if exc.code == "wallet_unavailable"
                else status.HTTP_502_BAD_GATEWAY
            )
            return Response(
                {
                    "detail": str(exc),
                    "error_code": exc.code,
                    "status": payment_intent.status,
                },
                status=status_code,
            )

        logger.info(
            "payments.submit_success user_id=%s payment_intent_id=%s tx_hash=%s",
            getattr(request.user, "id", None),
            submitted_payment.id,
            submitted_payment.tx_hash,
        )
        return Response(
            {
                "payment_intent_id": submitted_payment.id,
                "status": submitted_payment.status,
                "tx_hash": submitted_payment.tx_hash,
                "explorer_url": submitted_payment.explorer_url,
            },
            status=status.HTTP_200_OK,
        )
