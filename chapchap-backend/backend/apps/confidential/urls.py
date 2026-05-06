from django.urls import path

from .views import (
    ConfidentialActionTxRecordView,
    ConfidentialAgreementProofView,
    ConfidentialHistoryView,
    ConfidentialParseView,
    ConfidentialSavingsListView,
    ConfidentialSavingsWithdrawView,
)


urlpatterns = [
    path("parse/", ConfidentialParseView.as_view(), name="confidential-parse"),
    path("history/", ConfidentialHistoryView.as_view(), name="confidential-history"),
    path("savings/", ConfidentialSavingsListView.as_view(), name="confidential-savings-list"),
    path("savings/<int:id>/withdraw/", ConfidentialSavingsWithdrawView.as_view(), name="confidential-savings-withdraw"),
    path("agreements/<int:id>/proof/", ConfidentialAgreementProofView.as_view(), name="confidential-agreement-proof"),
    path("actions/<int:id>/tx/", ConfidentialActionTxRecordView.as_view(), name="confidential-action-tx"),
]
