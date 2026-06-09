-- Phase 17b — Communications task linking
-- Adds source communication references to existing CRM task surfaces so email threads can create and track follow-up tasks without a parallel task system.

alter table public.patient_followups
  add column if not exists source_communication_thread_id uuid references public.communications_threads (id) on delete set null,
  add column if not exists source_communication_message_id uuid references public.communications_messages (id) on delete set null;

alter table public.bd_tasks
  add column if not exists source_communication_thread_id uuid references public.communications_threads (id) on delete set null,
  add column if not exists source_communication_message_id uuid references public.communications_messages (id) on delete set null;

create index if not exists patient_followups_source_comm_idx
  on public.patient_followups (source_communication_thread_id, due_at desc, created_at desc)
  where source_communication_thread_id is not null;

create index if not exists bd_tasks_source_comm_idx
  on public.bd_tasks (source_communication_thread_id, due_at desc, created_at desc)
  where source_communication_thread_id is not null;

