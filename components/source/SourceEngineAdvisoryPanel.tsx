'use client'

import { Badge } from '@/components/ui/badge'
import type { ProcedureSourceEngineSnapshot } from '@/lib/source-engine/adapters/index'
import type { CaptureValidationError } from '@/lib/source-engine/adapters/source-response-adapter'

type SourceEngineAdvisoryPanelProps = {
  snapshot: ProcedureSourceEngineSnapshot | null | undefined
}

function formatValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function countFieldStates(snapshot: ProcedureSourceEngineSnapshot) {
  const fields = Object.values(snapshot.runtime?.fields ?? {})
  return {
    total: fields.length,
    visible: fields.filter((f) => f.visible).length,
    required: fields.filter((f) => f.required).length,
    disabled: fields.filter((f) => f.disabled).length,
  }
}

function collectValidation(snapshot: ProcedureSourceEngineSnapshot): CaptureValidationError[] {
  if (snapshot.validationErrors?.length) {
    return snapshot.validationErrors
  }
  return (snapshot.runtime?.validationResults ?? []).map((r) => ({
    fieldKey: r.fieldId,
    sectionId: r.sectionId ?? r.repeatableSectionId,
    severity: r.severity,
    code: r.code,
    message: r.message,
    blocksSubmission: r.blocksSubmission,
    blocksSignature: r.blocksSignature,
    taskEligible: r.taskEligible,
  }))
}

function resolutionLabel(snapshot: ProcedureSourceEngineSnapshot): string {
  const r = snapshot.engineStatus?.resolution
  if (!r) return 'unknown'
  if (r.fallback) return 'fallback (dev)'
  return `${r.source} · ${r.templateId}`
}

function signatureAdvisory(snapshot: ProcedureSourceEngineSnapshot): {
  label: string
  detail: string
} {
  const errors = collectValidation(snapshot)
  const blockers = errors.filter((e) => e.blocksSignature)
  const enforce = snapshot.engineStatus?.enforceSignatureBlockers ?? false
  const isFallback = snapshot.engineStatus?.resolution?.fallback ?? false
  const ctx = snapshot.context

  if (isFallback) {
    return {
      label: 'Fallback',
      detail: 'Generic fallback template — signature gate does not enforce template blockers.',
    }
  }
  if (ctx?.locked || ctx?.signatureState === 'locked') {
    return { label: 'Locked', detail: 'Source context is locked.' }
  }
  if (blockers.length > 0 && enforce) {
    return {
      label: 'Blocked',
      detail: `${blockers.length} issue(s) block signature on sign (Source Engine gate).`,
    }
  }
  if (blockers.length > 0) {
    return {
      label: 'Advisory',
      detail: `${blockers.length} finding(s) would block signature if enforcement were enabled.`,
    }
  }
  if (ctx?.signatureState === 'signed') {
    return { label: 'Signed', detail: 'Context reports signed state (advisory).' }
  }
  if (ctx?.signatureState === 'broken') {
    return { label: 'Broken', detail: 'Signature may require re-attestation (advisory).' }
  }
  return { label: 'Advisory OK', detail: 'No signature blockers detected in engine rules.' }
}

function runtimeStatusLabel(snapshot: ProcedureSourceEngineSnapshot): string {
  const ctx = snapshot.context
  if (!ctx) return 'active'
  const parts = [
    ctx.visitType,
    ctx.signatureState,
    ctx.isPhoneVisit ? 'phone' : null,
    ctx.isOffSiteVisit ? 'off-site' : null,
    ctx.correctionMode ? 'correction' : null,
    ctx.addendumMode ? 'addendum' : null,
  ].filter(Boolean)
  return parts.join(' · ') || 'active'
}

