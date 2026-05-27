# Schedule of Events Extraction — SOP

## Objetivo
Extraer de manera determinista matrices de procedimientos (Schedule of Events) desde documentos PDF/Excel utilizando Docling (y openpyxl como soporte) para luego normalizar mediante LLM y presentar al coordinador para su revisión, sin mutar runtime ni auto-publicar.

## Alcance
### Qué es
- Pipeline de subida de PDF/Excel.
- Extracción estructural con `docling` (script Python).
- Normalización semántica vía LLM (OpenRouter/GPT-4o o similar).
- Interfaz de revisión (Checklist) para el coordinador en `app/(ops)/source-builder/intake`.
- Persistencia de resultados como drafts JSON (en `source_builder_drafts`).

### Qué no es
- Generación automática de código fuente (eSource).
- Auto-binding a procedures en el runtime.
- Auto-publicación de protocolos.
- Extracción full-LLM sin base estructural OCR.

## Contrato (OBLIGATORIO)
### Inputs
- Fuente(s): Archivo PDF (Protocolo o SoA) o Excel (.xlsx).
- Formato esperado (schema/descripción): Archivos binarios subidos vía formulario multipart.
- Ejemplo mínimo (no sensible): `PARA_OA_012_Protocol.pdf`
- Validaciones previas: Verificar el MIME type y tamaño del archivo.

### Outputs
- Artefactos esperados (rutas exactas): 
  - Archivo subido en tabla `protocol_vault_documents`.
  - JSON Draft en `source_builder_drafts`.
- Formato esperado: Estructura de `ProtocolIntakeDraft` expandida con matrix de extracción.
- Criterios de aceptación:
  - [ ] (CRITICAL) El PDF de prueba (PARA_OA_012) extrae Screening, Treatment, y Follow-up tables sin perder filas.
  - [ ] (CRITICAL) Las celdas marcadas con 'X' o '(X)' se preservan y mapean a booleanos `required` o `conditional`.
  - [ ] (CRITICAL) La UI presenta una lista de verificación al coordinador.
  - [ ] (CRITICAL) Los resultados se guardan estrictamente como draft, separados en `raw_extraction_output`, `normalized_procedure_list`, `coordinator_selected_procedures`.

### Invariantes / Idempotencia
- Definición de “idempotente” para esta tarea: Subir el mismo archivo genera un nuevo `extraction_run_id` como un borrador independiente. No se duplican las definiciones de runtime.
- Estrategia anti-duplicados: Los borradores son entidades temporales por organización.
- Resume/retry: El coordinador puede recargar el review tab de su borrador.

## Flujo (pasos)
1. Construir script Python (`scripts/docling_extract.py`) que acepte un PDF, ejecute Docling y devuelva un JSON con las tablas HTML/JSON.
2. Construir Server Action en TypeScript para manejar la subida del archivo, invocar el script Python (o endpoint temporal), y pasar el resultado por el LLM (`lib/protocol-intake/extractors/schedule-normalizer.ts`).
3. Construir la vista de Intake (`app/(ops)/source-builder/intake/upload/page.tsx`) y Review (`app/(ops)/source-builder/intake/[draftId]/review/page.tsx`).
4. Almacenar el resultado en `source_builder_drafts`.

## Restricciones / Casos borde (Memoria viva)
- Nota: Docling divide tablas multi-página. El LLM o la lógica de concatenación debe unirlas.
- Falsos positivos (filas extra que no son procedimientos) son aceptables, el coordinador las desmarcará. Falsos negativos (procedimientos perdidos) son inaceptables.

## Observabilidad
- Log path: `.tmp/logs/schedule_extraction.log`
- Run manifest path: `.tmp/runs/schedule_extraction/YYYYMMDD_HHMMSS/manifest.json`
- Señales de éxito/fracaso: El script Python devuelve JSON válido con tablas.
