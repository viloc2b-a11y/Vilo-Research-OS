'use client'

interface DocumentDestinationSelectorProps {
  domain: string
  onDomainChange: (val: string) => void
  entityType: string
  onEntityTypeChange: (val: string) => void
}

export function DocumentDestinationSelector({
  domain,
  onDomainChange,
  entityType,
  onEntityTypeChange
}: DocumentDestinationSelectorProps) {
  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-800">Operational Destination</h3>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">Destination Domain</label>
          <select
            value={domain}
            onChange={(e) => onDomainChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2 text-sm"
          >
            <option value="" disabled>Select Domain</option>
            <option value="source_builder">Source Builder</option>
            <option value="regulatory_binder">Regulatory Binder</option>
            <option value="budget_contract">Budget / Contract</option>
            <option value="study_documents">Study Documents</option>
            <option value="subject_chart">Subject Chart</option>
            <option value="visit_workspace">Visit Workspace</option>
            <option value="procedure_execution">Procedure Execution Evidence</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">Entity Target</label>
          <select
            value={entityType}
            onChange={(e) => onEntityTypeChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2 text-sm"
          >
            <option value="" disabled>Select Target</option>
            <option value="study">Study Level</option>
            <option value="subject">Subject Level</option>
            <option value="visit">Visit Level</option>
            <option value="procedure">Procedure Level</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        In a full implementation, this will cascade into specific search dropdowns for actual subjects, visits, and procedures.
      </p>
    </div>
  )
}
