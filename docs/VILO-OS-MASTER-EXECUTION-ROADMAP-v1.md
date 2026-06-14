# VILO OS — Master Execution Roadmap v1

**Status:** Baseline oficial  
**Fecha:** 2026-06-14  
**Alcance:** Completion roadmap del Site Operating System — dependencias reales, sin features opcionales hasta Sprint G

---

## Principio fundacional

Vilo OS es un **Clinical Research Site Operating System**.

Cada sprint se mide contra una sola pregunta:

> ¿Contribuye directamente a cerrar los Sprints A–J, o introduce una nueva dirección?

Si introduce una nueva dirección → espera hasta después de Sprint G.

Lo que NO entra en este roadmap hasta después de Sprint G:

- Sponsor Portal
- AI Copilots
- Benchmarking externo
- CRA Workspace
- Portales externos

---

## Estado actual de completitud

| Módulo | Completitud |
|---|---:|
| Platform Core | 90% |
| Studies Runtime | 90% |
| Subject Runtime | 85% |
| Document Center | 75% |
| Financial Runtime | 70% |
| Pharmacy Runtime | 75% |
| Labs Runtime | 70% |
| Safety Runtime | 35% |
| Regulatory Runtime | 15% |
| Consent Runtime | 15% |
| Amendment Runtime | 25% |
| Workflow Backbone | 30% |
| Governance Closure | 40% |

Los próximos sprints atacan precisamente los módulos con menor completitud.

---

## Definitions of Done (DoD) — Obligatorias para todos los sprints

### DoD 1 — Coordinator Visible

Ningún sprint se considera terminado hasta que el coordinador pueda verlo en la UI.

No basta crear la tabla.  
No basta crear la API.

Debe existir visibilidad real:

- Subject Workspace
- VPI / Coordinator Inbox
- Coordinator Queue

**Ejemplo Safety:** no basta `sae_events` creado. Debe existir "SAE con clock vencido → acción urgente en coordinator inbox."  
**Ejemplo Regulatory:** no basta `irb_documents`. Debe existir "IRB expiring in 14 days → visible para el coordinador."

### DoD 2 — Subject Workspace Integration

Todo lo relacionado con un sujeto debe aparecer en Subject 360°.

- Safety events
- Consent status
- Deviations
- Amendment impacts
- Training impacts

Sin excepción.

### DoD 3 — Workflow Backbone Integration

Después de Sprint D, ningún módulo nuevo puede crear su propia cola de acciones.

Todo debe enrutar a `subject_workflow_actions` o su evolución canónica.

Un sprint que genera acciones sin conectarlas al Workflow Backbone está **incompleto**.

### DoD 4 — Command Center Integration

Cada sprint debe responder la pregunta:

> ¿Qué tengo que hacer hoy?

Si una acción existe pero no aparece en el Command Center → el sprint está incompleto.

### DoD 5 — Pilot Evidence

Cada sprint debe terminar con artefactos en `.runtime-validation/` o equivalente.

Porque cuando llegue el pilot, el sponsor, el auditor, o el inversor, se necesitará **evidencia**, no solo código.

---

## Sprints

### Sprint A — Platform Stability

*Higiene de plataforma. Prerrequisito absoluto de todo lo demás.*

| | Tarea |
|---|---|
| A1 | Live Supabase validation — resolver `TypeError: fetch failed` degradation |
| A2 | Strict integrity audit — limpiar findings del Phase 11 (`npm run integrity:audit:strict`) |
| A3 | Migration ledger reconciliation — canonicalizar orden y prefijos duplicados |
| A4 | Release readiness ledger — vocabulario único de madurez: `prototype / v0 / active / validated / pilot-ready / prod-ready` |
| A5 | README actualización — remover sección "Out of scope (MVP scaffold)" stale |

---

### Sprint B — Document Center E2E Validation

*Gate #1 del proyecto. La promesa principal de Vilo OS.*

```
Protocol → Reconciliation → Runtime Generation → Source Package → Visit Runtime → Executed
```

