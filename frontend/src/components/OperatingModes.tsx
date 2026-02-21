import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InfoTooltip } from './InfoTooltip'
import { OPERATION_MODES } from '@/types/heatpump'
import { formatTemp } from '@/lib/utils'
import type { OperatingState } from '@/types/heatpump'

interface OperatingModesProps {
  state: OperatingState
}

export function OperatingModes({ state }: OperatingModesProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span>🔄</span> Modes de fonctionnement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">Chauffage</span>
              <InfoTooltip paramKey="heatingMode" />
            </div>
            <Badge variant={state.heatingMode === 4 ? 'secondary' : 'default'}>
              {OPERATION_MODES[state.heatingMode] ?? 'Inconnu'}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Consigne : {formatTemp(state.heatingTargetTemp)}
          </div>
        </div>

        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">Eau chaude</span>
              <InfoTooltip paramKey="hotWaterMode" />
            </div>
            <Badge variant={state.hotWaterMode === 4 ? 'secondary' : 'default'}>
              {OPERATION_MODES[state.hotWaterMode] ?? 'Inconnu'}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Consigne : {formatTemp(state.hotWaterTargetTemp)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
