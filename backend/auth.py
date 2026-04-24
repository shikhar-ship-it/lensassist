"""JWT-based auth for LensAssist.

For the hackathon demo:
- OTP is hard-coded to 1234 (any customer in customers.json can log in)
- Admin is hard-coded to admin@lenskart.com / demo123
- Tokens are HS256-signed with a local secret

Production path: swap request_otp() for AWS SNS → SMS; swap OTP verification
for a Redis-cached one-time code; swap admin login for AWS Cognito User Pools.
"""
from __future__ import annotations
import json
import os
import secrets
import time
from pathlib import Path
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, status

AUTH_SECRET = os.environ.get("LENSASSIST_JWT_SECRET") or secrets.token_hex(32)
JWT_ALGO = "HS256"
JWT_TTL_SECONDS = 60 * 60 * 12  # 12-hour tokens

DEMO_OTP = "1234"
ADMIN_EMAIL = "admin@lenskart.com"
ADMIN_PASSWORD = "demo123"

CUSTOMERS_FILE = Path(__file__).resolve().parent.parent / "data" / "customers.json"


def _load_customers() -> dict[str, Any]:
    return json.loads(CUSTOMERS_FILE.read_text())


def find_customer_by_phone(phone: str) -> dict[str, Any] | None:
    """Match on the tail of the phone number so '+91-98765-43210', '9876543210',
    and '98765 43210' all resolve to the same customer."""
    digits = "".join(c for c in phone if c.isdigit())
    if not digits:
        return None
    customers = _load_customers()
    for cust in customers.values():
        cust_digits = "".join(c for c in str(cust.get("phone", "")) if c.isdigit())
        if cust_digits and (
            cust_digits.endswith(digits[-10:]) or digits.endswith(cust_digits[-10:])
        ):
            return cust
    return None


def issue_token(payload: dict[str, Any]) -> str:
    now = int(time.time())
    claims = {**payload, "iat": now, "exp": now + JWT_TTL_SECONDS}
    return jwt.encode(claims, AUTH_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, AUTH_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )


def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token"
        )
    token = authorization[7:].strip()
    return decode_token(token)


def require_admin(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return user


def ensure_owns_customer(user: dict[str, Any], customer_id: str) -> None:
    """Admins can act on any customer. Customers can only act on themselves."""
    if user.get("role") == "admin":
        return
    if user.get("customer_id") != customer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own data",
        )
