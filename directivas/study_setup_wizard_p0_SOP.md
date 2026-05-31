# study_setup_wizard_p0 — SOP

## Objetivo
- Implementar los bloqueantes P0 para permitir que un coordinador configure y active un estudio desde la UI sin SQL:
  1. Team Assignment & Delegation Log.
  2. Enrollment Configuration.
  3. Activation & Readiness Gates.
  4. Source Package -> Visit Schedule Binding.

## Alcance
### Qué es
- Creación de migraciones de base de datos para la configuración de delegación y enrollment.
- Implementación de server actions para la configuración, binding y activación.
- Implementación de un flujo de Setup Wizard (UI) que guíe por estos pasos.
- Script de validación (tests) para verificar los P0.

### Qué no es
- No rediseñar el almacenamiento de documentos.
- No duplicar repositorios de eDocs.
- No reconstruir Document Intake ni Source Studio.

## Contrato (OBLIGATORIO)
### Inputs
- El estado actual del sistema (tabla `studies`, `study_members`, source_packages).
### Outputs
- Migración `0137_study_setup_wizard_foundation.sql`.
- Componentes UI del Wizard.
- Server Actions para cada paso.
- Script de prueba `.tmp/runs/...`
- Reporte `acceptance_report.all_pass == true`.

### Invariantes / Idempotencia
- La activación de un estudio falla si no pasa los checks de pre-vuelo (idempotente).
- Las configuraciones de enrollment realizan UPSERT.

## Flujo (pasos)
1. **Migración DB:** Alterar `study_members` para la información de delegación. Crear tabla `study_enrollment_configs`.
2. **Server Actions:** Crear `activateStudy()`, `bindSourcePackageToVisits()`, `saveEnrollmentConfig()`, `updateStudyMemberDelegation()`.
3. **UI Components:** Crear el Setup Wizard shell y los paneles para Delegation, Enrollment, Binding y Activation.
4. **Testing:** Crear `scripts/study_setup_wizard_p0_smoke.ts`.

## Observabilidad
- Log path: `.tmp/logs/study_setup_wizard.log`
- Run manifest path: `.tmp/runs/study_setup_wizard/YYYYMMDD_HHMMSS/manifest.json`
