from rest_framework import serializers


class SupportedAssetSerializer(serializers.Serializer):
    symbol = serializers.CharField()
    name = serializers.CharField()
    contract_address = serializers.CharField(allow_null=True, required=False)
    decimals = serializers.IntegerField()
    is_native = serializers.BooleanField()


class FundReceiveSerializer(serializers.Serializer):
    address = serializers.CharField()
    address_short = serializers.CharField()
    network = serializers.CharField()
    chain_id = serializers.IntegerField()
    explorer_base_url = serializers.CharField()
    supported_assets = SupportedAssetSerializer(many=True)
    note = serializers.CharField()


class RampOptionSerializer(serializers.Serializer):
    type = serializers.CharField()
    label = serializers.CharField()
    enabled = serializers.BooleanField()


class FundWalletOptionsSerializer(serializers.Serializer):
    receive = FundReceiveSerializer()
    ramp_options = RampOptionSerializer(many=True)
