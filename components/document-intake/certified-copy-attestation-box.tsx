'use client'

import { CERTIFIED_COPY_ATTESTATION_LOCKED_TEXT } from '@/lib/document-intake/compliance-types'

interface CertifiedCopyAttestationBoxProps {
  isChecked: boolean
  onChange: (checked: boolean) => void
}

export function CertifiedCopyAttestationBox({ isChecked, onChange }: CertifiedCopyAttestationBoxProps) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-6 items-center">
          <input
            id="certified-copy-checkbox"
            type="checkbox"
            checked={isChecked}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-600"
          />
        </div>
        <div className="text-sm">
          <label htmlFor="certified-copy-checkbox" className="font-medium text-amber-900">
            Certified Copy Attestation
          </label>
          <p className="mt-1 font-mono text-xs italic text-amber-800">
            &quot;{CERTIFIED_COPY_ATTESTATION_LOCKED_TEXT}&quot;
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Checking this box generates an immutable audit event cementing your digital attestation to this exact text.
          </p>
        </div>
      </div>
    </div>
  )
}
