"""Local keyword retrieval — SQLite FTS5 with in-memory fallback."""
from __future__ import annotations

import re
import sqlite3
from typing import Any


def _tokenize(text: str) -> list[str]:
    return [t for t in re.sub(r"[^a-z0-9\s]", " ", text.lower()).split() if len(t) > 2]


class KeywordRetriever:
    def __init__(self, segments: list[dict[str, Any]]):
        self.segments = sorted(segments, key=lambda s: s.get("segment_id", ""))
        self._fts_conn: sqlite3.Connection | None = None
        self._use_fts = self._try_fts()

    def _try_fts(self) -> bool:
        try:
            conn = sqlite3.connect(":memory:")
            conn.execute(
                "CREATE VIRTUAL TABLE IF NOT EXISTS segments USING fts5("
                "segment_id, file_name, page_or_sheet, section_reference, text)"
            )
            for seg in self.segments:
                conn.execute(
                    "INSERT INTO segments(segment_id, file_name, page_or_sheet, section_reference, text) "
                    "VALUES (?,?,?,?,?)",
                    (
                        seg["segment_id"],
                        seg["file_name"],
                        seg.get("page_or_sheet", ""),
                        seg.get("section_reference") or "",
                        seg.get("text", ""),
                    ),
                )
            conn.commit()
            self._fts_conn = conn
            return True
        except sqlite3.OperationalError:
            return False

    def search(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        if self._use_fts and self._fts_conn:
            return self._search_fts(query, limit)
        return self._search_memory(query, limit)

    def _search_fts(self, query: str, limit: int) -> list[dict[str, Any]]:
        assert self._fts_conn
        q = " ".join(_tokenize(query))
        if not q:
            return []
        rows = self._fts_conn.execute(
            "SELECT segment_id, bm25(segments) AS score FROM segments "
            "WHERE segments MATCH ? ORDER BY score LIMIT ?",
            (q, limit),
        ).fetchall()
        by_id = {s["segment_id"]: s for s in self.segments}
        hits: list[dict[str, Any]] = []
        for seg_id, score in rows:
            seg = by_id.get(seg_id)
            if seg:
                hits.append({**seg, "score": float(-score), "channel": "keyword"})
        return hits

    def _search_memory(self, query: str, limit: int) -> list[dict[str, Any]]:
        tokens = _tokenize(query)
        if not tokens:
            return []
        hits: list[dict[str, Any]] = []
        for seg in self.segments:
            seg_tokens = set(_tokenize(seg.get("text", "")))
            hits_count = sum(1 for t in tokens if t in seg_tokens)
            if hits_count == 0:
                continue
            score = hits_count / len(tokens)
            if seg.get("content_kind") == "table":
                score += 0.1
            hits.append({**seg, "score": score, "channel": "keyword"})
        hits.sort(key=lambda h: (-h["score"], h.get("segment_id", "")))
        return hits[:limit]

    def fuzzy_boost(self, query: str, hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
        try:
            from rapidfuzz import fuzz  # type: ignore
        except Exception:
            return hits
        boosted = []
        for h in hits:
            ratio = fuzz.partial_ratio(query.lower(), (h.get("text") or "").lower()) / 100.0
            boosted.append({**h, "score": min(1.0, h["score"] * 0.7 + ratio * 0.3)})
        boosted.sort(key=lambda x: (-x["score"], x.get("segment_id", "")))
        return boosted


def segment_to_evidence(seg: dict[str, Any]) -> dict[str, str]:
    ref = seg.get("section_reference")
    if seg.get("content_kind") == "table" and seg.get("table_coordinates"):
        ref = f"Table {seg['table_coordinates'].get('sheet_name', seg.get('page_or_sheet'))}"
    return {
        "file_name": seg["file_name"],
        "page_or_sheet": str(seg.get("page_or_sheet", "")),
        "section_reference": ref or "",
        "source_snippet": (seg.get("text") or "")[:500],
    }
