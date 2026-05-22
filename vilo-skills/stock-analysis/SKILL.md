---
name: stock-analysis
description: Investigación accionaria completa vía Yahoo Finance. Usar para: perfiles corporativos, análisis técnico/fundamental, actividad insider, filings SEC y comparativas multi-acción.
---
# Stock Analysis
## Trigger
Activar con: ticker, símbolo, análisis de acción, perfil empresa, gráficos, insider, 10-K/10-Q, comparativa sectorial.
## Workflow
1. Identificar símbolo → `AAPL`, `TSLA`, `^GSPC`, etc.
2. Cargar APIs mínimas necesarias:
   - Perfil: `Yahoo/get_stock_profile`
   - Técnico/Valoración: `Yahoo/get_stock_insights`
   - Precio: `Yahoo/get_stock_chart` (interval/range según horizonte)
   - Insider/SEC: `Yahoo/get_stock_holders`, `Yahoo/get_stock_sec_filing`
3. Combinar outputs → retornar resumen estructurado (perfil + outlook + riesgo + próximos eventos)
## Rules
- Perfil + Insights siempre juntos para preguntas generales.
- Usar `comparisons` en chart para multi-ticker.
- Ajustar `region`/`lang` para mercados no-US.
- No dar recomendación de inversión. Solo datos y contexto.
