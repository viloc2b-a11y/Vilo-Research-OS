# Study Subject Command Center Audit

## Existing Assets
- **Study Workspace (`app/(ops)/studies/[studyId]/page.tsx`)**: Contiene un tab `subjects` que actualmente renderiza un roster muy primitivo (`SubjectRow`) y un tab `visits` que muestra el estado de las visitas.
- **Data Model**: `study_subjects` contiene `enrollment_status` y campos legacy de consent (`consent_signed_at`).
- **Coordinator Command Center (`app/(ops)/coordinator-command-center`)**: Existe, pero está enfocado en alertas cross-study (evidence, drafts, queries, signatures), no en la gestión operativa de los sujetos de un estudio.

## Reusable Components
- **SubjectRow / AddSubjectForm**: Componentes básicos existentes que pueden ser expandidos o reemplazados por una Data Table rica.
- **OperationalTableScroll**: Componente UI existente para tablas con scroll horizontal.
- **Status Badges**: Ya existen utilidades UI para renderizar estados clínicos.

## Visit Intelligence Availability
**PARTIAL**
- La inteligencia subyacente existe. La función `loadStudyVisits` (`lib/visits/loadStudyVisits.ts`) ya calcula y agrupa las visitas en: `inProgress`, `today`, `overdue`, `upcoming`, `completed`. 
- No existe una vista cruzada que coloque esta inteligencia como columnas por sujeto (ej. "Next Visit", "Visit Progress %") en el roster.

## Consent/Reconsent Availability
**PARTIAL**
- El Consent Runtime tiene un schema robusto (`subject_consent_events`, `subject_consent_versions`).
- **Missing**: No existen queries de agregación a nivel estudio para calcular `Consent Status` (Active, Missing, Expired) ni `Reconsent Status` masivamente para un roster. 

## Active Queue Logic
**BUILT**
- La tabla `study_subjects` rastrea `enrollment_status`.
- Los estados `screen_failed`, `withdrawn`, `early_terminated` y `completed` pueden ser filtrados de forma determinista usando el valor actual de la base de datos sin requerir una nueva máquina de estados.

## Quick Actions Availability
**BUILT**
- Ya existen rutas para:
  - Subject Chart: `/studies/[studyId]/subjects/[subjectId]`
  - Visit Workspace: `/studies/[studyId]/subjects/[subjectId]/visits/[visitId]`
  - Consent Runtime: Expuesto a través del panel en Subject Chart, se puede enrutar mediante un hash/tab.

## Recommended Architecture
**Extend Existing**
Construir un módulo completamente nuevo fragmentaría la experiencia del coordinador. El tab `subjects` dentro del **Study Workspace** (`app/(ops)/studies/[studyId]/page.tsx`) es el lugar canónico perfecto para alojar el "Study Subject Command Center". 

La evolución recomendada es:
1. Reemplazar la lista plana actual del tab `subjects` con una Data Table interactiva (Command Center).
2. Crear un nuevo loader (`loadSubjectCommandCenter`) que combine `study_subjects`, resúmenes de visitas y agregaciones del Consent Runtime.
3. Utilizar el componente `OperationalTableScroll` para manejar las múltiples columnas.

## Estimated Complexity
**MEDIUM**
- **UI**: Baja complejidad. Es reemplazar una lista por una tabla rica.
- **Backend**: Media complejidad. Requiere escribir queries SQL (o Supabase joins) eficientes que agreguen visitas y estados de consentimiento (última versión, eventos de reconsent) por sujeto sin causar N+1 problems.

## Final Verdict
**Extend Existing**
