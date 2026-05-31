# signature_consolidation_audit — SOP

## Objetivo
- Auditar todas las implementaciones de firma y unificarlas bajo un único servicio centralizado de eSignature en toda la plataforma Vilo OS, eliminando mecanismos primitivos/duplicados.

## Alcance
### Qué es
- Análisis e identificación del motor de firmas (`operational_signatures`).
- Reestructuración de esquemas paralelos como Delegation Log y Training Log hacia un modelo de llaves foráneas unificado.

## Contrato (OBLIGATORIO)
### Outputs
- Migración 0143_consolidate_signatures.sql
- Informe de manifiesto de auditoría y parcheado.

## Flujo (pasos)
1. Buscar firmas duplicadas.
2. Identificar el módulo maestro `operational_signature_requests`.
3. Escribir script y migración para consolidar referencialmente.

## Observabilidad
- Log path: `.tmp/logs/signature_consolidation_audit.log`
- Run manifest path: `.tmp/runs/signature_consolidation_audit/YYYYMMDD_HHMMSS/manifest.json`
