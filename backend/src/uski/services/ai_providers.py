"""Chat provider pool (prod load-balancing).

In production you often want to spread chat traffic across several free-tier
OpenAI-compatible endpoints/keys so their individual rate limits add up and
requests run in parallel. This module loads an optional JSON pool and hands out
providers round-robin. In dev it stays empty and the caller falls back to the
single Ollama target from settings.

JSON shape (see ai_providers.example.json):
    {
      "chat_providers": [
        {"name": "groq",   "base_url": "https://api.groq.com/openai/v1",
         "api_key": "gsk_...", "model": "llama-3.3-70b-versatile"},
        {"name": "gemini", "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
         "api_key": "AIza...", "model": "gemini-2.0-flash"}
      ]
    }
"""

from __future__ import annotations

import itertools
import json
import threading
from dataclasses import dataclass
from pathlib import Path

from loguru import logger

from uski.core.config import settings


@dataclass(frozen=True)
class ChatProvider:
    name: str
    base_url: str
    api_key: str
    model: str


_providers: list[ChatProvider] | None = None
_cycle: "itertools.cycle[int] | None" = None
_lock = threading.Lock()


def _load() -> list[ChatProvider]:
    path = Path(settings.AI_PROVIDERS_FILE or "ai_providers.json")
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError) as exc:
        logger.warning("Could not read AI providers file {}: {}", path, exc)
        return []
    out: list[ChatProvider] = []
    for item in data.get("chat_providers", []) if isinstance(data, dict) else []:
        try:
            out.append(ChatProvider(
                name=str(item.get("name", "provider")),
                base_url=str(item["base_url"]).rstrip("/"),
                api_key=str(item.get("api_key", "")),
                model=str(item["model"]),
            ))
        except (KeyError, TypeError):
            continue
    if out:
        logger.info("Loaded {} chat provider(s) from {}", len(out), path)
    return out


def chat_providers() -> list[ChatProvider]:
    """Return the configured chat provider pool (cached, empty in dev)."""
    global _providers
    if _providers is None:
        _providers = _load()
    return _providers


def next_chat_provider() -> ChatProvider | None:
    """Round-robin the pool, or None when no pool is configured."""
    global _cycle
    provs = chat_providers()
    if not provs:
        return None
    with _lock:
        if _cycle is None:
            _cycle = itertools.cycle(range(len(provs)))
        idx = next(_cycle)
    return provs[idx]
