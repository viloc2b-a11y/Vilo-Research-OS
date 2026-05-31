# Consent Runtime Build Validation Audit

## Data Model
**PASS**
- Todas las tablas solicitadas existen: `subject_consent_versions`, `subject_consent_events`, `subject_consent_documents`, `subject_consent_optional_permissions`, `subject_consent_withdrawals`, y `subject_consent_audit`.
- Roles y dependencias correctamente estructurados mediante Foreign Keys. Separa ejecuciones a nivel de sujeto, documentos y permisos opcionales en tablas discretas.

## State Machine
**PASS**
- Constantes transaccionales implementadas (pending, completed, active, superseded, withdrawn, expired, invalidated).
- Restricciones en BD aseguran un solo `initial_consent` activo.
- Soporta versión superseding automática. HIPAA y cláusulas opcionales operan independientemente sin invalidar el Main ICF.

## Signature Integration
**PASS**
- Totalmente implementado usando `operational_signature_requests`.
- Componente `ElectronicSignaturePanel` integrado para PI Review y Coordinator en `SubjectConsentRuntimePanel`.
- No hay primitives (`is_signed` boolean) actuando como fuente de la verdad para el ciclo de vida del consentimiento.

## Runtime Guards
**FAIL**
- Las funciones `canScreenSubject`, `canEnrollSubject`, `canExecuteVisit`, `canCollectOptionalSpecimen` y `hasWithdrawnConsent` fueron escritas/definidas en `lib/subject/consent/guards.ts`.
- **Defecto Crítico**: Estas guardas **no están importadas ni aplicadas en ningún lugar** dentro del `Visit Runtime`, `Subject Screening/Enrollment`, o flujos de trabajo de procedimientos. Son código muerto actualmente. El runtime sigue sin bloquear operaciones cuando falta consentimiento.

## Applicability Integration
**FAIL**
- No existe conexión entre los registros creados en `subject_consent_optional_permissions` y el motor de Applicability (que actualmente es Phase 1 basado en disables manuales). 
- Un procedimiento marcado para `future_use` o `genetic_testing` no se auto-invalida si el consentimiento opcional respectivo no fue otorgado.

## Backward Compatibility
**PASS**
- El archivo `actions.ts` actualiza explícitamente `study_subjects.consent_signed_at` y `consent_version_id` en retrocompatibilidad tras completar la firma de un ICF Principal.

## Primitive Consent Findings
- El sistema ha neutralizado la persistencia pasiva del Consent, y aunque la tabla `study_subjects` sigue recibiendo la fecha de sincronía (`consent_signed_at`), ya no dicta la lógica central del módulo de consentimientos del runtime.

## Critical Defects
1. **Guards Unenforced**: Las reglas regulatorias (ej. "no recolectar especímenes si no hay consentimiento opcional") están construidas matemáticamente en `guards.ts` pero el Visit Runtime las ignora por completo. Un coordinador puede realizar procedimientos antes de la fecha del ICF porque la barrera arquitectónica no ha sido conectada.
2. **Applicability Engine Disconnected**: El Source Runtime no responde al estado de los Optional Consents. 

## What Is Actually Validated
- El schema de base de datos fue desplegado y es 21 CFR Part 11 ready.
- La Interfaz de Usuario y los Server Actions (CRUD, State Transitions, Signatures) operan correctamente como un módulo encapsulado.

## What Still Requires UAT
- Conectar `guards.ts` a las Server Actions del Visit Runtime.
- Conectar Optional Consents al Applicability Engine de Subject Source.

## Final Verdict
**NOT READY**
El Consent Runtime es funcionalmente una isla. Para considerarse Ready for UAT, las guardas deben ser obligatoriamente aplicadas como middlewares y cortafuegos en las acciones que mutan datos clínicos (ej. `executeProcedure`, `completeVisit`, `enrollSubject`).
