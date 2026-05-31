# study_training_delegation — SOP

## Objetivo
- Implementar el "Protocol-Related Staff Training Log" y "Protocol Delegation Log".
- Definir la biblioteca dinámica de deberes delegados (`study_delegation_duties`).
- Rastrear entrenamientos específicos de protocolo, requerimientos de firma (staff, trainer, PI).
- Configurar las dependencias de activación para validar la delegación y el entrenamiento.

## Alcance
### Qué es
- Creación de migración para las tablas de entrenamiento específico por estudio y la bitácora de delegación dinámica de firmas.
- Server actions para asignar, firmar y revocar delegaciones.
- Server actions para asignar y firmar entrenamientos de protocolo.
- Actualización de las compuertas de activación (`checkActivationReadiness`).
- Pruebas de humo para los 15 escenarios solicitados.

### Qué no es
- No rediseñar entrenamientos compartidos (`00.Trainings`) en la organización.
- No exponer paneles internos CRA/FDA.

## Contrato (OBLIGATORIO)
### Inputs
- El modelo actual de estudios y `study_members`.
### Outputs
- Migración `0138_study_training_delegation.sql`.
- Server actions en `lib/studies/training-delegation-actions.ts`.
- Mock Smoke Tests en `scripts/study_training_delegation_smoke.ts`.
- Script Python de runner que valida los criterios de aceptación y escribe un reporte.

### Invariantes / Idempotencia
- Si `ongoing = true` el `stop_date` es nulo.
- Un duty ciego no puede ser asignado a un duty si requiere unblinding y el usuario está cegado, salvo que se ignore en UI, pero la persistencia registrará las reglas.

## Flujo (pasos)
1. **Migración DB:** Crear `study_delegation_duties`, `study_delegation_log`, `study_protocol_trainings`, `study_protocol_training_assignments`.
2. **Server Actions:** Implementar lógica transaccional de firmas.
3. **Testing:** Verificar todos los test cases.

## Observabilidad
- Log path: `.tmp/logs/study_training_delegation.log`
- Run manifest path: `.tmp/runs/study_training_delegation/YYYYMMDD_HHMMSS/manifest.json`
