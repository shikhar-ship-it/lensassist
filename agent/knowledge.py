"""RAG: retrieve relevant policies for a query.

Policies are now stored in DynamoDB (table: lensassist-policies) with a
local file fallback for dev. We keep an in-memory cache of all policies and
reload it after admin edits via reload().
"""
from __future__ import annotations
import re

from . import storage

_POLICIES: dict[str, str] = {}


def reload() -> int:
    """Re-read policies from DynamoDB. Called on startup and after admin edits."""
    global _POLICIES
    _POLICIES = storage.policies_load_all()
    return len(_POLICIES)


# Initial load
reload()


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-zA-Z]{3,}", text.lower()))


def retrieve(query: str, top_k: int = 3) -> list[tuple[str, str]]:
    if not _POLICIES:
        reload()
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


def list_policies() -> list[dict[str, str]]:
    return storage.policy_list()


def write_policy(name: str, body: str) -> dict[str, str]:
    saved = storage.policy_save(name, body)
    reload()
    return saved


def delete_policy(name: str) -> bool:
    ok = storage.policy_delete(name)
    if ok:
        reload()
    return ok
