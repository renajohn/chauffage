import type { HeatPumpData } from '@/types/heatpump'
import type { RoomsData } from '@/types/nussbaum'
import { TemperatureCard } from './TemperatureCard'
import { SystemStatus } from './SystemStatus'
import { OperatingModes } from './OperatingModes'
import { ControlPanel } from './ControlPanel'
import { RuntimeStats } from './RuntimeStats'
import { ErrorLog } from './ErrorLog'
import { RoomGrid } from './RoomGrid'

interface DashboardProps {
  data: HeatPumpData
  onControl: (parameter: string, value: number) => Promise<unknown>
  roomsData: RoomsData | null
  onRoomTemperature: (controllerId: 'rez' | 'etage', roomId: number, temperature: number) => Promise<void>
  onRenameRoom: (controllerId: 'rez' | 'etage', roomId: number, name: string) => Promise<void>
}

export function Dashboard({ data, onControl, roomsData, onRoomTemperature, onRenameRoom }: DashboardProps) {
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
      {/* Section 1: Zones de chauffage (Nussbaum) — en haut */}
      {roomsData ? (
        <RoomGrid roomsData={roomsData} onRoomTemperature={onRoomTemperature} onRename={onRenameRoom} />
      ) : (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Zones de chauffage</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span>Connexion aux thermostats Nussbaum...</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card shadow-sm p-4 space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-5 w-12 bg-muted rounded-full" />
                </div>
                <div className="h-8 w-20 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
                <div className="h-2 w-full bg-muted rounded-full" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 2: Températures PAC */}
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

      {/* Section 3: État + Modes + Contrôles */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SystemStatus outputs={outputs} mode={operatingState.mode} pressures={pressures} />
          <OperatingModes state={operatingState} />
          <ControlPanel state={operatingState} onControl={onControl} />
        </div>
      </section>

      {/* Section 4: Stats + Erreurs */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RuntimeStats stats={runtime} />
          <ErrorLog errors={errors} />
        </div>
      </section>
    </div>
  )
}
