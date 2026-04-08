from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import FundWalletOptionsSerializer
from .services import build_fund_wallet_options, ensure_wallet_profile


class FundWalletOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):  # type: ignore[override]
        wallet = ensure_wallet_profile(request.user)
        payload = build_fund_wallet_options(wallet)
        serializer = FundWalletOptionsSerializer(instance=payload)
        return Response(serializer.data)
