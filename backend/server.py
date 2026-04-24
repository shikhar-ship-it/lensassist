"""FastAPI backend for the LensAssist React UI.

Exposes the existing agent/* modules as a small REST API.
"""
from __future__ import annotations
import json
import os
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any

import boto3
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv()

from agent import concierge, memory, salesforce_mock  # noqa: E402
from backend import auth  # noqa: E402
from fastapi import Depends  # noqa: E402

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CUSTOMERS_FILE = DATA_DIR / "customers.json"

app = FastAPI(title="LensAssist API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load_customers() -> dict[str, Any]:
    return json.loads(CUSTOMERS_FILE.read_text())


def _save_customers(customers: dict[str, Any]) -> None:
    CUSTOMERS_FILE.write_text(json.dumps(customers, indent=2))


def _next_customer_id(customers: dict[str, Any]) -> str:
    nums = [int(k[1:]) for k in customers if k.startswith("C") and k[1:].isdigit()]
    return f"C{max(nums + [9000]) + 1}"


# ──────────────────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────────────────
class NewCustomer(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    city: str = ""
    gold_member: bool = False
    lifetime_value: int = 0
    right_sph: str = "0.00"
    left_sph: str = "0.00"


class ChatRequest(BaseModel):
    customer_id: str
    message: str


class ChatTrace(BaseModel):
    tool: str
    input: dict[str, Any]
    output: str


class ChatResponse(BaseModel):
    reply: str
    trace: list[ChatTrace]


class TTSRequest(BaseModel):
    text: str


class OtpRequest(BaseModel):
    phone: str


class OtpVerify(BaseModel):
    phone: str
    otp: str


class AdminLogin(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    role: str  # "customer" | "admin"
    customer_id: str | None = None
    name: str | None = None


# ──────────────────────────────────────────────────────────────────────────
# Polly client — lazily created so the app still boots without AWS creds
# ──────────────────────────────────────────────────────────────────────────
_polly_client = None


def _get_polly():
    """Return a Polly client if boto3 can find AWS credentials anywhere in its
    credential chain (env vars → IAM instance role via IMDS → shared config)."""
    global _polly_client
    if _polly_client is None:
        try:
            client = boto3.client(
                "polly",
                region_name=os.environ.get("AWS_REGION", "us-east-1"),
            )
            # Force a lightweight credential resolution — if no creds are
            # findable, get_frozen_credentials() returns None.
            creds = client._request_signer._credentials
            if creds is None or creds.get_frozen_credentials().access_key is None:
                return None
            _polly_client = client
        except Exception:
            return None
    return _polly_client


_DEVANAGARI = re.compile(r"[ऀ-ॿ]")


def _clean_for_tts(text: str) -> str:
    """Strip emojis + markdown so Polly reads the actual words."""
    text = re.sub(r"[\U0001F000-\U0001FFFF]", "", text)
    text = re.sub(r"[☀-➿]", "", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n+", ". ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ──────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "model": concierge.MODEL_ID,
        "region": concierge.REGION,
        "memory": memory.backend_info(),
    }


# ──────────────────────────────────────────────────────────────────────────
# AUTH — customer OTP + admin password
# ──────────────────────────────────────────────────────────────────────────
@app.post("/api/auth/request-otp")
def request_otp(req: OtpRequest) -> dict[str, Any]:
    customer = auth.find_customer_by_phone(req.phone)
    if not customer:
        raise HTTPException(
            status_code=404,
            detail="No Lenskart account found for that phone number",
        )
    # In production this would call AWS SNS to SMS the OTP. For demo we
    # return a hint so judges can log in without a real SMS.
    return {
        "success": True,
        "masked_phone": customer["phone"],
        "demo_hint": f"Demo OTP is {auth.DEMO_OTP}",
    }


@app.post("/api/auth/verify", response_model=AuthResponse)
def verify_otp(req: OtpVerify) -> AuthResponse:
    if req.otp.strip() != auth.DEMO_OTP:
        raise HTTPException(status_code=401, detail="Incorrect OTP")
    customer = auth.find_customer_by_phone(req.phone)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    token = auth.issue_token(
        {"role": "customer", "customer_id": customer["customer_id"], "name": customer["name"]}
    )
    return AuthResponse(
        token=token,
        role="customer",
        customer_id=customer["customer_id"],
        name=customer["name"],
    )


@app.post("/api/auth/admin", response_model=AuthResponse)
def admin_login(req: AdminLogin) -> AuthResponse:
    if (
        req.email.lower().strip() != auth.ADMIN_EMAIL
        or req.password != auth.ADMIN_PASSWORD
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = auth.issue_token({"role": "admin", "email": auth.ADMIN_EMAIL})
    return AuthResponse(token=token, role="admin", name="CX Admin")


@app.get("/api/auth/me")
def whoami(user: dict[str, Any] = Depends(auth.current_user)) -> dict[str, Any]:
    return user


@app.get("/api/customers")
def list_customers(
    user: dict[str, Any] = Depends(auth.current_user),
) -> dict[str, Any]:
    all_customers = _load_customers()
    # Customers only see themselves
    if user.get("role") == "customer":
        cid = user["customer_id"]
        return {cid: all_customers[cid]} if cid in all_customers else {}
    return all_customers


@app.post("/api/customers")
def create_customer(
    req: NewCustomer,
    _: dict[str, Any] = Depends(auth.require_admin),
) -> dict[str, Any]:
    customers = _load_customers()
    new_id = _next_customer_id(customers)
    customers[new_id] = {
        "customer_id": new_id,
        "name": req.name.strip() or "Unnamed",
        "phone": req.phone or "N/A",
        "email": req.email or "N/A",
        "city": req.city or "N/A",
        "gold_member": req.gold_member,
        "lifetime_value": req.lifetime_value,
        "preferred_language": "English",
        "last_rx": {
            "right_sph": req.right_sph or "0.00",
            "left_sph": req.left_sph or "0.00",
            "date": date.today().isoformat(),
        },
    }
    _save_customers(customers)
    return customers[new_id]


@app.get("/api/customers/{customer_id}/cases")
def customer_cases(
    customer_id: str,
    user: dict[str, Any] = Depends(auth.current_user),
) -> list[dict[str, Any]]:
    auth.ensure_owns_customer(user, customer_id)
    return salesforce_mock.list_cases_for_customer(customer_id)


@app.get("/api/customers/{customer_id}/memory")
def customer_memory(
    customer_id: str,
    user: dict[str, Any] = Depends(auth.current_user),
) -> dict[str, Any]:
    auth.ensure_owns_customer(user, customer_id)
    return memory.load(customer_id)


@app.post("/api/customers/{customer_id}/memory/reset")
def reset_customer_memory(
    customer_id: str,
    user: dict[str, Any] = Depends(auth.current_user),
) -> dict[str, str]:
    auth.ensure_owns_customer(user, customer_id)
    memory.reset(customer_id)
    return {"status": "reset"}


@app.post("/api/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    user: dict[str, Any] = Depends(auth.current_user),
) -> ChatResponse:
    auth.ensure_owns_customer(user, req.customer_id)
    customers = _load_customers()
    if req.customer_id not in customers:
        raise HTTPException(status_code=404, detail="Customer not found")
    result = concierge.respond(req.customer_id, req.message)
    return ChatResponse(
        reply=result["reply"],
        trace=[ChatTrace(**step) for step in result["trace"]],
    )


@app.post("/api/chat/stream")
def chat_stream(
    req: ChatRequest,
    user: dict[str, Any] = Depends(auth.current_user),
):
    auth.ensure_owns_customer(user, req.customer_id)
    """Server-Sent Events stream of the agent turn.

    Events are JSON-encoded lines separated by blank lines, each prefixed by
    `data: `. Client should parse the `type` field to decide how to react:
      text         → append chunk to assistant reply + TTS when a sentence is done
      tool_start   → show a "calling X…" indicator
      tool_result  → append to the tool trace
      done         → final reply + full trace
      error        → display an error toast
    """
    customers = _load_customers()
    if req.customer_id not in customers:
        raise HTTPException(status_code=404, detail="Customer not found")

    def generate():
        try:
            for event in concierge.respond_stream(req.customer_id, req.message):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            err = json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)
            yield f"data: {err}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/tts/status")
def tts_status() -> dict[str, Any]:
    client = _get_polly()
    return {
        "available": client is not None,
        "engine": "neural",
        "voice": "Kajal (bilingual Indian English + Hindi)",
    }


@app.post("/api/tts")
def tts(req: TTSRequest) -> Response:
    """Synthesize speech via Amazon Polly. Returns audio/mpeg.

    Voice auto-picks: Kajal (bilingual) for any text — she handles both
    Indian English and Hindi Devanagari natively. Falls back to Aditi if
    Kajal isn't available in the configured region.
    """
    client = _get_polly()
    if client is None:
        raise HTTPException(
            status_code=501,
            detail="Polly not configured. Set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.",
        )

    text = _clean_for_tts(req.text)
    if not text:
        raise HTTPException(status_code=400, detail="empty text")

    voice_id = "Kajal"
    language_code = "hi-IN" if _DEVANAGARI.search(text) else "en-IN"

    try:
        response = client.synthesize_speech(
            Text=text,
            OutputFormat="mp3",
            VoiceId=voice_id,
            Engine="neural",
            LanguageCode=language_code,
        )
    except Exception as e:
        # Kajal not available in this region — fall back to Aditi (standard engine)
        try:
            response = client.synthesize_speech(
                Text=text,
                OutputFormat="mp3",
                VoiceId="Aditi",
                Engine="standard",
                LanguageCode=language_code,
            )
        except Exception as e2:
            raise HTTPException(
                status_code=500, detail=f"Polly failed: {e}; fallback: {e2}"
            )

    audio = response["AudioStream"].read()
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-cache"},
    )


# ──────────────────────────────────────────────────────────────────────────
# Static frontend — served only when the React build exists (Docker / prod).
# In local dev the frontend is served by Vite on :5173 instead.
# ──────────────────────────────────────────────────────────────────────────
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIST / "assets"),
        name="static-assets",
    )

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str) -> FileResponse:
        # Let API routes 404 normally; only catch frontend routes.
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        target = FRONTEND_DIST / full_path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")
