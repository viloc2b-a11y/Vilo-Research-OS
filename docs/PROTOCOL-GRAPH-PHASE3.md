# Protocol Graph Engine — Phase 3

Status: Active  
Purpose: Executable protocol graph that **orchestrates** existing visit/procedure/source runtime — not a rewrite.

## Architecture

```
visit_definitions + procedure_definitions + visit_def_procedure_map
        +
study_versions.metadata.protocol_graph (rule extensions)
        │
        ▼
  compileProtocolGraphFromStudy()     ← graph compiler
        │
        ▼
  protocol_graph_publications         ← versioned immutable snapshots
  protocol_graph_nodes / edges        ← normalized index
        │
        ▼
  evaluateVisitGraphOrchestration()   ← runtime rule + dependency evaluation
        │
        ├── visit_readiness projections (derived blockers)
        ├── conditional procedure availability
        └── operational_events (PROTOCOL_GRAPH_PUBLISHED)
```

**Rules**

1. `operational_events` remain canonical chronology.
2. Projections remain derived; graph blockers enrich visit readiness only.
3. Visit runtime, source engine, and RPC execution paths are unchanged.
4. Coordinator-first: graph surfaces blockers and directives; coordinators act.

## Deliverables

| # | Capability | Module |
|---|------------|--------|
| 1 | Graph architecture | This doc + `protocol_graph_*` tables |
| 2 | Entity model | `lib/protocol-graph/types.ts` |
| 3 | Dependency engine | `evaluate/dependency-engine.ts` |
| 4 | Conditional procedures | `evaluate/conditional.ts` + conditional-procedures integration |
| 5 | Runtime rule evaluation | `evaluate/rule-evaluator.ts` |
| 6 | Safety trigger graph | `evaluate/safety-triggers.ts` + builtin rules |
| 7 | Visit sequencing | `evaluate/visit-sequencing.ts` |
| 8 | Window dependency rules | `evaluate/window-rules.ts` |
| 9 | Branch execution | `evaluate/branch-execution.ts` |
| 10 | Publication pipeline | `publish.ts`, `publish-action.ts`, source-publish co-publish |

## Study configuration

Opt into built-in example rules via `study_versions.metadata`:

```json
{
  "protocol_graph": {
    "ruleKeys": [
      "cbc_abnormality_safety",
      "unresolved_ae_signoff_block",
      "pk_branch_activation"
    ],
    "procedureDependencies": [
      {
        "visitCode": "V2",
        "procedureCode": "PK_DRAW",
        "dependsOnProcedureCode": "FASTING_CONFIRM"
      }
    ],
    "branches": [
      {
        "branchKey": "pk_sampling",
        "arm": "treatment",
        "activatesVisitCodes": ["PK_V1"]
      }
    ]
  }
}
```

## Publication

```typescript
import { publishProtocolGraph } from '@/lib/protocol-graph'

await publishProtocolGraph({
  supabase,
  organizationId,
  studyId,
  studyVersionId,
  actorUserId,
})
```

Sets `studies.active_protocol_graph_publication_id` and emits `PROTOCOL_GRAPH_PUBLISHED`.

Migration: `0076_phase3_protocol_graph.sql`

## Runtime orchestration

```typescript
import { evaluateVisitGraphOrchestration } from '@/lib/protocol-graph'

const result = await evaluateVisitGraphOrchestration({
  supabase,
  organizationId,
  studyId,
  visitId,
})
// result.blockers, result.directives, result.availableConditionalMapIds
```

## Builtin example rules

See `lib/protocol-graph/rules/builtin-catalog.ts`:

- CBC abnormality → safety workflow
- Unresolved AE → signoff / completion block
- PK branch activation
- Adrenal monitoring escalation
- Off-site modality gate
- Repeated lab chain
- Window outside protocol

## Deferred (not Phase 3)

- NLP protocol parser automation
- Sponsor portal / dashboards
- Autonomous AI publish
- Visual graph editor
