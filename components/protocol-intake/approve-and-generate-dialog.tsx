'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { approveAndGenerateRuntimeAction, createSourcePackageAction } from '@/app/workspaces/[organizationId]/protocol-intake/reconciliation/actions'
import { AlertCircle, CheckCircle2, ChevronRight, Loader2, PlayCircle } from 'lucide-react'

export type ApproveAndGenerateDialogProps = {
  organizationId: string
  studyId: string
  protocolVersionId: string
  actorId: string
  onClose: () => void
}

type Step = {
  id: string
  label: string
  status: 'pending' | 'running' | 'success' | 'error'
  error?: string
}

export function ApproveAndGenerateDialog({
  organizationId,
  studyId,
  protocolVersionId,
  actorId,
  onClose
}: ApproveAndGenerateDialogProps) {
  const router = useRouter()
  
  const [steps, setSteps] = useState<Step[]>([
    { id: 'extract', label: 'Extracting Protocol', status: 'success' },
    { id: 'candidates', label: 'Building Candidates', status: 'success' },
    { id: 'reconciliation', label: 'Waiting for Reconciliation', status: 'success' },
    { id: 'runtime', label: 'Generating Runtime', status: 'pending' },
    { id: 'source', label: 'Building Source Package', status: 'pending' },
  ])
  
  const [isStarted, setIsStarted] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [hasError, setHasError] = useState(false)
  
  const [sourcePackageId, setSourcePackageId] = useState<string | null>(null)
  const [stats, setStats] = useState<{ visits: number, procedures: number } | null>(null)
  const [runtimeSnapshotId, setRuntimeSnapshotId] = useState<string | null>(null)

  const updateStep = (id: string, update: Partial<Step>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s))
  }

  const runPipeline = async () => {
    setIsStarted(true)
    setHasError(false)
    updateStep('runtime', { status: 'running', error: undefined })
    updateStep('source', { status: 'pending', error: undefined })
    
    let currentSnapshotId = ''
    
    try {
      // 1. Generate Runtime
      const runtimeRes = await approveAndGenerateRuntimeAction({
        organizationId,
        studyId,
        protocolVersionId,
        actorId
      })
      currentSnapshotId = runtimeRes.runtimeSnapshotId
      setRuntimeSnapshotId(currentSnapshotId)
      updateStep('runtime', { status: 'success' })
      
      // 2. Generate Source Package
      updateStep('source', { status: 'running' })
      const sourceRes = await createSourcePackageAction({
        organizationId,
        studyId,
        compositionSnapshotId: currentSnapshotId,
        actorId,
        packageName: `Generated Source Package - ${new Date().toISOString().split('T')[0]}`
      })
      
      setSourcePackageId(sourceRes.sourcePackageId)
      setStats({
        visits: sourceRes.visitShellCount,
        procedures: sourceRes.procedureShellCount
      })
      updateStep('source', { status: 'success' })
      
      setIsComplete(true)
      
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Generation failed'
      setHasError(true)
      if (!currentSnapshotId) {
        updateStep('runtime', { status: 'error', error: message || 'Runtime Generation Failed' })
      } else {
        updateStep('source', { status: 'error', error: message || 'Source Package Generation Failed' })
      }
    }
  }

  // Phase 4: Source Package Landing Page inside the modal, or redirect
  if (isComplete && sourcePackageId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
          <div className="bg-teal-600 p-8 text-center text-white">
            <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Source Package Created</h2>
            <p className="text-teal-100 mt-2">Ready for coordinator operations</p>
          </div>
          
          <div className="p-6">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 mb-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Generation Summary</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500">Visit Forms</dt>
                  <dd className="font-medium text-slate-900 text-lg">{stats?.visits}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Procedure Forms</dt>
                  <dd className="font-medium text-slate-900 text-lg">{stats?.procedures}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Generated On</dt>
                  <dd className="font-medium text-slate-900">{new Date().toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-medium text-teal-600">Draft</dd>
                </div>
              </dl>
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push(`/vilo/studies/${studyId}/source-builder/${sourcePackageId}`)}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-800 transition-colors"
              >
                Open Source Forms
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-900">Approve & Generate Source</h2>
          <p className="text-sm text-slate-500 mt-1">
            This will lock the current reconciliation and generate operational source components.
          </p>
        </div>
        
        <div className="p-6 flex-1 bg-slate-50/50">
          <div className="space-y-4">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-start gap-4">
                <div className="mt-0.5 shrink-0">
                  {step.status === 'success' && <CheckCircle2 className="w-5 h-5 text-teal-500" />}
                  {step.status === 'running' && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
                  {step.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                  {step.status === 'error' && <AlertCircle className="w-5 h-5 text-rose-500" />}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    step.status === 'pending' ? 'text-slate-400' :
                    step.status === 'error' ? 'text-rose-600' :
                    'text-slate-900'
                  }`}>
                    {step.label}
                  </p>
                  {step.error && (
                    <div className="mt-2 p-3 bg-rose-50 rounded-md border border-rose-100 text-sm text-rose-700">
                      <p className="font-medium mb-1">Coordinator Action Required</p>
                      <p className="text-rose-600/90">{step.error}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          {!isStarted || hasError ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={runPipeline}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
              >
                {hasError ? 'Retry Generation' : 'Confirm & Generate'}
              </button>
            </>
          ) : (
            <button
              disabled
              className="px-4 py-2 bg-indigo-400 text-white text-sm font-medium rounded-md cursor-not-allowed opacity-80 flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
