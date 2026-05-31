# study_runtime_canonicalization — SOP

## Objetivo
- Definir la estructura final del Study Runtime antes de construir el Wizard.
- Modelar correctamente el contenedor Study en Vilo OS (Operational Layer vs Regulatory Layer).
- Analizar si la arquitectura actual soporta "Shared Site Master Files" y "Study-Specific Regulatory Files" sin duplicar repositorios de documentos.
- Producir matrices de: Study Runtime Structure, Shared Document Reuse Audit, Activation Readiness, y Especificación del Study Setup Wizard.

## Alcance
### Qué es
- Un análisis arquitectónico y regulatorio del estado actual del sistema de documentos y estudios de Vilo OS.
- Una evaluación de reusabilidad de documentos a nivel Site/Organización versus Estudio.

### Qué no es
- No se escribe código de la aplicación.
- No se crean migraciones de DB.
- No se construye UI.

## Contrato (OBLIGATORIO)
### Inputs
- Fuente(s): Directorio `c:\dev\vilo-os\supabase\migrations` y `c:\dev\vilo-os\lib\document-intake`.
- Formato esperado: Código fuente TypeScript/React, migraciones SQL, scripts Python.
- Validaciones previas: El código base de Vilo OS.

### Outputs
- Artefactos esperados (rutas exactas): 
  - `validation-corpus/metadata/study-runtime-canonicalization.md`
- Formato esperado: Markdown / JSON.
- Criterios de aceptación:
  - [x] (CRITICAL) Se define la Study Runtime Structure Matrix.
  - [x] (CRITICAL) Se define la Shared Document Reuse Audit (YES o NO explícito).
  - [x] (CRITICAL) Se define la Activation Readiness Matrix.
  - [x] (CRITICAL) Se define la Study Setup Wizard Specification (solo gaps reales).
  - [x] (CRITICAL) Respuesta final a si la arquitectura soporta el reuso sin duplicar (YES/NO) + P0 Blockers.

### Invariantes / Idempotencia
- Análisis determinista: El script genera la respuesta basada en el código. Al correr repetidas veces, no se corrompe el estado ni se crean nuevos registros en la DB.

## Flujo (pasos)
1. Analizar si los documentos (attachments/document-intake) pueden referenciar a `organization` en lugar de `study_id`.
2. Identificar el soporte de Role-based Delegation Log (RBAC vs Log persistido).
3. Evaluar los requerimientos de Activación (Enrollment rules, Subject numbering, Randomization rules).
4. Escribir reporte.

## Restricciones / Casos borde (Memoria viva)
- Nota: Actualmente, document-intake probablemente une `organization_id` y opcionalmente `study_id`. Evaluar esto para Shared Document Reuse.

## Observabilidad
- Log path: `.tmp/logs/study_runtime_canonicalization.log`
- Run manifest path: `.tmp/runs/study_runtime_canonicalization/YYYYMMDD_HHMMSS/manifest.json`
- Señales de éxito/fracaso: Finalización correcta de la evaluación y generación del `acceptance_report.all_pass = true`.
