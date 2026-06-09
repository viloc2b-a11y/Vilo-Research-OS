# CRA Monitoring Workbook Generator — SOP

## Objetivo
- Implementar el primer workbook XLSX dentro del Deliverable Runtime: "CRA Monitoring Workbook".
- Proveer un snapshot offline, auditado y reproducible para SDV / monitoring preparation que reemplace 8-12 exportaciones manuales.
- Proteger al sitio clínico NO exponiendo inteligencia interna, carga de trabajo, revenue, riesgos internos ni métricas de productividad.

## Alcance
### Qué es
- Un generador de entregables tipo XLSX en el Deliverable Runtime.
- Un consumidor de evidencia ejecutada (Visit Instances -> Procedures -> Evidence), mostrando versiones utilizadas durante la ejecución.
- Un reporte con hojas específicas: Cover, Subject Index, Visit Index, Procedure Matrix, Consent Summary, Signature Summary, Document Lineage Summary.

### Qué no es
- No es un CRA Super Dashboard interactivo.
- No es un reporte que usa versiones activas/actuales por defecto (usa lo ejecutado).
- No expone queries, query aging, desviaciones, predictiva, carga del coordinador, métricas VPI ni fuga de ingresos.
- No es un módulo de reportes aislado; se integra mediante `Deliverable Definition`, `Evidence Resolver`, `Deliverable Output` y `Audit Event`.

## Contrato (OBLIGATORIO)
### Inputs
- Fuente(s): `Deliverable Run` en base de datos con scope de estudio, y opcionalmente limitable a subjects/visits.
- Formato esperado: `{ systemCode: 'cra_monitoring_workbook', studyId: string, asOfDate: string, ... }`
- Validaciones previas: El `runId` debe existir. El scope debe permitir acceso de CRA/Coordinator.

### Outputs
- Artefactos esperados (rutas exactas): 
  - `lib/deliverables/generate-cra-monitoring-workbook.ts`
  - `lib/deliverables/renderers/cra-monitoring-workbook.ts` (si es necesario)
  - Modificaciones en `lib/deliverables/actions.ts` y UI builder (ej. `app/(ops)/deliverables/page.tsx` o similar).
  - Smoke test: `scripts/cra-monitoring-workbook-smoke.ts`
- Formato esperado: Buffer XLSX guardado en Supabase Storage `deliverables` bucket.
- Criterios de aceptación:
  - [ ] (CRITICAL) Genera archivo XLSX con 7 hojas requeridas.
  - [ ] (CRITICAL) Las filas se basan en evidencia de ejecución (Visit Instances, no source templates abstractos).
  - [ ] (CRITICAL) NO contiene datos de riesgo interno, carga de trabajo, queries o desviaciones (verificado mediante assertions).
  - [ ] (CRITICAL) Output se hashea, se guarda, se inserta en `deliverable_run_outputs` y se registra `audit_event`.

### Invariantes / Idempotencia
- Definición de “idempotente”: Cada ejecución crea un output inmutable con su propio hash e ID en el bucket `deliverables`, asociado a un nuevo `runId` si se vuelve a solicitar. El archivo anterior no se muta.
- Estrategia anti-duplicados: Runs son entidades discretas con timestamps y as_of_date.

## Flujo (pasos)
1. Inspeccionar dependencias (`package.json`) para ver qué librería usar para XLSX (ej. `exceljs` o `xlsx`).
2. Actualizar definiciones en `lib/deliverables/definitions.ts` para incluir `cra_monitoring_workbook`.
3. Crear el Evidence Resolver o extender los existentes.
4. Crear el Renderer (generación del workbook con hojas y columnas especificadas).
5. Crear la función `generateCRAMonitoringWorkbook` (load, resolve, render, hash, store, update run, audit).
6. Registrar acción en `actions.ts`.
7. Actualizar el Deliverables Builder UI (si existe).
8. Crear y ejecutar el smoke test `cra-monitoring-workbook-smoke.ts`.

## Restricciones / Casos borde (Memoria viva)
- Nota: Proteger la IP del sitio asegurándose de no consultar ni incluir tablas de "queries", "deviations" o "risks" en las hojas. Si se usan resolvers compartidos, mapear explícitamente solo las columnas permitidas.
- Nota: Las fechas vacías deben renderizarse como `"-"` en lugar de null/undefined para evitar errores en Excel.

## Observabilidad
- Log path: `.tmp/logs/cra_monitoring_workbook.log`
- Run manifest path: `.tmp/runs/cra_monitoring_workbook/{timestamp}/manifest.json`
- Señales de éxito/fracaso: Smoke test parsea el Excel y confirma existencia de hojas y no fugas de datos de query/risk.
