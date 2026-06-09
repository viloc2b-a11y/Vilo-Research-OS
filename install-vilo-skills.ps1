$ErrorActionPreference = "Stop"
$base = "$PWD\vilo-skills"

# 1. Estructura de carpetas
$skills = "vilo-os-context","similarweb-analytics","stock-analysis","video-generator","vilo-ecosystem","skill-creator"
foreach ($s in $skills) {
    New-Item -ItemType Directory -Force -Path "$base\$s\{references,scripts,templates}" | Out-Null
}
New-Item -ItemType Directory -Force -Path "$base\template\{references,scripts,templates}","$base\docs","$base\prompts\powerpoint" | Out-Null

# 2. registry.json
@'
{
  "version": "1.1.0",
  "updated": "2026-06-04",
  "skills": [
    {"name":"vilo-os-context","status":"active","trigger":"coding, migration, spec, refactor, UI copy, alert design, AI governance, architecture decision, vilo-os"},
    {"name":"similarweb-analytics","status":"active","trigger":"dominio, tráfico, ranking, canales, geografía"},
    {"name":"stock-analysis","status":"active","trigger":"acción, ticker, análisis técnico, perfil, SEC, comparativa"},
    {"name":"video-generator","status":"active","trigger":"video, IA, guion, keyframes, BGM, TTS, producción"},
    {"name":"vilo-ecosystem","status":"active","trigger":"VRG, VPL, ClinIQ, HazloAsíYa, ShoreIQ, estrategia, BD, pricing"},
    {"name":"skill-creator","status":"active","trigger":"crear skill, actualizar plantilla, empaquetar workflow, referencias"}
  ],
  "rules": {"max_lines":500, "license":"Apache-2.0", "trigger_pattern":"activar skill: [nombre]"}
}
'@ | Set-Content -Path "$base\registry.json" -Encoding UTF8 -Force

# 3. SKILL.md (Estándar Vilo, <500 líneas, triggers claros)
@'
---
name: vilo-os-context
description: Mandatory Vilo OS governance, architecture, and execution context. Load before any coding, migration, spec, refactor, UI copy, or AI/governance work on the vilo-os clinical research platform.
---
# Vilo OS Context

## Trigger
Load for: any code, migration, spec, plan, refactor, UI copy, alert/notification design, new feature, or AI/governance decision in this repo.
Activation phrase: `load skill: vilo-os-context`

## Platform identity
Vilo OS is a **Site Execution Operating System** and **Coordinator Survival OS**.
Primary beneficiary order: **Coordinator → Site → PI/Sub-I**.
Sponsors, CROs, and monitors are NOT primary beneficiaries.

## Workflow
1. Identify the work domain (code / migration / UI / AI / spec / refactor).
2. Apply the matching hard rules below before producing any output.
3. If a request violates a rule → **STOP** and surface the conflict first.
4. Use site-first vocabulary in all artifacts (see vocabulary table below).
5. Verify new modules/layers against the architecture gates before writing code.

---

## Hard rules

### 1 — Site-first
- Runtime exists for: finding prevention, deviation prevention, coordinator simplification, revenue protection.
- No feature may prioritize external visibility over coordinator protection.
- Sponsor/CRO/monitor-first dashboards → **forbidden**. See `docs/FUTURE_IMPLEMENTATION_GUARDRAIL.md`.

### 2 — Coordinator protection (STOP if requested)
Never implement:
- Coordinator scoring, ranking, or productivity metrics
- Behavioral export of coordinator actions to external analytics
- Automated performance alerts to sponsors/CROs
- Dashboards whose primary consumer is sponsor, CRO, or CRA/monitor
- Time-on-task or click tracking for external audiences

Visibility class default: `site_only`. Changing to `derived_external` requires explicit policy review.
Copy note: "Investigator review needed" — not "coordinator failed to sign."

### 3 — Coordinator-facing language
Forbidden in UI copy, labels, helper text:
`violation`, `failure`, `enforcement`, `noncompliance`, `escalation triggered`, `monitoring issue`, `audit problem`, `coordinator score`, `productivity`, `ranking`, `surveillance`, `you must`, `non-compliant`, `failed audit`

