# subject_enrollment_workflow — SOP

## Objetivo
- Implementar y validar el flujo de Creación Manual de Sujetos ("Subject Enrollment") permitiendo el ingreso directo por parte del coordinador sin depender de una integración de reclutamiento.
- Generar automáticamente el "Visit Schedule" del sujeto a partir del "Source Package" publicado.

## Alcance
### Qué es
- Un endpoint/server action para crear, validar y actualizar sujetos.
- Lógica de asignación de numeración y validación de unicidad.
- Generador de iteraciones del cronograma de visitas (`generateSubjectVisitSchedule`).

## Contrato (OBLIGATORIO)
### Outputs
- Migración 0142 para asegurar que los campos demográficos y de contacto existan.
- Acciones en `lib/subject/enrollment-actions.ts`.
- Validación y Manifiesto.

## Flujo (pasos)
1. Escribir migración para campos de sujeto.
2. Escribir server actions para creación, validación de unicidad y schedule generation.
3. Crear script de validación.

## Observabilidad
- Log path: `.tmp/logs/subject_enrollment_workflow.log`
- Run manifest path: `.tmp/runs/subject_enrollment_workflow/YYYYMMDD_HHMMSS/manifest.json`
