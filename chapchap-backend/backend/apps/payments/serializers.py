from rest_framework import serializers

from .models import PaymentIntent, TransactionHistory


class PaymentIntentSubmissionSerializer(serializers.Serializer):
    def validate(self, attrs):  # type: ignore[override]
        request = self.context["request"]
        payment_intent_id = self.context["payment_intent_id"]

        try:
            payment_intent = PaymentIntent.objects.get(
                id=payment_intent_id,
                user=request.user,
            )
        except PaymentIntent.DoesNotExist as exc:
            raise serializers.ValidationError(
                {"detail": "Payment intent not found."}
            ) from exc

        self.context["payment_intent"] = payment_intent
        return attrs


class TransactionHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionHistory
        fields = (
            "id",
            "transaction_type",
            "asset_symbol",
            "amount",
            "network",
            "recipient_address",
            "sender_address",
            "tx_hash",
            "explorer_url",
            "status",
            "title",
            "subtitle",
            "metadata_json",
            "created_at",
            "updated_at",
        )
