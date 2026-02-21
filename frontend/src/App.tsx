import { useHeatPump } from '@/hooks/useHeatPump'
import { Dashboard } from '@/components/Dashboard'
import { Badge } from '@/components/ui/badge'

export default function App() {
  const { data, wsConnected, error, sendControl } = useHeatPump()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🌍</span>
            <div>
              <h1 className="text-lg font-bold">Alpha Innotec</h1>
              <p className="text-xs text-muted-foreground">Pompe à chaleur géothermique</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <Badge variant="destructive">{error}</Badge>
            )}
            <Badge variant={wsConnected ? 'success' : 'warning'}>
              {wsConnected ? 'Connecté' : 'Déconnecté'}
            </Badge>
            {data && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {new Date(data.timestamp).toLocaleTimeString('fr-FR')}
              </span>
            )}
          </div>
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
        ) : (
          <Dashboard data={data} onControl={sendControl} />
        )}
      </main>
    </div>
  )
}