| | Tarea |
|---|---|
| B1 | Validación E2E completa **VALIDATION_PROTOCOL_001** — hasta visit instance ejecutada y source validado |
| B2 | Validación E2E completa **VALIDATION_PROTOCOL_002** — misma cadena completa |
| B3 | Runtime validation artifacts commiteados como evidencia oficial |

> Sin Sprint B demostrado, Vilo OS no puede llamarse Site Operating System.

---

### Sprint C — Safety Runtime Closure

*Core clinical operations. Los gaps aquí son regulatorios, no de UX.*

| | Tarea |
|---|---|
| C1 | **SAE lifecycle completo** — causality, outcome, relatedness, seriousness criteria |
| C2 | **Reporting clocks** — 24h (life-threatening SAE) + 15-day (unexpected SAE) desde `onset_date`; alertas activas en VPI |
| C3 | **Sponsor notification tracking** — cuándo, a quién, método, acknowledgment |
| C4 | **Follow-up tracking** — follow-up events ligados al SAE original; estado: pending / submitted / complete |
| C5 | **Subject Workspace linkage** — panel SAE completo en Subject 360° con todos los campos |
| C6 | **VPI linkage** — SAEs con clocks vencidos o próximos como acciones urgentes en coordinator inbox |

---

### Sprint D — Universal Workflow Backbone

*Infraestructura compartida. Se construye aquí para que Safety, Regulatory, Consent y Amendment enruten a la misma cola coordinadora.*

```
Safety     → Workflow Backbone → Coordinator Queue
Regulatory → Workflow Backbone → Coordinator Queue
Consent    → Workflow Backbone → Coordinator Queue
Amendment  → Workflow Backbone → Coordinator Queue
```

| | Tarea |
|---|---|
| D1 | **Universal object linking** — `subject_workflow_actions` linkeable a Study / Visit / Deviation / AE / Document / CAPA |
| D2 | **Owner + due date + priority** — campos de ownership, fecha y escalación en workflow actions |
| D3 | **SLA escalation rules** — acción supera SLA → escala automáticamente |
| D4 | **Multi-query per field** — múltiples queries por campo de source |
| D5 | **Query burden → VPI coordinator load** — query burden analytics en `OwnerWorkflowQueue` |

> Después de Sprint D, todos los módulos siguientes escriben sus acciones a esta infraestructura.

---

### Sprint E — Regulatory + Consent Foundation

*Construidos juntos porque IRB → ICF → Reconsent es un flujo continuo.*

**Regulatory layer:**

| | Tarea |
|---|---|
| E1 | **IRB expiration tracking** — approval vigente, fecha de expiración, renewal alert en VPI |
| E2 | **FDA Form 1572 lifecycle** — versiones, investigador firmante, protocol version linkage |
| E3 | **CV / License / Credential lifecycle** — expiración, alerta antes de vencimiento |
| E4 | **Delegation compliance** — credential activa verificada por rol delegado; alerta si credential expira con delegación activa |
| E5 | **Training expiration** — training por protocol version, fecha de vencimiento, alerta al coordinador |
| E6 | **Document readiness checklist** — qué está, qué falta, qué está vencido en el regulatory binder |

**Consent foundation — Branch A (ICF Template Runtime):**

| | Tarea |
|---|---|
| E7 | **Consent document versioning** — IRB approval date, effective date, expiration date |
| E8 | **Superseded version tracking** — cadena de versiones con lineage explícito |
| E9 | **Reconsent trigger** — nueva versión IRB-aprobada → genera `subject_consent_reconsent_requirements` para subjects activos automáticamente |

> IRB aprueba nueva versión → ICF activa se actualiza → reconsent requirements generados.

---

### Sprint F — Consent Execution Runtime

*Branch B — Signed Consent Runtime completo.*

