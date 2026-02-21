import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { InfoTooltip } from './InfoTooltip'
import { OPERATION_MODES } from '@/types/heatpump'
import type { OperatingState } from '@/types/heatpump'

interface ControlPanelProps {
  state: OperatingState
  onControl: (parameter: string, value: number) => Promise<unknown>
}

function formatOffset(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}°C`
}

export function ControlPanel({ state, onControl }: ControlPanelProps) {
  const [heatingTemp, setHeatingTemp] = useState<number | null>(null)
  const [hotWaterTemp, setHotWaterTemp] = useState<number | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ param: string; value: number; label: string } | null>(null)

  const effectiveHeatingTemp = heatingTemp ?? state.heatingTargetTemp
  const effectiveHotWaterTemp = hotWaterTemp ?? state.hotWaterTargetTemp

  async function handleSend(param: string, value: number, label: string) {
    if (!confirm || confirm.param !== param) {
      setConfirm({ param, value, label })
      return
    }
    setPending(param)
    setConfirm(null)
    try {
      await onControl(param, value)
      if (param === 'heating_target_temperature') setHeatingTemp(null)
      if (param === 'warmwater_target_temperature') setHotWaterTemp(null)
    } finally {
      setPending(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span>🎛️</span> Contrôles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Heating mode */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">Mode chauffage</span>
            <InfoTooltip paramKey="heatingMode" />
          </div>
          <Select
            value={String(state.heatingMode)}
            onValueChange={(v) => handleSend('heating_operation_mode', Number(v), `Mode chauffage → ${OPERATION_MODES[Number(v)]}`)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(OPERATION_MODES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hot water mode */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">Mode eau chaude</span>
            <InfoTooltip paramKey="hotWaterMode" />
          </div>
          <Select
            value={String(state.hotWaterMode)}
            onValueChange={(v) => handleSend('warmwater_operation_mode', Number(v), `Mode ECS → ${OPERATION_MODES[Number(v)]}`)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(OPERATION_MODES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Heating target temperature (parallel offset: -10 to +10°C) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">Décalage chauffage</span>
              <InfoTooltip paramKey="heatingTargetTemp" />
            </div>
            <span className="text-sm font-mono font-bold">{formatOffset(effectiveHeatingTemp)}</span>
          </div>
          <Slider
            value={[effectiveHeatingTemp]}
            onValueChange={([v]) => setHeatingTemp(v)}
            min={-10}
            max={10}
            step={0.5}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>-10°C</span>
            <span>0</span>
            <span>+10°C</span>
          </div>
          {heatingTemp !== null && heatingTemp !== state.heatingTargetTemp && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleSend('heating_target_temperature', heatingTemp, `Décalage chauffage → ${formatOffset(heatingTemp)}`)}
                disabled={pending === 'heating_target_temperature'}
              >
                {confirm?.param === 'heating_target_temperature' ? 'Confirmer ?' : 'Appliquer'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setHeatingTemp(null); setConfirm(null) }}>
                Annuler
              </Button>
            </div>
          )}
        </div>

        {/* Hot water target temperature */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">Consigne ECS</span>
              <InfoTooltip paramKey="hotWaterTargetTemp" />
            </div>
            <span className="text-sm font-mono font-bold">{effectiveHotWaterTemp.toFixed(1)}°C</span>
          </div>
          <Slider
            value={[effectiveHotWaterTemp]}
            onValueChange={([v]) => setHotWaterTemp(v)}
            min={30}
            max={65}
            step={0.5}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>30°C</span>
            <span>65°C</span>
          </div>
          {hotWaterTemp !== null && hotWaterTemp !== state.hotWaterTargetTemp && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleSend('warmwater_target_temperature', hotWaterTemp, `Consigne ECS → ${hotWaterTemp.toFixed(1)}°C`)}
                disabled={pending === 'warmwater_target_temperature'}
              >
                {confirm?.param === 'warmwater_target_temperature' ? 'Confirmer ?' : 'Appliquer'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setHotWaterTemp(null); setConfirm(null) }}>
                Annuler
              </Button>
            </div>
          )}
        </div>

        {confirm && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            Cliquez à nouveau pour confirmer : <strong>{confirm.label}</strong>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
