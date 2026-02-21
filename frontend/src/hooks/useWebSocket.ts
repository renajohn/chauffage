import { useEffect, useRef, useState, useCallback } from 'react'

interface UseWebSocketOptions {
  url: string
  onMessage?: (data: unknown) => void
}

export function useWebSocket({ url, onMessage }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const retryDelay = useRef(1000)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      retryDelay.current = 1000
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage?.(data)
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      // Reconnect with exponential backoff (max 30s)
      retryTimer.current = setTimeout(() => {
        connect()
      }, retryDelay.current)
      retryDelay.current = Math.min(retryDelay.current * 2, 30000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [url, onMessage])

  useEffect(() => {
    connect()
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected }
}
