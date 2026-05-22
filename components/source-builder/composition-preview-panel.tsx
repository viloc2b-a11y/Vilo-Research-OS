'use client'

import { useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  SOURCE_COMPOSITION_TEMPLATE_KEYS,
  getCompositionManifest,
  resolveSourceCompositionManifest,
} from '@/lib/source-engine/source-composition'
import { SourceCompositionResolveError } from '@/lib/source-engine/source-composition-resolver'

export function CompositionPreviewPanel() {
  const [templateKey, setTemplateKey] = useState(SOURCE_COMPOSITION_TEMPLATE_KEYS[0] ?? '')

  const preview = useMemo(() => {
    const manifest = getCompositionManifest(templateKey)
    if (!manifest) return { error: 'Template not found.' }
    try {
      const resolved = resolveSourceCompositionManifest(manifest)
      return { resolved, manifest, error: null as string | null }
    } catch (err) {
      const message =
        err instanceof SourceCompositionResolveError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Resolve failed'
      return { error: message, resolved: null, manifest }
    }
  }, [templateKey])

  const resolved = preview.resolved

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Canonical composition preview</CardTitle>
          <CardDescription>
            Deterministic field list from Phase 12A libraries + overlays. No publish or runtime
            mutation — preview only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Template</span>
            <select
              className="rounded-md border border-input bg-background px-3 py-2"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
            >
              {SOURCE_COMPOSITION_TEMPLATE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>

          {preview.error ? (
            <p className="text-sm text-destructive">{preview.error}</p>
          ) : resolved ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Label:</span> {resolved.label}
              </p>
              <p>
                <span className="font-medium">Fingerprint:</span>{' '}
                <code className="text-xs">{resolved.fingerprint.slice(0, 16)}…</code>
              </p>
              <p>
                <span className="font-medium">Active fields:</span> {resolved.fields.length}
              </p>
              {preview.manifest?.protocol_notes ? (
                <p className="text-muted-foreground">{preview.manifest.protocol_notes}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {resolved ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sections</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {resolved.sections.map((section) => (
                  <li
                    key={section.section_key}
                    className="rounded-md border border-border px-3 py-2"
                  >
                    <span className="font-medium">{section.section_key}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {section.library_code} ({section.library_kind}) · {section.field_count}{' '}
                      field(s)
                      {section.hidden_count > 0 ? ` · ${section.hidden_count} hidden` : ''}
                      {section.omitted_count > 0 ? ` · ${section.omitted_count} omitted` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resolved fields</CardTitle>
              <CardDescription>Runtime keys are section-scoped to prevent cross-library collisions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-1 pr-2">Runtime key</th>
                      <th className="py-1 pr-2">Logical</th>
                      <th className="py-1 pr-2">Section</th>
                      <th className="py-1">Req</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolved.field_meta
                      .filter((m) => !m.omitted)
                      .map((m) => (
                        <tr key={m.runtime_key} className="border-b border-border/60">
                          <td className="py-1 pr-2 font-mono">{m.runtime_key}</td>
                          <td className="py-1 pr-2 text-muted-foreground">{m.logical_key}</td>
                          <td className="py-1 pr-2">{m.section_key}</td>
                          <td className="py-1">{m.required ? 'Y' : ''}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
