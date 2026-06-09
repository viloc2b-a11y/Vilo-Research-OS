'use client'

interface DocumentDestinationSelectorProps {
  domain: string
  onDomainChange: (val: string) => void
  entityType: string
  onEntityTypeChange: (val: string) => void
  destinationEntityId?: string
  onDestinationEntityIdChange?: (val: string) => void
  showEntityId?: boolean
}

export function DocumentDestinationSelector({
  domain,
  onDomainChange,
  entityType,
  onEntityTypeChange,
  destinationEntityId = '',
  onDestinationEntityIdChange,
  showEntityId = false,
}: DocumentDestinationSelectorProps) {
  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-800">Operational Destination</h3>
      <p className="text-xs text-slate-500">
        Route the document into the engine that will actually use it: runtime, financial,
        compliance, or repository.
      </p>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">Destination Domain</label>
          <select
            value={domain}
            onChange={(e) => onDomainChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2 text-sm"
          >
            <option value="" disabled>Select Domain</option>
            <option value="source_builder">Runtime Engine - Protocol / Lab Manual / Source</option>
            <option value="consent_management">Runtime Engine - Consent Management</option>
            <option value="regulatory_binder">Compliance Engine - Regulatory Binder</option>
            <option value="budget_contract">Financial Engine - Budget / CTA</option>
            <option value="study_documents">Repository - Study Documents</option>
            <option value="subject_chart">Repository - Subject Chart</option>
            <option value="visit_workspace">Repository - Visit Workspace</option>
            <option value="procedure_execution">Repository - Procedure Execution Evidence</option>
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
            <option value="study">Study Runtime Level</option>
            <option value="subject">Subject Runtime Level</option>
            <option value="visit">Visit Runtime Level</option>
            <option value="procedure">Procedure Runtime Level</option>
          </select>
        </div>
      </div>

      {showEntityId && onDestinationEntityIdChange ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">Destination entity id</label>
          <input
            type="text"
            value={destinationEntityId}
            onChange={(e) => onDestinationEntityIdChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2 font-mono text-sm"
            placeholder="UUID for subject, visit, or procedure runtime object"
            required
          />
        </div>
      ) : null}
    </div>
  )
}
