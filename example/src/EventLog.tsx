import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { SuqoEvent } from '@suqo/react-native'

interface Entry {
  at: string
  text: string
}

interface EventLogValue {
  entries: Entry[]
  push(text: string): void
  record(event: SuqoEvent): void
  clear(): void
}

const EventLogContext = createContext<EventLogValue | null>(null)

export function EventLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([])

  const push = useCallback((text: string) => {
    const at = new Date().toISOString().slice(11, 23)
    setEntries((current) => [{ at, text }, ...current].slice(0, 100))
  }, [])

  const record = useCallback(
    (event: SuqoEvent) => {
      const detail =
        event.type === 'resize'
          ? ` ${event.height}px`
          : event.type === 'handoff' || event.type === 'handoff_failed'
            ? ` ${event.scheme}`
            : event.type === 'load_timeout'
              ? ` ${event.stage}`
              : event.type === 'settled'
                ? ` ${event.outcome}`
                : ''
      push(`${event.type}${detail}`)
    },
    [push]
  )

  const clear = useCallback(() => setEntries([]), [])

  const value = useMemo<EventLogValue>(
    () => ({ entries, push, record, clear }),
    [entries, push, record, clear]
  )

  return <EventLogContext.Provider value={value}>{children}</EventLogContext.Provider>
}

export function useEventLog() {
  const context = useContext(EventLogContext)
  if (!context) throw new Error('useEventLog outside EventLogProvider')
  return context
}
