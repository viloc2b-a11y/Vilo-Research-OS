# Vilo Engine — Client Layer (`src/vilo-engine`)

Production-ready bridge: **FieldSpec → Zod → React Hook Form → Supabase domain tables**.

## Structure

| File | Role |
|------|------|
| `src/vilo-engine/index.ts` | Public exports + `initViloEngineClient()` |
| `src/vilo-engine/zod-schemas.ts` | `buildViloZodSchema()` from `VILO_FIELD_CATALOG` |
| `src/vilo-engine/domain-tables.ts` | `sourcePath` → `vilo_*` table mapping |
| `src/vilo-engine/use-vilo-form.ts` | `useViloSourceForm` — triggers on change, rules on submit |

Core catalog/rules remain in `lib/source-engine/` (no duplication).

## Quick start

```bash
npm i zod @supabase/supabase-js react-hook-form @hookform/resolvers
```

```tsx
'use client'

import { initViloEngineClient, useViloSourceForm } from '@/src/vilo-engine'

const engine = initViloEngineClient()

export function CaptureForm() {
  const { form, handleViloSubmit, visibleFieldIds, businessFindings } =
    useViloSourceForm({
      isEditMode: false,
      onSubmit: async (data, ctx) => {
        // persist to vilo_* tables via Supabase client
        console.log(data, ctx)
      },
    })

  return (
    <form onSubmit={handleViloSubmit}>
      {visibleFieldIds.map((id) => (
        <input key={id} {...form.register(id)} />
      ))}
      {businessFindings.map((f) => (
        <p key={f.ruleId}>{f.message}</p>
      ))}
      <button type="submit">Save</button>
    </form>
  )
}
```

## Supabase migration

`supabase/migrations/0054_vilo_engine_domain_tables.sql`

Tables: `vilo_demographics`, `vilo_vitals`, `vilo_procedures`, `vilo_findings`, `vilo_tnm`, `vilo_plasma_aliquots`, `vilo_ip_supply`, `vilo_site_delegation`

RLS: study-scoped `select`; coordinator `insert`/`update` via `user_can_manage_subject_enrollment`.

Apply: `npm run db:migrate`

## Why this scales

- **Zero duplication** — one catalog, reusable triggers/rules.
- **Zod-ready** — `FieldSpec` maps 1:1 to Zod types.
- **Supabase-native** — `sourcePath` prefixes align with domain tables.
- **Audit-ready** — `SIGNATURE_BREAK_ON_EDIT` + `signature_state` column on each domain row.
- **New study** — extend `VILO_FIELD_CATALOG` + `BUSINESS_RULES` only.
