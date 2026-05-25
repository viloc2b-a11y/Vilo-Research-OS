#!/usr/bin/env python3
"""
Phase 12C-PY — Deterministic protocol intake orchestrator.

No vector DB. No mandatory LLM/API keys. No auto-publish, bind, or runtime mutation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from lib.protocol_intake.pipeline import run_intake  # noqa: E402
from lib.protocol_intake.safety import SAFETY  # noqa: E402


def _repo_root() -> Path:
    return SCRIPT_DIR.parent


def run_smoke() -> int:
    import shutil

    fixture_dir = _repo_root() / "fixtures/protocol-intake"
    smoke_in = _repo_root() / ".phase12c-py-smoke-input"
    out_dir = _repo_root() / ".phase12c-py-smoke"
    for d in (smoke_in, out_dir):
        if d.exists():
            shutil.rmtree(d)
    smoke_in.mkdir(parents=True)
    for name in ("para-oa-012-protocol-excerpt.txt", "para-oa-012-schedule.csv"):
        shutil.copy2(fixture_dir / name, smoke_in / name)
    result = run_intake(
        input_path=smoke_in,
        output_dir=out_dir,
        study_key="STUDY-KOA-001",
        force=True,
        emit_timestamp=False,
    )
    manifest_path = out_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    gates: list[tuple[str, bool, str]] = []

    def g(name: str, ok: bool, detail: str = "") -> None:
        gates.append((name, ok, detail))

    required_files = [
        "manifest.json",
        "study_metadata_draft.json",
        "eligibility_draft.json",
        "schedule_draft.json",
        "procedure_draft.json",
        "source_composition_draft.json",
        "vpi_draft.json",
        "cliniq_draft.json",
        "review_summary.md",
    ]
    for f in required_files:
        g(f"output exists: {f}", (out_dir / f).is_file())

    g("safety auto_publish false", manifest.get("safety", {}).get("auto_publish") is False)
    g("safety auto_bind false", manifest.get("safety", {}).get("auto_bind") is False)
    g("safety runtime_mutation false", manifest.get("safety", {}).get("runtime_mutation") is False)
    g("safety requires_human_approval true", manifest.get("safety", {}).get("requires_human_approval") is True)

    meta = json.loads((out_dir / "study_metadata_draft.json").read_text(encoding="utf-8"))
    pn = meta["study_metadata"]["protocol_number"]
    g("protocol number PARA-OA-012", pn.get("value") == "PARA-OA-012", str(pn.get("value")))
    g("protocol number has evidence", len(pn.get("evidence_refs") or []) > 0)
    g("protocol number has confidence", pn.get("confidence") in ("high", "medium", "low"))

    procs = json.loads((out_dir / "procedure_draft.json").read_text(encoding="utf-8"))["procedures"]
    g("procedures extracted", len(procs) >= 5, str(len(procs)))
    g("all procedures have evidence", all(len(p.get("evidence_refs") or []) > 0 for p in procs))

    review_md = (out_dir / "review_summary.md").read_text(encoding="utf-8")
    g("review has Found section", "## Found" in review_md)
    g("review has Conflicts section", "## Conflicts" in review_md)
    g("review warns not published", "Not Published" in review_md)

    blob = manifest_path.read_bytes()
    h1 = hashlib.sha256(blob).hexdigest()
    result2 = run_intake(smoke_in, out_dir, study_key="STUDY-KOA-001", force=True)
    h2 = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    g("idempotent manifest hash", h1 == h2, h1[:12])

    failed = [x for x in gates if not x[1]]
    print(json.dumps({"phase": "12C-PY-smoke", "gates": [{"name": n, "pass": p, "detail": d} for n, p, d in gates], "summary": {"passed": len(gates) - len(failed), "failed": len(failed)}, "output_dir": str(out_dir), "draft_id": result["draft_id"]}, indent=2))
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 12C-PY deterministic protocol intake")
    parser.add_argument("--input", type=Path, help="Protocol document file or folder")
    parser.add_argument("--output", type=Path, help="Output folder for draft artifacts")
    parser.add_argument("--study-key", default=None, help="Optional protocol/study key hint")
    parser.add_argument("--force", action="store_true", help="Overwrite approved drafts")
    parser.add_argument(
        "--format",
        choices=("json", "markdown", "both"),
        default="both",
        help="Emit json artifacts, markdown review, or both (default: both)",
    )
    parser.add_argument(
        "--timestamp",
        action="store_true",
        help="Include non-deterministic created_at in manifest (off by default)",
    )
    parser.add_argument("--smoke", action="store_true", help="Run fixture smoke proof and exit")
    args = parser.parse_args()

    if args.smoke:
        return run_smoke()

    if not args.input or not args.output:
        parser.error("--input and --output are required unless --smoke")

    result = run_intake(
        input_path=args.input.resolve(),
        output_dir=args.output.resolve(),
        study_key=args.study_key,
        force=args.force,
        emit_timestamp=args.timestamp,
    )

    out = args.output.resolve()
    if args.format == "json":
        (out / "review_summary.md").unlink(missing_ok=True)
    elif args.format == "markdown":
        for name in (
            "study_metadata_draft.json",
            "eligibility_draft.json",
            "schedule_draft.json",
            "procedure_draft.json",
            "source_composition_draft.json",
            "vpi_draft.json",
            "cliniq_draft.json",
        ):
            (out / name).unlink(missing_ok=True)
        (out / "manifest.json").write_text(
            json.dumps({"draft_id": result["draft_id"], "study_key": result["manifest"]["study_key"], "safety": SAFETY, "review": result["manifest"]["review"]}, indent=2)
            + "\n",
            encoding="utf-8",
        )

    print(json.dumps({"ok": True, "draft_id": result["draft_id"], "output_dir": result["output_dir"], "safety": SAFETY}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
