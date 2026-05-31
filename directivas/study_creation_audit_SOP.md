# study_creation_audit — SOP

## Objetivo
- Auditar y mapear todo el ciclo de vida de creación de un estudio en Vilo OS, desde la ingesta de documentos hasta la activación y el enrolamiento.
- Identificar dependencias de SQL, intervenciones manuales y capacidades faltantes.
- Proporcionar un diagnóstico definitivo sobre si un coordinador puede crear y activar un estudio íntegramente por la interfaz de usuario sin usar SQL.

## Alcance
### Qué es
- Una auditoría pasiva del código y migraciones actuales relacionadas con `studies`, `document-intake`, `source-builder` y operaciones de estudio.

### Qué no es
- No es una refactorización de código ni desarrollo de una nueva funcionalidad.
- No modifica datos en la base de datos.

## Contrato (OBLIGATORIO)
### Inputs
- Fuente(s): Directorios `components/`, `app/`, `supabase/migrations/`, `scripts/` de Vilo OS.
- Formato esperado: Código fuente TypeScript/React, migraciones SQL, scripts Python/Node.
- Ejemplo mínimo (no sensible): Componentes como `create-study-form.tsx`.
- Validaciones previas: El código debe existir en la máquina local.

### Outputs
- Artefactos esperados (rutas exactas): 
  - `validation-corpus/metadata/study-creation-audit.md` o directamente un manifest.
- Formato esperado: Markdown / JSON.
- Criterios de aceptación:
  - [x] (CRITICAL) Se identifican todos los pasos actuales de creación.
  - [x] (CRITICAL) Se evalúa si el flujo completo (End-to-End) puede hacerse sin SQL (YES o NO).
  - [x] (CRITICAL) Si es NO, se enumeran los P0 Blockers.
  - [x] (NON-CRITICAL) Inventario de dependencias SQL documentado.

### Invariantes / Idempotencia
- Idempotente ya que es un análisis de solo lectura y generación de reporte. Al ejecutarse N veces genera el mismo reporte (salvo cambios en el código).
- Estrategia anti-duplicados: Sobrescribir reporte si ya existe.

## Flujo (pasos)
1. Analizar el modelo de datos en migraciones (tabla `studies`, `study_versions`).
2. Identificar interfaces de UI (e.g. `create-study-form.tsx`).
3. Buscar flujos de activación (`status = 'active'`).
4. Identificar generación de source y subject enrollment limits.
5. Listar dependencias manuales (SQL).
6. Redactar reporte final respondiendo YES/NO.

## Restricciones / Casos borde (Memoria viva)
- Nota: No hacer suposiciones sobre el flujo de activación. Si no hay botón en UI, la activación depende de SQL.

## Observabilidad
- Log path: `.tmp/logs/study_creation_audit.log`
- Run manifest path: `.tmp/runs/study_creation_audit/YYYYMMDD_HHMMSS/manifest.json`
- Señales de éxito/fracaso: Finalización correcta de la evaluación y generación del `acceptance_report.all_pass = true`.
