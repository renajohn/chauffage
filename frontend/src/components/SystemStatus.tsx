import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InfoTooltip } from './InfoTooltip'
import type { SystemOutputs, Pressures } from '@/types/heatpump'

interface SystemStatusProps {
  outputs: SystemOutputs
  mode: string
  pressures: Pressures
}

function StatusIndicator({ label, active, paramKey }: { label: string; active: boolean; paramKey: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5">
        <div className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-gray-300'}`} />
        <span className="text-sm">{label}</span>
        <InfoTooltip paramKey={paramKey} />
      </div>
      <Badge variant={active ? 'success' : 'secondary'} className="text-xs">
        {active ? 'ON' : 'OFF'}
      </Badge>
    </div>
  )
}

export function SystemStatus({ outputs, mode, pressures }: SystemStatusProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span>⚙️</span> État système
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-medium">Mode actuel :</span>
          <Badge variant={mode === 'Erreur' ? 'destructive' : mode === 'Repos' ? 'secondary' : 'default'}>
            {mode}
          </Badge>
        </div>

        <StatusIndicator label="Compresseur (VD1)" active={outputs.compressor} paramKey="compressor" />
        <StatusIndicator label="Pompe chauffage (HUP)" active={outputs.heatingPump} paramKey="heatingPump" />
        <StatusIndicator label="Pompe saumure (VBO)" active={outputs.brinePump} paramKey="brinePump" />
        <StatusIndicator label="Vanne ECS (BUP)" active={outputs.hotWaterValve} paramKey="hotWaterValve" />
        <StatusIndicator label="Pompe bouclage (ZUP)" active={outputs.recirculationPump} paramKey="recirculationPump" />
        <StatusIndicator label="Vanne dégivrage (AV)" active={outputs.defrostValve} paramKey="defrostValve" />

        {(pressures.high > 0 || pressures.low > 0) && (
          <div className="border-t pt-3 mt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">Pression haute (HD)</span>
                <InfoTooltip paramKey="pressureHigh" />
              </div>
              <span className="text-sm font-mono">{pressures.high.toFixed(1)} bar</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">Pression basse (ND)</span>
                <InfoTooltip paramKey="pressureLow" />
              </div>
              <span className="text-sm font-mono">{pressures.low.toFixed(1)} bar</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
