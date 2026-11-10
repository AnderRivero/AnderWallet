// Lo usan la app y la función de correo. Sin imports, para que corra igual en Vite y en Deno.

export type ScheduleCadence = 'weekly' | 'monthly' | 'yearly'

export type DueState = {
  dueDate: string
  daysLeft: number
  status: 'overdue' | 'today' | 'soon' | 'later'
}

const DAY_MS = 86_400_000

export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10)
}

export function addMonthsIso(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const index = month - 1 + months
  const lastDay = new Date(Date.UTC(year, index + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, index, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

/** Fecha del pago número `occurrence` (0 = el primero), siempre contada desde la fecha ancla. */
export function occurrenceDate(anchor: string, cadence: ScheduleCadence, occurrence: number): string {
  if (cadence === 'weekly') return addDaysIso(anchor, 7 * occurrence)
  if (cadence === 'monthly') return addMonthsIso(anchor, occurrence)
  return addMonthsIso(anchor, 12 * occurrence)
}

export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS)
}

export function dueState(
  item: { anchorDate: string; cadence: ScheduleCadence; paidCount: number; leadDays: number },
  today: string,
): DueState {
  const dueDate = occurrenceDate(item.anchorDate, item.cadence, item.paidCount)
  const daysLeft = daysBetween(today, dueDate)
  const status = daysLeft < 0 ? 'overdue' : daysLeft === 0 ? 'today' : daysLeft <= item.leadDays ? 'soon' : 'later'
  return { dueDate, daysLeft, status }
}

export function caracasToday(now = new Date()): string {
  return new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