export function SourceEngineAdvisoryPanel({ snapshot }: SourceEngineAdvisoryPanelProps) {
  if (!snapshot?.runtime) {
    return null
  }

  const counts = countFieldStates(snapshot)
  const derivedEntries = Object.entries(snapshot.derivedValues ?? {}).filter(
    ([, v]) => v != null && v !== '',
  )
  const validation = collectValidation(snapshot)
  const warnings = validation.filter((e) => e.severity === 'warning')
  const errors = validation.filter((e) => e.severity === 'error' || e.severity === 'critical')
  const infos = validation.filter((e) => e.severity === 'info')
  const firedRules = snapshot.runtime.firedRuleIds ?? []
  const sections = Object.values(snapshot.runtime.sections ?? {})
  const repeatable = Object.values(snapshot.runtime.repeatableSections ?? {})
  const signature = signatureAdvisory(snapshot)
  const resolution = snapshot.engineStatus?.resolution

  return (
    <details className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 text-sm">
      <summary className="cursor-pointer select-none px-4 py-3 font-medium text-muted-foreground hover:text-foreground">
        Source Engine Advisory
        <span className="ml-2 text-xs font-normal">(non-blocking · coordinator / debug)</span>
      </summary>
      <div className="space-y-4 border-t border-dashed px-4 py-4">
        {resolution?.fallback ? (
          <p className="rounded border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            Generic fallback template in use. Not production source of truth.
            {resolution.warning ? ` ${resolution.warning}` : ''}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Template:{' '}
          <span className="font-mono font-medium text-foreground">{resolutionLabel(snapshot)}</span>
          {resolution?.publishedPackageId ? (
            <span className="ml-2 text-muted-foreground">
              package {resolution.publishedPackageId}
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          Runtime status:{' '}
          <span className="font-medium text-foreground">{runtimeStatusLabel(snapshot)}</span>
          {' · '}
          Save/submit unchanged.
          {snapshot.engineStatus?.enforceSignatureBlockers
            ? ' Signature may be blocked by engine.'
            : ' Signature gate advisory only.'}
        </p>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Visible fields</dt>
            <dd className="font-semibold">{counts.visible}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Required fields</dt>
            <dd className="font-semibold">{counts.required}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Disabled fields</dt>
            <dd className="font-semibold">{counts.disabled}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Engine field states</dt>
            <dd className="font-semibold">{counts.total}</dd>
          </div>
        </dl>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Signature readiness
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={signature.label === 'Blocked' ? 'destructive' : 'outline'}>
              {signature.label}
            </Badge>
            <span className="text-xs text-muted-foreground">{signature.detail}</span>
          </div>
          {validation.filter((e) => e.blocksSignature).length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-destructive">
              {validation
                .filter((e) => e.blocksSignature)
                .map((item, idx) => (
                  <li key={`sig-block-${idx}`}>
                    [{item.fieldKey ?? item.sectionId ?? 'form'}] {item.message}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>

        {derivedEntries.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Derived values ({derivedEntries.length})
            </p>
            <ul className="max-h-32 space-y-1 overflow-y-auto font-mono text-xs">
              {derivedEntries.map(([key, value]) => (
                <li key={key} className="rounded bg-muted/30 px-2 py-1">
                  <span className="text-muted-foreground">{key}:</span> {formatValue(value)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {firedRules.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Active rules ({firedRules.length})
            </p>
            <ul className="flex flex-wrap gap-1">
              {firedRules.map((id) => (
                <li key={id}>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {id}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {sections.length > 0 || repeatable.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Section status
            </p>
            <ul className="space-y-1 text-xs">
              {sections.map((s) => (
                <li key={s.sectionId} className="text-muted-foreground">
                  <span className="font-mono text-foreground">{s.sectionId}</span>
                  {s.visible ? '' : ' · hidden'}
                  {s.disabled ? ' · disabled' : ''}
                  {s.required ? ' · required' : ''}
                </li>
              ))}
              {repeatable.map((s) => (
                <li key={`rs-${s.sectionId}`} className="text-muted-foreground">
                  <span className="font-mono text-foreground">{s.sectionId}</span>
                  <span className="text-muted-foreground/80"> (repeatable)</span>
                  {s.visible ? '' : ' · hidden'}
                  {s.disabled ? ' · disabled' : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {validation.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Validation ({validation.length})
            </p>
            <ul className="max-h-40 space-y-2 overflow-y-auto">
              {[...errors, ...warnings, ...infos].map((item, idx) => (
                <li
                  key={`${item.code}-${idx}`}
                  className="rounded border border-border/60 bg-background/50 px-2 py-1.5 text-xs"
                >
                  <span
                    className={
                      item.severity === 'critical' || item.severity === 'error'
                        ? 'font-medium text-destructive'
                        : item.severity === 'warning'
                          ? 'font-medium text-amber-700 dark:text-amber-400'
                          : 'font-medium text-muted-foreground'
                    }
                  >
                    {item.severity}
                  </span>
                  {item.fieldKey ? (
                    <span className="ml-1 font-mono text-muted-foreground">({item.fieldKey})</span>
                  ) : null}
                  <p className="mt-0.5 text-muted-foreground">{item.message}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No engine validation findings for current values.</p>
        )}
      </div>
    </details>
  )
}
