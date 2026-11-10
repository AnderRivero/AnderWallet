import { useState, type FormEvent } from 'react'
import { saveAccount } from '../lib/api'
import { errorText } from '../lib/errors'
import { ACCOUNT_KIND_LABEL } from '../lib/format'
import { euroCrossesBcv, SOURCE_LABEL } from '../lib/money'
import type { Account, AccountKind, Currency, Icon, RateSource } from '../lib/types'
import { CURRENCIES } from '../lib/types'
import { useData } from '../data/DataProvider'
import { CurrencySelect, FormActions } from './fields'
import { ColorPicker, IconPicker } from './IconPicker'
import { Modal } from './Modal'

const DEFAULT_ICON: Record<AccountKind, string> = { bank: 'Landmark', wallet: 'Wallet', crypto: 'Bitcoin' }

export function AccountModal({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { movements, refresh } = useData()
  const [name, setName] = useState(account?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'bank')
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'VES')
  const [rateSource, setRateSource] = useState<RateSource>(account?.rateSource ?? 'bcv')
  const [refCurrency, setRefCurrency] = useState<Currency | ''>(account?.refCurrency ?? 'USD')
  const [color, setColor] = useState(account?.color ?? '#22c55e')
  const [icon, setIcon] = useState<Icon>(account?.icon ?? { kind: 'lucide', value: 'Landmark' })
  const [featured, setFeatured] = useState(account?.featured ?? true)
  const [notes, setNotes] = useState(account?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const locked = Boolean(account && movements.some((movement) => movement.accountId === account.id))

  function onKind(next: AccountKind) {
    setKind(next)
    if (next === 'crypto') {
      setCurrency('USDT')
      setRateSource('binance')
      if (refCurrency === 'USDT') setRefCurrency('VES')
    }
    if (icon.kind === 'lucide' && Object.values(DEFAULT_ICON).includes(icon.value)) {
      setIcon({ kind: 'lucide', value: DEFAULT_ICON[next] })
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Escribe el nombre de la cuenta.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await saveAccount({
        id: account?.id,
        name,
        kind,
        currency,
        rateSource,
        refCurrency: refCurrency && refCurrency !== currency ? refCurrency : null,
        color,
        icon,
        featured,
        notes,
      })
      await refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
      setPending(false)
    }
  }

  return (
    <Modal title={account ? 'Editar cuenta' : 'Nueva cuenta'} onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
        <label className="field full">
          <span>Nombre</span>
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} autoFocus required />
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={kind} onChange={(event) => onKind(event.target.value as AccountKind)}>
            {(Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[]).map((item) => (
              <option key={item} value={item}>
                {ACCOUNT_KIND_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
        <CurrencySelect
          label="Moneda principal"
          value={currency}
          disabled={locked || kind === 'crypto'}
          onChange={(next) => {
            setCurrency(next)
            if (refCurrency === next) setRefCurrency('')
          }}
        />
        <label className="field">
          <span>Tasa para convertir</span>
          <select value={rateSource} onChange={(event) => setRateSource(event.target.value as RateSource)}>
            {(Object.keys(SOURCE_LABEL) as RateSource[]).map((item) => (
              <option key={item} value={item}>
                {SOURCE_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Moneda de referencia</span>
          <select value={refCurrency} onChange={(event) => setRefCurrency(event.target.value as Currency | '')}>
            <option value="">Ninguna</option>
            {CURRENCIES.filter((item) => item !== currency).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {locked && <p className="note full">La moneda no se cambia porque la cuenta ya tiene movimientos.</p>}
        {euroCrossesBcv({ currency, refCurrency: refCurrency || null, rateSource }) && (
          <p className="note full">Binance no publica euro: la parte en euros se convierte con el BCV.</p>
        )}
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} color={color} onChange={setIcon} />
        <label className="check full">
          <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />
          Mostrar en el inicio
        </label>
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
