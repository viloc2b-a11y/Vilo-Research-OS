import { PatientConsentPortal } from '@/components/subject/consent/PatientConsentPortal'
import { loadPatientConsentPortalAction } from '@/lib/subject/consent/actions'

type ConsentPortalPageProps = {
  params: Promise<{ token: string }>
}

export default async function ConsentPortalPage({ params }: ConsentPortalPageProps) {
  const { token } = await params
  let model
  try {
    model = await loadPatientConsentPortalAction(token)
  } catch (error) {
    return (
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-xl rounded-md border p-5">
          <h1 className="text-lg font-semibold">Consent link unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'This consent link is unavailable or expired.'}
          </p>
        </div>
      </main>
    )
  }
  return <PatientConsentPortal token={token} model={model} />
}
