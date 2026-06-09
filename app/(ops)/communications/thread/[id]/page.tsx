import { redirect } from 'next/navigation'

export default async function CommunicationsThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/communications?thread=${encodeURIComponent(id)}`)
}

