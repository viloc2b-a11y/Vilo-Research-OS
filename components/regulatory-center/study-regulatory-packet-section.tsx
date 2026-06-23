'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { buildStudyRegulatoryPacket, type StudyRegulatoryPacket, type PacketItem } from '@/lib/regulatory-center/study-regulatory-packet'
import type { StudyLinkWithDetails, StudyInfo } from '@/lib/regulatory-center/study-regulatory-links'
import type { StudyRegulatoryDocumentEntry } from '@/lib/regulatory-center/study-regulatory-documents'

// ── Props ────────────────────────────────────────────────────────────────────

type StudyRegulatoryPacketSectionProps = {
  studies: StudyInfo[]
  links: StudyLinkWithDetails[]
  studySpecificDocs?: Record<string, StudyRegulatoryDocumentEntry[]>
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}>
      {label}
    </span>
  )
}

function readinessColor(score: number | null): string {
  if (score === null) return 'bg-slate-100 text-slate-500'
  if (score >= 100) return 'bg-green-100 text-green-700'
  if (score >= 80) return 'bg-teal-100 text-teal-700'
  if (score >= 50) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function readinessBarColor(score: number | null): string {
  if (score === null) return 'bg-slate-300'
  if (score >= 100) return 'bg-green-500'
  if (score >= 80) return 'bg-teal-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

// ── Packet Item Card ─────────────────────────────────────────────────────────

function PacketItemCard({ item }: { item: PacketItem }) {
  const statusColor = item.expirationBucket === 'expired' ? 'text-red-600'
    : item.expirationBucket?.startsWith('expiring') ? 'text-amber-600'
    : item.status === 'needs_review' ? 'text-amber-600'
    : 'text-slate-500'

  return (
    <div className={`flex items-start justify-between rounded-md border p-3 ${
      item.required && !item.isComplete ? 'border-red-200 bg-red-50'
      : item.expirationBucket === 'expired' ? 'border-red-100 bg-red-50'
      : item.expirationBucket?.startsWith('expiring') ? 'border-amber-100 bg-amber-50'
      : 'border-slate-100 bg-white'
    }`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">{item.name}</span>
          {item.required && <span className="text-[10px] font-medium text-amber-600">Required</span>}
          {!item.isComplete && <span className="text-[10px] text-red-500">Incomplete</span>}
        </div>
        {item.subtitle && <p className="mt-0.5 text-xs text-slate-400">{item.subtitle}</p>}
      </div>
      <div className="ml-3 shrink-0">
        {item.expirationBucket === 'expired' && <StatusBadge label="Expired" color="bg-red-100 text-red-700" />}
        {item.expirationBucket === 'expiring_30' && <StatusBadge label="≤30d" color="bg-red-100 text-red-700" />}
        {item.expirationBucket === 'expiring_60' && <StatusBadge label="≤60d" color="bg-amber-100 text-amber-700" />}
        {item.expirationBucket === 'expiring_90' && <StatusBadge label="≤90d" color="bg-amber-100 text-amber-700" />}
        {item.status === 'needs_review' && !item.expirationBucket && <StatusBadge label="Needs Review" color="bg-amber-100 text-amber-700" />}
        {item.isComplete && !item.expirationBucket && item.status === 'active' && <StatusBadge label="Active" color="bg-green-100 text-green-700" />}
      </div>
    </div>
  )
}

// ── Main Section ─────────────────────────────────────────────────────────────

export function StudyRegulatoryPacketSection({
  studies,
  links,
  studySpecificDocs,
}: StudyRegulatoryPacketSectionProps) {
  const [selectedStudyId, setSelectedStudyId] = useState('')
  const router = useRouter()

  const selectedStudy = studies.find((s) => s.id === selectedStudyId)
  const studyLinks = links.filter((l) => l.study_id === selectedStudyId)
  const studyDocs = (studySpecificDocs ?? {})[selectedStudyId] ?? []
  const packet = selectedStudy && studyLinks
    ? buildStudyRegulatoryPacket(selectedStudy, studyLinks, studyDocs)
    : null

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Study Regulatory Packet</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Readiness summary for linked regulatory records. This packet references master records — documents are not copied.
        </p>
      </div>

      {/* Study selector */}
      <div className="mt-4">
        <label className="block text-xs font-medium text-slate-600">Select Study</label>
        <select
          value={selectedStudyId}
          onChange={(e) => setSelectedStudyId(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
        >
          <option value="">— Choose a study —</option>
          {studies.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.status ?? 'no status'})</option>
          ))}
        </select>
      </div>

      {/* No study selected */}
      {!selectedStudyId && (
        <div className="mt-6 rounded-md border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm font-medium text-slate-400">Select a study to view its regulatory packet</p>
          <p className="mt-1 text-xs text-slate-300">Linked personnel and documents with readiness summary will appear here.</p>
        </div>
      )}

      {/* Packet view */}
      {packet && (
        <div className="mt-6 space-y-6">
          {/* Header stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Personnel</p>
              <p className="text-lg font-bold text-slate-800">{packet.totalLinkedPersonnel}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Documents</p>
              <p className="text-lg font-bold text-slate-800">{packet.totalLinkedDocuments}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Required</p>
              <p className="text-lg font-bold text-slate-800">{packet.required.complete}/{packet.required.total}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Expiring</p>
              <p className={`text-lg font-bold ${packet.expiring.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {packet.expiring.length}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Study-Specific</p>
              <p className="text-lg font-bold text-slate-800">{packet.totalStudySpecific}</p>
            </div>
          </div>

          {/* Readiness bar */}
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Regulatory Readiness</span>
              <StatusBadge
                label={packet.readinessLabel}
                color={readinessColor(packet.readiness)}
              />
            </div>
            {packet.readiness !== null ? (
              <>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${readinessBarColor(packet.readiness)}`}
                    style={{ width: `${packet.readiness}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {packet.required.complete} of {packet.required.total} required items complete
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-400">No required items defined for this study.</p>
            )}
          </div>

          {/* Risks */}
          {packet.expired.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-red-600">Expired ({packet.expired.length})</h3>
              {packet.expired.map((item) => <PacketItemCard key={item.id} item={item} />)}
            </div>
          )}

          {packet.expiring.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-600">Expiring Soon ({packet.expiring.length})</h3>
              {packet.expiring.map((item) => <PacketItemCard key={item.id} item={item} />)}
            </div>
          )}

          {packet.needsReview.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-600">Needs Review ({packet.needsReview.length})</h3>
              {packet.needsReview.map((item) => <PacketItemCard key={item.id} item={item} />)}
            </div>
          )}

          {/* Incomplete required */}
          {packet.required.incomplete > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-red-600">
                Missing Required ({packet.required.incomplete})
              </h3>
              {packet.allLinks
                .filter((i) => i.required && !i.isComplete)
                .map((item) => <PacketItemCard key={item.id} item={item} />)}
            </div>
          )}

          {/* Inherited from Regulatory Center */}
          {packet.inheritedItems.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-600">
                Inherited from Regulatory Center ({packet.inheritedItems.length})
              </h3>
              {/* Personnel section */}
              {packet.personnelLinks.length > 0 && (
                <div className="mb-4 space-y-2">
                  <h4 className="text-[11px] font-medium text-slate-500">Personnel ({packet.personnelLinks.length})</h4>
                  {packet.personnelLinks.map((item) => <PacketItemCard key={item.id} item={item} />)}
                </div>
              )}
              {/* Documents section */}
              {packet.documentLinks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-medium text-slate-500">Documents ({packet.documentLinks.length})</h4>
                  {packet.documentLinks.map((item) => <PacketItemCard key={item.id} item={item} />)}
                </div>
              )}
            </div>
          )}

          {/* Study-Specific Regulatory Documents */}
          {packet.studySpecificItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-purple-600">
                Study-Specific Regulatory Documents ({packet.studySpecificItems.length})
              </h3>
              {packet.studySpecificItems.map((item) => <PacketItemCard key={item.id} item={item} />)}
            </div>
          )}

          {/* Empty packet state */}
          {packet.allLinks.length === 0 && (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-xs text-slate-400">No regulatory records linked to this study.</p>
              <p className="mt-1 text-[10px] text-slate-300">Go to Study Links to add personnel and documents.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
