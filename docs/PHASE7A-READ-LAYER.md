# Phase 7A — VPI Read Layer

**Tema:** Aislar toda la lectura operativa que alimenta VPI en un módulo único (`lib/performance/read-layer/`) que sustituya la lógica dispersa actual en `app/(ops)/performance/_lib/`.
**Status:** Specification — sin código aplicado todavía.
**Padre:** [`VPI-PRODUCTION-PLAN.md`](./VPI-PRODUCTION-PLAN.md) (Fase A).
**Tipo de cambio:** Refactor puro. **Cero cambios de comportamiento.**
**Riesgo:** Bajo (sin DDL, sin nuevas queries, sin migraciones).
**Esfuerzo:** M — 3 a 5 días de un dev senior.

---

## 1. Motivación

Hoy `app/(ops)/performance/_lib/performance-read-model.ts` y `app/(ops)/performance/_lib/performance-counts.ts` mezclan tres responsabilidades distintas:

1. **Resolución de scope** (qué orgs, qué estudios, qué rol — actualmente sólo orgIds + studyId).
2. **Lectura de señales operativas** (queries crudas a `studies`, `visits`, `procedure_executions`, `subject_workflow_actions`).
3. **Composición del read model** (armar el objeto final que consume la UI).

Esta mezcla bloquea todas las fases posteriores:

- **Fase B** (views/RPCs) necesita un único lugar donde activar el modo `rpc` vs `fallback`.
- **Fase C** (scoring) necesita consumir señales puras — no objetos UI.
- **Fase D** (snapshots) necesita capturar señales de un día sin pasar por el read model UI.
- **Fase F** (alertas) necesita disparar reglas sobre señales sin tocar la UI.

Fase 7A separa estas tres responsabilidades sin cambiar lo que la página renderiza.

---

## 2. Alcance

### 2.1 Dentro de scope

- Crear `lib/performance/read-layer/` con submódulos `signals/`, `query/`, `scope.ts`, `aggregator.ts`.
- Crear `lib/performance/types.ts` con tipos comunes que sobrevivirán todas las fases.
- Mover los caps duros (`RISK_VISITS_QUERY_LIMIT`, etc.) a `lib/performance/read-layer/query/query-limits.ts`. Mantener re-export desde el path actual para no romper imports.
- Refactorizar `performance-read-model.ts` a una **fachada delgada** que delega a `lib/performance/read-layer`.
- Snapshot test que asegura que el `PerformanceReadModel` devuelto es **idéntico** antes y después.
- Validator `db:validate-phase7a-read-layer`.

### 2.2 Fuera de scope (intencional)

- No tocar UI (`_components/`). La página debe seguir renderizando idéntico.
- No tocar el SQL ni añadir queries. Mismas tablas, mismos filtros, mismos limits.
- No añadir scoring. Eso es Fase C.
- No añadir views ni RPCs. Eso es Fase B.
- No tocar el sidebar — eso se decide por separado en Fase E (o ya quedó hecho en sesiones previas).

---

## 3. Arquitectura objetivo

```
lib/performance/
├── types.ts                              # tipos comunes VPI (sobreviven a futuras fases)
└── read-layer/
    ├── index.ts                          # API pública del módulo
    ├── scope.ts                          # PerformanceScope + resolveScope()
    ├── aggregator.ts                     # compone el PerformanceReadModel
    ├── query/
    │   ├── supabase-client.ts            # wrapper tipado sobre createServerClient
    │   └── query-limits.ts               # caps (movidos desde _lib)
    └── signals/
        ├── index.ts                      # barrel
        ├── study-signals.ts              # studies + per-study counts
        ├── visit-signals.ts              # visits status/window snapshots
        ├── procedure-signals.ts          # procedure_executions blocked/etc.
        ├── workflow-signals.ts           # subject_workflow_actions overdue
        ├── subject-signals.ts            # study_subjects + risk markers
        └── data-capture-signals.ts       # source_response_* findings (stub útil para Fase C)
```

---

## 4. Contratos públicos

### 4.1 `lib/performance/types.ts`

```ts
export type PerformanceScope = {
  organizationIds: string[]
  studyIds: string[] | null    // null = todos los estudios del scope
  role: PerformanceRole
  userId: string | null
}

export type PerformanceRole =
  | 'coo' | 'pi' | 'coordinator' | 'lab' | 'admin' | 'unknown'

export type PerformanceLoadStatus = 'ok' | 'empty' | 'error' | 'partial'

export type PerformanceQueryError = { source: string; message: string }

export type RawSignal<T> = {
  source: string
  rows: T[]
  error: PerformanceQueryError | null
}
```

