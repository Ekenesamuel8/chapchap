from django.contrib import admin

from .models import LinkedAuthMethod


@admin.register(LinkedAuthMethod)
class LinkedAuthMethodAdmin(admin.ModelAdmin):
    list_display = ("provider", "email", "provider_user_id", "user", "created_at")
    list_filter = ("provider", "created_at")
    search_fields = ("email", "provider_user_id", "user__email")
    readonly_fields = ("created_at", "updated_at")
