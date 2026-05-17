# Phase 5.6A — Post-submit writes regression runner

**Status:** Implemented  
**Parents:** Phase 5.3B correction · 5.4B addendum · 5.5B findings action E2E

QA-only orchestrator: runs the three validated post-submit write harnesses in sequence and emits one combined JSON report. Does **not** duplicate harness logic, modify RPCs, routes, or UI.

---

## Commands

| Command | Mode |
|---------|------|
| `npm run db:validate-phase56a-post-submit-writes-e2e` | Planning (unit + planned live steps in each child) |
| `npm run db:validate-phase56a-post-submit-writes-e2e:live` | Live HTTP + DB (forwards `--live --fresh` to children) |

**Combined report:** `tmp/runtime-e2e/phase56a-post-submit-writes-e2e-report.json`

**Child reports (unchanged):**

| Phase | Report |
|-------|--------|
| 5.3B correction | `tmp/runtime-e2e/phase53b-correction-shell-e2e-report.json` |
| 5.4B addendum | `tmp/runtime-e2e/phase54b-addendum-shell-e2e-report.json` |
| 5.5B findings | `tmp/runtime-e2e/phase55b-findings-action-e2e-report.json` |

Individual harnesses remain runnable alone:

```bash
npm run db:validate-phase53b-correction-shell-e2e:live -- --organization-id <uuid>
npm run db:validate-phase54b-addendum-shell-e2e:live -- --organization-id <uuid>
npm run db:validate-phase55b-findings-action-e2e:live -- --organization-id <uuid>
```

---

## Live prerequisites

1. Catalog / infrastructure green as required by child harnesses
2. **Next.js dev server:** `npm run dev` (prefer `http://localhost:3001` if port 3000 is stale)
3. `.env.local` with Supabase + `DATABASE_URL`
4. Staging org UUID (`--organization-id`)

Example:

```bash
npm run dev
npm run db:validate-phase56a-post-submit-writes-e2e:live -- \
  --organization-id f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e \
  --base-url http://localhost:3001
```

Optional cross-tenant probe (forwarded to children):

```bash
npm run db:validate-phase56a-post-submit-writes-e2e:live -- \
  --organization-id <org-a> \
  --org-b-id <org-b> \
  --base-url http://localhost:3001
```

---

## Runner behavior

1. **Correction** — `scripts/validate-phase53b-correction-shell-e2e.mjs`
2. **Addendum** — `scripts/validate-phase54b-addendum-shell-e2e.mjs`
3. **Findings** — `scripts/validate-phase55b-findings-action-e2e.mjs`

Each child runs as a separate Node process with inherited stdio. Arguments passed through:

- `--live` / planning (omit `--live`)
- `--base-url`
- `--organization-id`
- `--org-b-id`
- `--fresh` / `--no-fresh`

All three phases run even if an earlier phase fails; the combined runner exits non-zero if any phase fails.

---

## Combined report format

```json
{
  "phase": "5.6A",
  "mode": "live | planning",
  "base_url": "...",
  "organization_id": "...",
  "fresh": true,
  "ok": true,
  "summary": {
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "blocked": 0,
    "planned": 0,
    "phases_ok": 3,
    "phases_failed": 0
  },
  "phases": [
    {
      "phase": "5.3B",
      "key": "correction",
      "ok": true,
      "exit_code": 0,
      "report_path": "...",
      "summary": { "passed": 19, "failed": 0, ... },
      "blocking_defects": []
    }
  ],
  "blocking_defects": [],
  "report_paths": {
    "combined": "...",
    "correction": "...",
    "addendum": "...",
    "findings": "..."
  }
}
```

`blocking_defects` aggregates child `gaps`, failed steps, and non-zero exit codes.

---

## Non-goals

- Playwright / browser click tests
- CI provider wiring
- CRA review workflow, signatures, exports
- Phase 6 product features
- Rewriting child harness logic

---

## Recommended next step

Wire `db:validate-phase56a-post-submit-writes-e2e:live` into your release or nightly QA job (secrets for org UUID + `E2E_API_BASE_URL`), after `npm run dev` health check on the chosen port.
