from django.urls import path

from .views import AgentChatView, AgentExecuteView, AgentParseView


urlpatterns = [
    path("chat/", AgentChatView.as_view(), name="agent-chat"),
    path("parse/", AgentParseView.as_view(), name="agent-parse"),
    path("execute/", AgentExecuteView.as_view(), name="agent-execute"),
]
