import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models import User

security_bearer = HTTPBearer(auto_error=False)

def hash_password(password: str, salt: str = None) -> str:
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        100000
    )
    return f"{salt}:{key.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected_key = stored_hash.split(":")
        candidate_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt),
            100000
        ).hex()
        return secrets.compare_digest(candidate_key, expected_key)
    except Exception:
        return False

# Token Generation & Verification using signed payloads
def create_access_token(user_id: str, email: str, expires_in_seconds: int = 7 * 24 * 3600) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": int(time.time()) + expires_in_seconds
    }
    payload_json = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    payload_b64 = base64.urlsafe_b64encode(payload_json).decode('utf-8').rstrip('=')
    signature = hmac.new(
        settings.SECRET_KEY.encode('utf-8'),
        payload_b64.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return f"{payload_b64}.{signature}"

def decode_access_token(token: str) -> Optional[dict]:
    try:
        parts = token.strip().split('.')
        if len(parts) != 2:
            return None
        payload_b64, signature = parts
        expected_signature = hmac.new(
            settings.SECRET_KEY.encode('utf-8'),
            payload_b64.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        if not secrets.compare_digest(signature, expected_signature):
            return None

        # Re-add base64 padding
        padding = 4 - (len(payload_b64) % 4)
        if padding != 4:
            payload_b64 += '=' * padding
        payload_json = base64.urlsafe_b64decode(payload_b64.encode('utf-8'))
        payload = json.loads(payload_json.decode('utf-8'))

        # Check expiration
        if time.time() > payload.get("exp", 0):
            return None
        return payload
    except Exception:
        return None

def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> User:
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_access_token(auth.credentials)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return user
