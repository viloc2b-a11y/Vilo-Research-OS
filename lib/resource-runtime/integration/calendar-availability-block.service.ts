import { createServerClient } from '@/lib/supabase/server'
import { logOperationalEvent } from '@/lib/operations/logOperationalEvent'
import { createResourceBlock, cancelResourceBlock, ResourceCatalogStore } from '../core'
import { getSiteTimeZone, allDayBlockRange, timedBlockRange } from '@/lib/calendar/site-calendar-dates'
import type { AvailabilityBlockMutationState } from '@/app/(ops)/operational-calendar/action-state'
import { resolveCalendarLinks } from '@/lib/calendar/resolve-calendar-links'
import { activeMemberships } from '@/lib/auth/membership-access'
import { getOrganizationMemberships } from '@/lib/auth/session'
import { canMutateOrganizationData, canManageSubjectVisits, canManageUnblindedData } from '@/lib/rbac/permissions'
import type { BlindingScope } from '@/lib/rbac/blinding'

function clean(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function parseBlindingScope(value: FormDataEntryValue | null): BlindingScope {
  if (value === 'unblinded' || value === 'blinded') return value
  return 'public_to_site'
}

async function validateMutationPermission(input: {
  userId: string
  organizationId: string
  blindingScope?: BlindingScope
}): Promise<string | null> {
  const memberships = activeMemberships(await getOrganizationMemberships(input.userId))
  if (!canMutateOrganizationData(memberships, input.organizationId)) {
    return 'Your role does not allow changes to organization data.'
  }
  if (!canManageSubjectVisits(memberships, input.organizationId)) {
    return 'Your role does not allow calendar or visit mutations.'
  }
  if (input.blindingScope === 'unblinded' && !canManageUnblindedData(memberships, input.organizationId)) {
    return 'Your role does not allow managing unblinded data.'
  }
  return null
}

function buildBlockRange(input: {
  startDate: string
  startTime: string | null
  endDate: string
  endTime: string | null
  allDay: boolean
}): { start: string; end: string; startDate: string; endDate: string; message?: string } {
  const timeZone = getSiteTimeZone()
  const range = input.allDay
    ? allDayBlockRange(input.startDate, input.endDate, timeZone)
    : timedBlockRange(
      input.startDate,
      input.startTime ?? '00:00',
      input.endDate,
      input.endTime ?? '23:59',
      timeZone,
    )

  if (new Date(range.start).getTime() >= new Date(range.end).getTime()) {
    return { ...range, startDate: input.startDate, endDate: input.endDate, message: 'End time must be after start time.' }
  }

  return { ...range, startDate: input.startDate, endDate: input.endDate }
}

export async function createCalendarResourceAvailabilityBlock(input: {
  eventType: 'calendar_availability_block_created' | 'calendar_availability_block_updated'
  organizationId: string
  organizationIds: string[]
  storageStudyId: string
  actorUserId: string
  originalBlockId?: string
  formData: FormData
}): Promise<AvailabilityBlockMutationState> {
  const title = clean(input.formData.get('title'))
  const blockType = clean(input.formData.get('block_type')) ?? 'unavailable'
  const scope = clean(input.formData.get('scope'))
  const studyId = clean(input.formData.get('study_id'))
  const resourceName = clean(input.formData.get('resource_name'))
  const startDate = clean(input.formData.get('start_date'))
  const startTime = clean(input.formData.get('start_time'))
  const endDate = clean(input.formData.get('end_date'))
  const endTime = clean(input.formData.get('end_time'))
  const allDay = input.formData.get('all_day') === 'on'
  const notes = clean(input.formData.get('notes'))
  const blindingScope = parseBlindingScope(input.formData.get('blinding_scope'))

  if (!title || !startDate || !endDate) {
    return { ok: false, message: 'Title, start date, and end date are required.' }
  }

  if (scope !== 'resource') {
     return { ok: false, message: 'Invalid scope for resource block.' }
  }
  if (!resourceName) {
     return { ok: false, message: 'Resource name is required for resource blocks.' }
  }

  const supabaseForValidation = await createServerClient()
  const memberOrgIds = input.organizationIds.length > 0 ? input.organizationIds : [input.organizationId]

  let resourceDoc
  try {
    resourceDoc = await ResourceCatalogStore.findByCode(supabaseForValidation, resourceName)
  } catch (err) {
    if (err instanceof Error && err.message.includes('NOT_IMPLEMENTED')) {
      return { ok: false, message: 'Resource availability runtime is not enabled yet.' }
    }
    throw err
  }
  if (!resourceDoc) {
     return { ok: false, message: 'Invalid resource code.' }
  }

  let studyLabel: string | null = null
  if (studyId) {
    const resolvedStudy = await resolveCalendarLinks({
      supabase: supabaseForValidation,
      organizationIds: memberOrgIds,
      studyId,
      subjectId: null,
      visitId: null,
      assignedUserId: null,
    })
    if (resolvedStudy.ok) studyLabel = resolvedStudy.data.studyLabel
    else return { ok: false, message: resolvedStudy.message }
  }

  const range = buildBlockRange({ startDate, startTime, endDate, endTime, allDay })
  if (range.message) return { ok: false, message: range.message }

  const permissionMessage = await validateMutationPermission({
    userId: input.actorUserId,
    organizationId: input.organizationId,
    blindingScope,
  })
  if (permissionMessage) return { ok: false, message: permissionMessage }

  let resourceBlock
  try {
    resourceBlock = await createResourceBlock({
       organizationId: input.organizationId,
       studyId: input.storageStudyId,
       resourceCode: resourceName,
       startDatetime: range.start,
       endDatetime: range.end,
       allDay
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('NOT_IMPLEMENTED')) {
      return { ok: false, message: 'Resource availability runtime is not enabled yet.' }
    }
    throw err
  }

  const supabase = await createServerClient()
  try {
    await logOperationalEvent({
      supabase,
      organizationId: input.organizationId,
      studyId: input.storageStudyId,
      eventType: input.eventType,
      actorUserId: input.actorUserId,
      occurredAt: range.start,
      payload: {
        calendar_event_type: 'availability_block',
        blinding_scope: blindingScope,
        availability_block_action: input.eventType === 'calendar_availability_block_updated' ? 'updated' : 'created',
        original_block_id: input.originalBlockId,
        title,
        block_type: blockType,
        scope,
        affected_user_id: null,
        affected_user_label: null,
        study_id: studyId,
        study_label: studyLabel,
        resource_name: resourceName,
        resource_block_id: resourceBlock.id,
        start_datetime: range.start,
        end_datetime: range.end,
        start_date: range.startDate,
        end_date: range.endDate,
        all_day: allDay,
        site_time_zone: getSiteTimeZone(),
        notes,
      },
    })
  } catch {
    return { ok: false, message: 'Could not save the resource availability block.' }
  }
  return {
    ok: true,
    message: input.eventType === 'calendar_availability_block_updated'
      ? 'Resource availability block updated.'
      : 'Resource availability block created.',
  }
}

export async function cancelCalendarResourceAvailabilityBlock(input: {
  originalRow: {
    id: string
    organization_id: string
    study_id: string
    payload: {
      resource_block_id?: string
      blinding_scope?: string
    }
  }
  actorUserId: string
  formData: FormData
  scheduleOccurredAt: string
}): Promise<AvailabilityBlockMutationState> {
  const cancelReason = clean(input.formData.get('cancel_reason'))
  const resourceBlockId = input.originalRow.payload?.resource_block_id

  if (resourceBlockId) {
     try {
       await cancelResourceBlock(resourceBlockId)
     } catch (err) {
       if (err instanceof Error && err.message.includes('NOT_IMPLEMENTED')) {
         return { ok: false, message: 'Resource availability runtime is not enabled yet.' }
       }
       throw err
     }
  }

  const supabase = await createServerClient()
  try {
    await logOperationalEvent({
      supabase,
      organizationId: input.originalRow.organization_id,
      studyId: input.originalRow.study_id,
      eventType: 'calendar_availability_block_cancelled',
      actorUserId: input.actorUserId,
      occurredAt: input.scheduleOccurredAt,
      payload: {
        calendar_event_type: 'availability_block',
        blinding_scope: input.originalRow.payload?.blinding_scope,
        availability_block_action: 'cancelled',
        original_block_id: input.originalRow.id,
        resource_block_id: resourceBlockId,
        cancelled_at: new Date().toISOString(),
        cancel_reason: cancelReason,
      },
    })
  } catch {
    return { ok: false, message: 'Could not cancel the resource availability block.' }
  }
  return { ok: true, message: 'Resource availability block cancelled.' }
}
