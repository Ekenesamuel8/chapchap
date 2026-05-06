from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from .serializers import (
    ConfidentialActionHistorySerializer,
    ConfidentialParseRequestSerializer,
    ConfidentialTxRecordSerializer,
    ProofSubmissionSerializer,
    SavingsPositionSerializer,
    SavingsWithdrawRequestSerializer,
)
from .services import (
    list_savings_positions,
    list_confidential_history,
    parse_and_record_confidential_prompt,
    prepare_savings_withdrawal,
    record_confidential_tx,
    submit_proof_and_recommend,
)


class ConfidentialParseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):  # type: ignore[override]
        serializer = ConfidentialParseRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = parse_and_record_confidential_prompt(
            user=request.user,
            message=serializer.validated_data["message"],
        )
        return Response(payload, status=status.HTTP_200_OK)


class ConfidentialHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):  # type: ignore[override]
        serializer = ConfidentialActionHistorySerializer(
            list_confidential_history(user=request.user),
            many=True,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class ConfidentialAgreementProofView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id: int):  # type: ignore[override]
        serializer = ProofSubmissionSerializer(
            data=request.data,
            context={"request": request, "agreement_id": id},
        )
        serializer.is_valid(raise_exception=True)
        agreement = serializer.context["agreement"]
        payload = submit_proof_and_recommend(
            agreement=agreement,
            proof_text=serializer.validated_data["proof_text"],
            proof_link=serializer.validated_data.get("proof_link"),
        )
        return Response(payload, status=status.HTTP_200_OK)


class ConfidentialActionTxRecordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id: int):  # type: ignore[override]
        serializer = ConfidentialTxRecordSerializer(
            data=request.data,
            context={"request": request, "action_id": id},
        )
        serializer.is_valid(raise_exception=True)
        action = serializer.context["action"]
        updated = record_confidential_tx(
            action=action,
            tx_hash=serializer.validated_data["tx_hash"],
            status=serializer.validated_data["status"],
            contract_address=serializer.validated_data.get("contract_address"),
            intent=serializer.validated_data.get("intent"),
        )
        return Response(
            {
                "action_id": updated.id,
                "status": updated.status,
                "tx_hash": updated.tx_hash,
                "contract_address": updated.contract_address,
                "network": updated.network,
            },
            status=status.HTTP_200_OK,
        )


class ConfidentialSavingsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):  # type: ignore[override]
        serializer = SavingsPositionSerializer(
            list_savings_positions(user=request.user),
            many=True,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class ConfidentialSavingsWithdrawView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id: int):  # type: ignore[override]
        serializer = SavingsWithdrawRequestSerializer(
            data=request.data,
            context={"request": request, "savings_id": id},
        )
        serializer.is_valid(raise_exception=True)
        savings = serializer.context["savings"]
        preparation = prepare_savings_withdrawal(savings=savings)

        withdraw_tx_hash = serializer.validated_data.get("withdraw_tx_hash")
        if withdraw_tx_hash:
            savings.withdraw_tx_hash = withdraw_tx_hash
            savings.status = savings.STATUS_WITHDRAWN
            savings.withdrawn_at = timezone.now()
            savings.save(
                update_fields=[
                    "withdraw_tx_hash",
                    "status",
                    "withdrawn_at",
                    "updated_at",
                ]
            )

        return Response(
            {
                "id": preparation.savings.id,
                "amount_display": preparation.withdrawable_amount,
                "asset": preparation.savings.asset,
                "unlock_at": preparation.savings.unlock_at.isoformat()
                if preparation.savings.unlock_at
                else None,
                "status": preparation.savings.status,
                "tx_hash": preparation.savings.tx_hash,
                "withdraw_tx_hash": preparation.savings.withdraw_tx_hash,
                "message": preparation.message,
                "withdrawal_contract_ready": False,
            },
            status=status.HTTP_200_OK,
        )
