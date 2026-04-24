"""RAG: loads policy markdown files and selects relevant passages per query.

Uses lightweight keyword overlap scoring — fast, no embeddings needed for demo.
"""
from __future__ import annotations
import re
from pathlib import Path

POLICY_DIR = Path(__file__).resolve().parent.parent / "data" / "policies"


def _load_all() -> dict[str, str]:
    return {p.stem: p.read_text() for p in POLICY_DIR.glob("*.md")}


_POLICIES = _load_all()


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-zA-Z]{3,}", text.lower()))


def retrieve(query: str, top_k: int = 3) -> list[tuple[str, str]]:
    q_tokens = _tokenize(query)
    scored = []
    for name, body in _POLICIES.items():
        body_tokens = _tokenize(body)
        score = len(q_tokens & body_tokens)
        scored.append((score, name, body))
    scored.sort(key=lambda x: -x[0])
    return [(name, body) for _, name, body in scored[:top_k]]


def context_block(query: str) -> str:
    chunks = retrieve(query)
    return "\n\n---\n\n".join(f"## Policy: {name}\n{body}" for name, body in chunks)
