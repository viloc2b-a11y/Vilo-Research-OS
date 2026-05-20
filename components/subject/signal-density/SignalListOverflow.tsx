import Link from 'next/link'

type SignalListOverflowProps = {
  hiddenCount: number
  moreHref: string | null
  label?: string
}

export function SignalListOverflow({
  hiddenCount,
  moreHref,
  label = 'View all in tab',
}: SignalListOverflowProps) {
  if (hiddenCount <= 0) return null

  return (
    <p className="mt-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
      <span className="font-medium" style={{ color: 'var(--foreground)' }}>
        +{hiddenCount} more
      </span>
      {moreHref ? (
        <>
          {' '}
          —{' '}
          <Link href={moreHref} className="text-primary hover:underline">
            {label}
          </Link>
        </>
      ) : null}
    </p>
  )
}
