import type { AccountKind, Cadence, MovementKind } from './types'

export { caracasToday as todayISO } from '../../supabase/functions/check-recurring/schedule'

export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Caracas',
  }).format(new Date(iso))
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

export function dueLabel(daysLeft: number): string {
  if (daysLeft < -1) return `Venció hace ${-daysLeft} días`
  if (daysLeft === -1) return 'Venció ayer'
  if (daysLeft === 0) return 'Vence hoy'
  if (daysLeft === 1) return 'Vence mañana'
  return `Vence en ${daysLeft} días`
}

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  bank: 'Banco',
  wallet: 'Billetera digital',
  crypto: 'Cripto',
}

export const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: 'Cada semana',
  monthly: 'Cada mes',
  yearly: 'Cada año',
}

export const MOVEMENT_KIND_LABEL: Record<MovementKind, string> = {
  opening: 'Saldo inicial',
  adjustment: 'Ajuste',
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
  loan_out: 'Préstamo',
  collection: 'Cobro',
}
