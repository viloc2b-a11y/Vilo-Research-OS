# signature_integration_impact_audit — SOP

## Objetivo
- Mapear la deuda técnica y de compliance respecto al uso de firmas primitivas (textos, booleanos, RPCs simples) versus el nuevo motor `operational_signatures`.

## Alcance
### Qué es
- Auditoría de 7 dominios de Vilo OS para verificar si las firmas usan PIN, son inmutables y están integradas.

## Contrato (OBLIGATORIO)
### Outputs
- Reporte detallado de inventario.

## Flujo (pasos)
1. Buscar en esquemas y lib/ por usos de `sign`, `signed`, `signature`.
2. Categorizar por complejidad de migración.
3. Emitir el Markdown solicitado.

## Observabilidad
- Log path: `.tmp/logs/signature_integration_impact_audit.log`
- Run manifest path: `.tmp/runs/signature_integration_impact_audit/YYYYMMDD_HHMMSS/manifest.json`
