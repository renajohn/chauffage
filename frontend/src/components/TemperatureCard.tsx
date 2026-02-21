import { Card, CardContent } from '@/components/ui/card'
import { InfoTooltip } from './InfoTooltip'
import { formatTemp, tempColor } from '@/lib/utils'

interface TemperatureCardProps {
  paramKey: string
  label: string
  value: number
  icon: string
  target?: number
}

export function TemperatureCard({ paramKey, label, value, icon, target }: TemperatureCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{icon}</span>
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
          </div>
          <InfoTooltip paramKey={paramKey} />
        </div>
        <div className={`text-2xl font-bold ${tempColor(value)}`}>
          {formatTemp(value)}
        </div>
        {target !== undefined && (
          <div className="text-xs text-muted-foreground mt-1">
            Consigne : {formatTemp(target)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