> Nota: `PerformanceLoadStatus` y `PerformanceQueryError` migran desde `app/(ops)/performance/_lib/performance-types.ts`. Ese archivo retiene los tipos específicos de UI (`StudyPerformanceCard`, `SubjectRiskQueueItem`, etc.) y los re-exporta desde `lib/performance/types.ts`.

### 4.2 `lib/performance/read-layer/scope.ts`

```ts
import type { PerformanceScope, PerformanceRole } from '@/lib/performance/types'

export type ResolveScopeInput = {
  organizationIds: string[]
  selectedStudyId: string | null
  userId: string | null
}

export function resolveScope(input: ResolveScopeInput): PerformanceScope

// Fase 7A devuelve role = 'unknown' siempre. Fase E reemplaza esta función con
// la resolución real desde study_members. Para no bloquear el cierre de Fase 7A,
// se acepta 'unknown' como rol válido y la UI por ahora no diferencia.
```

### 4.3 `lib/performance/read-layer/signals/*`

Cada archivo exporta funciones **puras** (sin side effects) con esta forma:

```ts
import type { PerformanceScope, RawSignal } from '@/lib/performance/types'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export async function loadStudySignals(
  client: SupabaseServerClient,
  scope: PerformanceScope,
): Promise<{
  studies: RawSignal<StudyRow>
  studyCounts: RawSignal<StudyCountsRow>
}>
```

Equivalentes para `visit-signals`, `procedure-signals`, `workflow-signals`, `subject-signals`, `data-capture-signals`.

> **Regla:** los archivos `*-signals.ts` no conocen al `PerformanceReadModel`. Sólo devuelven `RawSignal<T>`. La composición vive en `aggregator.ts`.

### 4.4 `lib/performance/read-layer/aggregator.ts`

```ts
export async function buildPerformanceReadModel(
  scope: PerformanceScope,
): Promise<PerformanceReadModel>
```

Implementa exactamente lo que hoy hace `loadPerformanceReadModel`, pero:
- Recibe `PerformanceScope` ya resuelto.
- Llama a `loadStudySignals`, `loadVisitSignals`, etc. en paralelo (`Promise.all`).
- Combina los `RawSignal` en el `PerformanceReadModel` final.
- Conserva el mismo manejo de errores (push a `errors[]`, `resolveStatus()`).

### 4.5 `lib/performance/read-layer/index.ts` (API pública)

```ts
export { resolveScope } from './scope'
export { buildPerformanceReadModel } from './aggregator'
export type { PerformanceScope, PerformanceRole } from '@/lib/performance/types'
```

### 4.6 `app/(ops)/performance/_lib/performance-read-model.ts` (post-refactor)

```ts
import { buildPerformanceReadModel, resolveScope } from '@/lib/performance/read-layer'
import type { PerformanceReadModel } from '@/app/(ops)/performance/_lib/performance-types'

/**
 * Backwards-compatible facade for the /performance page.
 * Real implementation lives in lib/performance/read-layer.
 */
export async function loadPerformanceReadModel(
  organizationIds: string[],
  selectedStudyId: string | null = null,
): Promise<PerformanceReadModel> {
  const scope = resolveScope({ organizationIds, selectedStudyId, userId: null })
  return buildPerformanceReadModel(scope)
}
```

Objetivo: < 80 líneas, sin lógica propia, sólo delegación.

---

## 5. Plan de ejecución (orden de PRs)

Se sugiere abrir 3 PRs separados para minimizar riesgo de revert:

### PR 1 — Estructura + types (no consumidor)

- Crear `lib/performance/types.ts`.
- Crear toda la carpeta `lib/performance/read-layer/` con esqueletos vacíos (sin lógica real).
- Crear el módulo `query/supabase-client.ts` wrapper.
- Tests unitarios mínimos: exports compilan, tipos coinciden.

**No** modifica nada existente. Solo añade archivos.

### PR 2 — Mover queries a signals/

- Trasplantar las queries que hoy hace `loadPerformanceReadModel` (líneas 263–466 de `performance-read-model.ts`) a los archivos correspondientes en `signals/`.
- Trasplantar `loadVisitSnapshotCounts` y `loadStudyCardCounts` de `performance-counts.ts` a `signals/visit-signals.ts` y `signals/study-signals.ts`.
- Trasplantar caps de `performance-query-limits.ts` a `read-layer/query/query-limits.ts`. Dejar re-export desde el path antiguo:

```ts
// app/(ops)/performance/_lib/performance-query-limits.ts (post-PR2)
export * from '@/lib/performance/read-layer/query/query-limits'
```

- `performance-read-model.ts` aún funciona (todavía contiene su lógica).
- Snapshot test añadido pero ejecutado contra el código viejo.

### PR 3 — Cortar al nuevo path

