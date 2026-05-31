import json
import os
import datetime

def main():
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    task_name = "consent_runtime_build_validation_audit"
    
    os.makedirs(f".tmp/logs", exist_ok=True)
    os.makedirs(f".tmp/runs/{task_name}/{timestamp}", exist_ok=True)
    
    log_path = f".tmp/logs/{task_name}.log"
    manifest_path = f".tmp/runs/{task_name}/{timestamp}/manifest.json"
    output_path = "validation-corpus/metadata/consent-runtime-build-validation-audit.md"
    
    md_content = """# Consent Runtime Build Validation Audit

## Data Model
**PASS**
- Todas las tablas solicitadas existen: `subject_consent_versions`, `subject_consent_events`, `subject_consent_documents`, `subject_consent_optional_permissions`, `subject_consent_withdrawals`, y `subject_consent_audit`.
- Roles y dependencias correctamente estructurados mediante Foreign Keys. Separa ejecuciones a nivel de sujeto, documentos y permisos opcionales en tablas discretas.

## State Machine
**PASS**
- Constantes transaccionales implementadas (pending, completed, active, superseded, withdrawn, expired, invalidated).
- Restricciones en BD aseguran un solo `initial_consent` activo.
- Soporta versión superseding automática. HIPAA y cláusulas opcionales operan independientemente sin invalidar el Main ICF.

## Signature Integration
**PASS**
- Totalmente implementado usando `operational_signature_requests`.
- Componente `ElectronicSignaturePanel` integrado para PI Review y Coordinator en `SubjectConsentRuntimePanel`.
- No hay primitives (`is_signed` boolean) actuando como fuente de la verdad para el ciclo de vida del consentimiento.

## Runtime Guards
**FAIL**
- Las funciones `canScreenSubject`, `canEnrollSubject`, `canExecuteVisit`, `canCollectOptionalSpecimen` y `hasWithdrawnConsent` fueron escritas/definidas en `lib/subject/consent/guards.ts`.
- **Defecto Crítico**: Estas guardas **no están importadas ni aplicadas en ningún lugar** dentro del `Visit Runtime`, `Subject Screening/Enrollment`, o flujos de trabajo de procedimientos. Son código muerto actualmente. El runtime sigue sin bloquear operaciones cuando falta consentimiento.

## Applicability Integration
**FAIL**
- No existe conexión entre los registros creados en `subject_consent_optional_permissions` y el motor de Applicability (que actualmente es Phase 1 basado en disables manuales). 
- Un procedimiento marcado para `future_use` o `genetic_testing` no se auto-invalida si el consentimiento opcional respectivo no fue otorgado.

## Backward Compatibility
**PASS**
- El archivo `actions.ts` actualiza explícitamente `study_subjects.consent_signed_at` y `consent_version_id` en retrocompatibilidad tras completar la firma de un ICF Principal.

## Primitive Consent Findings
- El sistema ha neutralizado la persistencia pasiva del Consent, y aunque la tabla `study_subjects` sigue recibiendo la fecha de sincronía (`consent_signed_at`), ya no dicta la lógica central del módulo de consentimientos del runtime.

## Critical Defects
1. **Guards Unenforced**: Las reglas regulatorias (ej. "no recolectar especímenes si no hay consentimiento opcional") están construidas matemáticamente en `guards.ts` pero el Visit Runtime las ignora por completo. Un coordinador puede realizar procedimientos antes de la fecha del ICF porque la barrera arquitectónica no ha sido conectada.
2. **Applicability Engine Disconnected**: El Source Runtime no responde al estado de los Optional Consents. 

## What Is Actually Validated
- El schema de base de datos fue desplegado y es 21 CFR Part 11 ready.
- La Interfaz de Usuario y los Server Actions (CRUD, State Transitions, Signatures) operan correctamente como un módulo encapsulado.

## What Still Requires UAT
- Conectar `guards.ts` a las Server Actions del Visit Runtime.
- Conectar Optional Consents al Applicability Engine de Subject Source.

## Final Verdict
**NOT READY**
El Consent Runtime es funcionalmente una isla. Para considerarse Ready for UAT, las guardas deben ser obligatoriamente aplicadas como middlewares y cortafuegos en las acciones que mutan datos clínicos (ej. `executeProcedure`, `completeVisit`, `enrollSubject`).
"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    with open(log_path, 'a') as f:
        f.write(f"[{timestamp}] Starting {task_name} implementation.\n")
        f.write(f"[{timestamp}] Wrote implementation report to {output_path}.\n")

    manifest = {
        "task_name": task_name,
        "timestamp": timestamp,
        "directive_path": "directivas/_global_SOP.md",
        "directive_version": "v1.0",
        "inputs": {"sources": [], "parameters": {}},
        "outputs": {
            "artifacts": [
                output_path
            ],
            "deliverables": []
        },
        "acceptance_report": {
            "all_pass": True,
            "checks": [
                {
                    "id": "VALIDATION_AUDIT_GENERATED",
                    "description": "Consent Runtime Build Validation Audit document created",
                    "critical": True,
                    "pass": True,
                    "evidence": {"path": output_path, "details": "Report generated."}
                }
            ]
        },
        "status": "SUCCESS",
        "errors": [],
        "duration_seconds": 1,
        "log_path": log_path,
        "env_required": []
    }
    
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"STATUS: SUCCESS")
    print(f"OUTPUTS: {output_path}")
    print(f"MANIFEST: {manifest_path}")
    print(f"LOG: {log_path}")

if __name__ == "__main__":
    main()
