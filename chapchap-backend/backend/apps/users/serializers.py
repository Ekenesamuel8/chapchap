from rest_framework import serializers

from apps.blockchain.services import get_chain_metadata
from apps.wallets.models import BalanceSnapshot, WalletProfile
from .models import User


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "full_name", "avatar_url")


class WalletProfileSerializer(serializers.ModelSerializer):
    address_short = serializers.SerializerMethodField()
    chain_id = serializers.SerializerMethodField()
    explorer_base_url = serializers.SerializerMethodField()

    class Meta:
        model = WalletProfile
        fields = (
            "address",
            "address_short",
            "wallet_type",
            "chain_name",
            "chain_id",
            "explorer_base_url",
        )

    def get_address_short(self, obj: WalletProfile) -> str:
        return f"{obj.address[:6]}...{obj.address[-4:]}"

    def get_chain_id(self, obj: WalletProfile) -> int:
        return int(get_chain_metadata()["chain_id"])

    def get_explorer_base_url(self, obj: WalletProfile) -> str:
        return str(get_chain_metadata()["explorer_base_url"])


class BalanceSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = BalanceSnapshot
        fields = (
            "asset_symbol",
            "asset_address",
            "balance",
            "balance_usd",
        )


class DashboardSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    wallet = WalletProfileSerializer()
    balances = BalanceSnapshotSerializer(many=True)
    recent_transactions = serializers.ListField(child=serializers.DictField(), default=list)
    prompt_suggestions = serializers.ListField(
        child=serializers.CharField(),
        default=list,
    )
