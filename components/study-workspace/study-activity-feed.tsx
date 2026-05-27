type StudyActivityFeedProps = {
  studyId: string
}

export function StudyActivityFeed({ studyId }: StudyActivityFeedProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Activity Feed</h2>
        <p className="mt-1 text-sm text-slate-500">
          Placeholder for a unified study activity timeline (protocol events, publications, visit
          locks, compliance actions). Event aggregation is not wired in this shell.
        </p>
      </div>
      <div className="rounded-md border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        <p>No aggregated activity feed yet.</p>
        <p className="mt-2 font-mono text-xs text-slate-400">study_id={studyId}</p>
      </div>
    </div>
  )
}
