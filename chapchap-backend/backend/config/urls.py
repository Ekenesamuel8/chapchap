from django.contrib import admin
from django.urls import include, path

from apps.payments.views import TransactionHistoryView
from shared.views import HealthCheckView


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", HealthCheckView.as_view(), name="health-check"),
    path("api/auth/", include("apps.authn.urls")),
    path("api/agent/", include("apps.ai_agent.urls")),
    path("api/confidential/", include("apps.confidential.urls")),
    path("api/payments/", include("apps.payments.urls")),
    path("api/history/", TransactionHistoryView.as_view(), name="history"),
    path("api/", include("apps.users.urls")),
    path("api/wallet/", include("apps.wallets.urls")),
]
