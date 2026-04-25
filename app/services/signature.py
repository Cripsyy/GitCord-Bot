import hashlib
import hmac


def build_github_signature(payload: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def is_valid_github_signature(
    payload: bytes,
    provided_signature: str | None,
    secret: str,
) -> bool:
    if not provided_signature:
        return False

    expected_signature = build_github_signature(payload, secret)
    return hmac.compare_digest(expected_signature, provided_signature)
