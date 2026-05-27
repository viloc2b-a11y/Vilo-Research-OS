import Link from 'next/link'
import type {
  CoordinatorCommandCenterAlert,
  CoordinatorCommandCenterItem,
} from '@/lib/coordinator-command-center'
import { formatDateTime, formatStatus } from './command-center-utils'

type CommandCenterSectionProps = {
  title: string
  label: string
  empty: string
  items: CoordinatorCommandCenterItem[]
}

export function CommandCenterSection({
  title,
  label,
  empty,
  items,
}: CommandCenterSectionProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 p-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{label}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="grid gap-3 p-3 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{item.title}</span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {formatStatus(item.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.studyName}</p>
                <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
              </div>
              <div className="flex flex-wrap items-start gap-2 md:justify-end">
                <Link
                  href={item.primaryActionHref}
                  className="rounded bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
                >
                  {item.primaryActionLabel}
                </Link>
                {item.secondaryActionHref && item.secondaryActionLabel ? (
                  <Link
                    href={item.secondaryActionHref}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {item.secondaryActionLabel}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function CommandCenterAlertSection({
  title,
  label,
  empty,
  items,
}: {
  title: string
  label: string
  empty: string
  items: CoordinatorCommandCenterAlert[]
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 p-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{label}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="grid gap-3 p-3 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{item.title}</span>
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
                    {item.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.studyName}</p>
                <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
              </div>
              <Link
                href={item.href}
                className="self-start rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Open Workflow
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
