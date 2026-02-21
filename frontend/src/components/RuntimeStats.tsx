import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { InfoTooltip } from './InfoTooltip'
import { formatHours, formatEnergy, formatNumber } from '@/lib/utils'
import type { RuntimeStats as RuntimeStatsType } from '@/types/heatpump'

interface RuntimeStatsProps {
  stats: RuntimeStatsType
}

function StatRow({ label, value, paramKey }: { label: string; value: string; paramKey?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        {paramKey && <InfoTooltip paramKey={paramKey} />}
      </div>
      <span className="text-sm font-mono font-medium">{value}</span>
    </div>
  )
}

export function RuntimeStats({ stats }: RuntimeStatsProps) {
  const avgRuntime = stats.compressorImpulses > 0
    ? (stats.compressorHours / stats.compressorImpulses).toFixed(1)
    : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span>📊</span> Statistiques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Heures de fonctionnement
        </h4>
        <StatRow label="Compresseur" value={formatHours(stats.compressorHours)} paramKey="compressorHours" />
        <StatRow label="Chauffage" value={formatHours(stats.heatingHours)} />
        <StatRow label="Eau chaude" value={formatHours(stats.hotWaterHours)} />
        <StatRow label="Total PAC" value={formatHours(stats.totalHours)} />

        <div className="border-t pt-3 mt-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Compresseur
          </h4>
          <StatRow label="Impulsions (démarrages)" value={formatNumber(stats.compressorImpulses)} paramKey="compressorImpulses" />
          {avgRuntime && (
            <StatRow label="Durée moy. par cycle" value={`${avgRuntime} h`} />
          )}
        </div>

        {(stats.heatingEnergy > 0 || stats.hotWaterEnergy > 0) && (
          <div className="border-t pt-3 mt-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Énergie produite
            </h4>
            <StatRow label="Chauffage" value={formatEnergy(stats.heatingEnergy)} />
            <StatRow label="Eau chaude" value={formatEnergy(stats.hotWaterEnergy)} />
            <StatRow label="Total" value={formatEnergy(stats.totalEnergy)} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
