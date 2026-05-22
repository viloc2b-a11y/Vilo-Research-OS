---
name: skill-creator
description: Guía maestra para crear, validar y empaquetar nuevos skills Vilo. Usar para: extender capacidades AI, estandarizar workflows o integrar nuevas APIs/herramientas.
---
# Skill Creator
## Trigger
Activar con: crear nuevo skill, empaquetar proceso, actualizar plantilla, añadir referencia, validar SKILL.md.
## Workflow
1. Definir dominio → triggers claros, descripción <150 palabras.
2. Estructurar: `SKILL.md` (<500 líneas) + `scripts/` (código) + `references/` (docs largas) + `templates/` (boilers).
3. Aplicar grados de libertad: Alto (texto) / Medio (pseudocódigo) / Bajo (scripts rígidos).
4. Validar: progresivo disclosure, cero duplicación, verbos imperativos, fallo rápido.
5. Registrar en `registry.json` → status `active`.
## Rules
- Context window es compartido. Solo incluir lo que el agente no sabe.
- Mover variantes a `references/`. Mantener SKILL.md como ruta principal.
- No incluir README, CHANGELOG ni docs de usuario.
- Validar con `python scripts/quick_validate.py <skill-name>` si disponible.
