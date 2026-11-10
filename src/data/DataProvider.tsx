import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadAll, ratesFrom, type Snapshot } from '../lib/api'
import { errorText } from '../lib/errors'
import type { Rates } from '../lib/types'

type DataContextValue = Snapshot & {
  rates: Rates
  loading: boolean
  error: string | null
  hidden: boolean
  toggleHidden: () => void
  refresh: () => Promise<void>
}

const EMPTY: Snapshot = { accounts: [], categories: [], movements: [], receivables: [], recurring: [], snapshots: [] }
const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await loadAll())
      setError(null)
    } catch (err) {
      setError(errorText(err))
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh().catch(() => undefined)
  }, [refresh])

  const toggleHidden = useCallback(() => setHidden((value) => !value), [])

  const value = useMemo(
    () => ({
      ...snapshot,
      rates: ratesFrom(snapshot.snapshots),
      loading,
      error,
      hidden,
      toggleHidden,
      refresh,
    }),
    [error, hidden, loading, refresh, snapshot, toggleHidden],
  )

  return (
    <DataContext.Provider value={value}>
      <div className={hidden ? 'privacy' : undefined}>{children}</div>
    </DataContext.Provider>
  )
}

export function useData(): DataContextValue {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData debe usarse dentro de DataProvider.')
  return value
}
