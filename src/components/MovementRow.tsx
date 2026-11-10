import { Pencil, Trash2 } from 'lucide-react'
import { formatDate, MOVEMENT_KIND_LABEL } from '../lib/format'
import { formatMoney } from '../lib/money'
import type { Account, Category, Movement, Receivable } from '../lib/types'
import { Amount } from './Amount'
import { IconView } from './IconView'

export function movementTitle(
  movement: Movement,
  context: { categories: Category[]; receivables: Receivable[]; accounts: Account[]; movements: Movement[] },
): string {
  if (movement.kind === 'transfer') {
    const other = context.movements.find((item) => item.transferGroup === movement.transferGroup && item.id !== movement.id)
    const name = context.accounts.find((item) => item.id === other?.accountId)?.name ?? 'otra cuenta'
    return movement.direction === -1 ? `A ${name}` : `Desde ${name}`
  }
  if (movement.kind === 'loan_out' || movement.kind === 'collection') {
    const person = context.receivables.find((item) => item.id === movement.receivableId)?.person ?? ''
    return `${MOVEMENT_KIND_LABEL[movement.kind]} · ${person}`
  }
  const category = context.categories.find((item) => item.id === movement.categoryId)
  return movement.note ?? category?.name ?? MOVEMENT_KIND_LABEL[movement.kind]
}

export function MovementRow({
  movement,
  account,
  category,
  title,
  onEdit,
  onDelete,
}: {
  movement: Movement
  account: Account | undefined
  category: Category | undefined
  title: string
  onEdit?: () => void
  onDelete?: () => void
}) {
  const icon = category?.icon ?? account?.icon ?? { kind: 'lucide' as const, value: 'Tag' }
  const color = category?.color ?? account?.color ?? '#64748b'
  const meta = [
    formatDate(movement.occurredOn),
    account?.name,
    category && movement.note ? category.name : null,
    movement.kind !== 'income' && movement.kind !== 'expense' ? MOVEMENT_KIND_LABEL[movement.kind] : null,
  ].filter(Boolean)

  return (
    <article className="row-card">
      <IconView icon={icon} color={color} size={40} />
      <div className="row-main">
        <strong>{title}</strong>
        <p className="note">{meta.join(' · ')}</p>
      </div>
      <div className="row-value">
        {account && <Amount value={movement.amount * movement.direction} currency={account.currency} signed />}
        {account && account.currency !== 'USD' && movement.usdAmount != null && (
          <small className="amount muted">{formatMoney(movement.usdAmount * movement.direction, 'USD')}</small>
        )}
      </div>
      {(onEdit || onDelete) && (
        <div className="row-actions">
          {onEdit && (
            <button className="icon-action" type="button" aria-label="Editar" title="Editar" onClick={onEdit}>
              <Pencil size={16} />
            </button>
          )}
          {onDelete && (
            <button className="icon-action danger" type="button" aria-label="Eliminar" title="Eliminar" onClick={onDelete}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </article>
  )
}
