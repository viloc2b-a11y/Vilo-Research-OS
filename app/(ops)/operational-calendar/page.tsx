import { OperationalCalendarClient } from '@/components/calendar/operational-calendar-client'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'
import { loadOperationalCalendarModel } from '@/lib/calendar/operational-calendar-read-model'

type OperationalCalendarPageProps = {
  searchParams: Promise<{ year?: string }>
}

export default async function OperationalCalendarPage({ searchParams }: OperationalCalendarPageProps) {
  const { year } = await searchParams
  const parsedYear = year ? Number(year) : undefined
  const model = await loadOperationalCalendarModel({ year: parsedYear })

  return (
    <CoordinatorPageScroll contentClassName="p-0">
      <OperationalCalendarClient model={model} />
    </CoordinatorPageScroll>
  )
}
