'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, getPrimaryOrganizationId } from '@/lib/auth/session'

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = requiredString(formData, key)
  return value || undefined
}

function optionalInt(formData: FormData, key: string): number | null {
  const value = requiredString(formData, key)
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function optionalDecimal(formData: FormData, key: string): number | null {
  const value = requiredString(formData, key)
  if (!value) return null
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

// ---------------------------------------------------------------------------
// createCampaign
// ---------------------------------------------------------------------------

export async function createCampaign(formData: FormData): Promise<never> {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    redirect('/recruitment/campaigns?result=error&reason=No+active+organization')
  }

  const name = requiredString(formData, 'name')
  const campaign_type = requiredString(formData, 'campaign_type')

  if (!name || !campaign_type) {
    redirect('/recruitment/campaigns/new?result=error&reason=Name+and+campaign+type+are+required')
  }

  const description = optionalString(formData, 'description')
  const utm_campaign = optionalString(formData, 'utm_campaign')
  const target_leads = optionalInt(formData, 'target_leads')
  const target_enrollments = optionalInt(formData, 'target_enrollments')
  const start_date = optionalString(formData, 'start_date')
  const end_date = optionalString(formData, 'end_date')

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('recruitment_campaigns')
    .insert({
      organization_id: organizationId,
      name,
      campaign_type,
      status: 'draft',
      description: description ?? null,
      utm_campaign: utm_campaign ?? null,
      target_leads: target_leads ?? null,
      target_enrollments: target_enrollments ?? null,
      start_date: start_date ?? null,
      end_date: end_date ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/recruitment/campaigns/new?result=error&reason=${encodeURIComponent(error?.message ?? 'Failed to create campaign')}`,
    )
  }

  redirect(
    `/recruitment/campaigns/${data.id}?result=success&reason=${encodeURIComponent('Campaign created')}`,
  )
}

// ---------------------------------------------------------------------------
// updateCampaign
// ---------------------------------------------------------------------------

export async function updateCampaign(formData: FormData): Promise<never> {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    redirect('/recruitment/campaigns?result=error&reason=No+active+organization')
  }

  const campaignId = requiredString(formData, 'campaignId')
  if (!campaignId) {
    redirect('/recruitment/campaigns?result=error&reason=Campaign+ID+required')
  }

  const supabase = await createServerClient()

  // Verify ownership before mutating
  const { data: existing } = await supabase
    .from('recruitment_campaigns')
    .select('organization_id')
    .eq('id', campaignId)
    .single() as { data: { organization_id: string } | null }

  if (!existing || existing.organization_id !== organizationId) {
    redirect('/recruitment/campaigns?result=error&reason=Campaign+not+found')
  }

  const status = optionalString(formData, 'status')
  const description = optionalString(formData, 'description')
  const target_leads = optionalInt(formData, 'target_leads')
  const target_enrollments = optionalInt(formData, 'target_enrollments')
  const budget_amount = optionalDecimal(formData, 'budget_amount')

  // Build partial update — only the listed fields
  const patch: Record<string, unknown> = {}
  if (status !== undefined) patch.status = status
  // description can be cleared, so we use a direct formData presence check
  const descRaw = formData.get('description')
  if (descRaw !== null) patch.description = description ?? null
  if (target_leads !== null) patch.target_leads = target_leads
  if (target_enrollments !== null) patch.target_enrollments = target_enrollments
  // budget_amount presence check — allow explicit null to clear the field
  const budgetRaw = formData.get('budget_amount')
  if (budgetRaw !== null) patch.budget_amount = budget_amount

  const { error } = await supabase
    .from('recruitment_campaigns')
    .update(patch)
    .eq('id', campaignId)
    .eq('organization_id', organizationId)

  if (error) {
    redirect(
      `/recruitment/campaigns/${campaignId}/edit?result=error&reason=${encodeURIComponent(error.message)}`,
    )
  }

  redirect(
    `/recruitment/campaigns/${campaignId}?result=success&reason=${encodeURIComponent('Campaign updated')}`,
  )
}

// ---------------------------------------------------------------------------
// linkStudyToCampaign
// ---------------------------------------------------------------------------

export async function linkStudyToCampaign(formData: FormData): Promise<never> {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    redirect('/recruitment/campaigns?result=error&reason=No+active+organization')
  }

  const campaignId = requiredString(formData, 'campaignId')
  const studyId = requiredString(formData, 'studyId')

  if (!campaignId || !studyId) {
    redirect(`/recruitment/campaigns/${campaignId}?result=error&reason=Campaign+and+study+IDs+required`)
  }

  const supabase = await createServerClient()

  // Verify ownership before mutating
  const { data: existing } = await supabase
    .from('recruitment_campaigns')
    .select('organization_id')
    .eq('id', campaignId)
    .single() as { data: { organization_id: string } | null }

  if (!existing || existing.organization_id !== organizationId) {
    redirect('/recruitment/campaigns?result=error&reason=Campaign+not+found')
  }

  await supabase
    .from('campaign_studies')
    .upsert({ campaign_id: campaignId, study_id: studyId }, { onConflict: 'campaign_id,study_id', ignoreDuplicates: true })

  redirect(
    `/recruitment/campaigns/${campaignId}?result=success&reason=${encodeURIComponent('Study linked')}`,
  )
}

// ---------------------------------------------------------------------------
// unlinkStudyFromCampaign
// ---------------------------------------------------------------------------

export async function unlinkStudyFromCampaign(formData: FormData): Promise<never> {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    redirect('/recruitment/campaigns?result=error&reason=No+active+organization')
  }

  const campaignId = requiredString(formData, 'campaignId')
  const studyId = requiredString(formData, 'studyId')

  if (!campaignId || !studyId) {
    redirect(`/recruitment/campaigns/${campaignId}?result=error&reason=Campaign+and+study+IDs+required`)
  }

  const supabase = await createServerClient()

  // Verify ownership before mutating
  const { data: existing } = await supabase
    .from('recruitment_campaigns')
    .select('organization_id')
    .eq('id', campaignId)
    .single() as { data: { organization_id: string } | null }

  if (!existing || existing.organization_id !== organizationId) {
    redirect('/recruitment/campaigns?result=error&reason=Campaign+not+found')
  }

  await supabase
    .from('campaign_studies')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('study_id', studyId)

  redirect(
    `/recruitment/campaigns/${campaignId}?result=success&reason=${encodeURIComponent('Study unlinked')}`,
  )
}
