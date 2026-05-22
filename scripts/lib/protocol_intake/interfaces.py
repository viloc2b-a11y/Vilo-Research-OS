"""Pluggable interfaces — embeddings/LLM are optional placeholders only."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Protocol


class Retriever(Protocol):
    def search(self, query: str, limit: int = 5) -> list[dict[str, Any]]: ...


class OptionalEmbeddingProvider(ABC):
    """Placeholder — not used in deterministic Phase 12C-PY."""

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError("Embeddings disabled in Phase 12C-PY")


class OptionalLlmExtractor(ABC):
    """Placeholder — deterministic extractors run first."""

    @abstractmethod
    def extract(self, prompt: str, context: str) -> dict[str, Any]:
        raise NotImplementedError("LLM extraction disabled in Phase 12C-PY")
