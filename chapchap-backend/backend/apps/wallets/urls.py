from django.urls import path

from .views import FundWalletOptionsView


urlpatterns = [
    path("fund-options/", FundWalletOptionsView.as_view(), name="wallet-fund-options"),
]
