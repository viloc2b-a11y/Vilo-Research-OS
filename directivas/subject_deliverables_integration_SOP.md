# Subject Deliverables Workspace Integration — SOP

## Objetivo
- Integrar la capacidad de generar y descargar entregables regulatorios (Consent Evidence Package y Printable Source Packet) directamente desde el Subject Workspace, sin forzar a los coordinadores a navegar al builder administrativo de Deliverables.

## Alcance
### Qué es
- Modificación del Subject Workspace (UI/Tabs) para incluir un panel de Deliverables.
- Invocación de las `actions` existentes del Deliverable Runtime desde el contexto del paciente.
- Descarga de PDFs generados.
- Visibilidad del historial de entregables del sujeto y de sus visitas.

### Qué no es
- No es la creación de nuevos tipos de entregables (CRA Workbook, Source Evidence Workbook, Financial Workbook).
- No es un rediseño del Subject Runtime.
- No es una re-implementación o duplicación de la lógica de generación del Deliverable Runtime.

## Contrato (OBLIGATORIO)
### Inputs
- Fuente(s): `subjectId`, `studyId`, `organizationId` del Subject Workspace context.
- Formato esperado (schema/descripción): UUIDs pasados por props a los componentes desde la ruta.
- Ejemplo mínimo (no sensible): `subjectId=123e4567-e89b-12d3-a456-426614174000`
- Validaciones previas: Permisos resueltos mediante `resolveSubjectChartPermissions` y `canMutateOrganizationData`.

### Outputs
- Artefactos esperados (rutas exactas): 
  - Archivos de UI actualizados (`SubjectDeliverablesSection.tsx`, `page.tsx`).
  - Lógica de carga actualizada (`load-subject-deliverables.ts`).
  - Smoke test verificado: `scripts/subject-deliverables-workspace-smoke.ts`.
- Formato esperado: UI Componente incrustado en tab `deliverables` del Subject Workspace.
- Ejemplo mínimo: Clicks mínimos, UI basada en botones de "Generate" y "Download" sin IDs crudos.
- Criterios de aceptación:
  - [x] (CRITICAL) Desde Subject Workspace, un usuario puede ver entregables existentes del sujeto.
  - [x] (CRITICAL) Puede generar y descargar Consent Evidence Package.
  - [x] (CRITICAL) Puede ver visitas disponibles del sujeto.
  - [x] (CRITICAL) Puede generar y descargar Printable Source Packet para una visita.
  - [x] (CRITICAL) No copiar UUIDs ni salir al builder administrativo.

### Invariantes / Idempotencia
- Definición de “idempotente” para esta tarea: Invocar múltiples veces la generación creará múltiples "runs", lo cual es el comportamiento esperado del Deliverable Runtime para regenerar versiones actualizadas.
- Estrategia anti-duplicados: La UI solo muestra los runs existentes y permite descargar el output más reciente, o explícitamente generar uno nuevo.
- Resume/retry: Si falla la generación, el error se muestra en pantalla y el usuario puede reintentar con el botón "Generate".

## Flujo (pasos)
1. Verificar implementación actual en `app/(ops)/subjects/[subjectId]/page.tsx` (ya expone el tab).
2. Verificar y alinear `SubjectDeliverablesSection.tsx` con el Subject Workspace.
3. Actualizar `scripts/subject-deliverables-workspace-smoke.ts` para testear la invocación real del `generateDeliverableAction`.
4. Validar tipos, lint y ejecutar el smoke test para cumplir el DoD.

## Restricciones / Casos borde (Memoria viva)
- Nota: No hacer que el usuario ingrese IDs a mano, porque rompe el principio "Coordinator First". En su lugar, hacer que el contexto de la ruta provea el `subjectId` y la lista de visitas.
- Nota: No duplicar endpoints. Usar `generateDeliverableAction` importado de `lib/deliverables/actions`.

## Observabilidad
- Log path: `.tmp/logs/subject_deliverables_integration.log`
- Run manifest path: `.tmp/runs/subject_deliverables_integration/{timestamp}/manifest.json`
- Señales de éxito/fracaso: Todo TS compile, lint pase y smoke devuelva status exitoso.
