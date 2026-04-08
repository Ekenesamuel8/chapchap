from rest_framework import serializers

from .models import PromptRequest


class PromptParseRequestSerializer(serializers.Serializer):
    prompt = serializers.CharField(allow_blank=False, trim_whitespace=True)
    source_type = serializers.ChoiceField(
        choices=PromptRequest.SOURCE_CHOICES,
        required=False,
        default=PromptRequest.SOURCE_TEXT,
    )


class AgentChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(allow_blank=False, trim_whitespace=True)
