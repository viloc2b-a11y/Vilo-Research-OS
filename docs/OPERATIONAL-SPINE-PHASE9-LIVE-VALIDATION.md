# Operational Spine — Phase 9 (Coordinator Live Validation)

**Status:** READY TO EXECUTE  
**Prerequisite:** Phases 0–8 PASS  
**Type:** Unguided coordinator session — no engineer, SQL, or scripts in the room.

## Objective

Answer truthfully:

> Can a coordinator execute the protocol end-to-end without technical intervention?

This phase is **observation and evidence**, not feature work. Track friction; fix only P0 blockers discovered during the session before declaring spine closed.

---

## Session setup

| Item | Requirement |
|------|-------------|
| Role | Clinical research coordinator (or proxy with coordinator permissions) |
| Environment | Staging or pilot org with published study package |
| Study | One study at `READY_FOR_EXECUTION` (Phase 4 gate green) |
| Subject | Fresh or reset pilot subject identifier |
| Rules | No Slack to engineering; no SQL; no `node scripts/*` unless exposed in UI |

**Facilitator:** Records timestamps, URLs, blockers, and verbatim coordinator quotes. Does not drive clicks unless safety-critical.

---

## Execution script (unguided)

Coordinator performs **in order** without a runbook handout:

1. **Study review** — open study workspace → confirm readiness/bindings/publish visible  
2. **Subject enrollment** — add/enroll subject in-app  
3. **Screening** — capture screening procedures if applicable  
4. **Randomization** — record external randomization (IWRS confirmation path)  
5. **Visit execution** — open visit workspace, check-in, run procedures  
6. **Source capture** — complete structured capture, submit, resolve validation if any  
7. **AE entry** — register or update AE on subject registry tab  
8. **Signatures** — coordinator + investigator visit closeout on ≥1 visit  
9. **Follow-up** — second visit or follow-up window if scheduled  
10. **Withdrawal or EOS** — use Subject → General checklist + complete OR withdraw with documented reason  

---

## Pass / fail criteria

### PASS (spine closed)

- All 10 steps completed **without** engineer intervention  
- No dead links, fake filters, or silent capture failures  
- Coordinator can explain blockers from **runtime UI** (readiness, checklist, validation badges)  
- Terminal subject status only after checklist blockers clear (Phase 8)  

### FAIL (return to phase)

| Finding | Return to |
|---------|-----------|
| Cannot publish or bind source | Phase 2–3 |
| Cannot enroll / randomize | Phase 5–6 |
| Capture blocked with no operational reason | Phase 2–4 |
| Visit discontinuity (lost context) | Phase 7 |
| Silent terminal status | Phase 8 |
| Cosmetic-only failure | Phase 0 |

---

## Observation log (copy per session)

```text
Session ID:
Coordinator:
Study ID:
Subject ID:
Date:

| Step | Start | End | Pass/Fail | Blocker (if fail) | Coordinator quote |
|------|-------|-----|-----------|-------------------|-------------------|
| 1 Study review | | | | | |
| 2 Enroll | | | | | |
| 3 Screening | | | | | |
| 4 Randomization | | | | | |
| 5 Visit execution | | | | | |
| 6 Source capture | | | | | |
| 7 AE entry | | | | | |
| 8 Signatures | | | | | |
| 9 Follow-up | | | | | |
| 10 EOS/Withdraw | | | | | |

Hesitation points:
Hidden assumptions:
Navigation confusion:
Terminology mismatch:
Runtime misunderstanding:
Workflow discontinuities:
```

---

## Post-session

1. **Triage** findings into P0 (blocks spine) vs P1 (polish after spine)  
2. **Fix P0** with minimal vertical slices; re-run affected phase gate  
3. **Re-run Phase 9** until PASS  
4. **Declare spine closed** in release notes / `docs/COORDINATOR-OPERATIONAL-CHAIN.md`  

---

## Related runbooks

- `docs/PHASE9A-GENERIC-PHASE3-PILOT-RUNBOOK.md` — GENERIC_PHASE3_OA pilot slice (optional template study)  
- `docs/COORDINATOR-OPERATIONAL-CHAIN.md` — architecture map  
- `docs/OPERATIONAL-SPINE-PHASE8-CLOSEOUT.md` — closeout gate evidence  

---

## Explicit non-goals (Phase 9)

- Sponsor analytics sign-off  
- Full PARA_OA conditional visit matrix proof  
- Enterprise PV / eTMF validation  
- Performance/VPI tuning  
