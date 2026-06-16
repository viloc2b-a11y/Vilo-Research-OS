CREATE TYPE public.lead_contact_attempt_type AS ENUM (
  'call',
  'sms',
  'email',
  'whatsapp'
);

CREATE TYPE public.lead_contact_outcome AS ENUM (
  'reached',
  'no_answer',
  'voicemail',
  'wrong_number',
  'opted_out',
  'rescheduled'
);

CREATE TABLE IF NOT EXISTS public.patient_lead_contact_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_lead_id UUID        NOT NULL REFERENCES public.patient_leads(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  attempt_type    public.lead_contact_attempt_type NOT NULL,
  outcome         public.lead_contact_outcome      NOT NULL,
  notes           TEXT,
  attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_lead_contact_log_lead_time_idx
  ON public.patient_lead_contact_log (patient_lead_id, attempted_at DESC);
