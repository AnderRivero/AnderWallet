import { useState, type FormEvent } from 'react'
import { createReceivable, saveMovement, updateReceivable } from '../lib/api'
import { errorText } from '../lib/errors'
import { todayISO } from '../lib/format'
import { amountInput, crossRate, formatMoney, parseAmount, receivableCollected, receivablePending, usdPerUnit } from '../lib/money'
import type { Currency, Icon, Receivable } from '../lib/types'
import { useData } from '../data/DataProvider'
import { AccountSelect, AmountField, CurrencySelect, FormActions } from './fields'
import { ColorPicker, IconPicker } from './IconPicker'
import { Modal } from './Modal'

export function ReceivableModal({ receivable, onClose }: { receivable: Receivable | null; onClose: () => void }) {
  const { accounts, movements, rates, refresh } = useData()
  const [person, setPerson] = useState(receivable?.person ?? '')
  const [currency, setCurrency] = useState<Currency>(receivable?.currency ?? 'USD')
  const [principal, setPrincipal] = useState(amountInput(receivable?.principal))
  const [dueDate, setDueDate] = useState(receivable?.dueDate ?? '')
  const [notes, setNotes] = useState(receivable?.notes ?? '')
  const [color, setColor] = useState(receivable?.color ?? '#22c55e')
  const [icon, setIcon] = useState<Icon>(receivable?.icon ?? { kind: 'lucide', value: 'HandCoins' })
  const [writtenOff, setWrittenOff] = useState(receivable?.writtenOff ?? false)
  const [fromAccount, setFromAccount] = useState(true)
  const [accountId, setAccountId] = useState(accounts.find((item) => item.currency === currency)?.id ?? accounts[0]?.id ?? '')
  const [accountAmount, setAccountAmount] = useState('')
  const [accountDirty, setAccountDirty] = useState(false)
  const [occurredOn, setOccurredOn] = useState(todayISO())
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const account = accounts.find((item) => item.id === accountId)
  const parsedPrincipal = parseAmount(principal)
  const rate = account ? crossRate(currency, account.currency, account.rateSource, rates) : null
  const proposal = parsedPrincipal != null && rate != null ? Math.round(parsedPrincipal * rate * 100) / 100 : null
  const shownAccountAmount = account?.currency === currency ? principal : accountDirty ? accountAmount : amountInput(proposal)
  const collected = receivable ? receivableCollected(receivable, movements) : 0

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!person.trim()) return setError('Escribe a quién le prestaste.')
    if (parsedPrincipal == null || parsedPrincipal <= 0) return setError('Escribe un monto mayor que cero.')
    if (receivable && parsedPrincipal < collected) {
      return setError(`Ya cobraste ${formatMoney(collected, receivable.currency)}. El monto no puede ser menor.`)
    }
    const sent = parseAmount(shownAccountAmount)
    if (!receivable && fromAccount && (!account || sent == null || sent <= 0)) {
      return setError('Elige la cuenta y cuánto salió de ella.')
    }
    setPending(true)
    setError(null)
    try {
      if (receivable) {
        await updateReceivable(receivable.id, {
          person,
          principal: parsedPrincipal,
          dueDate: dueDate || null,
          notes,
          color,
          icon,
          writtenOff,
        })
        const loan = movements.find((item) => item.receivableId === receivable.id && item.kind === 'loan_out')
        if (loan && loan.receivableAmount !== parsedPrincipal) {
          await saveMovement({
            id: loan.id,
            accountId: loan.accountId,
            categoryId: null,
            kind: 'loan_out',
            direction: -1,
            amount: loan.amount,
            occurredOn: loan.occurredOn,
            note: loan.note,
            usdRate: loan.usdRate,
            receivableId: receivable.id,
            receivableAmount: parsedPrincipal,
          })
        }
      } else {
        await createReceivable({
          person,
          currency,
          principal: parsedPrincipal,
          dueDate: dueDate || null,
          notes,
          color,
          icon,
          accountId: fromAccount && account ? account.id : null,
          accountAmount: fromAccount ? sent : null,
          occurredOn,
          usdRate: account ? usdPerUnit(account.currency, account.rateSource, rates) : null,
        })
      }
      await refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
      setPending(false)
    }
  }

  return (
    <Modal title={receivable ? 'Editar por cobrar' : 'Nuevo préstamo'} subtitle="Lo que te deben suma al bruto, no al neto." onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
        <label className="field">
          <span>Persona</span>
          <input value={person} maxLength={120} onChange={(event) => setPerson(event.target.value)} autoFocus required />
        </label>
        <CurrencySelect label="Moneda de la deuda" value={currency} disabled={Boolean(receivable)} onChange={setCurrency} />
        <AmountField label={`Monto (${currency})`} value={principal} onChange={setPrincipal} />
        <label className="field">
          <span>Fecha posible de cobro</span>
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        {!receivable && (
          <>
            <label className="check full">
              <input type="checkbox" checked={fromAccount} onChange={(event) => setFromAccount(event.target.checked)} />
              El dinero salió de una de mis cuentas
            </label>
            {fromAccount && (
              <>
                <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} label="Salió de" />
                <AmountField
                  label={account ? `Salió (${account.currency})` : 'Salió'}
                  value={shownAccountAmount}
                  onChange={(value) => {
                    setAccountDirty(true)
                    setAccountAmount(value)
                  }}
                  hint={account && account.currency !== currency && !accountDirty && proposal != null ? 'Propuesto con la tasa de hoy.' : undefined}
                />
                <label className="field">
                  <span>Fecha del préstamo</span>
                  <input type="date" value={occurredOn} max={todayISO()} onChange={(event) => setOccurredOn(event.target.value)} />
                </label>
              </>
            )}
          </>
        )}
        <label className="field full">
          <span>Nota</span>
          <textarea value={notes} rows={2} maxLength={2000} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} color={color} onChange={setIcon} />
        {receivable && (
          <>
            <p className="note full">
              Cobrado {formatMoney(collected, receivable.currency)} · pendiente{' '}
              {formatMoney(receivablePending({ ...receivable, writtenOff: false }, movements), receivable.currency)}
            </p>
            <label className="check full">
              <input type="checkbox" checked={writtenOff} onChange={(event) => setWrittenOff(event.target.checked)} />
              Darlo por perdido (deja de sumar al bruto)
            </label>
          </>
        )}
        {error && <p className="error full">{error}</p>}
        <FormActions pending={pending} onClose={onClose} />
      </form>
    </Modal>
  )
}

