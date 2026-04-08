from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LinkedAuthMethod
from .serializers import GoogleAuthSerializer
from .services import (
    GoogleAuthError,
    GoogleAuthConfigurationError,
    InvalidGoogleTokenError,
    UnverifiedGoogleEmailError,
    verify_google_id_token,
)

User = get_user_model()


class GoogleAuthView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):  # type: ignore[override]
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            google_user = verify_google_id_token(serializer.validated_data["id_token"])
        except InvalidGoogleTokenError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except UnverifiedGoogleEmailError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_403_FORBIDDEN,
            )
        except GoogleAuthConfigurationError:
            return Response(
                {"detail": "Authentication failed."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except GoogleAuthError:
            return Response(
                {"detail": "Authentication failed."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            with transaction.atomic():
                linked_method = (
                    LinkedAuthMethod.objects.select_related("user")
                    .filter(
                        provider=LinkedAuthMethod.PROVIDER_GOOGLE,
                        provider_user_id=google_user.sub,
                    )
                    .first()
                )

                if linked_method:
                    user = linked_method.user
                else:
                    user = User.objects.filter(email=google_user.email).first()
                    if user is None:
                        user = User.objects.create_user(
                            email=google_user.email,
                            password=None,
                            full_name=google_user.name,
                            avatar_url=google_user.picture or None,
                        )

                user_updates: list[str] = []
                if google_user.name and not user.full_name:
                    user.full_name = google_user.name
                    user_updates.append("full_name")
                if google_user.picture and not user.avatar_url:
                    user.avatar_url = google_user.picture
                    user_updates.append("avatar_url")
                if user_updates:
                    user.save(update_fields=[*user_updates, "updated_at"])

                LinkedAuthMethod.objects.update_or_create(
                    provider=LinkedAuthMethod.PROVIDER_GOOGLE,
                    provider_user_id=google_user.sub,
                    defaults={
                        "user": user,
                        "email": google_user.email,
                    },
                )

                token, _ = Token.objects.get_or_create(user=user)
        except IntegrityError:
            return Response(
                {"detail": "Authentication failed."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "token": token.key,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "full_name": user.full_name,
                    "avatar_url": user.avatar_url,
                },
            },
            status=status.HTTP_200_OK,
        )
