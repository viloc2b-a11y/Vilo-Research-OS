# study_unblinded_embedding — SOP

## Objetivo
- Integrar las capacidades unblinded nativamente dentro del Study Runtime, Subject Runtime y Visit Runtime existentes.
- Prevenir la existencia de un "workspace paralelo" duplicado, manteniendo el código unificado pero condicionalmente renderizado con protección de servidor severa.

## Alcance
### Qué es
- Un parche arquitectónico (acciones y layouts) que asegura que la interfaz unblinded aparezca de forma transparente solo a los usuarios autorizados (sin pistas para usuarios cegados).
- Refactorización de Server Actions para usar `canAccessUnblindedStudyArea` agresivamente en cada mutación.
- Scripts de validación.

### Qué no es
- No rediseñar el Subject/Visit runtime, solo inyectar `UnblindedSection` si tienen permisos.

## Contrato (OBLIGATORIO)
### Outputs
- Server actions protegidos (`lib/studies/unblinded-actions.ts`).
- Componentes unificados para inserción en Runtimes (`components/study-workspace/unblinded-study-section.tsx`, `components/subject-runtime/unblinded-subject-section.tsx`, `components/visit-runtime/unblinded-visit-section.tsx`).
- Smoke tests que demuestren el bloqueo.

## Flujo (pasos)
1. Modificar las Server Actions (IP Dispensing, Accountability, eDocs Upload/Download) para invocar obligatoriamente el guard.
2. Crear los componentes inyectables.
3. Escribir tests y manifest.

## Observabilidad
- Log path: `.tmp/logs/study_unblinded_embedding.log`
- Run manifest path: `.tmp/runs/study_unblinded_embedding/YYYYMMDD_HHMMSS/manifest.json`
