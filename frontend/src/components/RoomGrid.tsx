import { Badge } from '@/components/ui/badge'
import { RoomCard } from './RoomCard'
import { DemandSummary } from './DemandSummary'
import type { RoomsData, ControllerStatus, NussbaumRoom } from '@/types/nussbaum'

interface RoomGridProps {
  roomsData: RoomsData
  onRoomTemperature?: (controllerId: 'rez' | 'etage', roomId: number, temperature: number) => Promise<void>
  onRename?: (controllerId: 'rez' | 'etage', roomId: number, name: string) => Promise<void>
}

function ControllerHeader({ status }: { status: ControllerStatus }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <h3 className="text-sm font-semibold">{status.name}</h3>
      <Badge variant={status.connected ? 'success' : 'destructive'} className="text-xs">
        {status.connected ? 'Connecté' : 'Hors-ligne'}
      </Badge>
      {status.cooling && (
        <Badge variant="default" className="text-xs">
          Refroidissement
        </Badge>
      )}
    </div>
  )
}

export function RoomGrid({ roomsData, onRoomTemperature, onRename }: RoomGridProps) {
  // Group rooms by controller, demanding first within each group
  const roomsByController = new Map<string, NussbaumRoom[]>()
  for (const room of roomsData.rooms) {
    const existing = roomsByController.get(room.controllerId) || []
    existing.push(room)
    roomsByController.set(room.controllerId, existing)
  }
  for (const [key, rooms] of roomsByController) {
    roomsByController.set(key, rooms.sort((a, b) => (b.demanding ? 1 : 0) - (a.demanding ? 1 : 0)))
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Zones de chauffage</h2>
        <DemandSummary demand={roomsData.demand} />
      </div>

      {roomsData.controllers.map((controller) => {
        const rooms = roomsByController.get(controller.id) || []
        return (
          <div key={controller.id} className="space-y-3">
            <ControllerHeader status={controller} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rooms.map((room) => (
                <RoomCard
                  key={`${room.controllerId}-${room.id}`}
                  room={room}
                  onTemperatureChange={onRoomTemperature}
                  onRename={onRename}
                />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
