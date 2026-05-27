import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeVisitRuntimeRead } from '@/lib/visit-runtime-execution/visit-runtime-auth'
import { PUBLICATION_STATUS } from '@/lib/runtime-source-publication/runtime-source-publication-types'

type VisitShellOption = { id: string; visitCode: string; visitName: string }

type PublishedSourceVersion = {
  publication_id: string
  source_package_id: string
  publication_version: number
  package_hash: string
  visit_shells: VisitShellOption[]
}

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')

  if (!organizationId || !studyId) {
    return NextResponse.json(
      { error: 'organization_id and study_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeVisitRuntimeRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const { data: pubs, error: pubsError } = await supabase
      .from('runtime_source_package_publications')
      .select('id, source_package_id, publication_version, publication_status, package_hash')
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .eq('publication_status', PUBLICATION_STATUS.PUBLISHED)
      .order('publication_version', { ascending: false })

    if (pubsError) throw new Error(pubsError.message)

    const publications = (pubs ?? []).map((p) => ({
      publication_id: String(p.id),
      source_package_id: String(p.source_package_id),
      publication_version: Number(p.publication_version),
      package_hash: String(p.package_hash),
    }))

    const sourcePackageIds = publications.map((p) => p.source_package_id)

    const visitShellsByPackage: Record<string, VisitShellOption[]> = {}
    if (sourcePackageIds.length > 0) {
      const { data: shells, error: shellsError } = await supabase
        .from('runtime_source_visit_shells')
        .select('id, source_package_id, visit_code, visit_name, sequence_order')
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('source_package_id', sourcePackageIds)
        .order('sequence_order', { ascending: true })

      if (shellsError) throw new Error(shellsError.message)

      for (const shell of shells ?? []) {
        const pkgId = String(shell.source_package_id)
        if (!visitShellsByPackage[pkgId]) visitShellsByPackage[pkgId] = []
        visitShellsByPackage[pkgId].push({
          id: String(shell.id),
          visitCode: String(shell.visit_code),
          visitName: String(shell.visit_name),
        })
      }
    }

    const versions: PublishedSourceVersion[] = publications.map((p) => ({
      ...p,
      visit_shells: visitShellsByPackage[p.source_package_id] ?? [],
    }))

    return NextResponse.json({ ok: true, versions })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to list published source versions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

