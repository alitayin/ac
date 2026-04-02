"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { ChronikClient, ConnectionStrategy } from 'chronik-client'

const CHRONIK_URLS = [
  "https://chronik-native1.fabien.cash",
  "https://chronik-native2.fabien.cash",
  "https://chronik-native3.fabien.cash",
]

interface ChronikContextValue {
  chronik: ChronikClient | null
  isLoading: boolean
  error: Error | null
}

const ChronikContext = createContext<ChronikContextValue>({
  chronik: null,
  isLoading: true,
  error: null,
})

export const useChronik = () => {
  const context = useContext(ChronikContext)
  if (!context) {
    throw new Error('useChronik must be used within ChronikProvider')
  }
  return context
}

export function ChronikProvider({ children }: { children: React.ReactNode }) {
  const [chronik, setChronik] = useState<ChronikClient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    const initChronik = async () => {
      try {
        const client = await ChronikClient.useStrategy(
          ConnectionStrategy.ClosestFirst,
          CHRONIK_URLS
        )

        if (!cancelled) {
          setChronik(client)
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Failed to initialize chronik with strategy, falling back to default:', err)

        // Fallback to synchronous client
        const fallbackClient = new ChronikClient(CHRONIK_URLS)

        if (!cancelled) {
          setChronik(fallbackClient)
          setError(err instanceof Error ? err : new Error('Unknown error'))
          setIsLoading(false)
        }
      }
    }

    initChronik()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ChronikContext.Provider value={{ chronik, isLoading, error }}>
      {children}
    </ChronikContext.Provider>
  )
}
