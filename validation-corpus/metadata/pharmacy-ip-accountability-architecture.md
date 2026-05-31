# Pharmacy Runtime Architecture

## Core Entities

*   **IP Lot**: 
    *   **Propósito**: Representa un lote de fabricación de la medicación en investigación.
    *   **Ciclo de Vida**: Creado al inicio del estudio o al recibir un nuevo lote. Contiene fecha de expiración global y certificado de análisis.
    *   **Relaciones**: Padre de IP Kits.
*   **IP Kit**:
    *   **Propósito**: Unidad mínima dispensable (frasco, caja, jeringa). Tiene un identificador único.
    *   **Ciclo de Vida**: Recibido -> Disponible -> Asignado -> Dispensado -> Retornado -> Destruido.
    *   **Relaciones**: Pertenece a un Lot, se asigna a un Subject.
*   **Shipment**:
    *   **Propósito**: Agrupación logística de Kits/Lots enviados desde el Depot al Site.
    *   **Ciclo de Vida**: En tránsito -> Recibido -> Cuarentena -> Liberado.
*   **Receipt**:
    *   **Propósito**: El acto de acuse de recibo físico en el sitio, verificando cantidades y condiciones (ej. excursiones de temperatura).
*   **Inventory Location**:
    *   **Propósito**: Ubicación física (Ej: Refrigerador Farmacia A).
*   **Subject**:
    *   **Propósito**: El paciente que recibirá la medicación.
*   **Randomization**:
    *   **Propósito**: El evento (usualmente ciego) que asigna al sujeto a un brazo de tratamiento.
*   **Subject Assignment**:
    *   **Propósito**: El vínculo lógico donde el sistema (o IRT) determina que el Kit X debe darse al Subject Y.
*   **Dispense Event**:
    *   **Propósito**: Entrega física de la medicación al paciente.
*   **Return Event**:
    *   **Propósito**: Recuperación de medicación no utilizada o vacía por parte del paciente en la siguiente visita.
*   **Destruction Event**:
    *   **Propósito**: Disposición final de los kits retornados o expirados, con testigos.

## Immutable Ledger Model

El sistema operará bajo un **Event-Sourced Immutable Ledger**. Las tablas de inventario no tendrán columnas actualizables como `balance = balance - 1`. 

**Secuencia**: 
`Shipment` → `Receipt` (+1 al inventario) → `Inventory` (Estado calculado) → `Dispense` (-1 al inventario) → `Return` (+1 a inventario de retornos) → `Destruction` (-1 definitivo).

*   **Eventos Registrados**: Todos los movimientos son registros inmutables (INSERT-only) en una tabla `ip_transactions`.
*   **Balances Calculados**: El inventario disponible es siempre el SUM() de receipts menos el SUM() de dispensations.
*   **Qué nunca se edita**: Cantidades dispensadas, fechas de ejecución, firmas, lotes asignados.
*   **Cómo se corrigen errores**: Mediante eventos de reversión (Ej: `Dispense_Void` o `Inventory_Adjustment`) que requieren justificación, firma operativa y generan un nuevo registro que anula el anterior sin borrarlo.

## Subject Integration

*   **Cuándo ocurre**: Durante una visita activa del Subject Runtime.
*   **Dependencias**: El sujeto debe estar `Enrolled` o `Randomized`. El Visit debe estar `In Progress`.
*   **Validaciones Previas**: Consentimiento activo (sin retiros), ausencia de reconsentimientos bloqueantes, y cumplimiento de procedimientos obligatorios previos a dispensación (ej. Labs, ECG).
*   **Excepciones / Reemplazos**: Si un kit dispensado se daña o pierde, se emite un `Kit_Replacement_Event`, vinculando el nuevo kit al mismo Subject y marcando el anterior como "Perdido/Dañado".

## Signature Model

*   **Coordinator / Pharmacist Signature**: Requerida para ejecutar `Receipt`, `Dispense`, y `Return`.
*   **Witness Signature**: Requerida para `Destruction` y `Inventory_Adjustment`.
*   **PI Signature**: Requerida para revisión periódica del IP Accountability Log.
*   **Double Sign-Off**: Para preparación de dosis complejas (ej. IV blinded), un Farmacéutico prepara y firma, otro Farmacéutico/Coordinador dispensa y firma.
*   **Trazabilidad**: Integrado 100% con el **Operational Signature Engine** + PIN, registrando `signed_by`, `signed_at`, y huella criptográfica del payload.

## Unblinded Access Controls

