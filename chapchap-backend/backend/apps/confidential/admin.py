from django.contrib import admin

from .models import ConfidentialAction, ConfidentialAgreementRecord, SavingsPosition


@admin.register(ConfidentialAction)
class ConfidentialActionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "intent", "status", "network", "tx_hash", "created_at")
    list_filter = ("intent", "status", "network")
    search_fields = ("user__email", "public_summary", "tx_hash", "contract_address")


@admin.register(ConfidentialAgreementRecord)
class ConfidentialAgreementRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "recipient_address", "status", "contract_agreement_id", "created_at")
    list_filter = ("status",)
    search_fields = ("user__email", "recipient_address", "metadata_hash", "tx_hash")


@admin.register(SavingsPosition)
class SavingsPositionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "asset", "amount_display", "status", "created_at")
    list_filter = ("status", "asset")
    search_fields = ("user__email", "asset", "tx_hash")

