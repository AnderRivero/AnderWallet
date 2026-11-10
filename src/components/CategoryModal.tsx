import { useState, type FormEvent } from 'react'
import { saveCategory } from '../lib/api'
import { errorText } from '../lib/errors'
import type { Category, FlowKind, Icon } from '../lib/types'
import { useData } from '../data/DataProvider'
import { FormActions } from './fields'
import { ColorPicker, IconPicker } from './IconPicker'
import { Modal } from './Modal'

export function CategoryModal({
  category,
  defaultKind = 'expense',
  onClose,
}: {
  category: Category | null
  defaultKind?: FlowKind
  onClose: () => void
}) {
  const { refresh } = useData()
  const [name, setName] = useState(category?.name ?? '')
  const [kind, setKind] = useState<FlowKind>(category?.kind ?? defaultKind)
  const [color, setColor] = useState(category?.color ?? '#22c55e')
  const [icon, setIcon] = useState<Icon>(category?.icon ?? { kind: 'lucide', value: 'Tag' })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Escribe el nombre de la categoría.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await saveCategory({ id: category?.id, name, kind, color, icon })
      await refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
      setPending(false)
    }
  }

  return (
    <Modal title={category ? 'Editar categoría' : 'Nueva categoría'} onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
        <label className="field">
          <span>Nombre</span>
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} autoFocus required />
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={kind} disabled={Boolean(category)} onChange={(event) => setKind(event.target.value as FlowKind)}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </label>
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} color={color} onChange={setIcon} />
        {error && <p className="error full">{error}</p>}
        <FormActions pending={pending} onClose={onClose} />
      </form>
    </Modal>
  )
}
