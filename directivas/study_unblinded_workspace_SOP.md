# study_unblinded_workspace — SOP

## Objetivo
- Crear el Unblinded Workspace para estudios cegados, protegiendo el acceso a documentación IP (Investigational Product), accountability logs y asignación de tratamientos.

## Alcance
### Qué es
- Un nuevo sub-dominio operacional `/studies/[studyId]/unblinded`.
- Implementación de un guard de autorización sever-side (`canAccessUnblindedStudyArea`) basado en delegación de duties dinámicos y firmas.
- Migración para tablas mínimas de `study_ip_accountability` y `study_ip_dispensing`.

### Qué no es
- No se expone información unblinded en los endpoints regulares sin filtrar.
- No es una interfaz FDA/CRA.

## Contrato (OBLIGATORIO)
### Outputs
- Migración `0140_study_unblinded_workspace.sql`.
- Helper `canAccessUnblindedStudyArea` en `lib/auth/unblinded-guard.ts`.
- Mock UI route en `app/(ops)/studies/[studyId]/unblinded/page.tsx` y `components/study-workspace/unblinded-workspace-shell.tsx`.
- Script Python runner para pruebas de humo y manifiesto.

## Flujo (pasos)
1. Escribir migración para accountability y dispensing.
2. Implementar el guardián de autorización que exija Active Delegation Log.
3. Crear las rutas UI que apliquen el guardián.
4. Generar script Python que valide.

## Observabilidad
- Log path: `.tmp/logs/study_unblinded_workspace.log`
- Run manifest path: `.tmp/runs/study_unblinded_workspace/YYYYMMDD_HHMMSS/manifest.json`
