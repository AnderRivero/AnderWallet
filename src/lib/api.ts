import { supabase } from './supabase'
import type { BackupFile } from './backup'
import type {
  Account,
  Category,
  Currency,
  Icon,
  Movement,
  RateKey,
  Rates,
  RateSnapshot,
  Receivable,
  Recurring,
} from './types'

export type Snapshot = {
  accounts: Account[]
  categories: Category[]
  movements: Movement[]
  receivables: Receivable[]
  recurring: Recurring[]
  snapshots: RateSnapshot[]
}

type Row = Record<string, unknown>

function db() {
  if (!supabase) throw new Error('Falta la configuración de Supabase.')
  return supabase
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

function strOrNull(value: unknown): string | null {
  return value == null || value === '' ? null : String(value)
}

function icon(row: Row): Icon {
  return { kind: row.icon_kind as Icon['kind'], value: str(row.icon_value) }
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : null
}

export function ratesFrom(snapshots: RateSnapshot[]): Rates {
  const rates: Rates = { bcv_usd: null, bcv_eur: null, binance_usdt: null, manual_usd: null }
  for (const item of snapshots) rates[item.source] = item.vesPerUnit
  return rates
}

export async function loadAll(): Promise<Snapshot> {
  const client = db()
  const [accounts, categories, movements, receivables, recurring, snapshots] = await Promise.all([
    client.from('accounts').select('*').order('sort_order').order('name'),
    client.from('categories').select('*').order('name'),
    client.from('movements').select('*').order('occurred_on', { ascending: false }).order('created_at', { ascending: false }),
    client.from('receivables').select('*').order('created_at', { ascending: false }),
    client.from('recurring').select('*').order('name'),
    client.from('rate_snapshots').select('*'),
  ])
  for (const result of [accounts, categories, movements, receivables, recurring, snapshots]) {
    if (result.error) throw result.error
  }

  return {
    accounts: (accounts.data as Row[]).map((row) => ({
      id: str(row.id),
      name: str(row.name),
      kind: row.kind as Account['kind'],
      currency: row.currency as Currency,
      rateSource: row.rate_source as Account['rateSource'],
      refCurrency: strOrNull(row.ref_currency) as Currency | null,
      color: str(row.color),
      icon: icon(row),
      featured: Boolean(row.featured),
      notes: strOrNull(row.notes),
      sortOrder: num(row.sort_order),
    })),
    categories: (categories.data as Row[]).map((row) => ({
      id: str(row.id),
      name: str(row.name),
      kind: row.kind as Category['kind'],
      color: str(row.color),
      icon: icon(row),
    })),
    movements: (movements.data as Row[]).map((row) => ({
      id: str(row.id),
      accountId: str(row.account_id),
      categoryId: strOrNull(row.category_id),
      kind: row.kind as Movement['kind'],
      direction: num(row.direction) === 1 ? 1 : -1,
      amount: num(row.amount),
      occurredOn: str(row.occurred_on).slice(0, 10),
      note: strOrNull(row.note),
      usdRate: numOrNull(row.usd_rate),
      usdAmount: numOrNull(row.usd_amount),
      transferGroup: strOrNull(row.transfer_group),
      receivableId: strOrNull(row.receivable_id),
      receivableAmount: numOrNull(row.receivable_amount),
      recurringId: strOrNull(row.recurring_id),
    })),
    receivables: (receivables.data as Row[]).map((row) => ({
      id: str(row.id),
      person: str(row.person),
      currency: row.currency as Currency,
      principal: num(row.principal),
      dueDate: strOrNull(row.due_date),
      notes: strOrNull(row.notes),
      color: str(row.color),
      icon: icon(row),
      writtenOff: Boolean(row.written_off),
      createdAt: str(row.created_at),
    })),
    recurring: (recurring.data as Row[]).map((row) => ({
      id: str(row.id),
      name: str(row.name),
      kind: row.kind as Recurring['kind'],
      amount: num(row.amount),
      currency: row.currency as Currency,
      accountId: strOrNull(row.account_id),
      categoryId: strOrNull(row.category_id),
      cadence: row.cadence as Recurring['cadence'],
      anchorDate: str(row.anchor_date).slice(0, 10),
      paidCount: num(row.paid_count),
      leadDays: num(row.lead_days),
      color: str(row.color),
      icon: icon(row),
      active: Boolean(row.active),
      notes: strOrNull(row.notes),
    })),
    snapshots: (snapshots.data as Row[]).map((row) => ({
      source: row.source as RateKey,
      vesPerUnit: numOrNull(row.ves_per_unit),
      fetchedAt: strOrNull(row.fetched_at),
    })),
  }
}

async function upsert(table: string, id: string | undefined, row: Row): Promise<string> {
  if (id) {
    const { error } = await db().from(table).update(row).eq('id', id)
    if (error) throw error
    return id
  }
  const { data, error } = await db().from(table).insert(row).select('id').single()
  if (error) throw error
  return str((data as Row).id)
}

async function remove(table: string, id: string): Promise<void> {
  const { error } = await db().from(table).delete().eq('id', id)
  if (error) throw error
}

export function saveAccount(input: Omit<Account, 'id' | 'sortOrder'> & { id?: string }): Promise<string> {
  return upsert('accounts', input.id, {
    name: input.name.trim(),
    kind: input.kind,
    currency: input.currency,
    rate_source: input.rateSource,
    ref_currency: input.refCurrency,
    color: input.color,
    icon_kind: input.icon.kind,
    icon_value: input.icon.value,
    featured: input.featured,
    notes: emptyToNull(input.notes),
  })
}

export const deleteAccount = (id: string) => remove('accounts', id)

export function saveCategory(input: Omit<Category, 'id'> & { id?: string }): Promise<string> {
  return upsert('categories', input.id, {
    name: input.name.trim(),
    kind: input.kind,
    color: input.color,
    icon_kind: input.icon.kind,
    icon_value: input.icon.value,
  })
}

export const deleteCategory = (id: string) => remove('categories', id)

export type MovementInput = {
  id?: string
  accountId: string
  categoryId: string | null
  kind: 'opening' | 'adjustment' | 'income' | 'expense' | 'loan_out' | 'collection'
  direction: 1 | -1
  amount: number
  occurredOn: string
  note: string | null
  usdRate: number | null
  receivableId?: string | null
  receivableAmount?: number | null
}

export function saveMovement(input: MovementInput): Promise<string> {
  const row: Row = {
    account_id: input.accountId,
    category_id: input.categoryId,
    kind: input.kind,
    direction: input.direction,
    amount: input.amount,
    occurred_on: input.occurredOn,
    note: emptyToNull(input.note),
    usd_rate: input.usdRate,
  }
  if (input.receivableId !== undefined) {
    row.receivable_id = input.receivableId
    row.receivable_amount = input.receivableAmount ?? null
  }
  return upsert('movements', input.id, row)
}

export async function deleteMovement(movement: Movement): Promise<void> {
  if (movement.transferGroup) {
    const { error } = await db().from('movements').delete().eq('transfer_group', movement.transferGroup)
    if (error) throw error
    return
  }
  await remove('movements', movement.id)
}

export async function saveTransfer(input: {
  group: string | null
  fromId: string
  toId: string
  fromAmount: number
  toAmount: number
  occurredOn: string
  note: string | null
  fromRate: number | null
  toRate: number | null
}): Promise<void> {
  const { error } = await db().rpc('save_transfer', {
    p_group: input.group,
    p_from: input.fromId,
    p_to: input.toId,
    p_from_amount: input.fromAmount,
    p_to_amount: input.toAmount,
    p_on: input.occurredOn,
    p_note: emptyToNull(input.note),
    p_from_rate: input.fromRate,
    p_to_rate: input.toRate,
  })
  if (error) throw error
}

export async function createReceivable(input: {
  person: string
  currency: Currency
  principal: number
  dueDate: string | null
  notes: string | null
  color: string
  icon: Icon
  accountId: string | null
  accountAmount: number | null
  occurredOn: string
  usdRate: number | null
}): Promise<void> {
  const { error } = await db().rpc('create_receivable', {
    payload: {
      person: input.person.trim(),
      currency: input.currency,
      principal: input.principal,
      dueDate: input.dueDate ?? '',
      notes: emptyToNull(input.notes) ?? '',
      color: input.color,
      iconKind: input.icon.kind,
      iconValue: input.icon.value,
      accountId: input.accountId ?? '',
      accountAmount: input.accountAmount,
      occurredOn: input.occurredOn,
      usdRate: input.usdRate ?? '',
    },
  })
  if (error) throw error
}

export async function updateReceivable(
  id: string,
  input: Pick<Receivable, 'person' | 'principal' | 'dueDate' | 'notes' | 'color' | 'icon' | 'writtenOff'>,
): Promise<void> {
  await upsert('receivables', id, {
    person: input.person.trim(),
    principal: input.principal,
    due_date: input.dueDate,
    notes: emptyToNull(input.notes),
    color: input.color,
    icon_kind: input.icon.kind,
    icon_value: input.icon.value,
    written_off: input.writtenOff,
  })
}

export const deleteReceivable = (id: string) => remove('receivables', id)

export function saveRecurring(
  input: Omit<Recurring, 'id' | 'paidCount'> & { id?: string; restartSchedule: boolean },
): Promise<string> {
  return upsert('recurring', input.id, {
    ...(input.restartSchedule ? { paid_count: 0 } : {}),
    name: input.name.trim(),
    kind: input.kind,
    amount: input.amount,
    currency: input.currency,
    account_id: input.accountId,
    category_id: input.categoryId,
    cadence: input.cadence,
    anchor_date: input.anchorDate,
    lead_days: input.leadDays,
    color: input.color,
    icon_kind: input.icon.kind,
    icon_value: input.icon.value,
    active: input.active,
    notes: emptyToNull(input.notes),
  })
}

export const deleteRecurring = (id: string) => remove('recurring', id)

export async function confirmRecurring(input: {
  id: string
  expected: number
  accountId: string
  amount: number
  occurredOn: string
  usdRate: number | null
  note: string | null
}): Promise<void> {
  const { error } = await db().rpc('confirm_recurring', {
    p_id: input.id,
    p_expected: input.expected,
    p_account: input.accountId,
    p_amount: input.amount,
    p_on: input.occurredOn,
    p_rate: input.usdRate,
    p_note: emptyToNull(input.note),
  })
  if (error) throw error
}

export async function skipRecurring(id: string, expected: number): Promise<void> {
  const { error } = await db().rpc('skip_recurring', { p_id: id, p_expected: expected })
  if (error) throw error
}

export async function saveManualRate(value: number | null): Promise<void> {
  const { error } = await db()
    .from('rate_snapshots')
    .update({ ves_per_unit: value, fetched_at: value == null ? null : new Date().toISOString() })
    .eq('source', 'manual_usd')
  if (error) throw error
}

export async function refreshRates(): Promise<{ errors: string[] }> {
  const { data, error } = await db().functions.invoke('refresh-rates', { method: 'POST', body: {} })
  if (error) {
    const context = (error as { context?: Response }).context
    const body = context ? ((await context.json().catch(() => null)) as { error?: string } | null) : null
    throw new Error(body?.error ?? 'La función de tasas no respondió. Revisa que esté desplegada.')
  }
  const errors = Array.isArray((data as { errors?: unknown })?.errors) ? ((data as { errors: string[] }).errors) : []
  return { errors }
}

export async function restoreBackup(payload: BackupFile): Promise<Record<string, number>> {
  const { data, error } = await db().rpc('restore_backup', { payload })
  if (error) throw error
  const value = typeof data === 'string' ? JSON.parse(data) : data
  return (value ?? {}) as Record<string, number>
}
