from rest_framework import serializers


class GoogleAuthSerializer(serializers.Serializer):
    id_token = serializers.CharField(allow_blank=False, trim_whitespace=True)
