---
name: video-generator
description: Pipeline de producción de video IA en 5 fases. Usar para: guion, keyframes, BGM, TTS, montaje y consistencia visual.
---
# Video Generation
## Trigger
Activar con: crear video, IA, storyboard, keyframes, música de fondo, narración, producción audiovisual.
## Workflow
1. Fase 1: Recopilar requisitos (propósito, duración, ratio 16:9/9:16, estilo, lenguaje). STOP sin confirmación.
2. Fase 2: Definir estilo visual, elementos recurrentes, perfiles de voz, fuente BGM.
3. Fase 3: Segmentar en clips (4/6/8s). Definir `transition_description`, framing, budget narración, blueprint BGM.
4. Fase 4: Generar imágenes de referencia (MANDATORIO antes de keyframes).
5. Fase 5: Ejecutar keyframes → video → audio → mezcla. Preservar TODAS las pistas de audio.
## Rules
- Nunca usar TTS para diálogos on-screen. El modelo de video genera lip-sync.
- Último keyframe debe mostrar cambio interpolable (posición/estado/composición).
- Narración por span, no por clip. Respetar `narration_budget`.
- Fallo rápido si faltan specs. Zero asunciones creativas.
