import { describe, expect, it } from 'vitest'
import { caracasToday, dueState, occurrenceDate } from '../../supabase/functions/check-recurring/schedule'

describe('pagos fijos', () => {
  it('un pago del 31 cae el último día de los meses cortos sin correrse después', () => {
    expect(occurrenceDate('2026-01-31', 'monthly', 1)).toBe('2026-02-28')
    expect(occurrenceDate('2026-01-31', 'monthly', 2)).toBe('2026-03-31')
    expect(occurrenceDate('2024-02-29', 'yearly', 1)).toBe('2025-02-28')
    expect(occurrenceDate('2026-11-10', 'weekly', 2)).toBe('2026-11-24')
  })

  it('marca próximo según los días de anticipación', () => {
    const item = { anchorDate: '2026-11-13', cadence: 'monthly' as const, paidCount: 0, leadDays: 3 }
    expect(dueState(item, '2026-11-10').status).toBe('soon')
    expect(dueState(item, '2026-11-09').status).toBe('later')
    expect(dueState(item, '2026-11-13').status).toBe('today')
    expect(dueState(item, '2026-11-15')).toMatchObject({ status: 'overdue', daysLeft: -2 })
    expect(dueState({ ...item, paidCount: 1 }, '2026-11-15').dueDate).toBe('2026-12-13')
  })

  it('el día de Venezuela cambia a medianoche de Caracas, no de UTC', () => {
    expect(caracasToday(new Date('2026-11-11T02:30:00Z'))).toBe('2026-11-10')
    expect(caracasToday(new Date('2026-11-11T04:30:00Z'))).toBe('2026-11-11')
  })
})
