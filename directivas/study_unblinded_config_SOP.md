# study_unblinded_config — SOP

## Objetivo
- Hacer que el Unblinded Domain sea opcional y dependa enteramente de la configuración del estudio (`blinding_type` y `requires_unblinded_team`).

## Alcance
### Qué es
- Migración para añadir los campos `blinding_type` y `requires_unblinded_team` a la tabla `studies` (o `study_enrollment_configs`).
- Refactor del `unblinded-guard.ts` para que si el estudio NO requiere equipo descegado, niegue el acceso de raíz y suprima la UI independientemente de la delegación de staff.
- Parchear las lógicas de readiness para ignorar chequeos descegados en estudios abiertos u observacionales.

### Qué no es
- No es una configuración a nivel de organización, es estrictamente a nivel de estudio.

## Contrato (OBLIGATORIO)
### Outputs
- Migración `0141_study_unblinded_config.sql`.
- `lib/auth/unblinded-guard.ts` (Actualizado).
- Mock Tests en script runner Python.
- Manifiesto actualizado.

## Flujo (pasos)
1. Alterar tabla `studies`.
2. Sobrescribir `canAccessUnblindedStudyArea` inyectando validación del study configuration.
3. Crear script de validación.

## Observabilidad
- Log path: `.tmp/logs/study_unblinded_config.log`
- Run manifest path: `.tmp/runs/study_unblinded_config/YYYYMMDD_HHMMSS/manifest.json`
