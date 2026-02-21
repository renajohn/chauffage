import { useState, useCallback } from 'react'
import type { HeatPumpData } from '@/types/heatpump'
import type { RoomsData } from '@/types/nussbaum'
import { useWebSocket } from './useWebSocket'

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL = `${wsProtocol}//${window.location.host}/ws`

export function useHeatPump() {
  const [data, setData] = useState<HeatPumpData | null>(null)
  const [roomsData, setRoomsData] = useState<RoomsData | null>(null)
  const [roomsStale, setRoomsStale] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onMessage = useCallback((raw: unknown) => {
    const msg = raw as Record<string, unknown>

    // Detect envelope format: { type: 'heatpump'|'rooms', data: ... }
    if (msg && typeof msg === 'object' && 'type' in msg && 'data' in msg) {
      if (msg.type === 'heatpump') {
        setData(msg.data as HeatPumpData)
      } else if (msg.type === 'rooms') {
        const rooms = msg.data as RoomsData
        setRoomsData(rooms)
        // Data older than 60s is stale (from disk cache or old poll)
        const age = Date.now() - new Date(rooms.timestamp).getTime()
        setRoomsStale(age > 60_000)
      }
    } else {
      // Legacy format: raw HeatPumpData
      setData(msg as unknown as HeatPumpData)
    }
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

  const setRoomTemperature = useCallback(async (controllerId: 'rez' | 'etage', roomId: number, temperature: number) => {
    try {
      const res = await fetch(`/api/rooms/${controllerId}/${roomId}/temperature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature }),
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

  const renameRoom = useCallback(async (controllerId: 'rez' | 'etage', roomId: number, name: string) => {
    try {
      const res = await fetch(`/api/rooms/${controllerId}/${roomId}/label`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur inconnue')
      }
      // Update local state immediately
      if (roomsData) {
        setRoomsData({
          ...roomsData,
          rooms: roomsData.rooms.map(r =>
            r.controllerId === controllerId && r.id === roomId ? { ...r, name } : r
          ),
        })
      }
      return await res.json()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de communication'
      setError(msg)
      throw err
    }
  }, [roomsData])

  const resetErrors = useCallback(async () => {
    try {
      const res = await fetch('/api/controls/reset-errors', { method: 'POST' })
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
    roomsData,
    roomsStale,
    wsConnected,
    error,
    sendControl,
    setRoomTemperature,
    renameRoom,
    resetErrors,
  }
}
