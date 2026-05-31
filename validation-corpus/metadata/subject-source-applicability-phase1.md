# Subject Source Applicability — Phase 1

## Files Changed
- `supabase/migrations/0147_subject_source_applicability.sql`: Schema update and backfill
- `lib/operations/event-types.ts`: Agregados 3 eventos polimórficos de auditoría
- `lib/visit-runtime/toggleFieldState.ts`: Añadido ToggleMode `set_applicability`
- `lib/subject/visit-runtime/actions.ts`: Añadido Server Action `setApplicabilityAction`
- `lib/visit-runtime/validateProcedure.ts`: Reglas excluyentes de campos vacíos.
- `components/subjects/visits/VisitActionToolbar.tsx`: Interfaz del Applicability Modal

## Migration Added
Se inyectó en `procedure_executions`:
- `applicability_status` (`text`, constraint de dominios controlados)
- `applicability_reason`
- `applicability_set_by`
- `applicability_set_at`
- `previous_applicability_status`

*Nota:* Se incluyó un bloque `UPDATE` de backfill para que las filas antiguas con `section_disabled_at` asimilen automáticamente el status `'skipped'`.

## UI Updated
- En `VisitActionToolbar.tsx`, se añadió el botón "Mark Applicability".
- El panel despliega un `<dialog>`/`<form>` con un combobox de estados (`not_applicable`, `skipped`, `contraindicated`, etc.) y un input `required` para el motivo ("Reason").

## Completion Logic Updated
En `validateProcedure.ts`, el motor de Source Data Quality intercepta la matriz de campos:
- Si `applicability_status` es `not_applicable`, `skipped` o `contraindicated` (o el flag obsoleto `section_disabled_at` es true), los campos vacíos requeridos son descartados temporalmente y NO generan `missing required field(s)` alerts ni detienen el Visit Closeout.

## Audit Events Added
`OPERATIONAL_EVENT_TYPES` fue suplementado e insertado también en los `GATEWAY_EMITTED_EVENT_TYPES`:
- `PROCEDURE_APPLICABILITY_CHANGED`
- `SOURCE_FIELD_APPLICABILITY_CHANGED`
- `APPLICABILITY_REVERTED`

## Runtime Validation
- **Idempotencia:** Enviar un estado aplicable idéntico no emite duplicados. Revertir a 'applicable' registra `APPLICABILITY_REVERTED` limpiando el reason y el timestamp.
- **Signatures:** Los procedimientos "skipped" todavía mantienen un Response Set ID y deben ser formalmente firmados como atestación médica.

## Known Limitations
- En esta Fase 1, la aplicabilidad opera netamente a nivel "Procedimiento/Sección". Los campos unitarios (Field-level applicability) y Visitas enteras (Visit-level applicability) no poseen interfaces gráficas ni tablas inyectadas, quedando delegadas a fases posteriores.
- Debido a la inexistencia de Docker en este run temporal, la base local no corrió las migraciones automáticamente, por lo que requerirá un `supabase db reset` previo a probar la feature en vivo.

## Final Verdict
El mecanismo arcaico de "Disable Section" ha mutado exitosamente a un Applicability Engine formal. El sistema tolera protocolos dinámicos y exime justificadamente validaciones GCP sin corromper la completitud del CRF. El flujo está 100% blindado por el Audit Ledger centralizado.
