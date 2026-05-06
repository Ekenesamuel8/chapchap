from __future__ import annotations

from django.conf import settings
from django.db import models


class ConfidentialAction(models.Model):
    INTENT_CONFIDENTIAL_PAYMENT = "confidential_payment"
    INTENT_PUBLIC_PAYMENT = "public_payment"
    INTENT_CONFIDENTIAL_SAVINGS = "confidential_savings"
    INTENT_CONFIDENTIAL_AGREEMENT = "confidential_agreement"
    INTENT_PROOF_SUBMISSION = "proof_submission"
    INTENT_GENERAL_HELP = "general_help"
    INTENT_CHOICES = [
        (INTENT_CONFIDENTIAL_PAYMENT, "Confidential payment"),
        (INTENT_PUBLIC_PAYMENT, "Public payment"),
        (INTENT_CONFIDENTIAL_SAVINGS, "Confidential savings"),
        (INTENT_CONFIDENTIAL_AGREEMENT, "Confidential agreement"),
        (INTENT_PROOF_SUBMISSION, "Proof submission"),
        (INTENT_GENERAL_HELP, "General help"),
    ]

    STATUS_DRAFT = "draft"
    STATUS_AWAITING_WALLET = "awaiting_wallet"
    STATUS_SUBMITTED = "submitted"
    STATUS_CONFIRMED = "confirmed"
    STATUS_FAILED = "failed"
    STATUS_REVIEWED = "reviewed"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_AWAITING_WALLET, "Awaiting wallet"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_FAILED, "Failed"),
        (STATUS_REVIEWED, "Reviewed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="confidential_actions",
    )
    intent = models.CharField(max_length=40, choices=INTENT_CHOICES)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    public_summary = models.TextField()
    payload_json = models.JSONField(default=dict, blank=True)
    tx_hash = models.CharField(max_length=255, blank=True, null=True)
    contract_address = models.CharField(max_length=255, blank=True, null=True)
    network = models.CharField(max_length=80, default="Sepolia")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class ConfidentialAgreementRecord(models.Model):
    STATUS_PENDING = "pending"
    STATUS_RELEASED = "released"
    STATUS_REFUNDED = "refunded"
    STATUS_DISPUTE = "dispute"
    STATUS_PROOF_SUBMITTED = "proof_submitted"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_RELEASED, "Released"),
        (STATUS_REFUNDED, "Refunded"),
        (STATUS_DISPUTE, "Dispute"),
        (STATUS_PROOF_SUBMITTED, "Proof submitted"),
    ]

    action = models.OneToOneField(
        "confidential.ConfidentialAction",
        on_delete=models.CASCADE,
        related_name="agreement_record",
        blank=True,
        null=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="confidential_agreements",
    )
    recipient_address = models.CharField(max_length=255, blank=True, null=True)
    metadata_hash = models.CharField(max_length=66)
    condition_summary = models.TextField()
    deadline = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_PENDING)
    tx_hash = models.CharField(max_length=255, blank=True, null=True)
    contract_agreement_id = models.PositiveBigIntegerField(blank=True, null=True)
    ai_verdict = models.CharField(max_length=20, blank=True, null=True)
    ai_confidence = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class SavingsPosition(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_WITHDRAWABLE = "withdrawable"
    STATUS_WITHDRAWN = "withdrawn"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_WITHDRAWABLE, "Withdrawable"),
        (STATUS_WITHDRAWN, "Withdrawn"),
        (STATUS_FAILED, "Failed"),
    ]

    action = models.OneToOneField(
        "confidential.ConfidentialAction",
        on_delete=models.CASCADE,
        related_name="savings_position",
        blank=True,
        null=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="confidential_savings_positions",
    )
    asset = models.CharField(max_length=30)
    amount_display = models.CharField(max_length=64)
    lock_rule = models.CharField(max_length=255, blank=True, null=True)
    unlock_at = models.DateTimeField(blank=True, null=True)
    withdrawn_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    tx_hash = models.CharField(max_length=255, blank=True, null=True)
    withdraw_tx_hash = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
