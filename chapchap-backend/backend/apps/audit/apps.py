from django.apps import AppConfig
from django.conf import settings
import logging


class AuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.audit"
    label = "audit"

    def ready(self) -> None:
        logger = logging.getLogger("apps.audit")
        details = getattr(settings, "DATABASE_URL_DETAILS", {"host": "unknown", "kind": "unknown"})
        logger.info(
            "startup.database_config host=%s kind=%s network=%s",
            details.get("host", "unknown"),
            details.get("kind", "unknown"),
            getattr(settings, "BLOCKCHAIN_NETWORK", "unknown"),
        )
