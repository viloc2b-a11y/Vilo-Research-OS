# study_wizard_ui — SOP

## Objetivo
- Validar y completar la UI del Study Setup Wizard (Ruta `/studies/[studyId]/setup`).
- Unir el backend de los pasos 1 a 11 en una vista secuencial / de panel para el coordinador, sin depender de scripts o SQL.

## Alcance
### Qué es
- Implementación de la página principal del Wizard en Next.js.
- Generación del reporte de validación en markdown para los 11 pasos del wizard.
- Generación de las pruebas de humo.

### Qué no es
- No alterar la base de datos (se usa el backend ya implementado en 0137, 0138 y 0139).
- No reconstruir el Document Intake ni Source Studio (se asumen componentes/rutas existentes).

## Contrato (OBLIGATORIO)
### Outputs
- `app/(ops)/studies/[studyId]/setup/page.tsx`
- `components/study-workspace/study-setup-wizard-shell.tsx`
- `validation-corpus/metadata/study-setup-wizard-ui.md`
- Reporte `manifest.json`.

## Flujo (pasos)
1. Escribir componente `study-setup-wizard-shell.tsx` mockeado pero completo en estado y Server Actions bindings.
2. Escribir ruta `page.tsx` para exponerlo.
3. Escribir el script Python que produce el reporte final de validación y el manifest.

## Observabilidad
- Log path: `.tmp/logs/study_wizard_ui.log`
- Run manifest path: `.tmp/runs/study_wizard_ui/YYYYMMDD_HHMMSS/manifest.json`
