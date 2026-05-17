import type { CaptureActionMessage } from '@/lib/source/capture/types'

type CaptureFeedbackProps = {
  message: CaptureActionMessage | null
}

export function CaptureFeedback({ message }: CaptureFeedbackProps) {
  if (!message) return null

  const border =
    message.kind === 'success'
      ? 'border-emerald-500/40 bg-emerald-500/5'
      : message.kind === 'error'
        ? 'border-destructive/40 bg-destructive/5'
        : 'border-border bg-muted/30'

  return (
    <div
      role="status"
      className={`rounded-md border px-3 py-3 text-sm ${border}`}
    >
      <p className="font-medium">{message.title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {message.messages.map((line, i) => (
          <li key={`${message.title}-${i}`}>{line}</li>
        ))}
      </ul>
      {message.requestId ? (
        <p className="mt-2 text-xs text-muted-foreground">Request {message.requestId}</p>
      ) : null}
    </div>
  )
}
