# study_wizard_ui_regulatory — SOP

## Objetivo
- Implementar las reglas regulatorias adicionales para los Training Logs y Delegation Logs (Staff Initials, Verification, Refresher).
- Integrar la validación Training ↔ Delegation.
- Construir el "Study Setup Wizard UI Shell" y "Training Matrix".

## Alcance
### Qué es
- Migración `0139_study_wizard_regulatory_addendum.sql`.
- Server actions extendidas en `lib/studies/setup-wizard-regulatory-actions.ts`.
- Mock Smoke Tests en `scripts/study_wizard_regulatory_smoke.ts`.
- Componente base `components/studies/setup/study-setup-wizard-shell.tsx`.

### Qué no es
- No se expone un panel FDA/CRA.

## Contrato (OBLIGATORIO)
### Outputs
- Migración 0139.
- Actions / Componentes.
- Script Python de validación.

## Observabilidad
- Log path: `.tmp/logs/study_wizard_ui_regulatory.log`
- Run manifest path: `.tmp/runs/study_wizard_ui_regulatory/YYYYMMDD_HHMMSS/manifest.json`
