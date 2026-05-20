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
    <p className="mt-3 text-xs" style={{ color: '#98a5ad' }}>
      <span className="font-medium" style={{ color: '#10253e' }}>
        +{hiddenCount} more
      </span>
      {moreHref ? (
        <>
          {' '}
          —{' '}
          <Link href={moreHref} className="text-[#34a090] hover:underline">
            {label}
          </Link>
        </>
      ) : null}
    </p>
  )
}
