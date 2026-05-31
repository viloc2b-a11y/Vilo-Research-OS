# Pharmacy / IP Accountability Runtime Audit

## Existing Assets
- **Database schemas**: En `0140_study_unblinded_workspace.sql` existen dos tablas básicas: `study_ip_accountability` y `study_ip_dispensing`. Ambas actúan como registros planos, sin llaves relacionales a un sistema real de inventario (solo texto libre para lot/kit).
- **Server actions**: `lib/studies/unblinded-actions.ts` contiene stubs vacíos que insertan datos directamente sin validaciones clínicas ni de firmas (`createIPAccountabilityRecord`, `createIPDispensingRecord`).
- **UI Components**: `components/study-workspace/unblinded-workspace-shell.tsx` es un placeholder con tabs pero sin implementación real (contiene comentarios como `/* Table implementation */`).

## Inventory Runtime
- inventory ledger: **NOT BUILT** (La tabla accountability existe, pero no hay lógica de cálculo de balance ni estado de inventario).
- balance tracking: **NOT BUILT** (Campo `balance` presente pero no se actualiza vía triggers o lógica de doble entrada).
- reconciliation: **NOT BUILT**
- inventory adjustments: **NOT BUILT**
- expiration tracking: **NOT BUILT**

## Dispensing Runtime
- dispensing workflow: **NOT BUILT**
- quantity dispensed: **PARTIAL** (Definido en el schema, sin lógica).
- date/time: **PARTIAL** (Definido en el schema, sin lógica).
- staff attribution: **PARTIAL** (Definido en el schema, no validado por roles).
- witness requirements: **NOT BUILT**

## Returns
- returned kits: **NOT BUILT**
- returned quantity: **NOT BUILT**
- reconciliation: **NOT BUILT**

## Destruction
- destruction workflow: **NOT BUILT**
- witness signature: **NOT BUILT**
- audit trail: **NOT BUILT**

## Signatures
- operational signatures: **NOT BUILT** (Los eventos no están enlazados al Operational Signature Engine).
- PIN workflow: **NOT BUILT**
- pharmacist/coordinator signatures: **NOT BUILT**
- double sign-off: **NOT BUILT**

## Unblinded Controls
- role separation: **PARTIAL** (El helper `canAccessUnblindedStudyArea` existe pero es rudimentario).
- restricted access: **PARTIAL** (Solo se cuenta con RLS a nivel de `organization_id`).
- auditability: **NOT BUILT**

## Inventory Intelligence
- low inventory alerts: **NOT BUILT**
- expiration alerts: **NOT BUILT**
- reconciliation alerts: **NOT BUILT**

## Critical Gaps
1. **No Operational Signatures**: Las transacciones IP requieren firmas validadas (ALCOA+), no inserciones directas vía supabase-js insert.
2. **Double Entry/Ledger Missing**: El manejo de IP no puede basarse en updates crudos. Requiere un sistema de transacciones inmutables donde Dispensings y Returns resten o sumen al Balance global.
3. **No Kit/Lot Entity Models**: `ip_lot` y `kit_number` son `text` en el schema actual. Deberían ser entidades maestras para validar el ciclo de vida, expiración, y cadena de custodia (Shipment -> Site -> Dispensed -> Returned).
4. **No Real UI**: Todo el módulo está en fase placeholder/stub.

## Recommended Architecture
Debe construirse un **IP Runtime Engine** basado en los siguientes principios:
- **Master Data**: Tablas para `ip_lots` e `ip_kits`.
- **Ledger System**: Todas las operaciones (Receipt, Dispense, Return, Destroy) deben modelarse como `ip_transactions` inmutables.
- **Signature Integration**: Todo movimiento IP (dispense, destruction) debe registrarse a través del `OperationalSignatureRequest` y completarse con un PIN.
- **Strict Role Boundaries**: RLS políticas reforzadas donde SOLO roles unblinded/pharmacist puedan acceder a estas tablas.

## Estimated Complexity
- **High / Complex Module**. Estimo ~3 a 4 fases completas de desarrollo (Schema -> Ledger Engine -> UI Workflows -> Unblinded Analytics) debido al rigor regulatorio de CFR Part 11 requerido para manejo de producto en investigación.

## Final Verdict
**NOT BUILT**
El estado actual es de "cascarón" (scaffold). No puede considerarse un módulo funcional.
