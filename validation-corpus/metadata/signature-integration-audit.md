# Signature Integration Inventory

## Already Using operational_signatures
*(Ninguno. A nivel de UI y Workflows End-to-End, ninguna firma está utilizando el motor validado con PIN)*

## Using Primitive Signatures
- **Visit Runtime (Closeout):**
  - Current Mechanism: Modifica el campo `visit_review_status` vía los RPCs `sign_visit_coordinator_closeout` y `sign_visit_investigator_closeout`.
  - Uses operational_signatures? NO
  - Uses PIN? NO
  - Uses immutable audit? NO (Usa event logs genéricos, pero la firma en sí puede ser revocada / reopen).
  - Migration Complexity: HIGH
- **Visit Runtime (Procedures):**
  - Current Mechanism: Actualiza booleanos y strings (`is_signed`, `signed_at`, `signed_by`) directamente en la tabla `procedure_executions`.
  - Uses operational_signatures? NO
  - Uses PIN? NO
  - Uses immutable audit? NO
  - Migration Complexity: HIGH
- **Regulatory Documents:**
  - Current Mechanism: La tabla `compliance_obligations` maneja el requerimiento de firma como `obligation_type = 'signature'` y transiciona el campo primitivo `status` a `'fulfilled'`.
  - Uses operational_signatures? NO
  - Uses PIN? NO
  - Uses immutable audit? NO
  - Migration Complexity: MEDIUM
- **Subject Runtime (Documents):**
  - Current Mechanism: La tabla `subject_document_review_requests` utiliza un Enum primitivo `status = 'Signed'`.
  - Uses operational_signatures? NO
  - Uses PIN? NO
  - Uses immutable audit? NO
  - Migration Complexity: MEDIUM

## Signature-Ready (Schema Exists, UI Missing)
- **Training Log:**
  - Current Mechanism: La migración `0143` agregó los foreign keys (`trainee_signature_request_id`, etc.) vinculados a `operational_signature_requests`.
  - Uses operational_signatures? YES (Solo en esquema BD)
  - Uses PIN? NO (No existe UI).
  - Uses immutable audit? NO.
  - Migration Complexity: LOW
- **Delegation Log:**
  - Current Mechanism: La migración `0143` agregó llaves foráneas (`staff_signature_request_id`, `pi_signature_request_id`).
  - Uses operational_signatures? YES (Solo en esquema BD)
  - Uses PIN? NO (No existe UI).
  - Uses immutable audit? NO.
  - Migration Complexity: LOW

## Highest ROI Migrations
1. **Delegation Log** (Baja complejidad. Fundamental para GCP; sin Delegation Activa y firmada, los roles no deberían poder operar).
2. **Visit Runtime Closeout** (Alta complejidad. Crítico para Data Lock y Site Defense Guard).
3. **Training Log** (Baja complejidad. Fácil adopción).
4. **Subject Runtime Documents** (Complejidad media. Crítico para eConsent e ICF reviews).
5. **Regulatory Documents** (Complejidad media. Fundamental para TMF).

## Final Verdict
¿Cuántos workflows reales faltan por migrar al motor central de firmas?
**Faltan 7 workflows.** (Visit Closeout, Procedure Execution, Training Log, Delegation Log, Regulatory Documents, Subject Documents, y IP Accountability). Actualmente, el 100% de las operaciones de firma en la plataforma carecen de integración end-to-end con `ElectronicSignaturePanel` y el servicio inmutable `operational_signatures`.
