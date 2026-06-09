# Budget Negotiation Runtime G1

Status: native Vilo OS extension, no parallel negotiation platform

## Principle

Budget negotiation belongs inside the existing chain:

Protocol
Canonical Reader
Parser Extraction Result
Reconciliation
Runtime Objects
Source Generation
Visit Runtime
Financial Runtime

Negotiation must not become a separate ClinIQ clone. ClinIQ patterns can inform the model, but Vilo OS should derive negotiation intelligence from study documents, procedure runtime, visit execution, and financial projections.

## Current Native Support

Vilo OS already has three useful foundations:

1. Document Intelligence

- classifies `budget` and `contract`
- applies `budget_analysis` and `contract_analysis` domains
- indexes chunks for study-scoped search
- supports active document references for evidence-backed use

2. Financial Runtime

- expected procedures
- executed procedures
- earned procedures
- leakage score
- payment lifecycle projection
- screen failure visit payment logic

3. Study Runtime

- protocol schedule
- visit definitions
- procedure definitions
- generated source/runtime execution

## G1 Implementation

G1 adds UX presence without adding schema:

- Study Copilot now explicitly supports budget and CTA questions.
- Suggested questions include invoiceability, payment terms, pass-through costs, screen failure payment, and negotiation review items.
- Study Workspace now exposes a `Budget / CTA review` entry point using the existing Document Intelligence route.
- Study Workspace now also surfaces a native append-only budget negotiation ledger for sponsor offers, counteroffers, and term decisions.
- Study Workspace now includes an operational negotiation action panel to record sponsor offers and save draft counteroffers as ledger events.
- The negotiation action panel now captures structured sponsor terms and shows an SOA comparison summary for the current protocol.
- The negotiation action panel now supports structured budget line items so visit, procedure, pass-through, and screen-fail terms can be captured explicitly.
- The counteroffer draft remains derived from the protocol SOA and indexed Budget/CTA evidence.

This makes negotiation evidence discoverable while keeping Financial Runtime as the source of revenue truth.

## What G1 Does Not Do

G1 does not add:

- budget line-item table
- benchmark pricing model
- invoice terms extraction table
- migration

Those require a future schema phase.

## Negotiation Engine Data Requirements

A future negotiation engine should use:

- protocol-required procedures
- visit schedule and frequency
- source-generated procedure definitions
- budget/CTA chunks from `budget_analysis` and `contract_analysis`
- visit financial runtime projections
- screen failure policy
- pass-through policy
- invoice and payment terms
- amendments and procedure changes

## Future Native Schema Direction

When migrations are approved, the native extension should attach to study runtime:

- `study_budget_terms`
- `study_budget_line_items`
- `study_budget_negotiation_events`
- `study_budget_benchmark_observations`

Every row should include:

- `organization_id`
- `study_id`
- optional `procedure_definition_id`
- optional `visit_definition_id`
- evidence reference to document intelligence chunk/version
- audit/event reference

## VPI Role

VPI should observe budget risk, not perform negotiation.

Future VPI signals:

- high-value procedures missing budget evidence
- executed procedures without invoiceable terms
- screen failure payment ambiguity
- payment terms missing
- pass-through reimbursement ambiguity
- revenue leakage tied to negotiated terms

## Implemented Read-Only Evidence Summary

The first read-only budget evidence summary is implemented in Study Workspace:

- count budget/CTA documents
- count budget_analysis chunks
- count contract_analysis chunks
- show whether active budget/contract references exist

This is surfaced in the Study Command Center before creating negotiation tables.

## Implemented VPI Observation

VPI now observes budget evidence as a study-level risk:

- budget/CTA evidence missing
- active budget/contract reference missing
- financial leakage present but budget evidence missing

This keeps VPI observational and keeps negotiation evidence inside the existing Document Intelligence and Financial Runtime boundaries.

## Implemented Read-Only Term Hints

The Study Workspace budget evidence summary now includes read-only term hints:

- payment terms
- invoice due dates
- screen failure payment language
- pass-through reimbursement language
- invoiceable procedure language

These are counted from indexed Budget/CTA chunks and are not persisted as financial truth.

## Next Safe Step

The next safe step is an evidence-backed term review panel:

- show candidate source chunks
- let the user accept/reject a proposed term
- keep accepted terms read-only until a future approved financial term schema exists

The proposal must remain reviewed by a user before any future financial term table is created or updated.
