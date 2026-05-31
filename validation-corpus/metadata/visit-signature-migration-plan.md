# Visit Signature Migration Plan

## Files To Modify
- **Base de Datos:** Se requiere una nueva migración SQL para añadir columnas `coordinator_signature_request_id` e `investigator_signature_request_id` a `visit_progress_notes` (o `visits`), y `signature_request_id` a `procedure_executions`.
- **Server Actions:** `lib/subject/visits/progress-note/actions.ts` y `lib/visit-runtime/signProcedure.ts`.
- **UI Components:** `components/subjects/visits/CoordinatorSignatureCard.tsx`, `InvestigatorSignatureCard.tsx`, y `VisitActionToolbar.tsx`.

## Actions To Replace
El modelo de un solo paso (`sign()`) debe reemplazarse por un modelo de dos pasos:
1. **Paso 1 (Request):** `signCoordinatorProgressNoteAction`, `signInvestigatorReviewAction`, y `signProcedure` se convierten en inicializadores. Invocarán internamente a `requestOperationalSignature` y devolverán el `request_id` a la UI.
2. **Paso 2 (Complete):** Crear nuevas funciones de callback (ej. `completeCoordinatorSignatureAction`) que la UI invocará después de que el PIN sea verificado con éxito, para alterar el estado de la visita o procedimiento.

## RPCs To Replace
- `sign_visit_coordinator_closeout`
- `sign_visit_investigator_closeout`
Deben modificarse para requerir el `signature_request_id` validado, o bien deprecarlos y manejar la lógica en los Server Actions apoyados por la seguridad Row-Level de Postgres.

## UI Components To Modify
- **Coordinator Closeout:** Reemplazar el botón primitivo en `CoordinatorSignatureCard.tsx` por la instanciación de `<ElectronicSignaturePanel />` cuando el request se ha emitido.
- **Investigator Closeout:** Idem en `InvestigatorSignatureCard.tsx`.
- **Procedure Signatures:** Interceptar el clic en `VisitActionToolbar.tsx` (botón "Sign Procedure"), abrir un modal contextual, y montar el `<ElectronicSignaturePanel />`.

## Locking Integration Point
**State Transition Exacta:**
El estado de bloqueo (donde se prohíbe editar la Progress Note o el Procedure) sucede **inmediatamente después** de que `signOperationalRequest` retorna con éxito, dentro del Server Action de *Complete*. 
- En el caso de Progress Note: se cambia `visit_review_status` a `'coordinator_signed'`. Los guards existentes (`saveVisitProgressNoteAction`) leerán este estado y rechazarán mutaciones.
- En el caso de Procedure: se cambia `is_locked = true`.

## Estimated Complexity
**MEDIUM.**

## Recommended Implementation Order
1. **Migración SQL:** Añadir las columnas `_request_id` a las tablas operativas del Visit Runtime.
2. **Refactorización de Actions:** Dividir la lógica de firmado actual en `Request` y `Complete`.
3. **UI Injection:** Incrustar el `<ElectronicSignaturePanel />` en los componentes `CoordinatorSignatureCard`, `InvestigatorSignatureCard` y `VisitActionToolbar`.
4. **Guards Verification:** Correr tests para confirmar que la inmutabilidad (Locking) funciona y que no se puede evadir la validación PIN.

## Final Verdict
¿Es una migración de días o de semanas?

**Es una migración de DÍAS.**
A diferencia de Delegation y Training Log (que requieren semanas para construir las UIs CRUD completas), la arquitectura visual y operativa del Visit Runtime ya está funcional al 100%. Solo requiere interceptar los botones de firma existentes y enrutarlos hacia el componente validado de PIN, manteniendo la UX intacta.
