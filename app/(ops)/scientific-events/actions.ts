'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function createScientificEvent(payload: {
  organization_id: string;
  title: string;
  description?: string;
  event_type: string;
  event_date: string;
  event_time?: string;
  location?: string;
  virtual_link?: string;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored for server actions
          }
        },
      },
    }
  );

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('scientific_events')
    .insert({
      ...payload,
      owner_user_id: user.user.id,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw error;
  
  revalidatePath('/scientific-events');
  return data;
}

export async function addEventParticipant(payload: {
  event_id: string;
  contact_person_id?: string;
  contact_organization_id?: string;
  role?: string;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored for server actions
          }
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('scientific_event_participants')
    .insert({
      event_id: payload.event_id,
      contact_person_id: payload.contact_person_id || null,
      contact_organization_id: payload.contact_organization_id || null,
      role: payload.role,
      registration_status: 'invited',
      attendance_status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  
  revalidatePath(`/scientific-events/${payload.event_id}`);
  return data;
}

export async function updateEventParticipantStatus(
  participant_id: string,
  event_id: string,
  updates: {
    registration_status?: string;
    attendance_status?: string;
    notes?: string;
  }
) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored for server actions
          }
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('scientific_event_participants')
    .update(updates)
    .eq('id', participant_id)
    .select()
    .single();

  if (error) throw error;
  
  revalidatePath(`/scientific-events/${event_id}`);
  return data;
}
