import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { canAccessUnblindedStudyArea } from '@/lib/auth/unblinded-guard'
import { UnblindedWorkspaceShell } from '@/components/study-workspace/unblinded-workspace-shell'

export const metadata = {
  title: 'Unblinded Workspace | Vilo OS',
}

export default async function UnblindedWorkspacePage({ params }: { params: { studyId: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect('/login')

  const hasAccess = await canAccessUnblindedStudyArea(sessionUser.id, params.studyId)
  
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8 bg-white border border-red-200 rounded shadow-sm text-red-800">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>You do not have active unblinded delegation for this study.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 flex-col">
      <header className="border-b bg-red-800 text-white px-6 py-4 flex justify-between">
        <h1 className="text-xl font-semibold">Unblinded Workspace (Restricted)</h1>
        <span className="text-sm bg-red-900 px-3 py-1 rounded">UNBLINDED AREA</span>
      </header>
      
      <main className="flex-1 overflow-auto p-6">
        <UnblindedWorkspaceShell studyId={params.studyId} />
      </main>
    </div>
  )
}
