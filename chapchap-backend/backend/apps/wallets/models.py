from django.conf import settings
from django.db import models


class WalletProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wallet_profile",
    )
    address = models.CharField(max_length=42, unique=True)
    wallet_type = models.CharField(max_length=50, default="embedded")
    chain_name = models.CharField(max_length=100, default="etherlink_testnet")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.email} - {self.address}"


class BalanceSnapshot(models.Model):
    wallet = models.ForeignKey(
        WalletProfile,
        on_delete=models.CASCADE,
        related_name="balance_snapshots",
    )
    asset_symbol = models.CharField(max_length=20)
    asset_address = models.CharField(max_length=255, blank=True, null=True)
    balance = models.DecimalField(max_digits=24, decimal_places=2, default=0)
    balance_usd = models.DecimalField(max_digits=24, decimal_places=2, default=0)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["asset_symbol", "-fetched_at"]

    def __str__(self) -> str:
        return f"{self.wallet.address} - {self.asset_symbol}"
