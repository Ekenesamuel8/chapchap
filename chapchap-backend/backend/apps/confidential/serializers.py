from __future__ import annotations

from rest_framework import serializers

from .models import ConfidentialAction, ConfidentialAgreementRecord, SavingsPosition


class ConfidentialParseRequestSerializer(serializers.Serializer):
    message = serializers.CharField(allow_blank=False, trim_whitespace=True)


class ConfidentialActionHistorySerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="intent")

    class Meta:
        model = ConfidentialAction
        fields = (
            "type",
            "status",
            "public_summary",
            "tx_hash",
            "contract_address",
            "network",
            "created_at",
        )


class ProofSubmissionSerializer(serializers.Serializer):
    proof_text = serializers.CharField(allow_blank=False, trim_whitespace=True)
    proof_link = serializers.URLField(required=False, allow_blank=True)

    def validate(self, attrs):  # type: ignore[override]
        agreement_id = self.context["agreement_id"]
        user = self.context["request"].user

        try:
            agreement = ConfidentialAgreementRecord.objects.get(id=agreement_id, user=user)
        except ConfidentialAgreementRecord.DoesNotExist as exc:
            raise serializers.ValidationError({"detail": "Agreement record not found."}) from exc

        self.context["agreement"] = agreement
        return attrs


class ConfidentialTxRecordSerializer(serializers.Serializer):
    STATUS_CHOICES = [
        ConfidentialAction.STATUS_DRAFT,
        ConfidentialAction.STATUS_AWAITING_WALLET,
        ConfidentialAction.STATUS_SUBMITTED,
        ConfidentialAction.STATUS_CONFIRMED,
        ConfidentialAction.STATUS_FAILED,
        ConfidentialAction.STATUS_REVIEWED,
    ]

    tx_hash = serializers.CharField(allow_blank=False, trim_whitespace=True)
    status = serializers.ChoiceField(choices=STATUS_CHOICES)
    contract_address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    intent = serializers.ChoiceField(
        choices=[
            ConfidentialAction.INTENT_CONFIDENTIAL_PAYMENT,
            ConfidentialAction.INTENT_PUBLIC_PAYMENT,
            ConfidentialAction.INTENT_CONFIDENTIAL_SAVINGS,
            ConfidentialAction.INTENT_CONFIDENTIAL_AGREEMENT,
            ConfidentialAction.INTENT_PROOF_SUBMISSION,
        ],
        required=False,
    )

    def validate(self, attrs):  # type: ignore[override]
        action_id = self.context["action_id"]
        user = self.context["request"].user

        try:
            action = ConfidentialAction.objects.get(id=action_id, user=user)
        except ConfidentialAction.DoesNotExist as exc:
            raise serializers.ValidationError({"detail": "Confidential action not found."}) from exc

        self.context["action"] = action
        return attrs


class SavingsPositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavingsPosition
        fields = (
            "id",
            "amount_display",
            "asset",
            "lock_rule",
            "unlock_at",
            "status",
            "tx_hash",
            "withdraw_tx_hash",
            "withdrawn_at",
            "created_at",
        )


class SavingsWithdrawRequestSerializer(serializers.Serializer):
    withdraw_tx_hash = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )

    def validate(self, attrs):  # type: ignore[override]
        savings_id = self.context["savings_id"]
        user = self.context["request"].user

        try:
            savings = SavingsPosition.objects.get(id=savings_id, user=user)
        except SavingsPosition.DoesNotExist as exc:
            raise serializers.ValidationError({"detail": "Savings position not found."}) from exc

        self.context["savings"] = savings
        return attrs
