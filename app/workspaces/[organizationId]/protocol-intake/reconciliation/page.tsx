'use client'

import React, { useState } from 'react'
import { ExtractedVisitCandidate, ExtractedProcedureCandidate, ExtractedMatrixCellCandidate } from '@/lib/protocol-intake-reconciliation/reconciliation-candidates-types'
import { ApproveAndGenerateDialog } from '@/components/protocol-intake/approve-and-generate-dialog'

export default function CoordinatorReconciliationWorkspace() {
  const tabs = ['visits', 'procedures', 'matrix'] as const
  const [activeTab, setActiveTab] = useState<'visits' | 'procedures' | 'matrix'>('visits')

  // Mock data for UI layout
  const mockVisits: ExtractedVisitCandidate[] = []
  const mockProcedures: ExtractedProcedureCandidate[] = []
  const mockMatrix: ExtractedMatrixCellCandidate[] = []

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  // These would come from props/searchParams in a real app, hardcoding for this validation
  const organizationId = '00000000-0000-0000-0000-000000000000'
  const studyId = '00000000-0000-0000-0000-000000000000' 
  const protocolVersionId = '00000000-0000-0000-0000-000000000000'
  const actorId = '00000000-0000-0000-0000-000000000000'

  return (
    <div className="flex flex-col h-full bg-gray-50 p-6 space-y-4">
      {isDialogOpen && (
        <ApproveAndGenerateDialog
          organizationId={organizationId}
          studyId={studyId}
          protocolVersionId={protocolVersionId}
          actorId={actorId}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Coordinator Reconciliation</h1>
          <p className="text-sm text-gray-500">Review candidate extraction and approve operational truth.</p>
        </div>
        <div className="flex space-x-2">
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">IN REVIEW</span>
          <button 
            onClick={() => setIsDialogOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 shadow-sm"
          >
            Approve & Generate Source
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-4">
        {activeTab === 'visits' && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Visit Candidates</h2>
            <div className="text-sm text-gray-500">Select visits to approve, edit, or reject. Provenance is available on hover.</div>
            {/* Table Mock */}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visit Label</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Study Day / Window</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Populate from mockVisits */}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'procedures' && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Procedure Candidates</h2>
            <div className="text-sm text-gray-500">Map extracted procedures to canonical library names.</div>
             {/* Table Mock */}
             <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Procedure Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Populate from mockProcedures */}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'matrix' && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Schedule of Activities Matrix</h2>
            <div className="text-sm text-gray-500">Verify cell-level intersection markers (X, PRN) and footnote logic.</div>
            <div className="overflow-x-auto border rounded-md">
                {/* Matrix Grid Mock */}
                <div className="p-12 text-center text-gray-400">Matrix Visualization</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
