import { useState, type FormEvent } from 'react'
import { saveMovement, type MovementInput } from '../lib/api'
import { errorText } from '../lib/errors'
import { todayISO } from '../lib/format'
import { amountInput, formatMoney, parseAmount, SOURCE_LABEL, usdPerUnit } from '../lib/money'
import type { Movement } from '../lib/types'
import { useData } from '../data/DataProvider'
import { AccountSelect, AmountField, CategorySelect, FormActions } from './fields'
import { Modal } from './Modal'

type EditableKind = MovementInput['kind']

const TABS: Array<{ kind: EditableKind; label: string }> = [
  { kind: 'expense', label: 'Gasto' },
  { kind: 'income', label: 'Ingreso' },
  { kind: 'opening', label: 'Saldo inicial' },
  { kind: 'adjustment', label: 'Ajuste' },
]

export function MovementModal({
  movement,
  defaultKind = 'expense',
  defaultAccountId,
  onClose,
}: {
  movement: Movement | null
  defaultKind?: EditableKind
  defaultAccountId?: string
  onClose: () => void
}) {
  const { accounts, categories, receivables, rates, refresh } = useData()
  const initialKind = (movement?.kind as EditableKind | undefined) ?? defaultKind
  const [kind, setKind] = useState<EditableKind>(initialKind)
  const [accountId, setAccountId] = useState(movement?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? '')
  const [amount, setAmount] = useState(amountInput(movement?.amount))
  const [negative, setNegative] = useState(movement ? movement.direction === -1 : false)
  const [categoryId, setCategoryId] = useState(movement?.categoryId ?? '')
  const [occurredOn, setOccurredOn] = useState(movement?.occurredOn ?? todayISO())
  const [note, setNote] = useState(movement?.note ?? '')
  const [receivableAmount, setReceivableAmount] = useState(amountInput(movement?.receivableAmount))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const linked = kind === 'loan_out' || kind === 'collection'
  const receivable = receivables.find((item) => item.id === movement?.receivableId)
  const account = accounts.find((item) => item.id === accountId)
  const parsed = parseAmount(amount)
  const factor = account ? usdPerUnit(account.currency, account.rateSource, rates) : null
  const signedChoice = kind === 'opening' || kind === 'adjustment'
  const direction: 1 | -1 = kind === 'income' || kind === 'collection' ? 1 : kind === 'expense' || kind === 'loan_out' ? -1 : negative ? -1 : 1

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!account) {
      setError('Elige una cuenta.')
      return
    }
    if (parsed == null || parsed <= 0) {
      setError('Escribe un monto mayor que cero.')
      return
    }
    const linkedAmount = linked ? parseAmount(receivableAmount) : null
    if (linked && (linkedAmount == null || linkedAmount <= 0)) {
      setError('Escribe cuánto cuenta para la deuda.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await saveMovement({
        id: movement?.id,
        accountId,
        categoryId: kind === 'income' || kind === 'expense' ? categoryId || null : null,
        kind,
        direction,
        amount: parsed,
        occurredOn,
        note,
        usdRate: movement && movement.accountId === accountId && movement.usdRate ? movement.usdRate : factor,
        ...(linked ? { receivableId: movement?.receivableId ?? null, receivableAmount: linkedAmount } : {}),
      })
      await refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
      setPending(false)
    }
  }

  const title = movement ? 'Editar movimiento' : 'Nuevo movimiento'

  return (
    <Modal title={title} onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
        {!linked && (
          <div className="segmented full">
            {TABS.map((tab) => (
              <button
                key={tab.kind}
                type="button"
                className={tab.kind === kind ? 'on' : ''}
                onClick={() => {
                  setKind(tab.kind)
                  setCategoryId('')
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        {linked && receivable && (
          <p className="note full">
            {kind === 'loan_out' ? 'Préstamo a' : 'Cobro de'} {receivable.person}
          </p>
        )}
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
        <AmountField
          label={account ? `Monto en ${account.currency}` : 'Monto'}
          value={amount}
          onChange={setAmount}
          hint={
            parsed != null && account && account.currency !== 'USD'
              ? factor
                ? `≈ ${formatMoney(parsed * factor, 'USD')} con la tasa ${SOURCE_LABEL[account.rateSource]} de hoy`
                : 'Sin tasa para convertir a dólares. Se guarda sin equivalente.'
              : undefined
          }
        />
        {signedChoice && (
          <label className="check full">
            <input type="checkbox" checked={negative} onChange={(event) => setNegative(event.target.checked)} />
            {kind === 'opening' ? 'El saldo inicial es negativo' : 'Este ajuste resta'}
          </label>
        )}
        {(kind === 'income' || kind === 'expense') && (
          <CategorySelect categories={categories} kind={kind} value={categoryId} onChange={setCategoryId} />
        )}
        {linked && receivable && (
          <AmountField label={`Cuenta para la deuda (${receivable.currency})`} value={receivableAmount} onChange={setReceivableAmount} />
        )}
        <label className="field">
          <span>Fecha</span>
          <input type="date" value={occurredOn} max={todayISO()} onChange={(event) => setOccurredOn(event.target.value)} required />
        </label>
        <label className="field full">
          <span>Nota</span>
          <input value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} />
        </label>
        {movement && movement.usdRate && movement.accountId === accountId && (
          <p className="note full">Conserva la tasa con la que se anotó, no la de hoy.</p>
        )}
        {error && <p className="error full">{error}</p>}
        <FormActions pending={pending} onClose={onClose} />
      </form>
    </Modal>
  )
}
