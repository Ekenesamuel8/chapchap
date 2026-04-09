from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.users.models import User

from .services import ensure_wallet_profile


@receiver(post_save, sender=User)
def create_wallet_for_new_user(sender, instance: User, created: bool, **kwargs) -> None:
    if not created:
        return
    ensure_wallet_profile(instance)
