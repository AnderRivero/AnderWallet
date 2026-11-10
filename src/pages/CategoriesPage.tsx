import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { CategoryModal } from '../components/CategoryModal'
import { IconView } from '../components/IconView'
import { useData } from '../data/DataProvider'
import { deleteCategory } from '../lib/api'
import { errorText } from '../lib/errors'
import type { Category, FlowKind } from '../lib/types'

export function CategoriesPage() {
  const { categories, movements, refresh } = useData()
  const [editing, setEditing] = useState<{ category: Category | null; kind: FlowKind } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove(category: Category) {
    const used = movements.filter((item) => item.categoryId === category.id).length
    const message = used
      ? `¿Eliminar ${category.name}? ${used} movimientos quedan sin categoría.`
      : `¿Eliminar ${category.name}?`
    if (!window.confirm(message)) return
    try {
      await deleteCategory(category.id)
      await refresh()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <>
      <section className="section-head">
        <div>
          <p className="eyebrow">Para ordenar</p>
          <h1>Categorías</h1>
        </div>
      </section>
      {error && <p className="error">{error}</p>}
      <div className="two">
        {(['expense', 'income'] as FlowKind[]).map((kind) => (
          <section key={kind} className="stack">
            <div className="section-head">
              <h2>{kind === 'expense' ? 'Gastos' : 'Ingresos'}</h2>
              <button className="btn ghost compact" type="button" onClick={() => setEditing({ category: null, kind })}>
                <Plus size={16} /> Nueva
              </button>
            </div>
            {categories
              .filter((category) => category.kind === kind)
              .map((category) => (
                <article key={category.id} className="row-card">
                  <IconView icon={category.icon} color={category.color} size={38} />
                  <div className="row-main">
                    <strong>{category.name}</strong>
                  </div>
                  <div className="row-actions">
                    <button className="icon-action" type="button" aria-label="Editar" title="Editar" onClick={() => setEditing({ category, kind })}>
                      <Pencil size={16} />
                    </button>
                    <button className="icon-action danger" type="button" aria-label="Eliminar" title="Eliminar" onClick={() => void remove(category)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
          </section>
        ))}
      </div>
      {editing && <CategoryModal category={editing.category} defaultKind={editing.kind} onClose={() => setEditing(null)} />}
    </>
  )
}
