from django.urls import path

from .views import PaymentIntentSubmitView, TransactionHistoryView

urlpatterns = [
    path("history/", TransactionHistoryView.as_view(), name="transaction-history"),
    path(
        "<int:payment_intent_id>/submit/",
        PaymentIntentSubmitView.as_view(),
        name="payment-intent-submit",
    ),
]
