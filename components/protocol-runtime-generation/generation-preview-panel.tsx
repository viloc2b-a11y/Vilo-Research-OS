'use client'

export function GenerationPreviewPanel(props: {
  preview: {
    approvedVisits: number
    approvedProcedures: number
    distinctProcedureMappings: number
  } | null
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <p className="font-medium text-slate-900">Generation preview</p>
      {!props.preview ? (
        <p className="mt-1 text-xs text-slate-500">Run validation to populate preview counts.</p>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <span>{props.preview.approvedVisits} approved visits</span>
          <span>{props.preview.approvedProcedures} approved procedures</span>
          <span>{props.preview.distinctProcedureMappings} distinct blueprint mappings</span>
        </div>
      )}
    </div>
  )
}

