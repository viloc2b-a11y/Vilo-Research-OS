import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import { StudySetupWizardShell } from '@/components/study-workspace/study-setup-wizard-shell'

export const metadata = {
  title: 'Study Setup Wizard | Vilo OS',
}

export default async function StudySetupPage({ params }: { params: { studyId: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect('/login')

  const supabase = await createServerClient()
  
  // Verify access and get study
  const { data: study, error } = await supabase
    .from('studies')
    .select('*')
    .eq('id', params.studyId)
    .single()

  if (error || !study) {
    redirect('/studies')
  }

  // If already active, maybe redirect to workspace, but we'll let the wizard show it's Complete.

  return (
    <div className="flex h-screen bg-gray-50 flex-col">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">Study Setup Wizard: {study.name}</h1>
      </header>
      
      <main className="flex-1 overflow-auto p-6">
        <StudySetupWizardShell studyId={params.studyId} initialStatus={study.status} />
      </main>
    </div>
  )
}