| | Tarea |
|---|---|
| F1 | **Paper consent** — upload ICF firmado, fecha, hora, witness, coordinator, PI |
| F2 | **Electronic consent** — `PatientConsentPortal` conectado al signed consent record oficial |
| F3 | **Hybrid mode** — paper firmado + scan digital como certified copy |
| F4 | **Reconsent chain** — subject con consent activo + reconsent requirement → flujo de re-firma con ICF nuevo |
| F5 | **PI signoff** — PI acknowledge del proceso de consentimiento |
| F6 | **Consent status en VPI** — subjects con consent vencido / reconsent pendiente en risk queue |

---

### Sprint G — Amendment Runtime

*Flujo downstream completo del amendment. Uno de los diferenciadores más fuertes de Vilo OS.*

```
Amendment Approved
  → Impact Analysis
  → Training Assignment
  → Reconsent Requirement
  → Visit / Procedure Changes
  → Coordinator Actions (via Workflow Backbone)
```

| | Tarea |
|---|---|
| G1 | **Impact Analysis** — subjects afectados, visits afectadas, procedures afectados |
| G2 | **Training cascade** — auto-asignar training a staff activo cuando amendment requiere re-review |
| G3 | **Reconsent cascade** — auto-generar reconsent requirements para subjects activos afectados |
| G4 | **Visit/procedure diff** — en Study Workspace: qué cambió en el runtime por este amendment |
| G5 | **Coordinator action items** — amendment → acciones concretas en Workflow Backbone (owner, due date, prioridad) |
| G6 | **Amendment status tracking** — pending → submitted → IRB review → approved → activated |

---

### Sprint H — Governance Lifecycle Closure

*Cierra el único lifecycle de compliance que sigue incompleto.*

| | Tarea |
|---|---|
| H1 | Deviation adjudication: `candidate signal → PI review → confirmed → CAPA linkage → resolved` |
| H2 | CAPA → VPI feed — CAPAs abiertos en coordinator risk queue |
| H3 | Governance signal lifecycle — supersede, reopen, escalate |
| H4 | Protocol deviation panel en Subject 360° — desviaciones confirmadas |

---

### Sprint I — Integration Bridges

| | Tarea |
|---|---|
| I1 | ClinIQ → Financial Runtime absorption (SoA billables, leakage engine) |
| I2 | Vitalis → Subject Runtime handoff (lead → enrollment attribution) |
| I3 | CRM v0 → v1 |
| I4 | Communications email provider lifecycle |

---

### Sprint J — External Visibility

*Solo después de datos reales de pilot.*

| | Tarea |
|---|---|
| J1 | Export privacy engine (field masking por role/study/report type + export audit trail) |
| J2 | Sponsor visibility layer |
| J3 | VIP adapter hardening |
| J4 | Benchmarking / scoring externo |

---

## Mapa de dependencias

```
A (Stability)
    ↓
B (Document Center — Gate #1)
    ↓
C (Safety Runtime)
    ↓
D (Workflow Backbone) ←── infraestructura compartida para E, F, G, H
    ↓
E (Regulatory + Consent Foundation)
    ↓
F (Consent Execution)
    ↓
G (Amendment Runtime)
    ↓
H (Governance Closure)
    ↓
I (Integration Bridges)
    ↓
J (External Visibility)
```

---

## Cierre estratégico al terminar Sprint G

Al completar Sprint G, Vilo OS cierra sus cuatro huecos estratégicos:

| Gap | Cerrado en |
|---|---|
| Document Center validado E2E | Sprint B |
| Safety Runtime completo | Sprint C |
| Regulatory + Consent Runtime | Sprint E + F |
| Amendment → Action Engine | Sprint G |

Y el Workflow Backbone (Sprint D) ya es el canal único por donde todos los módulos enrutan sus acciones al coordinador — que es el principio fundacional de Vilo OS.

---

## Punto de reevaluación

Reevaluar el roadmap al terminar Sprint D.

Para ese punto habrá suficiente visibilidad para saber si:

- Regulatory necesita subir prioridad
- Consent necesita dividirse más
- Amendment necesita expandirse
- O si el roadmap sigue intacto

---

*Este documento es el baseline oficial del roadmap Vilo OS. Actualizaciones deben reflejar decisiones reales de ejecución, no exploraciones arquitectónicas.*
