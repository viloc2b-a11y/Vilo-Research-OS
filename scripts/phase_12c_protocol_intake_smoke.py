#!/usr/bin/env python3
"""Thin wrapper — runs Phase 12C-PY smoke proof."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
script = Path(__file__).resolve().parent / "phase_12c_protocol_intake.py"
raise SystemExit(subprocess.call([sys.executable, str(script), "--smoke"], cwd=str(ROOT)))
