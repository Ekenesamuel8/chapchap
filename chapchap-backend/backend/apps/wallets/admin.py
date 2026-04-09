from django.contrib import admin

from .models import BalanceSnapshot, WalletProfile


@admin.register(WalletProfile)
class WalletProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "address",
        "wallet_type",
        "chain_name",
        "is_active",
        "created_at",
    )
    search_fields = ("user__email", "address")
    list_filter = ("wallet_type", "chain_name", "is_active")
    readonly_fields = ("created_at", "updated_at")
    exclude = ("encrypted_private_key",)


@admin.register(BalanceSnapshot)
class BalanceSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "wallet",
        "asset_symbol",
        "balance",
        "balance_usd",
        "fetched_at",
    )
    search_fields = ("wallet__address", "wallet__user__email", "asset_symbol")
    list_filter = ("asset_symbol", "fetched_at")
    readonly_fields = ("fetched_at",)
