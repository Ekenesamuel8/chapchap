from django.urls import path

from .views import PaymentIntentSubmitView

urlpatterns = [
    path(
        "<int:payment_intent_id>/submit/",
        PaymentIntentSubmitView.as_view(),
        name="payment-intent-submit",
    ),
]
