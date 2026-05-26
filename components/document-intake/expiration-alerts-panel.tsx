'use client'

import { useEffect, useState } from 'react'
import {
  EXPIRATION_ALERT_TYPE_LABELS,
  EXPIRATION_THRESHOLD_LABELS,
  type ExpirationAlertView,
} from '@/lib/document-intake/expiration-alert-types'
import { ResolveExpirationAlertButton } from './resolve-expiration-alert-button'

type ExpirationAlertsPanelProps = {
  organizationId: string
  refreshKey?: number
  onAlertsChanged?: () => void
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

function alertHeadline(alert: ExpirationAlertView): string {
  if (alert.alertType === 'expired') {
    return EXPIRATION_ALERT_TYPE_LABELS.expired
  }
  return EXPIRATION_ALERT_TYPE_LABELS.expiration_warning
}

export function ExpirationAlertsPanel({
  organizationId,
  refreshKey = 0,
  onAlertsChanged,
}: ExpirationAlertsPanelProps) {
  const [alerts, setAlerts] = useState<ExpirationAlertView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(
          `/api/document-intake/expiration-alerts?organization_id=${encodeURIComponent(organizationId)}`,
        )
        const data = (await res.json()) as { alerts?: ExpirationAlertView[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not load expiration alerts')
        if (!cancelled) {
          setAlerts(data.alerts ?? [])
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load expiration alerts')
          setAlerts([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [organizationId, refreshKey])

  async function handleScan() {
    setScanning(true)
    setScanMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/document-intake/expiration-alerts/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: organizationId }),
      })
      const data = (await res.json()) as {
        error?: string
        alertsCreated?: number
        documentsScanned?: number
      }
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      setScanMessage(
        `Checked ${data.documentsScanned ?? 0} document(s); ${data.alertsCreated ?? 0} new alert(s).`,
      )
      onAlertsChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Expiration alerts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Documents approaching expiration or past due. Renewal needed when dates are near.
          </p>
        </div>
        <button
          type="button"
          disabled={scanning}
          onClick={() => void handleScan()}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {scanning ? 'Scanning…' : 'Check expirations'}
        </button>
      </div>

      {scanMessage ? <p className="mb-3 text-sm text-emerald-700">{scanMessage}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && alerts.length === 0 ? (
        <p className="text-sm text-slate-500">No pending expiration alerts.</p>
      ) : null}

      <div className="space-y-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800">{alert.documentOperationalDisplayName}</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                  {alert.documentClassification}
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {alert.status}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-700">{alertHeadline(alert)}</p>
              <p className="text-sm text-slate-600">
                {EXPIRATION_THRESHOLD_LABELS[alert.daysBeforeExpiration]}
              </p>
              <p className="text-xs text-slate-500">
                Expires: {formatWhen(alert.documentExpirationDate)} ·{' '}
                {alert.daysRemaining <= 0
                  ? 'Past due'
                  : `${alert.daysRemaining} day(s) remaining`}{' '}
                · Alert {formatWhen(alert.alertDate)}
              </p>
            </div>
            <ResolveExpirationAlertButton
              organizationId={organizationId}
              alertId={alert.id}
              onResolved={onAlertsChanged}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
