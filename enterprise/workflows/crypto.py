"""Sensitive parameter encryption using Fernet symmetric encryption.

Encryption key is loaded from environment variable FINRPA_PARAM_KEY.
Provides encrypt/decrypt for storage and mask for API responses.
"""

import logging
import os

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

ENV_KEY_NAME = "FINRPA_PARAM_KEY"

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    """Get or create the Fernet cipher instance."""
    global _fernet
    if _fernet is not None:
        return _fernet

    key = os.environ.get(ENV_KEY_NAME)
    if not key:
        raise RuntimeError(
            f"Environment variable {ENV_KEY_NAME} is not set. "
            "Generate a key with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        )

    try:
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as e:
        raise RuntimeError(f"Invalid Fernet key in {ENV_KEY_NAME}: {e}")

    return _fernet


def set_key(key: str | bytes):
    """Set the encryption key programmatically (for testing)."""
    global _fernet
    if isinstance(key, str):
        key = key.encode()
    _fernet = Fernet(key)


def reset_key():
    """Reset the key (for testing cleanup)."""
    global _fernet
    _fernet = None


def encrypt_value(plaintext: str) -> str:
    """Encrypt a sensitive parameter value.

    Returns base64-encoded ciphertext string.
    """
    f = _get_fernet()
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a sensitive parameter value.

    Raises InvalidToken if the ciphertext is corrupted or key is wrong.
    """
    f = _get_fernet()
    return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")


def mask_value(plaintext: str) -> str:
    """Mask a sensitive value for API response display.

    Rules:
    - Length <= 4: all masked as ****
    - Length > 4: show first and last char, mask middle
    """
    if len(plaintext) <= 4:
        return "****"
    return plaintext[0] + "*" * (len(plaintext) - 2) + plaintext[-1]
