from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.wallets.services import ensure_default_balance_snapshots, ensure_wallet_profile, refresh_wallet_balances

from .serializers import (
    BalanceSnapshotSerializer,
    DashboardSerializer,
    UserProfileSerializer,
    WalletProfileSerializer,
)

PROMPT_SUGGESTIONS = [
    "How do I invest $100?",
    "Analyze my portfolio and suggest investment",
    "Purchase an iPhone",
    "Swap 10 tezos to USDC",
]


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):  # type: ignore[override]
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)


class MeDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):  # type: ignore[override]
        wallet = ensure_wallet_profile(request.user)
        balances = refresh_wallet_balances(wallet)
        if not balances:
            balances = ensure_default_balance_snapshots(wallet)

        payload = {
            "user": request.user,
            "wallet": wallet,
            "balances": balances,
            "recent_transactions": [],
            "prompt_suggestions": PROMPT_SUGGESTIONS,
        }
        serializer = DashboardSerializer(instance=payload)
        return Response(serializer.data)
