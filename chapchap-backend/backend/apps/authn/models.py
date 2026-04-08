from django.conf import settings
from django.db import models


class LinkedAuthMethod(models.Model):
    PROVIDER_GOOGLE = "google"
    PROVIDER_CHOICES = [
        (PROVIDER_GOOGLE, "Google"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="linked_auth_methods",
    )
    provider = models.CharField(max_length=50, choices=PROVIDER_CHOICES)
    provider_user_id = models.CharField(max_length=255)
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["provider", "email"]
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "provider_user_id"],
                name="unique_provider_user_id",
            )
        ]

    def __str__(self) -> str:
        return f"{self.provider}:{self.email}"
