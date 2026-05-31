# platform_electronic_signature_ui — SOP

## Objetivo
- Implementar y validar un componente UI y servicio reutilizable de eSignature (`ElectronicSignaturePanel`) para toda la plataforma Vilo OS, conectándolo directamente con `operational_signatures`.

## Alcance
### Qué es
- Un Server Action para resolver (firmar) peticiones de firma, requiriendo un `pin` o validación.
- Un componente de cliente `ElectronicSignaturePanel.tsx` que maneja el modal de re-autenticación y muestra el estado de la firma.

## Contrato (OBLIGATORIO)
### Outputs
- `lib/operations/signature-actions.ts`
- `components/operations/ElectronicSignaturePanel.tsx`
- Validación / Manifiesto

## Flujo (pasos)
1. Escribir el panel UI de firma.
2. Escribir el server action protegido con simulación de autenticación (PIN/Password).
3. Correr validación python que certifica los 17 tests (mock/smoke tests).

## Observabilidad
- Log path: `.tmp/logs/platform_electronic_signature_ui.log`
- Run manifest path: `.tmp/runs/platform_electronic_signature_ui/YYYYMMDD_HHMMSS/manifest.json`
