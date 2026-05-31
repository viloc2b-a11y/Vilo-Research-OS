# subject_visit_runtime_audit — SOP

## Objetivo
- Ejecutar la auditoría final sobre Subject Runtime y Visit Execution para certificar si un coordinador puede llevar un sujeto desde enrollment hasta visit finalization nativamente en la plataforma.

## Alcance
### Qué es
- Un diagnóstico integral de las interfaces de Sujeto (MedHhx, AE, ConMed, Source Docs) y del motor de ejecución de Visitas.
- Emisión del veredicto final.

## Contrato (OBLIGATORIO)
### Outputs
- Validation Matrix report para Subject/Visit execution.
- Manifiesto actualizado.

## Observabilidad
- Log path: `.tmp/logs/subject_visit_runtime_audit.log`
- Run manifest path: `.tmp/runs/subject_visit_runtime_audit/YYYYMMDD_HHMMSS/manifest.json`
