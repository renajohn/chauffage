import type { HeatPumpData } from '@/types/heatpump'
import { TemperatureCard } from './TemperatureCard'
import { SystemStatus } from './SystemStatus'
import { OperatingModes } from './OperatingModes'
import { ControlPanel } from './ControlPanel'
import { RuntimeStats } from './RuntimeStats'
import { ErrorLog } from './ErrorLog'

interface DashboardProps {
  data: HeatPumpData
  onControl: (parameter: string, value: number) => Promise<unknown>
}

export function Dashboard({ data, onControl }: DashboardProps) {
  const { temperatures: t, outputs, operatingState, runtime, errors, pressures } = data

  const temperatureCards = [
    { key: 'outdoor', label: 'Extérieure', value: t.outdoor, icon: '🌡️' },
    { key: 'outdoorAvg24h', label: 'Moy. ext. 24h', value: t.outdoorAvg24h, icon: '📊' },
    { key: 'heatingFlow', label: 'Départ chauffage', value: t.heatingFlow, icon: '↗️' },
    { key: 'heatingReturn', label: 'Retour chauffage', value: t.heatingReturn, icon: '↙️', target: t.heatingReturnTarget },
    { key: 'heatingReturnTarget', label: 'Consigne retour', value: t.heatingReturnTarget, icon: '🎯' },
    { key: 'hotWater', label: 'Eau chaude (ECS)', value: t.hotWater, icon: '🚿', target: operatingState.hotWaterTargetTemp },
    { key: 'sourceIn', label: 'Source entrée', value: t.sourceIn, icon: '⬇️' },
    { key: 'sourceOut', label: 'Source sortie', value: t.sourceOut, icon: '⬆️' },
    { key: 'hotGas', label: 'Gaz chaud', value: t.hotGas, icon: '🔥' },
  ]

  return (
    <div className="space-y-8">
      {/* Section 1: Températures */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Températures</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {temperatureCards.map((card) => (
            <TemperatureCard
              key={card.key}
              paramKey={card.key}
              label={card.label}
              value={card.value}
              icon={card.icon}
              target={card.target}
            />
          ))}
        </div>
      </section>

      {/* Section 2 & 3: État + Modes + Contrôles */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SystemStatus outputs={outputs} mode={operatingState.mode} pressures={pressures} />
          <OperatingModes state={operatingState} />
          <ControlPanel state={operatingState} onControl={onControl} />
        </div>
      </section>

      {/* Section 4 & 5: Stats + Erreurs */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RuntimeStats stats={runtime} />
          <ErrorLog errors={errors} />
        </div>
      </section>
    </div>
  )
}
