from django.contrib import admin

from .models import PaymentIntent


@admin.register(PaymentIntent)
class PaymentIntentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "recipient_name",
        "amount",
        "token_symbol",
        "network",
        "status",
        "created_at",
    )
    list_filter = ("status", "network", "token_symbol", "created_at")
    search_fields = (
        "user__email",
        "recipient_name",
        "recipient_address",
        "parsed_intent__prompt_request__raw_prompt",
    )
    readonly_fields = (
        "tx_hash",
        "explorer_url",
        "submitted_at",
        "confirmed_at",
        "created_at",
        "updated_at",
    )
