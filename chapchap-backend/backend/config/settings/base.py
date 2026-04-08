import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


def _get_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _get_list(name: str, default: list[str] | None = None) -> list[str]:
    value = os.environ.get(name, "")
    if not value:
        return default or []
    return [item.strip() for item in value.split(",") if item.strip()]


SECRET_KEY = os.environ.get(
    "SECRET_KEY",
    "django-insecure-change-me",
)
DEBUG = _get_bool("DEBUG", default=False)
ALLOWED_HOSTS = _get_list("ALLOWED_HOSTS", default=["127.0.0.1", "localhost", "https://chapchap-rho.vercel.app", "https://chapchap-at9y.onrender.com"])

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
]

LOCAL_APPS = [
    "apps.users",
    "apps.authn",
    "apps.wallets",
    "apps.ai_agent",
    "apps.payments",
    "apps.commerce",
    "apps.giftcards",
    "apps.ramps",
    "apps.blockchain",
    "apps.audit",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "corsheaders.middleware.CorsMiddleware",
]

ROOT_URLCONF = "config.urls"

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://chapchap-rho.vercel.app",
    "https://chapchap-at9y.onrender.com",
]

CORS_ALLOW_CREDENTIALS = True

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

database_url = os.environ.get("DATABASE_URL")

if database_url:
    DATABASES = {
        "default": dj_database_url.parse(
            database_url,
            conn_max_age=600,
        )
    }
else:
    DATABASES = {}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "users.User"
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_OAUTH_VERIFY_AUDIENCE = _get_bool(
    "GOOGLE_OAUTH_VERIFY_AUDIENCE",
    default=True,
)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")
BLOCKCHAIN_NETWORK = (
    os.environ.get("BLOCKCHAIN_NETWORK")
    or os.environ.get("BLOCKCHAIN_MODE")
    or "etherlink_testnet"
).strip().lower()

BLOCKCHAIN_NETWORKS = {
    "dev_sepolia": {
        "rpc_url": os.environ.get("DEV_SEPOLIA_RPC_URL", ""),
        "network": os.environ.get("DEV_SEPOLIA_NETWORK_NAME", "Sepolia Dev"),
        "chain_name": os.environ.get("DEV_SEPOLIA_CHAIN_NAME", "sepolia"),
        "chain_id": int(os.environ.get("DEV_SEPOLIA_CHAIN_ID", "11155111")),
        "explorer_base_url": os.environ.get(
            "DEV_SEPOLIA_EXPLORER_BASE_URL",
            "https://sepolia.etherscan.io",
        ),
        "asset_registry_key": "dev_sepolia",
    },
    "etherlink_testnet": {
        "rpc_url": os.environ.get("ETHERLINK_TESTNET_RPC_URL", ""),
        "network": os.environ.get("ETHERLINK_TESTNET_NETWORK_NAME", "Etherlink Testnet"),
        "chain_name": os.environ.get("ETHERLINK_TESTNET_CHAIN_NAME", "etherlink_testnet"),
        "chain_id": int(os.environ.get("ETHERLINK_TESTNET_CHAIN_ID", "128123")),
        "explorer_base_url": os.environ.get(
            "ETHERLINK_TESTNET_EXPLORER_BASE_URL",
            "https://testnet.explorer.etherlink.com",
        ),
        "asset_registry_key": "etherlink_testnet",
    },
    "etherlink_mainnet": {
        "rpc_url": os.environ.get("ETHERLINK_MAINNET_RPC_URL", ""),
        "network": os.environ.get("ETHERLINK_MAINNET_NETWORK_NAME", "Etherlink Mainnet"),
        "chain_name": os.environ.get("ETHERLINK_MAINNET_CHAIN_NAME", "etherlink_mainnet"),
        "chain_id": int(os.environ.get("ETHERLINK_MAINNET_CHAIN_ID", "42793")),
        "explorer_base_url": os.environ.get(
            "ETHERLINK_MAINNET_EXPLORER_BASE_URL",
            "https://explorer.etherlink.com",
        ),
        "asset_registry_key": "etherlink_mainnet",
    },
}