Use `toCoordinatorSafeOperationalLanguage()` from `lib/coordinator-calm/language.ts` for dynamic strings.

Key substitutions: "Audit finding likely" → "Prevention focus" | "Deviation detected" → "Chronology needs review" | "Blocked by policy" → "Completion blocked" | "Monitor will reject" → "Stabilize before SDV"

### 4 — External visibility
- Vilo OS does not emit operational truth to external actors by default.
- External visibility requires: site-controlled + derived + scoped + delayed + operationally justified.
- All new features start with `DEFAULT_DENY_EXPOSURE_POLICY`.
- Before shipping: call `validateExposurePolicy()` + `rejectsSurveillancePolicy()`.
- Forbidden as default external outputs: raw projection rows, runtime_traces, execution_spans, work queue JSON with coordinator IDs, live projection feeds.

### 5 — VIP / AI authority (GOV-1)
- AI is ASSISTIVE only. Never mutate truth layers directly.
- AI may suggest, summarize, route — never confirm eligibility, randomize, sign source, lock visits, adjudicate deviations.
- Use `WORKFLOW_AUTHORITY_LEVEL` constants only — no free-text authority strings in runtime, traces, or observability.
- New AI-assisted workflows must be registered in `workflow_decision_authorities` before shipping.
- `workflow_key` is immutable once referenced. Deprecate with `active = false`; never rename.
- Hard-stop: `ACTIVE_DELEGATION + evidence_status=MISSING` → `BLOCK_ACTION`. Advisory alerts cannot bypass this.

### 6 — PHI in logs, alerts, and copy
- No subject names, coordinator names, or emails in external payloads, alert bodies, or log fields.
- Call `validateMetadataNonPhi()` from `lib/ai-governance/risk-tier.ts` at every alert/governance creation boundary.
- ALCOA+: timestamps must be server-generated — DB `now()` in RPC or trigger, not `new Date().toISOString()`.

### 7 — Architecture gates
- Does an existing module own this concern? Check `lib/document-intake/`, `lib/governance-fabric/`, `lib/delegation-runtime/`, `lib/performance/` first.
- No parallel detection logic — adapters only; delegate to existing detectors.
- New migration: confirm latest number via `ls supabase/migrations/ | tail -5`.
- No new layer without clear single-responsibility justification.

### 8 — Coordinator UX Gate
Before approving any feature, answer all five:
- Can the coordinator complete the workflow with fewer clicks?
- Does this remove work or add work?
- Does this reduce context switching?
- Can this be executed from the workspace where the coordinator already works?
- Does this eliminate a manual export, copy/paste, or duplicate entry?

If the answer to any is no → STOP and justify the feature.

Preferred outcome: Coordinator workload down | Operational clarity up | Navigation complexity down

---

## Site-first vocabulary

Use → Instead of:
Inspection Readiness Workspace → CRA Workspace
Controlled External Visibility → Sponsor Oversight
Finding Prevention Runtime → Oversight Engine
Coordinator operational survival prioritization → Task management
Site self-defense telemetry → Monitor visibility / oversight telemetry

## Prohibited patterns — STOP if proposed
Sponsor surveillance surfaces | coordinator scoring/metrics for external audiences | monitor-first dashboards | real-time sponsor feeds | raw runtime export APIs | default exportable:true policies

## Key source files
docs/SITE_FIRST_RUNTIME_PRINCIPLES.md | docs/PRODUCT_GUARDRAILS.md | docs/FUTURE_IMPLEMENTATION_GUARDRAIL.md | docs/COORDINATOR_PROTECTION_RULES.md | docs/OPERATIONAL_CALM_LANGUAGE_GUIDE.md | docs/EXTERNAL_VISIBILITY_POLICY.md | docs/GOV-1-WORKFLOW-DECISION-AUTHORITY.md | docs/ARCHITECTURE_NON_GOALS.md
'@ | Set-Content -Path "$base\vilo-os-context\SKILL.md" -Encoding UTF8 -Force

