from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


class WalletEncryptionConfigurationError(Exception):
    """Raised when wallet encryption is not configured correctly."""


class WalletDecryptionError(Exception):
    """Raised when an encrypted wallet key cannot be decrypted."""


def encrypt_private_key(private_key: str) -> str:
    private_key_value = private_key.strip()
    if not private_key_value:
        raise WalletEncryptionConfigurationError("Private key cannot be empty.")
    token = _get_fernet().encrypt(private_key_value.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_private_key(encrypted_key: str) -> str:
    encrypted_value = encrypted_key.strip()
    if not encrypted_value:
        raise WalletDecryptionError("Encrypted wallet key is missing.")
    try:
        return _get_fernet().decrypt(encrypted_value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise WalletDecryptionError("Encrypted wallet key could not be decrypted.") from exc


def _get_fernet() -> Fernet:
    key = settings.WALLET_ENCRYPTION_KEY
    if not key:
        raise WalletEncryptionConfigurationError(
            "Wallet encryption key is not configured."
        )
    try:
        return Fernet(key.encode("utf-8"))
    except (TypeError, ValueError) as exc:
        raise WalletEncryptionConfigurationError(
            "Wallet encryption key is invalid."
        ) from exc
