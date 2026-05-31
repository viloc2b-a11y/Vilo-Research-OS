# Study Subject Command Center Quick Actions Patch

## Files Changed
- `lib/studies/load-study-subject-command-center.ts`
- `components/coordinator-operations/StudySubjectCommandCenter.tsx`

## Visit Quick Action
- **BUILT**: La acción rápida "Open Visit" ha sido implementada. Si hay una visita `overdue`, redirige allí; si no, redirige a la `upcoming`. Si no hay ninguna de las dos, la acción no se muestra.

## Reconsent Quick Action
- **BUILT**: Se agregó `?mode=reconsent` a la URL del ancla `#consent` cuando el `actionRequired` es "Obtain Reconsent", permitiendo que el Subject Chart inicie automáticamente el workflow de reconsentimiento.

## Contact Info Handling
- **BUILT**: El modelo de datos ahora extrae `phone` y `email` directamente de la tabla base `study_subjects` (incorporados en `0142_subject_enrollment.sql`). Se mantiene como nullable, devolviendo `'—'` cuando no existen datos.

## Performance Guard
- **BUILT**: Se ha agregado un comentario arquitectónico en `loadStudySubjectCommandCenter.ts` que advierte explícitamente sobre el límite práctico (~1000 sujetos) y la futura necesidad de migrar a un modelo paginado de servidor (TanStack Table) para evitar el agotamiento de memoria en las Edge Functions para registros de más de 5000 sujetos.

## Validation Results
- typecheck: Aprobado (sin errores de tipado nuevos en los archivos modificados).
- UI/Render: Los links están agregados y usan íconos de Lucide.

## Final Verdict
**BUILT**