@'
---
name: similarweb-analytics
description: Analiza tráfico web, rankings y fuentes de canales vía SimilarWeb. Usar para: investigación de dominios, benchmarking competitivo, distribución geográfica y métricas de engagement.
---
# SimilarWeb Analytics
## Trigger
Activar cuando se mencione: dominio, tráfico, visitantes únicos, bounce rate, ranking global, fuentes de tráfico, distribución por país.
## Workflow
1. Validar dominio → formato `example.com` (sin `http://`)
2. Seleccionar API según necesidad:
   - `get_global_rank` → Popularidad histórica
   - `get_visits_total` / `get_unique_visit` → Volumen
   - `get_traffic_sources_desktop|mobile` → Canales de adquisición
   - `get_total_traffic_by_country` → Geografía (max 3 meses)
3. Ejecutar → Guardar resultado en `references/` o retornar JSON estructurado
4. Limitar a 12 meses históricos, granularidad mensual
## Rules
- Guardar datos inmediatamente tras llamada API. Cero redundancia.
- Si crédito/API falla, retornar últimos datos cacheados en `references/`.
- No asumir métricas. Solo datos verificados.
'@ | Set-Content -Path "$base\similarweb-analytics\SKILL.md" -Encoding UTF8 -Force

@'
---
name: stock-analysis
description: Investigación accionaria completa vía Yahoo Finance. Usar para: perfiles corporativos, análisis técnico/fundamental, actividad insider, filings SEC y comparativas multi-acción.
---
# Stock Analysis
## Trigger
Activar con: ticker, símbolo, análisis de acción, perfil empresa, gráficos, insider, 10-K/10-Q, comparativa sectorial.
## Workflow
1. Identificar símbolo → `AAPL`, `TSLA`, `^GSPC`, etc.
2. Cargar APIs mínimas necesarias:
   - Perfil: `Yahoo/get_stock_profile`
   - Técnico/Valoración: `Yahoo/get_stock_insights`
   - Precio: `Yahoo/get_stock_chart` (interval/range según horizonte)
   - Insider/SEC: `Yahoo/get_stock_holders`, `Yahoo/get_stock_sec_filing`
3. Combinar outputs → retornar resumen estructurado (perfil + outlook + riesgo + próximos eventos)
## Rules
- Perfil + Insights siempre juntos para preguntas generales.
- Usar `comparisons` en chart para multi-ticker.
- Ajustar `region`/`lang` para mercados no-US.
- No dar recomendación de inversión. Solo datos y contexto.
'@ | Set-Content -Path "$base\stock-analysis\SKILL.md" -Encoding UTF8 -Force

@'
---
name: video-generator
description: Pipeline de producción de video IA en 5 fases. Usar para: guion, keyframes, BGM, TTS, montaje y consistencia visual.
---
# Video Generation
## Trigger
Activar con: crear video, IA, storyboard, keyframes, música de fondo, narración, producción audiovisual.
## Workflow
1. Fase 1: Recopilar requisitos (propósito, duración, ratio 16:9/9:16, estilo, lenguaje). STOP sin confirmación.
2. Fase 2: Definir estilo visual, elementos recurrentes, perfiles de voz, fuente BGM.
3. Fase 3: Segmentar en clips (4/6/8s). Definir `transition_description`, framing, budget narración, blueprint BGM.
4. Fase 4: Generar imágenes de referencia (MANDATORIO antes de keyframes).
5. Fase 5: Ejecutar keyframes → video → audio → mezcla. Preservar TODAS las pistas de audio.
## Rules
- Nunca usar TTS para diálogos on-screen. El modelo de video genera lip-sync.
- Último keyframe debe mostrar cambio interpolable (posición/estado/composición).
- Narración por span, no por clip. Respetar `narration_budget`.
- Fallo rápido si faltan specs. Zero asunciones creativas.
'@ | Set-Content -Path "$base\video-generator\SKILL.md" -Encoding UTF8 -Force

