from django.urls import path

from .views import MeDashboardView, MeView


urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/dashboard/", MeDashboardView.as_view(), name="me-dashboard"),
]
