/**
 * @deprecated Use ReadPanelErrorCard from read-panel-error.tsx
 */
import type { ApiEnvelope } from '@/lib/api/source/types'
import { normalizeReadPanelError } from '@/lib/source/read-contract/errors'
import { ReadPanelErrorCard } from '@/components/source/read-panel-error'

type ApiErrorPanelProps = {
  title: string
  envelope: ApiEnvelope<unknown>
}

export function ApiErrorPanel({ title, envelope }: ApiErrorPanelProps) {
  return <ReadPanelErrorCard error={normalizeReadPanelError(envelope, title)} />
}
