# PI Subject Document Review Audit

## Data Model
- `subject_documents`: Almacena el repositorio de documentos a nivel sujeto y su estado global.
- `subject_document_review_requests`: Tabla transaccional para solicitar y completar "Reviews".
- `operational_signature_requests`: El Ledger criptográfico central para manejar "Signatures".

## Lifecycle Coverage
- **Document Upload/Assignment**: BUILT (`uploadSubjectDocumentAction`, `assignComplianceDocumentToSubject`)
- **Review Request/Completion**: BUILT (`requestSubjectDocumentReview` mode 'Review')
- **Signature Request/Completion**: BUILT (`requestSubjectDocumentReview` mode 'Signature', `completeSubjectSignature`)

## Current Signature Mechanism
El mecanismo actual es **Híbrido**:
1. **Signatures (Firmas Formales)**: Totalmente integrado con `operational_signatures` y `signOperationalArtifact()`. Cumple con 21 CFR Part 11 (requiere PIN y genera un evento inmutable).
2. **Reviews (Revisiones)**: Emplea firmas primitivas. Escribe pasivamente `completed_by` (UUID del sessionUser) y `completed_at` (timestamp del servidor) en `subject_document_review_requests` mediante un `UPDATE` de Supabase, sin solicitar validación biométrica ni PIN.

## Runtime Dependencies
- **Subject Runtime**: Acoplado a `study_subjects` y el Visit Runtime.
- **Operational Signatures Engine**: Altamente acoplado para procesar las firmas documentales formales (`artifact_type: 'subject_document'`).
- **Clinical Profile Ledger**: Emite eventos a `subject_clinical_profile_events` para ambas acciones (mediante la función `audit()`).

## Primitive Signature Findings
- `subject_document_review_requests.completed_by`
- `subject_document_review_requests.completed_at`
- Aunque las firmas formales están resueltas, la acción de "Revisar" (Review) opera como una atestación silenciosa que evade el mecanismo de intención del usuario (PIN).

## Migration Complexity
**LOW**
El infrastructure de firmas ya está construido e inyectado en este módulo. Si se requiere migrar las "Revisiones" para que también sean inmutables y bajo PIN, solo se necesita unificar el modelo para que 'Review' sea simplemente otro `signatureMeaning` dentro de `createOperationalSignatureRequest()`, eliminando por completo la tabla primitiva `subject_document_review_requests`.

## Regulatory Risk
**MEDIUM**
El sistema actual mitiga el riesgo mayor al ofrecer una opción de "Signature" totalmente compliance. Sin embargo, en investigación clínica, la "Revisión" del PI sobre un documento crítico (ej. Labs anormales, ECGs) es frecuentemente considerada una atestación regulatoria. Permitir que un "Review" ocurra sin mecanismo Part 11 (PIN) abre la puerta a hallazgos de auditoría si los coordinadores seleccionan "Review" en lugar de "Signature" para documentos de seguridad del sujeto.

## Critical Gaps
1. **Dicotomía de Cumplimiento**: Mantener una tabla primitiva para *Reviews* y una tabla compliance para *Signatures* en la misma interfaz genera confusión operativa y riesgo de desviación de protocolo.
2. **Bypass del Ledger Criptográfico**: Las revisiones no quedan registradas en `operational_signatures` ni heredan sus protecciones contra la manipulación retroactiva.

## Final Verdict
El **PI Subject Document Review** es un runtime maduro y funcional que *ya* posee integración end-to-end con `operational_signatures` para las firmas. Su única debilidad técnica/regulatoria es la mantención de un carril paralelo y primitivo para las "Revisiones". La remediación recomendada es converger ambos flujos hacia el motor operacional y deprecar la tabla `subject_document_review_requests`.
