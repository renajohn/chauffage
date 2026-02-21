import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { formatTemp, tempColor } from '@/lib/utils'
import type { NussbaumRoom } from '@/types/nussbaum'

const EMOJI_PATTERNS: [RegExp, string][] = [
  [/salon/i, '🛋️'],
  [/bureau/i, '💻'],
  [/sdb|salle de bain|bathroom/i, '🚿'],
  [/oriane/i, '🧒'],
  [/parent|bedroom/i, '🛏️'],
  [/escalier|réduit|play/i, '🚪'],
]

function roomEmoji(name: string): string {
  for (const [pattern, emoji] of EMOJI_PATTERNS) {
    if (pattern.test(name)) return emoji
  }
  return '🏠'
}

function BatteryIcon({ level }: { level: number }) {
  const color = level > 50 ? 'text-green-600' : level > 20 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`text-xs ${color}`}>{level}%</span>
}

function SignalIcon({ strength }: { strength: number }) {
  const bars = Math.min(strength, 3)
  const label = bars === 0 ? '○' : '▂'.repeat(bars)
  return <span className="text-xs text-muted-foreground font-mono">{label}</span>
}

interface RoomCardProps {
  room: NussbaumRoom
  disabled?: boolean
  onTemperatureChange?: (controllerId: 'rez' | 'etage', roomId: number, temperature: number) => Promise<void>
  onRename?: (controllerId: 'rez' | 'etage', roomId: number, name: string) => Promise<void>
}

export function RoomCard({ room, disabled, onTemperatureChange, onRename }: RoomCardProps) {
  const [sliderTemp, setSliderTemp] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [applyError, setApplyError] = useState(false)
  const [propagating, setPropagating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(room.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const emoji = roomEmoji(room.name)
  const delta = room.actualTemperature - room.targetTemperature
  const effectiveTarget = sliderTemp ?? room.targetTemperature

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  // Clear propagating state when target temperature updates from backend
  useEffect(() => {
    if (propagating) setPropagating(false)
  }, [room.targetTemperature])

  async function handleApply() {
    if (!confirm) {
      setConfirm(true)
      return
    }
    if (!onTemperatureChange || sliderTemp === null) return
    setPending(true)
    setConfirm(false)
    setApplyError(false)
    try {
      await onTemperatureChange(room.controllerId, room.id, sliderTemp)
      setSliderTemp(null)
      setPropagating(true)
    } catch {
      setApplyError(true)
    } finally {
      setPending(false)
    }
  }

  async function handleRename() {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === room.name) {
      setEditing(false)
      setEditName(room.name)
      return
    }
    try {
      await onRename?.(room.controllerId, room.id, trimmed)
    } catch { /* error handled in hook */ }
    setEditing(false)
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Header: emoji + name + demand badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">{emoji}</span>
            {editing ? (
              <input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') { setEditing(false); setEditName(room.name) }
                }}
                className="font-medium text-sm bg-transparent border-b border-primary outline-none w-full min-w-0"
              />
            ) : (
              <button
                onClick={() => { if (onRename && !disabled) { setEditName(room.name); setEditing(true) } }}
                className={`font-medium text-sm text-left truncate ${disabled ? '' : 'hover:underline decoration-dotted cursor-text'}`}
                title={disabled ? undefined : 'Cliquer pour renommer'}
              >
                {room.name}
              </button>
            )}
          </div>
          <Badge variant={room.demanding ? 'warning' : 'secondary'} className="text-xs ml-2 shrink-0">
            {room.demanding ? 'Demande' : 'OK'}
          </Badge>
        </div>

        {/* Temperature display */}
        <div>
          <div className={`text-2xl font-bold ${tempColor(room.actualTemperature)}`}>
            {formatTemp(room.actualTemperature)}
          </div>
          <div className="text-xs text-muted-foreground">
            Consigne : {formatTemp(room.targetTemperature)}
            <span className={`ml-2 ${delta > 0 ? 'text-orange-500' : delta < 0 ? 'text-blue-500' : ''}`}>
              ({delta >= 0 ? '+' : ''}{delta.toFixed(1)}°C)
            </span>
            {propagating && (
              <span className="ml-2 inline-flex items-center gap-1 text-primary animate-pulse">
                <span className="inline-block h-2 w-2 animate-spin border border-primary border-t-transparent rounded-full" />
                envoi…
              </span>
            )}
          </div>
        </div>

        {/* Temperature slider */}
        {onTemperatureChange && (
          <div className={`space-y-2${disabled ? ' opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Consigne</span>
              <span className="text-xs font-mono font-medium">{effectiveTarget.toFixed(1)}°C</span>
            </div>
            <Slider
              value={[effectiveTarget]}
              onValueChange={([v]) => { setSliderTemp(v); setConfirm(false) }}
              min={15}
              max={28}
              step={0.5}
              disabled={disabled}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>15°C</span>
              <span>28°C</span>
            </div>
            {sliderTemp !== null && sliderTemp !== room.targetTemperature && (
              <div className="space-y-1">
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleApply} disabled={pending || disabled}>
                    {confirm ? 'Confirmer ?' : 'Appliquer'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setSliderTemp(null); setConfirm(false); setApplyError(false) }}>
                    Annuler
                  </Button>
                </div>
                {applyError && (
                  <p className="text-xs text-destructive">Échec — contrôleur injoignable</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Battery + signal */}
        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">🔋</span>
            <BatteryIcon level={room.batteryLevel} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">📶</span>
            <SignalIcon strength={room.signalStrength} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
