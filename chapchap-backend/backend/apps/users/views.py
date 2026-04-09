from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.serializers import TransactionHistorySerializer
from apps.payments.services import list_transaction_history
from apps.wallets.services import (
    ensure_wallet_profile,
    get_cached_wallet_balances,
    schedule_wallet_balance_refresh,
)

from .serializers import (
    BalanceSnapshotSerializer,
    DashboardSerializer,
    UserProfileSerializer,
    WalletProfileSerializer,
)

PROMPT_SUGGESTIONS = [
    "How do I invest?",
    "Analyze my portfolio and suggest investment",
    "Swap XTZ to USDC",
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
        balances = get_cached_wallet_balances(wallet)
        schedule_wallet_balance_refresh(wallet)

        payload = {
            "user": request.user,
            "wallet": wallet,
            "balances": balances,
            "recent_transactions": TransactionHistorySerializer(
                list_transaction_history(user=request.user, limit=5),
                many=True,
            ).data,
            "prompt_suggestions": PROMPT_SUGGESTIONS,
        }
        serializer = DashboardSerializer(instance=payload)
        return Response(serializer.data)