ACTIVE_BLOCKCHAIN_NETWORK = BLOCKCHAIN_NETWORKS.get(
    BLOCKCHAIN_NETWORK,
    BLOCKCHAIN_NETWORKS["etherlink_testnet"],
)
BLOCKCHAIN_RPC_URL = ACTIVE_BLOCKCHAIN_NETWORK["rpc_url"]
BLOCKCHAIN_NETWORK_NAME = ACTIVE_BLOCKCHAIN_NETWORK["network"]
BLOCKCHAIN_CHAIN_NAME = ACTIVE_BLOCKCHAIN_NETWORK["chain_name"]
BLOCKCHAIN_CHAIN_ID = ACTIVE_BLOCKCHAIN_NETWORK["chain_id"]
BLOCKCHAIN_EXPLORER_BASE_URL = ACTIVE_BLOCKCHAIN_NETWORK["explorer_base_url"]
BLOCKCHAIN_ASSET_REGISTRY_KEY = ACTIVE_BLOCKCHAIN_NETWORK["asset_registry_key"]
BLOCKCHAIN_SENDER_PRIVATE_KEY_BY_NETWORK = {
    "dev_sepolia": os.environ.get("DEV_SEPOLIA_SENDER_PRIVATE_KEY", ""),
    "etherlink_testnet": os.environ.get("ETHERLINK_TESTNET_SENDER_PRIVATE_KEY", ""),
    "etherlink_mainnet": os.environ.get("ETHERLINK_MAINNET_SENDER_PRIVATE_KEY", ""),
}
BLOCKCHAIN_SENDER_ADDRESS_BY_NETWORK = {
    "dev_sepolia": os.environ.get("DEV_SEPOLIA_SENDER_ADDRESS", ""),
    "etherlink_testnet": os.environ.get("ETHERLINK_TESTNET_SENDER_ADDRESS", ""),
    "etherlink_mainnet": os.environ.get("ETHERLINK_MAINNET_SENDER_ADDRESS", ""),
}
BLOCKCHAIN_SENDER_PRIVATE_KEY = BLOCKCHAIN_SENDER_PRIVATE_KEY_BY_NETWORK.get(
    BLOCKCHAIN_NETWORK,
    "",
)
BLOCKCHAIN_SENDER_ADDRESS = BLOCKCHAIN_SENDER_ADDRESS_BY_NETWORK.get(
    BLOCKCHAIN_NETWORK,
    "",
)

SUPPORTED_ASSETS_BY_NETWORK = {
    "dev_sepolia": [
        {
            "symbol": "XTZ",
            "name": "Sepolia ETH",
            "contract_address": None,
            "decimals": 18,
            "is_native": True,
        },
        {
            "symbol": "USDC",
            "name": "USD Coin",
            "contract_address": os.environ.get("DEV_SEPOLIA_USDC_ADDRESS", "") or None,
            "decimals": int(os.environ.get("DEV_SEPOLIA_USDC_DECIMALS", "6")),
            "is_native": False,
        },
    ],
    "etherlink_testnet": [
        {
            "symbol": "XTZ",
            "name": "Tezos",
            "contract_address": None,
            "decimals": 18,
            "is_native": True,
        },
        {
            "symbol": "USDC",
            "name": "USD Coin",
            "contract_address": os.environ.get("ETHERLINK_TESTNET_USDC_ADDRESS", "") or None,
            "decimals": int(os.environ.get("ETHERLINK_TESTNET_USDC_DECIMALS", "6")),
            "is_native": False,
        },
    ],
    "etherlink_mainnet": [
        {
            "symbol": "XTZ",
            "name": "Tezos",
            "contract_address": None,
            "decimals": 18,
            "is_native": True,
        },
        {
            "symbol": "USDC",
            "name": "USD Coin",
            "contract_address": os.environ.get("ETHERLINK_MAINNET_USDC_ADDRESS", "") or None,
            "decimals": int(os.environ.get("ETHERLINK_MAINNET_USDC_DECIMALS", "6")),
            "is_native": False,
        },
    ],
}
SUPPORTED_ASSETS = SUPPORTED_ASSETS_BY_NETWORK.get(
    BLOCKCHAIN_ASSET_REGISTRY_KEY,
    SUPPORTED_ASSETS_BY_NETWORK["etherlink_testnet"],
)

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
    },
    "loggers": {
        "apps.ai_agent": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "apps.blockchain": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "apps.wallets": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
