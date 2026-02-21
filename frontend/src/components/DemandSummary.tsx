import { Badge } from '@/components/ui/badge'
import type { DemandSummary as DemandSummaryType } from '@/types/nussbaum'

interface DemandSummaryProps {
  demand: DemandSummaryType
}

export function DemandSummary({ demand }: DemandSummaryProps) {
  const variant = demand.demandingRooms === 0
    ? 'success'
    : demand.demandingRooms <= 2
    ? 'warning'
    : 'destructive'

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Badge variant={variant}>
        {demand.demandingRooms}/{demand.totalRooms} en demande
      </Badge>
      {demand.demandingRooms > 0 && demand.maxDeltaRoom && (
        <span className="text-xs text-muted-foreground">
          Max {demand.maxDelta.toFixed(1)}°C ({demand.maxDeltaRoom})
        </span>
      )}
    </div>
  )
}
