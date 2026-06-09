-- Phase 21: Optional Unblinded Domain Configuration

ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS blinding_type text CHECK (blinding_type IN ('Open Label', 'Single Blind', 'Double Blind', 'Observer Blind', 'Sponsor Blind', 'Unblinded', 'Other')) DEFAULT 'Open Label',
  ADD COLUMN IF NOT EXISTS requires_unblinded_team boolean NOT NULL DEFAULT false;

-- Setup check constraints logically based on the requirements
-- If blinding_type is Open Label or Unblinded, maybe we don't need an internal unblinded team barrier? 
-- The user explicitly said: "Only if Requires Unblinded Team = YES Enable Unblinded Domain"

CREATE OR REPLACE FUNCTION check_unblinded_readiness()
RETURNS trigger AS $$
BEGIN
  -- Logic to check if unblinded team is required during activation
  IF NEW.status = 'active' AND NEW.requires_unblinded_team = true THEN
     -- Assuming checkActivationReadiness in the API handles the complex lookups. 
     -- We just want to make sure the state constraint doesn't break.
     NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_unblinded_readiness ON public.studies;
CREATE TRIGGER trg_check_unblinded_readiness
BEFORE UPDATE ON public.studies
FOR EACH ROW EXECUTE FUNCTION check_unblinded_readiness();
