-- Sprint I4: Governance ↔ CAPA bridge
-- Adds capa_deviation_id to governance_signals so that when a governance
-- signal is promoted to a formal protocol deviation + CAPA action, the
-- traceability chain is persisted: signal → deviation → capa_action.
-- governance_capa_placeholders is retired (Phase 4 placeholder — no workflow).

ALTER TABLE public.governance_signals
  ADD COLUMN IF NOT EXISTS capa_deviation_id uuid
    REFERENCES public.protocol_deviations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS governance_signals_capa_deviation_idx
  ON public.governance_signals(capa_deviation_id)
  WHERE capa_deviation_id IS NOT NULL;
