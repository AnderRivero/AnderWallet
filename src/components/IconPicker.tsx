import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { Icon } from '../lib/types'
import { IconView, LUCIDE_ICONS } from './IconView'

const COLORS = [
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#64748b', '#f5f5f4', '#000000',
]

type Tab = 'lucide' | 'brand' | 'url'

export function ColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="field full">
      <span>Color</span>
      <div className="swatches">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={color === value ? 'swatch on' : 'swatch'}
            style={{ background: color }}
            aria-label={`Color ${color}`}
            onClick={() => onChange(color)}
          />
        ))}
        <label className="swatch custom" title="Otro color">
          <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        </label>
      </div>
    </div>
  )
}

export function IconPicker({ value, color, onChange }: { value: Icon; color: string; onChange: (icon: Icon) => void }) {
  const [tab, setTab] = useState<Tab>(value.kind)
  const [query, setQuery] = useState(value.kind === 'brand' ? value.value.split(':')[1] ?? '' : '')
  const [results, setResults] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [url, setUrl] = useState(value.kind === 'url' ? value.value : '')

  useEffect(() => {
    if (tab !== 'brand') return
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setSearchError(null)
      try {
        const params = new URLSearchParams({ query: term, prefixes: 'simple-icons,logos', limit: '48' })
        const response = await fetch(`https://api.iconify.design/search?${params}`, {
          signal: controller.signal,
          referrerPolicy: 'no-referrer',
          credentials: 'omit',
        })
        if (!response.ok) throw new Error()
        const body = (await response.json()) as { icons?: unknown }
        const icons = Array.isArray(body.icons) ? body.icons.filter((item): item is string => typeof item === 'string') : []
        setResults(icons.filter((item) => /^[a-z0-9-]+:[a-z0-9-]+$/.test(item)))
      } catch {
        if (!controller.signal.aborted) setSearchError('No se pudo buscar. Revisa la conexión o pega una URL.')
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 350)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, tab])

  return (
    <div className="field full">
      <span>Icono</span>
      <div className="segmented">
        <button type="button" className={tab === 'lucide' ? 'on' : ''} onClick={() => setTab('lucide')}>
          Incluidos
        </button>
        <button type="button" className={tab === 'brand' ? 'on' : ''} onClick={() => setTab('brand')}>
          Marcas
        </button>
        <button type="button" className={tab === 'url' ? 'on' : ''} onClick={() => setTab('url')}>
          URL
        </button>
      </div>

      {tab === 'lucide' && (
        <div className="icon-grid">
          {Object.keys(LUCIDE_ICONS).map((name) => (
            <button
              key={name}
              type="button"
              className={value.kind === 'lucide' && value.value === name ? 'icon-choice on' : 'icon-choice'}
              title={name}
              onClick={() => onChange({ kind: 'lucide', value: name })}
            >
              <IconView icon={{ kind: 'lucide', value: name }} color={color} size={34} />
            </button>
          ))}
        </div>
      )}

      {tab === 'brand' && (
        <div className="stack-tight">
          <div className="search-input">
            <Search size={16} />
            <input
              value={query}
              placeholder="Cursor, Netflix, Spotify…"
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </div>
          {searching && <p className="note">Buscando…</p>}
          {searchError && <p className="note">{searchError}</p>}
          <div className="icon-grid">
            {results.map((name) => (
              <button
                key={name}
                type="button"
                className={value.kind === 'brand' && value.value === name ? 'icon-choice on' : 'icon-choice'}
                title={name}
                onClick={() => onChange({ kind: 'brand', value: name })}
              >
                <IconView icon={{ kind: 'brand', value: name }} color={color} size={34} />
              </button>
            ))}
          </div>
          <p className="note">Los logos salen de Iconify (Simple Icons y Logos). Solo se envía lo que escribes en la búsqueda.</p>
        </div>
      )}

      {tab === 'url' && (
        <div className="stack-tight">
          <input
            value={url}
            placeholder="https://…/logo.png"
            inputMode="url"
            onChange={(event) => {
              setUrl(event.target.value)
              if (/^https:\/\/[^\s"'<>]{4,490}$/.test(event.target.value.trim())) {
                onChange({ kind: 'url', value: event.target.value.trim() })
              }
            }}
          />
          <p className="note">Solo direcciones https. La imagen se pide sin enviar de dónde viene.</p>
        </div>
      )}
    </div>
  )
}