- `aggregator.ts` se vuelve la implementación real.
- `performance-read-model.ts` se reduce a la fachada de 4.6.
- `performance-counts.ts` se reduce a re-exports.
- Snapshot test ahora ejecuta contra el nuevo código y debe seguir verde.
- Validator `db:validate-phase7a-read-layer` agregado.

> **Acuerdo previo:** los 3 PRs entran en la misma sprint para evitar dejar el repo en estado intermedio.

---

## 6. Snapshot test (clave para refactor seguro)

Crear `lib/performance/read-layer/__tests__/snapshot.test.ts` (o equivalente del runner que use el repo):

1. Setup contra Supabase staging con datos provisionados por `provision-synthetic.mjs`.
2. Capturar output de `loadPerformanceReadModel` **antes** del refactor — guardar en `tmp/phase7a-baseline.json`.
3. Tras cada PR, comparar output nuevo contra `tmp/phase7a-baseline.json` con `deep-equal`.
4. Diferencia ≠ 0 → test rojo → bloquea merge.

> Si el repo aún no tiene framework de tests TS unitarios, este "test" se ejecuta como script Node `scripts/validate-phase7a-read-layer.mjs` siguiendo el patrón de los `validate-*.mjs` existentes.

---

## 7. Validator `db:validate-phase7a-read-layer`

Añadir a `package.json`:

```json
"db:validate-phase7a-read-layer": "node scripts/validate-phase7a-read-layer.mjs",
```

Pasos del script:

1. Provisión synthetic limpia (`npm run db:provision`).
2. Capturar baseline llamando al viejo `loadPerformanceReadModel` (durante el desarrollo se commitea el JSON a `tmp/phase7a-baseline.json`).
3. Llamar al nuevo `buildPerformanceReadModel` via fachada.
4. Diff profundo con keys ordenadas. Tolerar diferencias sólo en `errors[].message` (string libres) — todo lo demás debe ser exacto.
5. Exit 0 si ok, exit 1 si difiere.
6. Probar también con `selectedStudyId` válido, inválido y null.

---

## 8. Acceptance criteria

- [ ] `app/(ops)/performance/page.tsx` no se modifica.
- [ ] `loadPerformanceReadModel` retorna **byte-equal** lo que devolvía antes (modulo `errors[].message`).
- [ ] `app/(ops)/performance/_lib/performance-read-model.ts` < 80 líneas.
- [ ] No quedan queries crudas a `supabase.from('visits' | 'studies' | 'procedure_executions' | 'subject_workflow_actions' | 'study_subjects')` fuera de `lib/performance/read-layer/signals/`.
- [ ] `npm run lint` y `npm run build` pasan.
- [ ] `npm run db:validate-phase7a-read-layer` pasa contra staging.
- [ ] Validators previos siguen verdes: `db:validate-phase52c-read-contract-e2e`, `db:validate-phase53b-correction-shell-e2e`, `db:validate-phase56a-post-submit-writes-e2e`.

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Importes circulares entre `lib/performance/` y `lib/visits/` | Regla: `read-layer` puede importar de `lib/visits`, **nunca al revés**. Pre-commit lint regla. |
| Diferencia sutil en order de fields del read model | Snapshot test con `sortKeys: true` antes de comparar. |
| Caps de query rotos al moverse | Re-export desde el path viejo durante 1 release. Borrar en Fase 7B. |
| Drift entre `_lib/performance-types.ts` y `lib/performance/types.ts` | Convención: `lib/performance/types.ts` es la fuente; `_lib/performance-types.ts` re-exporta más sus tipos UI. |
| Tests de Fase 4B/5x sensibles a este refactor | Correr el set completo de `db:validate-phase*` antes de merge final. |

---

## 10. Definición de Done

1. PRs 1–3 mergeados.
2. Snapshot test verde durante 5 días en staging.
3. Doc `PHASE7A-VALIDATION-RESULTS.md` añadido a `docs/` con outputs del validator.
4. `VPI-PRODUCTION-PLAN.md` actualizado: Fase A marcada como **completada** con link a `PHASE7A-VALIDATION-RESULTS.md`.
5. Tickets Fase 7B abiertos referenciando esta foundation.

---

## 11. Notas para los siguientes ejecutores

- Al implementar `signals/`, **respetar los caps duros existentes**. Cambiarlos es Fase B, no aquí.
- `data-capture-signals.ts` puede quedar **stub** (devolviendo `RawSignal` vacío) en esta fase. Existe como placeholder para que Fase C lo llene sin cambios estructurales.
- Si se descubre lógica que hoy parece bug (ej. counts cero cuando hay datos), **no se arregla en Fase A**. Se documenta y se mueve tal cual. Los arreglos van en su propia rama post-A.
- Mantener nombres de `source` en `PerformanceQueryError` exactamente como están hoy (`'studies'`, `'study_card_counts'`, `'visits_total'`, etc.) — la UI los lee.
