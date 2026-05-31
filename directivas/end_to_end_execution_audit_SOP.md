# end_to_end_execution_audit — SOP

## Objetivo
- Ejecutar y documentar la validación operativa final "End-to-End" desde Study Setup hasta Visit Finalization para confirmar que un coordinador puede operar completamente Vilo OS sin SQL.

## Alcance
### Qué es
- Simulacro completo del ciclo de vida del sujeto.
- Validación de persistencias y UI (Study State, Subject Creation, Visit Schedule, Visit Execution, Longitudinal Sections, Signatures, Finalization).
- Producción del Execution Map y Pass/Fail Matrix.

## Contrato (OBLIGATORIO)
### Outputs
- Validation Matrix report.
- Manifiesto actualizado.

## Flujo (pasos)
1. Escribir script de validación que analice y consolide el estado de las herramientas construidas.
2. Generar artifact de salida y manifiesto.

## Observabilidad
- Log path: `.tmp/logs/end_to_end_execution_audit.log`
- Run manifest path: `.tmp/runs/end_to_end_execution_audit/YYYYMMDD_HHMMSS/manifest.json`
