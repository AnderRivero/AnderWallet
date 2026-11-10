import type { Account, Category, Movement, Receivable, Recurring } from './types'

export type BackupFile = {
  app: 'AnderWallet'
  version: 1
  exportedAt: string
  accounts: Account[]
  categories: Category[]
  receivables: Receivable[]
  recurring: Recurring[]
  movements: Array<Omit<Movement, 'usdAmount'>>
  manualUsdRate: number | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function buildBackup(data: {
  accounts: Account[]
  categories: Category[]
  receivables: Receivable[]
  recurring: Recurring[]
  movements: Movement[]
  manualUsdRate: number | null
}): BackupFile {
  return {
    app: 'AnderWallet',
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: data.accounts,
    categories: data.categories,
    receivables: data.receivables,
    recurring: data.recurring,
    movements: data.movements.map(({ usdAmount: _usdAmount, ...movement }) => movement),
    manualUsdRate: data.manualUsdRate,
  }
}

export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('El respaldo está incompleto.')
  const record = raw as Record<string, unknown>
  if (record.app !== 'AnderWallet') throw new Error('El archivo no es un respaldo de AnderWallet.')
  if (record.version !== 1) throw new Error('Este respaldo usa una versión que la app no reconoce.')

  const accounts = list<Account>(record.accounts, 'cuentas')
  const categories = list<Category>(record.categories, 'categorías')
  const receivables = list<Receivable>(record.receivables, 'por cobrar')
  const recurring = list<Recurring>(record.recurring, 'pagos fijos')
  const movements = list<Omit<Movement, 'usdAmount'>>(record.movements, 'movimientos')

  for (const item of [...accounts, ...categories, ...receivables, ...recurring, ...movements]) {
    if (!UUID.test(String(item.id))) throw new Error('El respaldo tiene un identificador inválido.')
  }
  const accountIds = new Set(accounts.map((item) => item.id))
  const receivableIds = new Set(receivables.map((item) => item.id))
  for (const movement of movements) {
    if (!accountIds.has(movement.accountId)) throw new Error('Un movimiento apunta a una cuenta que no está en el respaldo.')
    if (movement.receivableId && !receivableIds.has(movement.receivableId)) {
      throw new Error('Un cobro apunta a un por cobrar que no está en el respaldo.')
    }
    if (!(Number(movement.amount) > 0)) throw new Error('Un movimiento tiene un monto inválido.')
  }
  const groups = new Map<string, number>()
  for (const movement of movements) {
    if (movement.transferGroup) groups.set(movement.transferGroup, (groups.get(movement.transferGroup) ?? 0) + 1)
  }
  if ([...groups.values()].some((count) => count !== 2)) throw new Error('Una transferencia del respaldo está incompleta.')

  const manual = record.manualUsdRate
  return {
    app: 'AnderWallet',
    version: 1,
    exportedAt: typeof record.exportedAt === 'string' ? record.exportedAt : new Date().toISOString(),
    accounts,
    categories,
    receivables,
    recurring,
    movements,
    manualUsdRate: typeof manual === 'number' && manual > 0 ? manual : null,
  }
}

function list<T extends { id: string }>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`El respaldo no trae ${label}.`)
  return value as T[]
}
