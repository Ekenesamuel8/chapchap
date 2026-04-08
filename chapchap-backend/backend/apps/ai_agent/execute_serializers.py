from rest_framework import serializers

from .models import ParsedIntent


class AgentExecuteSerializer(serializers.Serializer):
    parsed_intent_id = serializers.IntegerField()

    def validate_parsed_intent_id(self, value: int) -> int:
        request = self.context["request"]
        try:
            parsed_intent = ParsedIntent.objects.get(id=value)
        except ParsedIntent.DoesNotExist as exc:
            raise serializers.ValidationError("Parsed intent not found.") from exc

        if parsed_intent.prompt_request.user_id != request.user.id:
            raise serializers.ValidationError("Parsed intent not found.")

        self.context["parsed_intent"] = parsed_intent
        return value
