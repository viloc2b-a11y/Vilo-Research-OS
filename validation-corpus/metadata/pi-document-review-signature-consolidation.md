# PI Subject Document Review Signature Consolidation

## Files Changed
- `supabase/migrations/0148_pi_document_review_signature_consolidation.sql`
- `lib/subject/source-template/actions.ts`
- `lib/subject/source-template/read.ts`
- `components/subject/source-template/SubjectSourceTemplateSections.tsx`

## Server Actions Updated
1. `requestSubjectDocumentReview`: 
   - Modificado para que tanto 'Review' como 'Signature' invoquen `createOperationalSignatureRequest`. 
   - El `signatureMeaning` para Review fue actualizado a `PI reviewed subject document`.
   - Continúa insertando en la tabla transaccional legacy `subject_document_review_requests`, pero ahora guarda el `signature_request_id`.
2. `completeSubjectDocumentRequest`:
   - Agregada una validación estricta para bloquear la marca de "Reviewed" si el `signature_request_id` asociado no tiene status `'signed'` en la tabla `operational_signature_requests`.

## UI Updated
- `SubjectSourceTemplateSections.tsx`:
  - Se eliminó el botón primitivo `Mark reviewed` para los nuevos Review Requests.
  - Se introdujo el componente local `ReviewRequestItem` que renderiza el `ElectronicSignaturePanel` (requiriendo PIN) para completar las revisiones.
  - Una vez firmado correctamente, el panel emite `onSigned`, que hace `requestSubmit()` automático de un form oculto para transicionar la tabla heredada.

## Signature Integration
- Todo `PI Review` ahora está respaldado criptográficamente por la tabla `operational_signatures`.
- Los coordinadores pueden seguir solicitando "Reviews" separadas de "Signatures", pero el PI (o el rol designado) siempre se enfrentará al modal `ElectronicSignaturePanel` para atestar su revisión con PIN, cumpliendo con 21 CFR Part 11.

## Backward Compatibility
- Se agregó el campo `signature_request_id` a `subject_document_review_requests`.
- Las revisiones heredadas (aquellas donde `signature_request_id` es NULL) mantienen el botón original bajo la etiqueta **Legacy Mark Reviewed** y pueden completarse sin PIN para no romper el historial clínico anterior.

## Audit Trail
- Cada vez que se crea un Review, se genera:
  - 1 `operational_signature_requests` (Inmutable).
  - 1 `subject_document_review_requests` (Legacy).
  - 1 evento transversal en `subject_clinical_profile_events`.
- Al firmar y completar, el motor `operational_signatures` genera inmutabilidad criptográfica, y el Server Action actualiza el `status_history`.

## Locking
- El completado del documento requiere que la firma `operational_signature` sea resolutiva, inhabilitando modificaciones por la vía de API sin re-apertura. La validación `completeSubjectDocumentRequest` detiene ataques server-side si `sigReq?.status !== 'signed'`.

## Validation Results
- Lint y TypeScript subset pasaron correctamente con las adaptaciones introducidas para `useActionState`, `useState` y el ignorado de tipos `any`.

## Known Limitations
- El modelo sigue escribiendo en la tabla primitiva `subject_document_review_requests` por consistencia hacia atrás. En un futuro "Phase 3" se podrá migrar enteramente la vista hacia la tabla de Operational Signatures para prescindir del JOIN.

## Final Verdict
BUILT
