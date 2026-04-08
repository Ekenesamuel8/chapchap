from decimal import Decimal

from django.conf import settings
from django.db import models


class PaymentIntent(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_AWAITING_CONFIRMATION = "awaiting_confirmation"
    STATUS_CONFIRMED = "confirmed"
    STATUS_SUBMITTED = "submitted"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_AWAITING_CONFIRMATION, "Awaiting confirmation"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_FAILED, "Failed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payment_intents",
    )
    wallet = models.ForeignKey(
        "wallets.WalletProfile",
        on_delete=models.CASCADE,
        related_name="payment_intents",
    )
    parsed_intent = models.OneToOneField(
        "ai_agent.ParsedIntent",
        on_delete=models.CASCADE,
        related_name="payment_intent",
    )
    recipient_name = models.CharField(max_length=255, blank=True, null=True)
    recipient_address = models.CharField(max_length=255, blank=True, null=True)
    token_symbol = models.CharField(max_length=30)
    token_address = models.CharField(max_length=255, blank=True, null=True)
    amount = models.DecimalField(max_digits=24, decimal_places=2)
    amount_usd = models.DecimalField(
        max_digits=24,
        decimal_places=2,
        blank=True,
        null=True,
        default=Decimal("0.00"),
    )
    currency = models.CharField(max_length=20)
    network = models.CharField(max_length=50, default="Etherlink")
    note = models.TextField(blank=True, null=True)
    schedule_in_minutes = models.PositiveIntegerField(blank=True, null=True)
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default=STATUS_AWAITING_CONFIRMATION,
    )
    tx_hash = models.CharField(max_length=255, blank=True, null=True)
    explorer_url = models.URLField(blank=True, null=True)
    submitted_at = models.DateTimeField(blank=True, null=True)
    confirmed_at = models.DateTimeField(blank=True, null=True)
    failure_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.email} - {self.amount} {self.token_symbol}"
