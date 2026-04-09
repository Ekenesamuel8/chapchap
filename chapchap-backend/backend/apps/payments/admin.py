from django.contrib import admin

from .models import GiftCardRequest, PaymentIntent, SavingsPosition, TransactionHistory


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


@admin.register(TransactionHistory)
class TransactionHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "transaction_type", "asset_symbol", "amount", "status", "created_at")
    list_filter = ("transaction_type", "status", "asset_symbol", "created_at")
    search_fields = ("user__email", "tx_hash", "recipient_address", "sender_address", "title")


@admin.register(SavingsPosition)
class SavingsPositionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "asset", "amount", "strategy_name", "mode", "status", "created_at")
    list_filter = ("mode", "status", "asset", "created_at")
    search_fields = ("user__email", "strategy_name")


@admin.register(GiftCardRequest)
class GiftCardRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "brand", "mode", "status", "result_count", "created_at")
    list_filter = ("mode", "status", "created_at")
    search_fields = ("user__email", "brand", "query")