*   **Pharmacist / Unblinded Coordinator**: Acceso total al IP Ledger, Lots, Kits, y Workflows de dispensación. Pueden ver códigos de tratamiento si el diseño lo exige.
*   **Blinded Coordinator / PI**: **Bloqueo estricto** al módulo de IP Accountability. En el Subject Chart, solo ven "Medicación Dispensada: [Fecha]" sin ver número de kit ni lote si esto revela el ciego.
*   **Monitor (Blinded)**: Acceso de solo lectura a Subject Chart, sin ver datos IP.
*   **Sponsor Monitor (Unblinded)**: Acceso de solo lectura al IP Ledger para reconciliación.
*   **Auditoría de Accesos**: Cualquier visualización de la pestaña Unblinded genera un evento de auditoría.

## Inventory Intelligence

*   **Low Inventory**: 
    *   *Trigger*: Inventario disponible < Threshold. 
    *   *Action*: Alerta visual en Command Center unblinded.
*   **Expiration Risk**: 
    *   *Trigger*: Kit expira en < 30 días. 
    *   *Action*: Bloqueo preventivo de dispensación para ese Kit.
*   **Missing Returns**: 
    *   *Trigger*: Visita completada pero no se registró evento de Return de la visita anterior.
    *   *Action*: Flag al Coordinador ("IP Return Pending").

## Visit Integration

*   **Dispensing Windows**: La dispensación se ancla a un `Visit`.
*   **Bloqueos**: Un `Dispense` no puede ocurrir si la visita no ha sido instanciada. Si la visita está fuera de ventana (Out of Window), el sistema permite dispensar pero fuerza la captura de un *Protocol Deviation/Note to File*.
*   **Emergency Dispensing**: Permitido fuera de visita estándar solo mediante un workflow excepcional que requiere firma del PI en < 24 hrs.

## Audit and Compliance Model

*   **Chain of Custody**: Trazabilidad a nivel de Kit. El sistema puede responder: "¿Dónde estuvo el Kit 999 en todo momento?". (Depot -> Recibido 1 Ene -> Cuarentena -> Liberado 3 Ene -> Dispensado 10 Ene -> Retornado 20 Ene -> Destruido 30 Ene).
*   **ALCOA+ / Part 11**: Cada transición de estado del Kit está firmada. El Ledger no permite DELETE ni UPDATE.
*   **Reconciliation**: Reporte automatizado que cruza Total Recibido vs (Dispensado + En Stock + Perdido + Dañado + Destruido), garantizando que la suma cuadre a cero variaciones.

## MVP Scope

*   **Mínimo Funcional**: Un módulo que permita recibir Kits manualmente, asignarlos a Sujetos en una Visita, registrar el retorno y registrar la destrucción, todo bajo firmas ALCOA+ y control de acceso por roles (Blinded vs Unblinded).
*   **Capacidades obligatorias**: Immutable Ledger, Operational Signatures para IP, Unblinded Guard, Subject Dispensing Workflow, Accountability Log exportable.
*   **Capacidades deseables (Post-MVP)**: Integración RTSM/IRT automática.

## Out of Scope for MVP

*   **Temperature Logs**: La monitorización de refrigeradores es compleja y suele manejarse con sistemas de hardware dedicados.
*   **Multi-Site Depot Logistics**: El MVP asume la gestión desde la perspectiva del Site, no del Sponsor.
*   **Barcode Scanning**: Deseable, pero no bloqueante para operar. Se puede usar ingreso manual con validación cruzada.
*   **Automated Resupply Ordering**: El Site pedirá IP manualmente al sponsor en el MVP.
*   **External IRT Integrations**: El coordinador transcribirá la asignación del IRT externo al Vilo OS.

## Recommended Build Order

*   **Phase 1: Core Ledger & Master Data**
    *   *Alcance*: Tablas inmutables (Lots, Kits, Transactions).
    *   *Criterio*: Inserción de Receipts sin UI compleja, validando balances.
*   **Phase 2: Unblinded Role Boundaries**
    *   *Alcance*: Políticas de RLS estrictas y UI Shell protegido por unblinded guards.
    *   *Criterio*: Un usuario Blinded recibe 403 / UI oculta al intentar acceder.
*   **Phase 3: Dispensing & Returns Workflows**
    *   *Alcance*: UI para dispensar a Sujetos y registrar retornos.
    *   *Criterio*: Flujo end-to-end con Firmas Operativas.
*   **Phase 4: Accountability Reconciliation & Intelligence**
    *   *Alcance*: Exportación de logs formales para Sponsor, Alertas de Expiración.
    *   *Criterio*: Generación del "Formato de Accountability" clásico.

## Estimated Complexity

*   **Core Ledger**: Alta (Requiere ingeniería cuidadosa de event-sourcing).
*   **Access Controls (Unblinding)**: Crítica (Un error aquí contamina el estudio).
*   **Signatures & Workflows**: Media (Reutiliza el Operational Signature Engine).
*   **Inventory Intelligence**: Baja (Consultas derivadas del Ledger).
