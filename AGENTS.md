\# AGENTS.md — Vilo OS



Reglas de revisión de código para Vilo OS, usadas por Gentleman Guardian Angel (GGA) en cada commit.



\## Contexto del producto



Vilo OS es el sistema operativo de software para Vilo Research Group (VRG), un sitio de investigación clínica y laboratorio certificado CLIA (VPL). Es infraestructura de \*\*misión crítica\*\*: errores en este sistema pueden afectar protocolos de estudios clínicos activos, datos de pacientes, y cumplimiento regulatorio (HIPAA, 21 CFR Part 11).



Pipeline core (riesgo crítico, \~35–40% operacional):

\*\*Protocol Intake → Procedure Library → Source Generation\*\*



\- \*\*Protocol Intake\*\*: ingesta y parsing de protocolos de estudio (sponsors/CROs).

\- \*\*Procedure Library\*\*: biblioteca normalizada de procedimientos clínicos reutilizables.

\- \*\*Source Generation\*\*: generación de documentos fuente (source documents) para cumplimiento regulatorio.



Vilo OS consume la capa compartida \*\*VIP (Vilo Intelligence Platform)\*\* vía Supabase (schema `vip`), que expone seis funciones de harness (VIH) y un audit log compatible con 21 CFR Part 11 / HIPAA.



\## Arquitectura



\- Framework: Next.js 16 (App Router), React 19

\- Backend/DB: Supabase (`@supabase/supabase-js`, `@supabase/ssr`) — proyecto compartido con el resto del ecosistema VIP

\- Lenguaje: TypeScript con \*\*`strict: true`\*\* — no se acepta debilitar el tipado

\- Validación de esquemas: Zod

\- Formularios: react-hook-form + @hookform/resolvers

\- UI: shadcn + Tailwind v4 + class-variance-authority

\- Testing: Vitest + Testing Library + Playwright

\- El proyecto ya tiene una suite extensa de scripts `\*:smoke` y `db:validate-\*` por fase — los cambios en runtime/protocolo/source generation deben mantenerse compatibles con estos scripts de validación, no solo con el build.



\## Reglas de revisión (prioridad alta → baja)



\### 1. Seguridad de datos clínicos (bloqueante)

\- Ningún dato de paciente (PHI) debe aparecer en logs, console.log, mensajes de error expuestos al cliente, o comentarios de código.

\- Toda escritura a tablas relacionadas con protocolos, procedimientos, o source documents debe pasar por las funciones VIH del schema `vip`, no acceso directo no auditado.

\- Cualquier cambio que toque el audit log (21 CFR Part 11 / HIPAA) requiere que la función de auditoría se invoque de forma síncrona antes de confirmar la operación — no fire-and-forget.

\- Rechazar cualquier query a Supabase que use el cliente con `service\_role` key en código que se ejecute en el browser/cliente. El proyecto ya tiene `safety-net:service-role-audit` para esto — si un cambio introduce un uso nuevo de service\_role, debe quedar claro que ese script lo cubre.

\- El proyecto ya corre `scan:protocol-safety` (scripts/scan-forbidden-protocol-tokens.ts) — cualquier cambio que introduzca tokens/strings relacionados a protocolos debe respetar esa lista de prohibidos, no sortearla.



\### 2. Integridad del pipeline crítico

\- Cambios en Protocol Intake, Procedure Library, o Source Generation deben incluir manejo explícito de errores — no silenciar excepciones ni usar catch vacíos.

\- Cualquier transformación de datos entre las tres etapas del pipeline debe ser idempotente o documentar explícitamente por qué no lo es.

\- No permitir cambios que reduzcan validación de inputs en el parsing de protocolos (Protocol Intake) sin justificación explícita en el PR/commit message.



\### 3. Convenciones de código

\- TypeScript con `strict: true` ya activo en el proyecto — cualquier `any`, `@ts-ignore`, o `@ts-expect-error` nuevo requiere justificación explícita en comentario inline; márcalo si no la tiene.

\- Validación de inputs externos (protocolos, formularios, payloads de Supabase) debe usar Zod, no checks manuales sueltos — el proyecto ya depende de Zod para esto.

\- Componentes React: nombres en PascalCase, un componente principal por archivo.

\- Funciones async: siempre con try/catch o manejo de error explícito, especialmente en llamadas a Supabase o a las funciones VIH.

\- No usar `console.log` en código que llegue a producción — usar el logger del proyecto si existe, o señalar su ausencia.



\### 4. Cumplimiento regulatorio

\- Cualquier endpoint o función que lea/escriba datos potencialmente identificables debe tener un comentario indicando qué controla el acceso (RLS policy, rol, etc.).

\- Cambios en políticas de Row Level Security (RLS) de Supabase requieren revisión extra cuidadosa — marcar como riesgo alto.



\## Qué NO bloquear

\- Estilo de formateo menor (dejar a Prettier/ESLint si están configurados).

\- Nombres de variables no críticas, salvo que sean genuinamente confusos.

\- Tests (excluidos explícitamente por `.gga` vía `EXCLUDE\_PATTERNS`).



\## Notas para el revisor AI

\- Si un cambio toca Protocol Intake, Procedure Library o Source Generation, trátalo como alto riesgo por defecto y exige justificación más detallada.

\- Si detectas PHI hardcodeado, datos de prueba con apariencia de datos reales de pacientes, o credenciales, marca como bloqueante inmediato.



