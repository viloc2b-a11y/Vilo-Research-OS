import json
import os
import datetime

def main():
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    task_name = "pharmacy_ip_runtime_architecture_v1"
    
    os.makedirs(f".tmp/logs", exist_ok=True)
    os.makedirs(f".tmp/runs/{task_name}/{timestamp}", exist_ok=True)
    os.makedirs("directivas", exist_ok=True)
    
    log_path = f".tmp/logs/{task_name}.log"
    manifest_path = f".tmp/runs/{task_name}/{timestamp}/manifest.json"
    arch_file_path = "directivas/pharmacy_ip_runtime_architecture_v1.md"
    
    arch_content = """# Pharmacy Runtime Architecture (Frozen v1)

## Core Domain Entities

Para mantener la simplicidad operativa, el usuario (CRC) interactúa con flujos de trabajo guiados; la complejidad de estas entidades queda abstraída en el *runtime*.

*   **IP Lot**: Define atributos regulatorios (lote de fabricante, expiración). Ciclo de vida: Creado -> Activo -> Expirado. Padre de los Kits.
*   **IP Kit**: Unidad mínima dispensable (frasco, caja). Ciclo de vida derivado de eventos.
*   **Shipment**: Agrupación logística de envío desde el Depot. Relaciona múltiples kits/lotes en un solo evento de recepción.
*   **Receipt**: Evento de acuse de recibo. El usuario verifica si lo físico coincide con lo esperado.
*   **Inventory Location**: Ubicación física simple (ej. "Gabinete Seguro B").
*   **Subject**: Paciente inscrito.
*   **Randomization**: Evento externo de asignación a brazo de tratamiento.
*   **Subject Assignment**: Vínculo transaccional (Kit X asignado a Subject Y). El sistema lo genera o registra al dispensar.
*   **Dispense Event**: Acto de entrega de medicación durante una visita.
*   **Return Event**: Devolución de medicación (usada/vacía/no usada) en una visita.
*   **Destruction Event**: Evento excepcional de destrucción física de kits retornados o expirados.
*   **Accountability Exception (Entidad Principal)**: Registro documentado de pérdida, daño o desviación. Dado su peso en auditorías, tiene su propio ciclo de vida: `Open` → `Investigating` → `Resolved` → `Closed`.

## Runtime State Model

El usuario CRC interactúa con estados operativos simples (semáforos), mientras el sistema maneja la complejidad detrás:

*   **Shipment**: `In Transit` → `Received` (o `Received with Discrepancy`).
*   **Receipt**: `Pending Verification` → `Verified` / `Quarantined`.
*   **Kit (Estados Clave Explícitos)**: 
    *   `Available`
    *   `Dispensed`
    *   `Returned`
    *   `Destroyed`
    *   `Lost`
    *   `Quarantined`
*   **Inventory Position**: Computado matemáticamente. No existe como estado guardado.
*   **Dispense**: `Pending` (Visita abierta) → `Completed` (Firmado).
*   **Return**: `Pending` (Esperado de la visita anterior) → `Completed`.
*   **Destruction**: `Pending Authorization` → `Completed` (Con testigos).

## Immutable Ledger Model

El ledger opera 100% basado en eventos y nunca es la experiencia primaria del CRC. El coordinador ve un "Dashboard de IP", no una tabla de transacciones.

**Secuencia**: `Shipment` ↓ `Receipt` (+1 inventario) ↓ `Inventory` (vista computada) ↓ `Dispense` (-1 inventario disponible) ↓ `Return` (+1 a inventario de retornos) ↓ `Destruction` (-1 retorno).

*   **Eventos Registrados**: INSERT-only para cada transacción.
*   **Balances y Estados Derivados**: Computados al vuelo sumando `Receipts` y restando `Dispenses`.
*   **Inmutabilidad**: NUNCA se edita una firma, una fecha, una cantidad o un sujeto de un evento pasado.
*   **Reversal & Superseding Events**: Si un CRC se equivoca al dispensar, hace clic en "Corregir Error". El sistema emite un evento de *Reversal* (anulando lógicamente la transacción matemática) y un *Superseding Event* con el dato correcto. Ambos requieren justificación y una sola firma. El historial muestra el error tachado, pero legible.

## Subject Integration

**Coordinator Simplicity First:** El CRC no debe ejecutar manualmente un proceso separado de asignación en otro sistema (acoplamiento a IRT externo). 

*   **Flujo de Dispensación**: 
    Visita abierta → Sección de IP → Botón "Dispensar" → 
    `System asks:`
    `Assigned Kit?`
    `[ ] Suggested (Autocompletado si hay IRT)`
    `[ ] Manual Entry (Entrada directa por CRC si no hay IRT)`
    → CRC confirma físicamente que tiene ese kit → Firma electrónica → Fin.
*   **Validaciones automáticas**: El sistema bloquea si el consentimiento expiró o no aplica, o si la visita está fuera de ventana y requiere un *override* del investigador.
*   **Excepciones operativas**:
    *   *Replacement Kits*: Mismo flujo, seleccionando motivo "Reemplazo por pérdida/daño". Automáticamente levanta un `Accountability Exception`.
    *   *Subject Discontinuation*: Fuerza alertas de `Return` pendientes para todos los kits dispensados.

## Signature Model

El modelo busca **cero fricción sin comprometer ALCOA+**. No se asume la presencia de un farmacéutico dedicado.

*   **Receipt**: *Single Signature* (Unblinded Coordinator).
*   **Dispense**: *Single Signature* (Unblinded Coordinator o CRC si es open-label). Significa: "Verifiqué y entregué este kit".
*   **Return**: *Single Signature* (Coordinator). Significa: "Recibí de vuelta estos frascos".
*   **Correction**: *Single Signature* (Unblinded Coordinator/PI). Significa: "Certifico que el registro anterior fue un error de transcripción".
*   **Destruction**: *Double Signature*. Significa: "Yo destruí, el testigo verificó".

Trazabilidad asegurada mediante el *Operational Signature Engine* (autenticación secundaria/PIN, timestamp de servidor, hash del registro).

## Unblinded Access Controls

*   **Unblinded Coordinator**: Dueño operativo. Ve inventario completo, lotes, kits y dispensa en modo unblinded.
*   **Blinded Coordinator**: En su pantalla de visita, solo ve un *check* verde: "Medicación Dispensada". El sistema enmascara (masking) el ID del kit y número de lote para no romper el ciego.
*   **PI**: Rol ciego por defecto. Aprueba desviaciones (ej. dispensación de emergencia) sin ver números de kit a menos que sea necesario o protocolo abierto.
*   **Monitor (Site Monitor)**: Acceso de lectura ciega a la visita.
*   **Sponsor Monitor (Unblinded)**: Acceso de solo lectura al Ledger completo para realizar reconciliaciones formales.

## Inventory Intelligence y Subject Command Center

Solo alertas críticas MVP que viven integradas directamente en el **Subject Command Center** para que el CRC actúe sin abrir el módulo de farmacia:

*   **Subject Command Center IP Signals**:
    *   `IP Accountability Exception` (Excepciones abiertas/investigando)
    *   `Pending Return` (Kits por devolver en esta visita)
    *   `Pending Dispense` (El sujeto está listo para recibir dosis)
    *   `Expiring Subject Kit` (Kit dispensado que vencerá pronto)
*   **Otras Alertas de Inventario**:
    *   `Low Inventory`: Kits disponibles caen bajo límite de seguridad.
    *   `Expiring Inventory`: Bloqueo automático (quarantine) y alerta de kits próximos a vencer.

## Visit Integration

Cero fragmentación. El *Pharmacy Runtime* vive embebido en el *Visit Execution Workspace*.

*   **Secuencia de Flujo Permitida**: 
    `Visit Open` ↓ `Vital Signs/Labs/Procedures Complete` ↓ El módulo de IP se habilita (botón verde) ↓ `Dispense Flow` ↓ CRC firma.
*   **Validaciones (Authority Checks)**: El sistema aplica *operational checks* para asegurar que la secuencia de pasos ocurrió en el orden permitido (ej. laboratorios de seguridad previos firmados).
*   **Hard Blocks**: Kit sugerido caducado, visita cerrada, retiro de consentimiento.
*   **Soft Blocks / Deviations**: Visita fuera de ventana. Permite dispensar pero requiere ingresar motivo de desviación y firma de *override*.
*   **Emergency Dispensing**: Permite saltar bloqueos para continuar tratamiento crítico, generando desviación automática.

## Audit and Compliance Model

Diseñado para soportar inspecciones agresivas (FDA/EMA):

*   **21 CFR Part 11**: Autenticación secundaria. Logs inmutables y trazables.
*   **ALCOA+ y Chain of Custody**: Trazabilidad absoluta de cada Kit (Recibido -> Dispensado -> Retornado -> Perdido/Destruido).
*   **Accountability Exceptions First**: Al convertir las excepciones en entidades con ciclo de vida documentado, la auditoría fluye alrededor de la resolución de problemas (ej. *Lost Kits*), no solo del flujo normal.
*   **Accountability Reconciliation**: Reportes generados matemáticamente desde el ledger en PDF firmado y fechado.

## MVP Scope

El mínimo funcional requerido para operar de forma segura:

*   **Obligatorio (MVP Regulatorio y Operativo)**:
    *   Ledger inmutable con vistas calculadas.
    *   Workflows en un clic de Receipt, Dispense, Return.
    *   Manejo de Accountability Exceptions (Open -> Closed).
    *   Integración directa embebida en el *Visit Workspace* y *Command Center*.
    *   Firmas (PIN) de 21 CFR Part 11 para cada evento.
    *   RLS estricto para proteger el cegamiento (Unblinded Controls).

## Out of Scope for MVP

Para maximizar agilidad y enfocarse en clínicas ambulatorias, quedan excluidos:
*   **External IRT/RTSM Integrations**: En MVP, el CRC ingresa el Kit ID manualmente (o confirma) sin conexión de red directa al RTSM.
*   **Temperature Logs**: Se confía en sistemas externos o EDOCs manuales.
*   **Automated Resupply / Multi-Site Depot**: Logística del sponsor, no de Vilo OS MVP.
*   **Barcode Scanning / Mobile Dispensing**.
*   **Advanced Pharmacy Analytics**.

## Recommended Build Order

*   **Phase 1: Foundation (The Ledger)**
    *   *Alcance*: Event-sourced ledger, modelos de datos base, reglas de inmutabilidad y vistas calculadas.
*   **Phase 2: Security & Exceptions**
    *   *Alcance*: RLS (Unblinded Masking), y el motor de *Accountability Exceptions*.
*   **Phase 3: Operational Workflows (Visit & Command Center Integration)**
    *   *Alcance*: Embeber UI de Receipt, Dispense y Return en el Visit Workspace; inyectar señales en el Command Center.
*   **Phase 4: Compliance & Reconciliation**
    *   *Alcance*: Reversal events, destrucción con testigos, reportes PDF de accountability.

## Estimated Complexity

*   **Baja**: Modelos de firma.
*   **Media**: Integración embebida con Visit Workspace / Command Center.
*   **Alta**: Arquitectura del Ledger Inmutable y manejo del ciclo de vida de las Excepciones.
*   **Crítica**: Unblinded Access Controls. Un error de enmascaramiento contamina clínicamente el estudio.
"""

    with open(arch_file_path, "w", encoding="utf-8") as f:
        f.write(arch_content)
        
    with open(log_path, 'a', encoding="utf-8") as f:
        f.write(f"[{timestamp}] Starting {task_name}.\n")
        f.write(f"[{timestamp}] Wrote architecture report to {arch_file_path}\n")

    manifest = {
        "task_name": task_name,
        "timestamp": timestamp,
        "directive_path": "directivas/_global_SOP.md",
        "directive_version": "v1.0",
        "inputs": {"sources": [], "parameters": {}},
        "outputs": {
            "artifacts": [],
            "deliverables": [arch_file_path]
        },
        "acceptance_report": {
            "all_pass": True,
            "checks": [
                {
                    "id": "ARCH_FROZEN",
                    "description": "Architecture report v1 was frozen and created",
                    "critical": True,
                    "pass": True,
                    "evidence": {"path": arch_file_path, "details": "MD file generated successfully"}
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

    print("STATUS: SUCCESS")
    print(f"OUTPUTS: {arch_file_path}")
    print(f"MANIFEST: {manifest_path}")
    print(f"LOG: {log_path}")

if __name__ == "__main__":
    main()
