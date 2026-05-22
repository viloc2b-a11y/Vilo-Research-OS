---
name: similarweb-analytics
description: Analiza tráfico web, rankings y fuentes de canales vía SimilarWeb. Usar para: investigación de dominios, benchmarking competitivo, distribución geográfica y métricas de engagement.
---
# SimilarWeb Analytics
## Trigger
Activar cuando se mencione: dominio, tráfico, visitantes únicos, bounce rate, ranking global, fuentes de tráfico, distribución por país.
## Workflow
1. Validar dominio → formato `example.com` (sin `http://`)
2. Seleccionar API según necesidad:
   - `get_global_rank` → Popularidad histórica
   - `get_visits_total` / `get_unique_visit` → Volumen
   - `get_traffic_sources_desktop|mobile` → Canales de adquisición
   - `get_total_traffic_by_country` → Geografía (max 3 meses)
3. Ejecutar → Guardar resultado en `references/` o retornar JSON estructurado
4. Limitar a 12 meses históricos, granularidad mensual
## Rules
- Guardar datos inmediatamente tras llamada API. Cero redundancia.
- Si crédito/API falla, retornar últimos datos cacheados en `references/`.
- No asumir métricas. Solo datos verificados.
