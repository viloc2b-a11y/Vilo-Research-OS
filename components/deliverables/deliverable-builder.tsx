'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { generateDeliverableAction, getCRAMonitoringWorkbookReadinessAction } from '@/lib/deliverables/actions'
import type {
  CRAMonitoringWorkbookReadinessResult,
  DeliverableAudience,
  DeliverableScope,
} from '@/lib/deliverables/types'

export function DeliverableBuilder() {
  const [preset, setPreset] = useState('')
  const [audience, setAudience] = useState<DeliverableAudience | ''>('')
  const [type, setType] = useState('')
  const [scope, setScope] = useState<DeliverableScope | ''>('')
  const [cohort, setCohort] = useState('')
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false)
  
  // Minimal inputs for the smoke/POC UI
  const [studyId, setStudyId] = useState('00000000-0000-0000-0000-000000000000') // Placeholder
  const [subjectId, setSubjectId] = useState('')
  const [visitInstanceId, setVisitInstanceId] = useState('')
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<{ success: boolean; storagePath?: string; error?: string } | null>(null)
  const [readiness, setReadiness] = useState<CRAMonitoringWorkbookReadinessResult | null>(null)
  const [readinessLoading, setReadinessLoading] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      if (type !== 'cra_monitoring_workbook' || !studyId) {
        setReadiness(null)
        setReadinessLoading(false)
        return
      }

      setReadinessLoading(true)
      try {
        const response = await getCRAMonitoringWorkbookReadinessAction({ studyId })
        if (!active) return
        setReadiness(response.success ? response.readiness : null)
      } catch {
        if (!active) return
        setReadiness(null)
      } finally {
        if (active) setReadinessLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [type, studyId])

  useEffect(() => {
    setAcknowledgeWarnings(false)
  }, [type, studyId, readiness?.checkedAt])

  const handleGenerate = async () => {
    if (!audience || !type || !scope) {
      alert('Please fill out all required fields.')
      return
    }

    if (type === 'cra_monitoring_workbook' && readiness?.status === 'BLOCKED') {
      setResult({ success: false, error: 'CRA Workbook readiness is blocked. Resolve the readiness items before generating.' })
      return
    }

    if (type === 'cra_monitoring_workbook' && readiness?.status === 'WARNING' && !acknowledgeWarnings) {
      setResult({ success: false, error: 'Acknowledge the readiness warnings before generating the CRA workbook.' })
      return
    }

    setIsGenerating(true)
    setResult(null)

    try {
      const res = await generateDeliverableAction({
        systemCode: type,
        organizationId: '00000000-0000-0000-0000-000000000000', // MOCK ORG ID FOR POC
        userId: '00000000-0000-0000-0000-000000000000', // MOCK USER ID
        audience,
        scope,
        filters: scope === 'visit' ? { studyId, subjectId: subjectId || 'placeholder', visitInstanceId } : (scope === 'subject' ? { studyId, subjectId } : { studyId })
      })
      setResult(res as { success: boolean; storagePath?: string; error?: string })
    } catch (e: unknown) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Left Panel: Wizard */}
      <div className="md:col-span-2 space-y-6">
        <h2 className="text-lg font-medium text-white mb-4">Build Deliverable</h2>
        
        {/* Presets */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-300">Saved Presets (Quick Start)</label>
          <div className="flex flex-wrap gap-2">
            {['CRA Monitoring Pack', 'PI Weekly Review', 'Consent Compliance Pack', 'Financial Reconciliation Pack'].map(p => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  preset === p ? 'bg-[#34a090] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Audience</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as DeliverableAudience | '')}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#34a090]"
            >
              <option value="">Select Audience</option>
              <option value="coordinator">Coordinator</option>
              <option value="cra">CRA / Monitor</option>
              <option value="sponsor">Sponsor / CRO</option>
              <option value="finance">Finance</option>
              <option value="qa">Internal QA</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Deliverable Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#34a090]"
            >
              <option value="">Select Type</option>
              <option value="printable_source_packet">Printable Source Packet PDF</option>
              <option value="cra_monitoring_workbook">CRA Monitoring Workbook</option>
              <option value="source_evidence_workbook" disabled>Source Evidence Workbook (Coming soon)</option>
              <option value="consent_evidence_package">Consent Evidence Package</option>
              <option value="signature_evidence_package">Signature Evidence Package</option>
              <option value="financial_reconciliation_workbook">Financial Reconciliation Workbook</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as DeliverableScope | '')}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#34a090]"
              >
                <option value="">Select Scope</option>
                <option value="study">Study</option>
                <option value="subject">Subject</option>
                <option value="visit">Visit Instance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Subject Cohort</label>
              <select
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#34a090]"
              >
                <option value="">All Subjects</option>
                <option value="Randomized">Randomized</option>
                <option value="Screen Failed">Screen Failed</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Discontinued">Discontinued</option>
                <option value="Lost To Follow-Up">Lost To Follow-Up</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Study ID</label>
              <input
                type="text"
                value={studyId}
                onChange={e => setStudyId(e.target.value)}
                placeholder="Enter UUID of study"
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#34a090]"
              />
            </div>
            
            {type === 'cra_monitoring_workbook' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">As Of Date</label>
                <input
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#34a090]"
                />
              </div>
            )}
          </div>
          
          {scope === 'subject' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Subject ID</label>
              <input
                type="text"
                value={subjectId}
                onChange={e => setSubjectId(e.target.value)}
                placeholder="Enter UUID of study_subject"
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#34a090]"
              />
            </div>
          )}
          
          {scope === 'visit' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Subject ID (Optional if Visit Instance known)</label>
                <input
                  type="text"
                  value={subjectId}
                  onChange={e => setSubjectId(e.target.value)}
                  placeholder="Enter UUID of study_subject"
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#34a090]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Visit Instance ID</label>
                <input
                  type="text"
                  value={visitInstanceId}
                  onChange={e => setVisitInstanceId(e.target.value)}
                  placeholder="Enter UUID of visit_runtime_instance"
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#34a090]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Preview */}
      <div className="space-y-6">
        <h2 className="text-lg font-medium text-white mb-4">Preview</h2>
        
        <div className="bg-slate-800 rounded-lg p-4 space-y-4">
          {type === 'cra_monitoring_workbook' ? (
            <div className={`rounded-lg border p-3 ${readiness?.status === 'BLOCKED'
              ? 'border-red-500/40 bg-red-500/10'
              : readiness?.status === 'WARNING'
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-emerald-500/40 bg-emerald-500/10'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">CRA Workbook Readiness</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={readiness?.status === 'BLOCKED' ? 'destructive' : 'default'}>
                      {readiness?.badgeLabel ?? (readinessLoading ? 'CHECKING' : 'READY')}
                    </Badge>
                    <span className="text-sm text-slate-200">
                      {readiness?.status === 'BLOCKED'
                        ? 'Blocked until the required readiness items are resolved.'
                        : readiness?.status === 'WARNING'
                          ? 'Ready to generate, but there are follow-up items.'
                          : 'Ready to generate.'}
                    </span>
                  </div>
                </div>
              </div>

              {readiness ? (
                <div className="mt-3 space-y-2">
                  {readiness.checks.map((check) => (
                    <div key={check.id} className="rounded border border-white/10 bg-slate-900/40 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-white">{check.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{check.detail}</p>
                        </div>
                        <Badge variant={check.status === 'blocker' ? 'destructive' : 'secondary'}>
                          {check.status === 'pass' ? 'PASS' : check.status === 'warning' ? 'WARNING' : 'BLOCKED'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  {readinessLoading ? 'Checking readiness...' : 'Select a study to evaluate readiness.'}
                </p>
              )}

              {readiness?.blockers.length ? (
                <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
                  <p className="font-medium text-red-200">Blocking items</p>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    {readiness.blockers.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {readiness?.warnings.length ? (
                <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  <p className="font-medium text-amber-200">Warnings</p>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    {readiness.warnings.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {readiness?.status === 'WARNING' ? (
                <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={acknowledgeWarnings}
                    onChange={(event) => setAcknowledgeWarnings(event.target.checked)}
                  />
                  Acknowledge readiness warnings before generating
                </label>
              ) : null}
            </div>
          ) : null}

          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Proposed Filename</p>
            <p className="text-sm text-slate-200 font-mono mt-1">VILO_Deliverable_Draft.tmp</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-700">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Subjects</p>
              <p className="text-xl font-medium text-white mt-0.5">-</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Visits</p>
              <p className="text-xl font-medium text-white mt-0.5">-</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-700">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Version Logic</p>
            <p className="text-sm font-medium text-indigo-400 mt-1">VERSION_USED_DURING_EXECUTION</p>
          </div>

          <div className="pt-3 border-t border-slate-700">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Warnings</p>
            <div className="rounded border border-amber-900/50 bg-amber-900/20 p-2 text-xs text-amber-200">
              {type === 'printable_source_packet' && !visitInstanceId ? '⚠️ visit_instance_id is required.' : '✅ Ready to generate.'}
            </div>
          </div>

          <button
            className="w-full mt-4 bg-[#34a090] text-white font-medium py-2 px-4 rounded-md hover:bg-[#2b8678] transition-colors disabled:opacity-50"
            onClick={handleGenerate}
            disabled={
              isGenerating ||
              readinessLoading ||
              (type === 'printable_source_packet' && !visitInstanceId) ||
              (type === 'cra_monitoring_workbook' && readiness?.status === 'BLOCKED') ||
              (type === 'cra_monitoring_workbook' && readiness?.status === 'WARNING' && !acknowledgeWarnings)
            }
          >
            {isGenerating ? 'Generating...' : 'Generate Deliverable'}
          </button>
          
          {result && (
            <div className={`mt-4 p-3 rounded text-sm ${result.success ? 'bg-green-900/20 text-green-400 border border-green-900/50' : 'bg-red-900/20 text-red-400 border border-red-900/50'}`}>
              {result.success ? `Success! Saved to ${result.storagePath}` : `Error: ${result.error}`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
