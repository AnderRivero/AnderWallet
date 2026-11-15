import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Amount } from '../components/Amount'
import { IconView } from '../components/IconView'
import { CollectModal, ReceivableModal } from '../components/ReceivableModal'
import { useData } from '../data/DataProvider'
import { deleteReceivable } from '../lib/api'
import { errorText } from '../lib/errors'
import { dueLabel, formatDate, todayISO } from '../lib/format'
import { formatMoney, receivableCollected, receivablePending, totals } from '../lib/money'
import type { DebtKind, Receivable } from '../lib/types'
import { daysBetween } from '../../supabase/functions/check-recurring/schedule'

function DebtRow({
  receivable,
  pending,
  collected,
  today,
  noAccounts,
  onSettle,
  onEdit,
  onRemove,
}: {
  receivable: Receivable
  pending: number
  collected: number
  today: string
  noAccounts: boolean
  onSettle: (receivable: Receivable) => void
  onEdit: (receivable: Receivable) => void
  onRemove: (receivable: Receivable) => void
}) {
  const paying = receivable.kind === 'payable'
  const days = receivable.dueDate ? daysBetween(today, receivable.dueDate) : null
  const verb = paying ? 'pagado' : 'cobrado'
  const meta = [
    collected > 0 ? `${verb} ${formatMoney(collected, receivable.currency)} de ${formatMoney(receivable.principal, receivable.currency)}` : null,
    receivable.dueDate ? `${formatDate(receivable.dueDate)}${pending > 0 && days != null ? ` · ${dueLabel(days)}` : ''}` : null,
    receivable.writtenOff ? (paying ? 'condonada' : 'dado por perdido') : pending === 0 ? verb : null,
    receivable.notes,
  ].filter(Boolean)
  return (
    <article className={`row-card${pending > 0 && days != null && days < 0 ? ' due-overdue' : ''}`}>
      <IconView icon={receivable.icon} color={receivable.color} size={42} />
      <div className="row-main">
        <strong>{receivable.person}</strong>
        <p className="note">{meta.join(' · ')}</p>
      </div>
      <div className="row-value">
        <Amount value={pending} currency={receivable.currency} />
      </div>
      <div className="row-actions">
        {pending > 0 && (
          <button className="btn primary compact" type="button" disabled={noAccounts} onClick={() => onSettle(receivable)}>
            {paying ? 'Pagar' : 'Cobrar'}
          </button>
        )}
        <button className="icon-action" type="button" aria-label="Editar" title="Editar" onClick={() => onEdit(receivable)}>
          <Pencil size={16} />
        </button>
        <button className="icon-action danger" type="button" aria-label="Eliminar" title="Eliminar" onClick={() => onRemove(receivable)}>
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  )
}

export function ReceivablesPage() {
  const { accounts, movements, rates, receivables, refresh } = useData()
  const [side, setSide] = useState<DebtKind>('receivable')
  const [editing, setEditing] = useState<{ item: Receivable | null; kind: DebtKind } | null>(null)
  const [collecting, setCollecting] = useState<Receivable | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = todayISO()
  const summary = useMemo(() => totals(accounts, receivables, movements, rates), [accounts, movements, rates, receivables])

  const rows = receivables
    .map((receivable) => ({
      receivable,
      pending: receivablePending(receivable, movements),
      collected: receivableCollected(receivable, movements),
    }))
    .filter((row) => showClosed || row.pending > 0)
    .sort((a, b) => (a.receivable.dueDate ?? '9999').localeCompare(b.receivable.dueDate ?? '9999'))
  const paying = side === 'payable'
  const visible = rows.filter((row) => (row.receivable.kind === 'payable') === paying)

  async function remove(receivable: Receivable) {
    const linked = movements.some((item) => item.receivableId === receivable.id)
    const paying = receivable.kind === 'payable'
    const message = linked
      ? paying
        ? `¿Eliminar la deuda con ${receivable.person}? También se borran los pagos, y los saldos de tus cuentas cambian.`
        : `¿Eliminar a ${receivable.person}? También se borran el préstamo y los cobros, y los saldos de tus cuentas cambian.`
      : `¿Eliminar a ${receivable.person}?`
    if (!window.confirm(message)) return
    try {
      await deleteReceivable(receivable.id)
      await refresh()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <>
      <div className="segmented debt-switch" role="tablist" aria-label="Tipo de deuda">
        <button type="button" role="tab" aria-selected={!paying} className={paying ? '' : 'on'} onClick={() => setSide('receivable')}>
          <span>Te deben</span>
          <strong className="amount">{formatMoney(summary.receivablesUsd, 'USD')}</strong>
        </button>
        <button type="button" role="tab" aria-selected={paying} className={paying ? 'on' : ''} onClick={() => setSide('payable')}>
          <span>Debes</span>
          <strong className="amount">{formatMoney(summary.payablesUsd, 'USD')}</strong>
        </button>
      </div>
      <section className="section-head">
        <h1>{paying ? 'Por pagar' : 'Por cobrar'}</h1>
        <button className="btn primary" type="button" onClick={() => setEditing({ item: null, kind: side })}>
          <Plus size={18} /> {paying ? 'Nueva deuda' : 'Nuevo préstamo'}
        </button>
      </section>
      <label className="check">
        <input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />
        Mostrar saldados y perdidos
      </label>
      {error && <p className="error">{error}</p>}

      <section className="stack">
        {visible.length === 0 && <p className="note">{paying ? 'No tienes deudas por pagar.' : 'Nadie te debe nada por ahora.'}</p>}
        {visible.map((row) => (
          <DebtRow
            key={row.receivable.id}
            {...row}
            today={today}
            noAccounts={accounts.length === 0}
            onSettle={setCollecting}
            onEdit={(item) => setEditing({ item, kind: item.kind })}
            onRemove={(item) => void remove(item)}
          />
        ))}
      </section>

      {editing && (
        <ReceivableModal receivable={editing.item} creating={editing.kind} onClose={() => setEditing(null)} />
      )}
      {collecting && <CollectModal receivable={collecting} onClose={() => setCollecting(null)} />}
    </>
  )
}
