import { useMemo, useState } from 'react'
import { ArrowLeftRight, Plus } from 'lucide-react'
import { MovementModal } from '../components/MovementModal'
import { MovementRow, movementTitle } from '../components/MovementRow'
import { TransferModal } from '../components/TransferModal'
import { useData } from '../data/DataProvider'
import { deleteMovement } from '../lib/api'
import { errorText } from '../lib/errors'
import { MOVEMENT_KIND_LABEL } from '../lib/format'
import { formatMoney } from '../lib/money'
import type { Movement, MovementKind } from '../lib/types'

type Editing = { type: 'movement' | 'transfer'; movement: Movement | null } | null

export function MovementsPage() {
  const data = useData()
  const { accounts, categories, movements, refresh } = data
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [kind, setKind] = useState<MovementKind | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Editing>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    return movements.filter((movement) => {
      if (accountId && movement.accountId !== accountId) return false
      if (categoryId && movement.categoryId !== categoryId) return false
      if (kind && movement.kind !== kind) return false
      if (from && movement.occurredOn < from) return false
      if (to && movement.occurredOn > to) return false
      if (text && !(movement.note ?? '').toLowerCase().includes(text)) return false
      return true
    })
  }, [accountId, categoryId, from, kind, movements, search, to])

  const flow = useMemo(() => {
    let income = 0
    let expense = 0
    for (const movement of filtered) {
      if (movement.usdAmount == null) continue
      if (movement.kind === 'income') income += movement.usdAmount
      if (movement.kind === 'expense') expense += movement.usdAmount
    }
    return { income, expense }
  }, [filtered])

  async function remove(movement: Movement) {
    const message = movement.transferGroup
      ? '¿Eliminar esta transferencia? Se borran las dos partes.'
      : '¿Eliminar este movimiento? El saldo de la cuenta cambia.'
    if (!window.confirm(message)) return
    try {
      await deleteMovement(movement)
      await refresh()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <>
      <section className="section-head">
        <div>
          <p className="eyebrow">Historial</p>
          <h1>Movimientos</h1>
        </div>
        <div className="actions">
          <button className="btn ghost" type="button" disabled={accounts.length < 2} onClick={() => setEditing({ type: 'transfer', movement: null })}>
            <ArrowLeftRight size={18} /> Transferir
          </button>
          <button className="btn primary" type="button" disabled={accounts.length === 0} onClick={() => setEditing({ type: 'movement', movement: null })}>
            <Plus size={18} /> Nuevo
          </button>
        </div>
      </section>

      <section className="filters">
        <label className="field">
          <span>Cuenta</span>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">Todas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Categoría</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} · {category.kind === 'income' ? 'ingreso' : 'gasto'}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as MovementKind | '')}>
            <option value="">Todos</option>
            {(Object.keys(MOVEMENT_KIND_LABEL) as MovementKind[]).map((item) => (
              <option key={item} value={item}>
                {MOVEMENT_KIND_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Desde</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field">
          <span>Hasta</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label className="field">
          <span>Buscar en notas</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </section>

      <p className="note">
        {filtered.length} movimientos · ingresos <span className="amount">{formatMoney(flow.income, 'USD')}</span> · gastos{' '}
        <span className="amount">{formatMoney(flow.expense, 'USD')}</span> (en dólares del día de cada movimiento)
      </p>
      {error && <p className="error">{error}</p>}

      <section className="stack">
        {filtered.length === 0 && <p className="note">No hay movimientos con estos filtros.</p>}
        {filtered.map((movement) => (
          <MovementRow
            key={movement.id}
            movement={movement}
            account={accounts.find((item) => item.id === movement.accountId)}
            category={categories.find((item) => item.id === movement.categoryId)}
            title={movementTitle(movement, data)}
            onEdit={() => setEditing({ type: movement.kind === 'transfer' ? 'transfer' : 'movement', movement })}
            onDelete={() => void remove(movement)}
          />
        ))}
      </section>

      {editing?.type === 'movement' && (
        <MovementModal movement={editing.movement} defaultAccountId={accountId || undefined} onClose={() => setEditing(null)} />
      )}
      {editing?.type === 'transfer' && <TransferModal movement={editing.movement} onClose={() => setEditing(null)} />}
    </>
  )
}