export function CollectModal({ receivable, onClose }: { receivable: Receivable; onClose: () => void }) {
  const { accounts, movements, rates, refresh } = useData()
  const pending = receivablePending(receivable, movements)
  const [accountId, setAccountId] = useState(
    accounts.find((item) => item.currency === receivable.currency)?.id ?? accounts[0]?.id ?? '',
  )
  const [debtAmount, setDebtAmount] = useState(amountInput(pending))
  const [accountAmount, setAccountAmount] = useState('')
  const [accountDirty, setAccountDirty] = useState(false)
  const [occurredOn, setOccurredOn] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const account = accounts.find((item) => item.id === accountId)
  const parsedDebt = parseAmount(debtAmount)
  const rate = account ? crossRate(receivable.currency, account.currency, account.rateSource, rates) : null
  const proposal = parsedDebt != null && rate != null ? Math.round(parsedDebt * rate * 100) / 100 : null
  const shown = account?.currency === receivable.currency ? debtAmount : accountDirty ? accountAmount : amountInput(proposal)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const received = parseAmount(shown)
    if (!account) return setError('Elige la cuenta donde entró.')
    if (parsedDebt == null || parsedDebt <= 0) return setError('Escribe cuánto te pagaron.')
    if (parsedDebt > pending + 0.000001) return setError(`Lo pendiente es ${formatMoney(pending, receivable.currency)}.`)
    if (received == null || received <= 0) return setError('Escribe cuánto entró a la cuenta.')
    setSaving(true)
    setError(null)
    try {
      await saveMovement({
        accountId,
        categoryId: null,
        kind: 'collection',
        direction: 1,
        amount: received,
        occurredOn,
        note: note || `Cobro de ${receivable.person}`,
        usdRate: usdPerUnit(account.currency, account.rateSource, rates),
        receivableId: receivable.id,
        receivableAmount: parsedDebt,
      })
      await refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Cobro de ${receivable.person}`}
      subtitle={`Pendiente: ${formatMoney(pending, receivable.currency)}`}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
        <AmountField label={`Abono a la deuda (${receivable.currency})`} value={debtAmount} onChange={setDebtAmount} />
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} label="Entró a" />
        <AmountField
          label={account ? `Entró (${account.currency})` : 'Entró'}
          value={shown}
          onChange={(value) => {
            setAccountDirty(true)
            setAccountAmount(value)
          }}
          hint={account && account.currency !== receivable.currency && !accountDirty && proposal != null ? 'Propuesto con la tasa de hoy.' : undefined}
        />
        <label className="field">
          <span>Fecha</span>
          <input type="date" value={occurredOn} max={todayISO()} onChange={(event) => setOccurredOn(event.target.value)} />
        </label>
        <label className="field full">
          <span>Nota</span>
          <input value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} />
        </label>
        {error && <p className="error full">{error}</p>}
        <FormActions pending={saving} onClose={onClose} label="Registrar cobro" />
      </form>
    </Modal>
  )
}
