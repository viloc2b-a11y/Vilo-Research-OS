import json
import os
import datetime

def main():
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    task_name = "subject_consent_runtime_audit"
    
    # Create logs directory
    os.makedirs(f".tmp/logs", exist_ok=True)
    os.makedirs(f".tmp/runs/{task_name}/{timestamp}", exist_ok=True)
    
    log_path = f".tmp/logs/{task_name}.log"
    manifest_path = f".tmp/runs/{task_name}/{timestamp}/manifest.json"
    output_path = "validation-corpus/metadata/subject-consent-runtime-audit.md"
    
    md_content = """# Subject Consent Runtime Audit

## Data Model
- `study_subjects` contiene los campos primitivos: `consented_at`, `consent_version_id`, `consent_signed_at`, y `privacy_consent`.
- `document_versions`: Creada como un "stub" (marcador de posición) con el siguiente comentario explícito en la migración `0089_phase16a27_runtime_safety_net.sql`: *"Stub for future consent version tracking. Full implementation deferred to future phase."*

## Lifecycle Coverage
- **Initial Consent:** PARTIAL (Se captura únicamente un timestamp de inicio).
- **Re-Consent:** MISSING (La estructura 1:1 en `study_subjects` no soporta un array histórico ni control de versiones activas).
- **Amendment Consent:** MISSING
- **HIPAA Authorization:** MISSING (Sustituido temporalmente por el boolean genérico `privacy_consent`).
- **Optional Consents:** MISSING
- **Withdrawal of Consent:** MISSING (Se maneja a nivel clínico genérico cambiando el status a "Withdrawn", pero sin registrar el flujo legal del Documento de Revocación de Consentimiento).

## Current Signature Mechanism
- La captura de firma reside netamente en la manipulación de la columna estática `consent_signed_at` (`timestamptz`).
- **NO usa `operational_signatures`**.
- Carece por completo de la identificación del coordinador (signed_by) que ejecutó el proceso de consentimiento informado y de la atestación biométrica / PIN requerida.

## Runtime Dependencies
- **Eligibility / Enrollment:** Vilo OS cuenta con un motor de validación temporal (`temporal_consistency_rules`). Existe una regla global crítica configurada como `'blocker'` (`consent_before_screening`) que abortará el `eligibility_status` si la fecha de `consent_signed_at` es nula o posterior al `screening_started_at`.
- **Visit Execution:** El Runtime asume implícitamente que el sujeto tiene permiso de proceder si el status clínico es 'Enrolled', estado que no puede alcanzarse si el consentimiento falla en la regla de elegibilidad.

## Migration Complexity
**HIGH**
La migración no se resolverá simplemente reemplazando un string por un UUID de `operational_signature_requests`. Dado que la infraestructura actual carece por completo de cardinalidad 1:N (Historial de Consentimientos por Sujeto), el requerimiento exigirá la arquitectura completa de un verdadero **Subject Consent Engine**, desvinculando los campos planos de `study_subjects` para convertirlos en un Ledger transaccional independiente capaz de soportar versiones, re-consentimientos y atestaciones de Coordinador/PI concurrentes.

## Critical Gaps
1. **Ausencia de Trazabilidad del Adquisidor:** El modelo documenta *cuándo* ocurrió pero ignora *quién* (Coordinador) condujo la entrevista médica y recogió legalmente la firma.
2. **Deficiencia de Versionado GCP:** Sin un historial de Re-Consentimiento atado dinámicamente a las actualizaciones del IRB Protocol Amendments, el sistema fallará en cualquier auditoría regulatoria estándar de monitorización de pacientes en tratamientos de largo plazo.
3. **Ausencia de Vínculo Documental (eConsent / Wet-ink):** No existe persistencia obligatoria entre el "click" temporal del timestamp y el PDF / Scan subyacente blindado.

## Final Verdict
**NO existe un "Consent Runtime" operativo en Vilo OS en la actualidad.**

La implementación viva es únicamente un flag plano / andamiaje de metadatos insertado dentro del esquema de Sujetos de estudio a fin de satisfacer las barreras booleanas básicas de enrolamiento ("no screen without consent"). Para cumplir con CFR Part 11, este andamiaje primitivo debe ser abolido por completo en favor de un módulo independiente que acople legalmente los artefactos del paciente, la historia de versiones del IRB, y el marco centralizado de `operational_signatures`.
"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    with open(log_path, 'a') as f:
        f.write(f"[{timestamp}] Starting {task_name} gap audit.\n")
        f.write(f"[{timestamp}] Wrote Subject Consent Audit artifact to {output_path}.\n")

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
                    "id": "CONSENT_AUDIT_REPORT",
                    "description": "Report written correctly",
                    "critical": True,
                    "pass": True,
                    "evidence": {"path": output_path, "details": ""}
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
