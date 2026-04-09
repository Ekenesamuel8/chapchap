from django.conf import settings
from django.db import models
from django.db.models import Q


class PromptRequest(models.Model):
    SOURCE_TEXT = "text"
    SOURCE_VOICE = "voice"
    SOURCE_IMAGE = "image"
    SOURCE_CHOICES = [
        (SOURCE_TEXT, "Text"),
        (SOURCE_VOICE, "Voice"),
        (SOURCE_IMAGE, "Image"),
    ]

    STATUS_RECEIVED = "received"
    STATUS_PARSED = "parsed"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_RECEIVED, "Received"),
        (STATUS_PARSED, "Parsed"),
        (STATUS_FAILED, "Failed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="prompt_requests",
    )
    raw_prompt = models.TextField()
    source_type = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES,
        default=SOURCE_TEXT,
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_RECEIVED,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.email} - {self.status}"


class ParsedIntent(models.Model):
    prompt_request = models.OneToOneField(
        PromptRequest,
        on_delete=models.CASCADE,
        related_name="parsed_intent",
    )
    intent_type = models.CharField(max_length=50)
    payload_json = models.JSONField(default=dict)
    confidence = models.FloatField()
    missing_fields = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.intent_type} ({self.prompt_request_id})"


class PendingIntentSession(models.Model):
    INTENT_PAYMENT = "payment"
    INTENT_PRODUCT_SEARCH = "product_search"
    INTENT_SWAP = "swap"
    INTENT_CHOICES = [
        (INTENT_PAYMENT, "Payment"),
        (INTENT_PRODUCT_SEARCH, "Product search"),
        (INTENT_SWAP, "Swap"),
    ]

    STATUS_COLLECTING = "collecting"
    STATUS_READY_FOR_CONFIRMATION = "ready_for_confirmation"
    STATUS_RESULTS_READY = "results_ready"
    STATUS_CANCELLED = "cancelled"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = [
        (STATUS_COLLECTING, "Collecting"),
        (STATUS_READY_FOR_CONFIRMATION, "Ready for confirmation"),
        (STATUS_RESULTS_READY, "Results ready"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_COMPLETED, "Completed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pending_intent_sessions",
    )
    intent_type = models.CharField(max_length=50, choices=INTENT_CHOICES)
    status = models.CharField(
        max_length=40,
        choices=STATUS_CHOICES,
        default=STATUS_COLLECTING,
    )
    collected_data_json = models.JSONField(default=dict)
    missing_fields_json = models.JSONField(default=list)
    last_prompt_request = models.ForeignKey(
        PromptRequest,
        on_delete=models.SET_NULL,
        related_name="pending_sessions",
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "intent_type"],
                condition=Q(status="collecting"),
                name="unique_collecting_pending_intent_per_user",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} - {self.intent_type} ({self.status})"
