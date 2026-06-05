import { DeliverableBuilder } from '@/components/deliverables/deliverable-builder'

export default function DeliverablesPage() {
  return (
    <div className="h-full w-full p-8 flex flex-col max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Deliverables</h1>
        <p className="text-sm text-slate-400">
          Generate audit-ready reports, workbooks, and source evidence packages.
        </p>
      </div>

      <div className="flex-1 rounded-xl border border-white/10 bg-slate-900/50 p-6">
        <DeliverableBuilder />
      </div>
    </div>
  )
}
