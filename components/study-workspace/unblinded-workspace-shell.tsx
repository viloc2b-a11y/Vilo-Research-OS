'use client'

import { useState } from 'react'

export function UnblindedWorkspaceShell({ studyId }: { studyId: string }) {
  const [activeTab, setActiveTab] = useState<'team' | 'edocs' | 'accountability' | 'dispensing' | 'audit'>('edocs')

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="flex gap-4 border-b pb-2">
        <button onClick={() => setActiveTab('team')} className={`px-4 py-2 font-medium ${activeTab === 'team' ? 'border-b-2 border-red-800 text-red-800' : 'text-gray-500'}`}>Unblinded Team</button>
        <button onClick={() => setActiveTab('edocs')} className={`px-4 py-2 font-medium ${activeTab === 'edocs' ? 'border-b-2 border-red-800 text-red-800' : 'text-gray-500'}`}>Unblinded eDocs</button>
        <button onClick={() => setActiveTab('accountability')} className={`px-4 py-2 font-medium ${activeTab === 'accountability' ? 'border-b-2 border-red-800 text-red-800' : 'text-gray-500'}`}>IP Accountability</button>
        <button onClick={() => setActiveTab('dispensing')} className={`px-4 py-2 font-medium ${activeTab === 'dispensing' ? 'border-b-2 border-red-800 text-red-800' : 'text-gray-500'}`}>IP Dispensing</button>
        <button onClick={() => setActiveTab('audit')} className={`px-4 py-2 font-medium ${activeTab === 'audit' ? 'border-b-2 border-red-800 text-red-800' : 'text-gray-500'}`}>Audit Trail</button>
      </div>

      <div className="bg-white border rounded shadow-sm p-6 min-h-[400px]">
        {activeTab === 'team' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Unblinded Team</h2>
            <p className="text-gray-600">Showing only staff with active unblinded delegation.</p>
            {/* Table implementation */}
          </div>
        )}

        {activeTab === 'edocs' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Unblinded eDocs</h2>
            <p className="text-gray-600">IP accountability, randomization documents, and unblinded correspondence.</p>
            {/* Document list implementation */}
          </div>
        )}

        {activeTab === 'accountability' && (
          <div>
            <h2 className="text-xl font-bold mb-4">IP Accountability Log</h2>
            <p className="text-gray-600">Track IP lots, kits, received, dispensed, and balance.</p>
            {/* Accountability implementation */}
          </div>
        )}

        {activeTab === 'dispensing' && (
          <div>
            <h2 className="text-xl font-bold mb-4">IP Dispensing & Preparation</h2>
            <p className="text-gray-600">Log dose preparation and dispensing for subjects.</p>
            {/* Dispensing implementation */}
          </div>
        )}

        {activeTab === 'audit' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Unblinded Audit Trail</h2>
            <p className="text-gray-600">Records of documents viewed, uploaded, and IP records modified.</p>
            {/* Audit trail implementation */}
          </div>
        )}
      </div>
    </div>
  )
}
