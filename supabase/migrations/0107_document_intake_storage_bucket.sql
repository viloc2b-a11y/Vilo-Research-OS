-- Phase 1B: storage bucket for compliance runtime document blobs
insert into storage.buckets (id, name, public)
values ('operational-documents', 'operational-documents', false)
on conflict (id) do nothing;