@'
---
name: vilo-ecosystem
description: Contexto operativo completo del ecosistema Vilo. Usar para: estrategia cross-entity, BD, pricing, automatización, contenido o producto para VRG, VPL, ClinIQ, HazloAsíYa, ShoreIQ.
---
# Vilo Ecosystem
## Trigger
Activar con: VRG, VPL, ClinIQ Financial/Feasibility, VIDA, HazloAsíYa, ShoreIQ, CRO intelligence, estrategia, moats, BD, pricing, Hispanic access, biospecímenes.
## Workflow
1. Identificar entidad objetivo → VRG (ejecución clínica), VPL (lab), ClinIQ (SaaS financiero), VIDA/HazloAsíYa (acceso Hispanic), ShoreIQ (PropTech).
2. Aplicar filosofía: Ejecución > complejidad. AI como infraestructura. Moats de datos. Optimización de margen.
3. Entregar outputs: checklists, emails, flujos, pricing models, SOPs, arquitectura low-code.
4. Si la solución añade fricción o teoría: descartar. Preferir manual → low-code → automatizado.
## Rules
- Context window es recurso crítico. Concisión extrema.
- Siempre priorizar revenue, leverage, escalabilidad y compliance.
- Referenciar `references/ecosystem-map.md` para relaciones cruzadas.
- Cero jerga. Cero sobreingeniería.
'@ | Set-Content -Path "$base\vilo-ecosystem\SKILL.md" -Encoding UTF8 -Force

@'
---
name: skill-creator
description: Guía maestra para crear, validar y empaquetar nuevos skills Vilo. Usar para: extender capacidades AI, estandarizar workflows o integrar nuevas APIs/herramientas.
---
# Skill Creator
## Trigger
Activar con: crear nuevo skill, empaquetar proceso, actualizar plantilla, añadir referencia, validar SKILL.md.
## Workflow
1. Definir dominio → triggers claros, descripción <150 palabras.
2. Estructurar: `SKILL.md` (<500 líneas) + `scripts/` (código) + `references/` (docs largas) + `templates/` (boilers).
3. Aplicar grados de libertad: Alto (texto) / Medio (pseudocódigo) / Bajo (scripts rígidos).
4. Validar: progresivo disclosure, cero duplicación, verbos imperativos, fallo rápido.
5. Registrar en `registry.json` → status `active`.
## Rules
- Context window es compartido. Solo incluir lo que el agente no sabe.
- Mover variantes a `references/`. Mantener SKILL.md como ruta principal.
- No incluir README, CHANGELOG ni docs de usuario.
- Validar con `python scripts/quick_validate.py <skill-name>` si disponible.
'@ | Set-Content -Path "$base\skill-creator\SKILL.md" -Encoding UTF8 -Force

# 4. README.md & Docs
@'
# Vilo Skills Library
Framework operativo para IA, automatización clínica y flujos CRO.

## Uso Rápido
1. Copiar `template/` → renombrar al proceso
2. Actualizar frontmatter (`name`, `description`)
3. Llenar `scripts/`, `references/` o `templates/`
4. Registrar en `registry.json` → status `draft` → `active`
5. Activar vía prompt: `"activar skill: [nombre]"`
'@ | Set-Content -Path "$base\README.md" -Encoding UTF8 -Force

@'
# Vilo Skills — Visual Decks
Decks ejecutivos para sponsors/BD. Fuente de verdad: `.md` y `registry.json`.
| Deck | Trigger | Estado |
|------|---------|--------|
| `vilo-skills-registry.pptx` | "Mostrar skills activos" | 🟡 Pendiente |
| `vilo-ecosystem.pptx` | "Presentar ecosistema" | 🟡 Pendiente |
| `clinical-ops-ai-workflow.pptx` | "Demo operativo CRO" | 🟡 Pendiente |
'@ | Set-Content -Path "$base\docs\INDEX.md" -Encoding UTF8 -Force

Write-Host "`n✅ Vilo Skills Library deployed clean." -ForegroundColor Green
Write-Host "📁 Skills: $($skills -join ', ')" -ForegroundColor Cyan
Write-Host "📄 Registry updated. UTF-8 validated." -ForegroundColor Cyan
Write-Host "🚀 Ready for commit. Run: git add vilo-skills/`n" -ForegroundColor Yellow