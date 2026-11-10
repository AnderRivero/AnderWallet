import { useState, type FormEvent } from 'react'
import { confirmRecurring, saveRecurring } from '../lib/api'
import { errorText } from '../lib/errors'
import { CADENCE_LABEL, todayISO } from '../lib/format'
import { amountInput, crossRate, formatMoney, parseAmount, usdPerUnit } from '../lib/money'
import type { Cadence, Currency, FlowKind, Icon, Recurring } from '../lib/types'
import { dueState } from '../../supabase/functions/check-recurring/schedule'
import { useData } from '../data/DataProvider'
import { AccountSelect, AmountField, CategorySelect, CurrencySelect, FormActions } from './fields'
import { ColorPicker, IconPicker } from './IconPicker'
import { Modal } from './Modal'

export function RecurringModal({ recurring, onClose }: { recurring: Recurring | null; onClose: () => void }) {
  const { accounts, categories, refresh } = useData()
  const currentDue = recurring ? dueState(recurring, todayISO()).dueDate : todayISO()
  const [name, setName] = useState(recurring?.name ?? '')
  const [kind, setKind] = useState<FlowKind>(recurring?.kind ?? 'expense')
  const [amount, setAmount] = useState(amountInput(recurring?.amount))
  const [currency, setCurrency] = useState<Currency>(recurring?.currency ?? 'USD')
  const [accountId, setAccountId] = useState(recurring?.accountId ?? '')
  const [categoryId, setCategoryId] = useState(recurring?.categoryId ?? '')
  const [cadence, setCadence] = useState<Cadence>(recurring?.cadence ?? 'monthly')
  const [nextDue, setNextDue] = useState(currentDue)
  const [leadDays, setLeadDays] = useState(String(recurring?.leadDays ?? 3))
  const [color, setColor] = useState(recurring?.color ?? '#a855f7')
  const [icon, setIcon] = useState<Icon>(recurring?.icon ?? { kind: 'lucide', value: 'Repeat' })
  const [active, setActive] = useState(recurring?.active ?? true)
  const [notes, setNotes] = useState(recurring?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount)
    const lead = Number(leadDays)
    if (!name.trim()) return setError('Escribe el nombre del pago.')
    if (parsed == null || parsed <= 0) return setError('Escribe un monto mayor que cero.')
    if (!Number.isInteger(lead) || lead < 0 || lead > 60) return setError('Los días de aviso van de 0 a 60.')
    if (!nextDue) return setError('Elige la fecha del próximo pago.')
    const restart = !recurring || nextDue !== currentDue || cadence !== recurring.cadence
    setPending(true)
    setError(null)
    try {
      await saveRecurring({
        id: recurring?.id,
        name,
        kind,
        amount: parsed,
        currency,
        accountId: accountId || null,
        categoryId: categoryId || null,
        cadence,
        anchorDate: restart ? nextDue : (recurring?.anchorDate ?? nextDue),
        leadDays: lead,
        color,
        icon,
        active,
        notes,
        restartSchedule: Boolean(recurring) && restart,
      })
      await refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
      setPending(false)
    }
  }

  return (
    <Modal title={recurring ? 'Editar pago fijo' : 'Nuevo pago fijo'} subtitle="Suscripciones, servicios, alquiler o un ingreso que se repite." onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
        <label className="field">
          <span>Nombre</span>
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} autoFocus required />
        </label>
        <label className="field">
          <span>Tipo</span>
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as FlowKind)
              setCategoryId('')
            }}
          >
            <option value="expense">Pago</option>
            <option value="income">Cobro</option>
          </select>
        </label>
        <AmountField label="Monto" value={amount} onChange={setAmount} />
        <CurrencySelect value={currency} onChange={setCurrency} />
        <label className="field">
          <span>Se repite</span>
          <select value={cadence} onChange={(event) => setCadence(event.target.value as Cadence)}>
            {(Object.keys(CADENCE_LABEL) as Cadence[]).map((item) => (
              <option key={item} value={item}>
                {CADENCE_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Próximo pago</span>
          <input type="date" value={nextDue} onChange={(event) => setNextDue(event.target.value)} required />
        </label>
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} label="Cuenta habitual" allowEmpty="La elijo al pagar" />
        <CategorySelect categories={categories} kind={kind} value={categoryId} onChange={setCategoryId} />
        <label className="field">
          <span>Avisar con días de anticipación</span>
          <input type="number" min={0} max={60} value={leadDays} onChange={(event) => setLeadDays(event.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Activo
        </label>
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} color={color} onChange={setIcon} />
        <label className="field full">
          <span>Notas</span>
          <textarea value={notes} rows={2} maxLength={2000} onChange={(event) => setNotes(event.target.value)} />
        </label>
        {error && <p className="error full">{error}</p>}
        <FormActions pending={pending} onClose={onClose} />
      </form>
    </Modal>
  )
}

export function ConfirmRecurringModal({ recurring, onClose }: { recurring: Recurring; onClose: () => void }) {
  const { accounts, rates, refresh } = useData()
  const due = dueState(recurring, todayISO())
  const [accountId, setAccountId] = useState(
    recurring.accountId ?? accounts.find((item) => item.currency === recurring.currency)?.id ?? accounts[0]?.id ?? '',
  )
  const [amount, setAmount] = useState('')
  const [dirty, setDirty] = useState(false)
  const [occurredOn, setOccurredOn] = useState(due.dueDate < todayISO() ? due.dueDate : todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const account = accounts.find((item) => item.id === accountId)
  const rate = account ? crossRate(recurring.currency, account.currency, account.rateSource, rates) : null
  const proposal = rate == null ? null : Math.round(recurring.amount * rate * 100) / 100
  const shown = dirty ? amount : account?.currency === recurring.currency ? amountInput(recurring.amount) : amountInput(proposal)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(shown)
    if (!account) return setError('Elige la cuenta.')
    if (parsed == null || parsed <= 0) return setError('Escribe un monto mayor que cero.')
    setPending(true)
    setError(null)
    try {
      await confirmRecurring({
        id: recurring.id,
        expected: recurring.paidCount,
        accountId,
        amount: parsed,
        occurredOn,
        usdRate: usdPerUnit(account.currency, account.rateSource, rates),
        note,
      })
      await refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
      setPending(false)
    }
  }

  return (
    <Modal
      title={`${recurring.kind === 'expense' ? 'Pagar' : 'Cobrar'} ${recurring.name}`}
      subtitle={`${formatMoney(recurring.amount, recurring.currency)} · corresponde al ${due.dueDate}`}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
        <AmountField
          label={account ? `Monto en ${account.currency}` : 'Monto'}
          value={shown}
          onChange={(value) => {
            setDirty(true)
            setAmount(value)
          }}
          hint={
            account && account.currency !== recurring.currency
              ? proposal != null
                ? 'Convertido con la tasa de hoy. Corrígelo si pagaste otro monto.'
                : 'Sin tasa para convertir. Escribe el monto.'
              : undefined
          }
        />
        <label className="field">
          <span>Fecha</span>
          <input type="date" value={occurredOn} max={todayISO()} onChange={(event) => setOccurredOn(event.target.value)} />
        </label>
        <label className="field">
          <span>Nota</span>
          <input value={note} maxLength={2000} placeholder={recurring.name} onChange={(event) => setNote(event.target.value)} />
        </label>
        {error && <p className="error full">{error}</p>}
        <FormActions pending={pending} onClose={onClose} label="Confirmar" />
      </form>
    </Modal>
  )
}
