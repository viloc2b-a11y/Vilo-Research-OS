import { PerformanceCommandNav } from '@/app/(ops)/performance/_components/PerformanceCommandNav'

export default function PerformanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <PerformanceCommandNav />
      {children}
    </div>
  )
}
