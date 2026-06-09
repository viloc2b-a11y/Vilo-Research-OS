import { redirect } from 'next/navigation'

export default async function AdminPage() {
  // Navigation guard is now handled comprehensively in layout.tsx.
  // Redirect to the first structured section.
  redirect('/admin/organization')
}
