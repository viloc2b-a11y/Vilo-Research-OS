# Scientific Events MVP — SOP

## Objetivo
- Implementar el módulo "Vilo Scientific Events" como un motor de engagement y relacionamiento dentro de Vilo OS, integrado directamente con el Contact Runtime y el CRM. No es una aplicación standalone.

## Alcance
### Qué es
- MVP operativo para crear y rastrear eventos científicos y de BD (Business Development).
- Entidades principales: `scientific_events`, `scientific_event_participants`.
- Integración nativa con `contact_people` y `contact_organizations`.

### Qué no es
- No es Eventbrite. No tiene pasarela de pagos, tickets, portal de autoservicio ni motor complejo de calendario.

## Contrato (OBLIGATORIO)
### Inputs
- Fuente(s): Entradas del coordinador desde la UI en `/scientific-events`.
- Formato esperado (schema/descripción):
  - Evento: `title` (text), `event_type` (enum), `event_date` (date), `status` (enum), `slug` (text), `stream_embed_url` (text), `sponsor_organization_id` (uuid).
  - Participantes: `event_id`, `contact_person_id` / `contact_organization_id`, `registration_status`, `attendance_status`.
  - Engagement: Tablas `scientific_event_questions` y `scientific_event_attendance_sessions` conectadas a `scientific_event_participants`.
- Validaciones previas:
  - Un participante debe referenciar un `contact_person_id` o un `contact_organization_id`, pero no ambos.
  - Validación de acceso vía RLS (`contact_runtime_user_can_access` y `contact_runtime_user_can_manage`).

### Outputs
- Artefactos esperados (rutas exactas):
  - Migración SQL: `supabase/migrations/0167_scientific_events_mvp.sql`
  - UI de lista y creación: `app/(ops)/scientific-events/page.tsx`
  - UI de detalle y participantes: `app/(ops)/scientific-events/[id]/page.tsx`
  - Server Actions: `app/(ops)/scientific-events/actions.ts`
- Criterios de aceptación:
  - [ ] (CRITICAL) El esquema de base de datos debe ser creado y RLS debe restringir acceso por `organization_id`.
  - [ ] (CRITICAL) La UI debe compilar sin errores de TypeScript.
  - [ ] (CRITICAL) Los participantes deben enlazar directamente al Contact Runtime, sin duplicar entidades de personas.

### Invariantes / Idempotencia
- Definición de “idempotente” para esta tarea: Las migraciones deben usar `if not exists` / `on conflict do nothing` donde aplique para no fallar en re-ejecuciones. Las acciones del servidor deben actualizar entidades si existen (upsert en participantes) para evitar duplicados.

## Flujo (pasos)
1. Definir los tipos enumerados y tablas en la base de datos (Migración 0167).
2. Crear la interfaz de listado de eventos (`page.tsx`).
3. Crear las acciones de servidor (`actions.ts`) para Mutaciones de Eventos y Participantes.
4. Crear la vista de detalles del evento y gestión de participantes (`[id]/page.tsx`).
5. Validar compilación con `npm run typecheck`.

## Restricciones / Casos borde (Memoria viva)
- Nota: No crear nuevas tablas de usuarios o contactos. Utilizar `public.contact_people` y `public.contact_organizations` existentes del Contact Runtime (Migración 0166).

## Observabilidad
- Log path: `.tmp/logs/scientific_events_mvp.log`
- Run manifest path: `.tmp/runs/scientific_events_mvp/{timestamp}/manifest.json`
- Señales de éxito/fracaso: El comando `npm run typecheck` pasa sin errores relacionados a `scientific-events`.
