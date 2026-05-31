# IP Accountability + Dispensing Runtime Audit

## Data Model
La base de datos (según Migración `0140_study_unblinded_workspace.sql`) contiene dos tablas estructurales:
- `study_ip_accountability`: Tabla de balance de inventario por lote/kit, con tracking de cantidades recibidas, dispensadas, devueltas y destruidas.
- `study_ip_dispensing`: Tabla nominal de registro de entrega a un `subject_id` y `visit_id` específicos.

## Lifecycle Coverage
- **IP Receipt**: PARTIAL (Existe el campo `quantity_received` y un Action crudo).
- **IP Inventory**: PARTIAL (Existe el campo `balance`).
- **IP Preparation**: PARTIAL (Existe campo `dose` y `prepared_by`).
- **IP Dispensing**: PARTIAL (Existe tabla y Action, pero la UI está vacía).
- **IP Return**: MISSING (No hay tabla/acciones dedicadas al flujo de retorno del paciente).
- **IP Destruction**: MISSING (No hay flujo de atestación de destrucción o cuarentena).
- **IP Reconciliation**: MISSING (Sin entidad de conciliación global por sitio).

## Current Signature Mechanism
El mecanismo actual para capturar responsabilidad es totalmente primitivo y no cumple CFR Part 11:
- Utiliza foreign keys UUID apuntando a `auth.users` (`performed_by`, `prepared_by`, `dispensed_by`).
- Extrae el ID automáticamente desde la sesión durante la ejecución del Server Action (`createIPAccountabilityRecord`, `createIPDispensingRecord`).
- Las marcas temporales (`dispensed_at`, `performed_date`) son o bien pasadas en crudo desde el cliente, o generadas por el servidor durante el CRUD.

## Runtime Dependencies
- **Subject Visit**: `study_ip_dispensing` apunta a `study_runtime_visits(id)` y `study_subjects(id)`.
- **Pharmacy Workspace / Unblinded Role**: El acceso está restringido fuertemente por el guard `canAccessUnblindedStudyArea()`. Solo usuarios delegados como Unblinded pueden interactuar.
- **Randomization / Subject Runtime**: NO HAY una integración que conecte la dispensación con la visualización cegada del Coordinador.

## Primitive Signature Findings
- `study_ip_accountability.performed_by`
- `study_ip_dispensing.prepared_by`
- `study_ip_dispensing.dispensed_by`
No existe uso de `operational_signatures`, PIN prompts, `ElectronicSignaturePanel`, o un Ledger criptográfico inmutable en esta área.

## Migration Complexity
**HIGH**
No es una simple refactorización de base de datos. Para migrar este módulo, se requiere construir desde cero toda la interfaz operativa (los formularios, listas y paneles no existen en `UnblindedWorkspaceShell`), orquestar Server Actions de dos pasos (Request Signature -> Complete Signature) e implementar la lógica de Double Sign-Off (Doble firma para Preparador y Verificador), que es estándar en farmacia de investigación.

## Regulatory Risk
**HIGH**
Si un usuario intentara usar este componente (ignorando que la UI no está terminada), las atestaciones de dispensación quedarían registradas silenciosamente sin un prompt explícito de intención (PIN), incumpliendo inmediatamente 21 CFR Part 11 y comprometiendo la cadena de custodia del producto en investigación.

## Critical Gaps
1. **Scaffold UI**: `UnblindedWorkspaceShell` es solo una carcasa visual. Las pestañas ("IP Accountability", "IP Dispensing") solo contienen `<p>` y comentarios JSX (`{/* Dispensing implementation */}`). No hay forma interactiva de ejecutar el flujo.
2. **Ausencia de Double Sign-Off**: La tabla `study_ip_dispensing` no contempla validación cruzada ni firmas duales (ej. Preparador + Verificador Independiente).
3. **Desacople del Visit Runtime**: El coordinador (blinded) no tiene forma de atestiguar que el Subject recibió o devolvió la medicación, debido a que el Source Quality Engine no intersecta con el IP Runtime.

## Final Verdict
**IP Accountability / Dispensing NO es un runtime real.** Es simplemente un cascarón de UI acoplado a dos tablas CRUD primitivas.

Implementar firmas operacionales aquí no es un ejercicio de "migración" sino un proyecto de "Feature Build" (Fase de construcción) que debe diseñarse íntegramente como un nuevo dominio del sistema (Pharmacy Runtime), requiriendo un Ledger transaccional propio y flujos de interfaz complejos antes de conectarse a `operational_signatures`.
