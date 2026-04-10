from decimal import Decimal

from django.conf import settings
from django.db import models


class PaymentIntent(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_AWAITING_CONFIRMATION = "awaiting_confirmation"
    STATUS_CONFIRMED = "confirmed"
    STATUS_SUBMITTED = "submitted"
    STATUS_SCHEDULED = "scheduled"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_AWAITING_CONFIRMATION, "Awaiting confirmation"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_SCHEDULED, "Scheduled"),
        (STATUS_FAILED, "Failed"),
    ]

    EXECUTION_PENDING = "pending"
    EXECUTION_SCHEDULED = "scheduled"
    EXECUTION_SUBMITTED = "submitted"
    EXECUTION_FAILED = "failed"
    EXECUTION_CHOICES = [
        (EXECUTION_PENDING, "Pending"),
        (EXECUTION_SCHEDULED, "Scheduled"),
        (EXECUTION_SUBMITTED, "Submitted"),
        (EXECUTION_FAILED, "Failed"),
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
    is_scheduled = models.BooleanField(default=False)
    scheduled_for = models.DateTimeField(blank=True, null=True)
    execution_status = models.CharField(
        max_length=30,
        choices=EXECUTION_CHOICES,
        default=EXECUTION_PENDING,
    )
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
    registry_tx_hash = models.CharField(max_length=255, blank=True, null=True)
    registry_payment_intent_id = models.PositiveBigIntegerField(blank=True, null=True)
    registry_contract_address = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.email} - {self.amount} {self.token_symbol}"


class TransactionHistory(models.Model):
    TYPE_SEND = "send"
    TYPE_RECEIVE = "receive"
    TYPE_SWAP = "swap"
    TYPE_GIFTCARD = "giftcard"
    TYPE_SAVE = "save"
    TYPE_CHOICES = [
        (TYPE_SEND, "Send"),
        (TYPE_RECEIVE, "Receive"),
        (TYPE_SWAP, "Swap"),
        (TYPE_GIFTCARD, "Gift card"),
        (TYPE_SAVE, "Save"),
    ]

    STATUS_PENDING = "pending"
    STATUS_SUBMITTED = "submitted"
    STATUS_CONFIRMED = "confirmed"
    STATUS_FAILED = "failed"
    STATUS_SCHEDULED = "scheduled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_FAILED, "Failed"),
        (STATUS_SCHEDULED, "Scheduled"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="transaction_history",
    )
    wallet = models.ForeignKey(
        "wallets.WalletProfile",
        on_delete=models.CASCADE,
        related_name="transaction_history",
    )
    payment_intent = models.ForeignKey(
        "payments.PaymentIntent",
        on_delete=models.SET_NULL,
        related_name="history_entries",
        blank=True,
        null=True,
    )
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    asset_symbol = models.CharField(max_length=30)
    amount = models.DecimalField(max_digits=24, decimal_places=8, default=Decimal("0"))
    network = models.CharField(max_length=80)
    recipient_address = models.CharField(max_length=255, blank=True, null=True)
    sender_address = models.CharField(max_length=255, blank=True, null=True)
    tx_hash = models.CharField(max_length=255, blank=True, null=True)
    explorer_url = models.URLField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    title = models.CharField(max_length=255, blank=True, null=True)
    subtitle = models.CharField(max_length=255, blank=True, null=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class SavingsPosition(models.Model):
    MODE_DEMO = "demo"
    MODE_REAL = "real"
    MODE_CHOICES = [
        (MODE_DEMO, "Demo"),
        (MODE_REAL, "Real"),
    ]

    STATUS_ACTIVE = "active"
    STATUS_PENDING = "pending"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_PENDING, "Pending"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="savings_positions",
    )
    wallet = models.ForeignKey(
        "wallets.WalletProfile",
        on_delete=models.CASCADE,
        related_name="savings_positions",
    )
    asset = models.CharField(max_length=30)
    amount = models.DecimalField(max_digits=24, decimal_places=8)
    strategy_name = models.CharField(max_length=255)
    strategy_type = models.CharField(max_length=100)
    apy_estimate = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"))
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default=MODE_DEMO)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class GiftCardRequest(models.Model):
    MODE_DEMO = "demo"
    MODE_API = "api"
    MODE_CHOICES = [
        (MODE_DEMO, "Demo"),
        (MODE_API, "API"),
    ]

    STATUS_PENDING = "pending"
    STATUS_READY = "ready"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_READY, "Ready"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="gift_card_requests",
    )
    wallet = models.ForeignKey(
        "wallets.WalletProfile",
        on_delete=models.CASCADE,
        related_name="gift_card_requests",
    )
    brand = models.CharField(max_length=120)
    query = models.CharField(max_length=255)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default=MODE_DEMO)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_READY)
    result_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
