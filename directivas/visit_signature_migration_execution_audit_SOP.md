# visit_signature_migration_execution_audit — SOP

## Objetivo
- Auditar la ruta de ejecución exacta para migrar Visit Runtime al framework `operational_signatures`.

## Alcance
### Qué es
- Análisis de archivos, componentes, actions y schemas actuales de Visit Finalization y Procedure Execution.

## Contrato (OBLIGATORIO)
### Outputs
- Markdown con el plan de migración detallado.

## Flujo (pasos)
1. Analizar código existente.
2. Emitir script que genera el markdown.

## Observabilidad
- Log path: `.tmp/logs/visit_signature_migration_audit.log`
- Run manifest path: `.tmp/runs/visit_signature_migration_audit/YYYYMMDD_HHMMSS/manifest.json`
