from django.contrib import admin

from .models import ParsedIntent, PendingIntentSession, PromptRequest


@admin.register(PromptRequest)
class PromptRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "source_type", "status", "created_at")
    list_filter = ("source_type", "status", "created_at")
    search_fields = ("user__email", "raw_prompt")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ParsedIntent)
class ParsedIntentAdmin(admin.ModelAdmin):
    list_display = ("id", "prompt_request", "intent_type", "confidence", "created_at")
    list_filter = ("intent_type", "created_at")
    search_fields = ("prompt_request__raw_prompt", "intent_type")
    readonly_fields = ("created_at", "updated_at")


@admin.register(PendingIntentSession)
class PendingIntentSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "intent_type", "status", "updated_at")
    list_filter = ("intent_type", "status", "updated_at")
    search_fields = ("user__email",)
    readonly_fields = ("created_at", "updated_at")
