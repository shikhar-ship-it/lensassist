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


def reload() -> int:
    """Re-read policy files from disk. Called after admin edits."""
    global _POLICIES
    _POLICIES = _load_all()
    return len(_POLICIES)


def list_policies() -> list[dict[str, str]]:
    """Return [{name, body, path}] for every policy on disk."""
    return [
        {
            "name": p.stem,
            "body": p.read_text(),
            "path": str(p.relative_to(POLICY_DIR.parent.parent)),
        }
        for p in sorted(POLICY_DIR.glob("*.md"))
    ]


def write_policy(name: str, body: str) -> dict[str, str]:
    """Create or replace a policy file. Returns the saved record."""
    safe_name = "".join(c for c in name if c.isalnum() or c in ("_", "-")).strip("_-")
    if not safe_name:
        raise ValueError("Policy name cannot be empty after sanitization")
    path = POLICY_DIR / f"{safe_name}.md"
    path.write_text(body)
    reload()
    return {"name": safe_name, "body": body, "path": str(path.relative_to(POLICY_DIR.parent.parent))}


def delete_policy(name: str) -> bool:
    safe_name = "".join(c for c in name if c.isalnum() or c in ("_", "-")).strip("_-")
    path = POLICY_DIR / f"{safe_name}.md"
    if not path.exists():
        return False
    path.unlink()
    reload()
    return True


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
