import { useState } from 'react'
import { useHeatPump } from '@/hooks/useHeatPump'
import { Dashboard } from '@/components/Dashboard'
import { HeatingCurvePage } from '@/components/HeatingCurvePage'
import { Badge } from '@/components/ui/badge'

type Tab = 'dashboard' | 'curve'

export default function App() {
  const { data, roomsData, roomsStale, wsConnected, error, sendControl, setRoomTemperature, renameRoom, resetErrors } = useHeatPump()
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="w-6 h-6">
              <path d="M16 3L2 15h4v13h20V15h4L16 3z" fill="#2563eb"/>
              <path d="M12 17c0-2 2-3 2-5s-2-3-2-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
              <path d="M16 17c0-2 2-3 2-5s-2-3-2-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
              <path d="M20 17c0-2 2-3 2-5s-2-3-2-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
            </svg>
            <div>
              <h1 className="text-lg font-bold">Chauffage</h1>
              <p className="text-xs text-muted-foreground">PAC géothermique + Nussbaum Therm-Control</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <Badge variant="destructive">{error}</Badge>
            )}
            <Badge variant={wsConnected ? 'success' : 'warning'}>
              {wsConnected ? 'Connecté' : 'Déconnecté'}
            </Badge>
            {roomsData && (
              <Badge variant={roomsData.connected ? 'success' : 'destructive'} className="text-xs">
                NB {roomsData.connected ? 'OK' : 'HS'}
              </Badge>
            )}
            {data && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {new Date(data.timestamp).toLocaleTimeString('fr-FR')}
              </span>
            )}
          </div>
        </div>
        {/* Tab navigation */}
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px">
            <button
              onClick={() => setTab('dashboard')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'dashboard'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              Tableau de bord
            </button>
            <button
              onClick={() => setTab('curve')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'curve'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              Courbe de chauffe
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {!data ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-3">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-muted-foreground">Connexion à la pompe à chaleur...</p>
            </div>
          </div>
        ) : tab === 'dashboard' ? (
          <Dashboard
            data={data}
            onControl={sendControl}
            roomsData={roomsData}
            roomsStale={roomsStale}
            onRoomTemperature={setRoomTemperature}
            onRenameRoom={renameRoom}
            onResetErrors={resetErrors}
          />
        ) : (
          <HeatingCurvePage
            data={data}
            roomsData={roomsData}
            onControl={sendControl}
          />
        )}
      </main>
    </div>
  )
}
