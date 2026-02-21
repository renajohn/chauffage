import { useState, useCallback } from 'react'
import type { HeatPumpData } from '@/types/heatpump'
import { useWebSocket } from './useWebSocket'

const WS_URL = `ws://${window.location.hostname}:3002`

export function useHeatPump() {
  const [data, setData] = useState<HeatPumpData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onMessage = useCallback((raw: unknown) => {
    setData(raw as HeatPumpData)
    setError(null)
  }, [])

  const { connected: wsConnected } = useWebSocket({ url: WS_URL, onMessage })

  const sendControl = useCallback(async (parameter: string, value: number) => {
    try {
      const res = await fetch('/api/controls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameter, value }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur inconnue')
      }
      return await res.json()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de communication'
      setError(msg)
      throw err
    }
  }, [])

  return {
    data,
    wsConnected,
    error,
    sendControl,
  }
}
