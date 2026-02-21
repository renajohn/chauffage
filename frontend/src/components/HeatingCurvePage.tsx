import { useState, useEffect, useMemo, useCallback } from 'react'
import type { HeatPumpData, HistoryPoint } from '@/types/heatpump'
import type { RoomsData } from '@/types/nussbaum'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { InfoTooltip } from './InfoTooltip'
import { HeatingCurveChart } from './HeatingCurveChart'
import { analyzeAndRecommend, calculateCurveTemp } from '@/lib/heatingCurve'

interface HeatingCurvePageProps {
  data: HeatPumpData
  roomsData: RoomsData | null
  onControl: (parameter: string, value: number) => Promise<unknown>
}

export function HeatingCurvePage({ data, roomsData, onControl }: HeatingCurvePageProps) {
  const { heatingCurve, temperatures } = data
  const saved = heatingCurve

  // Local slider state (null = using saved value)
  const [endPoint, setEndPoint] = useState<number | null>(null)
  const [parallelOffset, setParallelOffset] = useState<number | null>(null)
  const [deltaReduction, setDeltaReduction] = useState<number | null>(null)
  const [desiredTemp, setDesiredTemp] = useState(21)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [historyEnabled, setHistoryEnabled] = useState(true)
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState(false)

  const effectiveEndPoint = endPoint ?? saved.endPoint
  const effectiveParallelOffset = parallelOffset ?? saved.parallelOffset
  const effectiveDelta = deltaReduction ?? saved.deltaReduction

  const hasChanges = endPoint !== null || parallelOffset !== null || deltaReduction !== null
  const showSavedCurve = hasChanges && (
    effectiveEndPoint !== saved.endPoint || effectiveParallelOffset !== saved.parallelOffset
  )

  // Fetch history on mount and periodically
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history')
      if (res.ok) {
        setHistory(await res.json())
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchHistory()
    const interval = setInterval(fetchHistory, 60_000)
    return () => clearInterval(interval)
  }, [fetchHistory])

  // Fetch history settings
  useEffect(() => {
    fetch('/api/history/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setHistoryEnabled(d.enabled) })
      .catch(() => {})
  }, [])

  async function toggleHistoryEnabled() {
    const next = !historyEnabled
    setHistoryEnabled(next)
    try {
      const res = await fetch('/api/history/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (res.ok) {
        const d = await res.json()
        setHistoryEnabled(d.enabled)
      }
    } catch { /* ignore */ }
  }

  // Set default desired temp from room averages
  useEffect(() => {
    if (roomsData?.rooms?.length) {
      const avgTarget = roomsData.rooms.reduce((s, r) => s + r.targetTemperature, 0) / roomsData.rooms.length
      setDesiredTemp(Math.round(avgTarget * 2) / 2)
    }
  }, [roomsData?.rooms?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recommendation
  const recommendation = useMemo(
    () => analyzeAndRecommend(
      history,
      roomsData?.rooms ?? [],
      saved,
      desiredTemp,
    ),
    [history, roomsData?.rooms, saved, desiredTemp],
  )

  function applyRecommendation() {
    if (recommendation.suggestedEndPoint !== saved.endPoint) {
      setEndPoint(recommendation.suggestedEndPoint)
    }
    if (recommendation.suggestedParallelOffset !== saved.parallelOffset) {
      setParallelOffset(recommendation.suggestedParallelOffset)
    }
  }

  function cancelChanges() {
    setEndPoint(null)
    setParallelOffset(null)
    setDeltaReduction(null)
    setConfirm(false)
  }

  async function applyChanges() {
    if (!confirm) {
      setConfirm(true)
      return
    }
    setPending(true)
    setConfirm(false)
    try {
      const promises: Promise<unknown>[] = []
      if (endPoint !== null && endPoint !== saved.endPoint) {
        promises.push(onControl('heating_curve_end_point', endPoint))
      }
      if (parallelOffset !== null && parallelOffset !== saved.parallelOffset) {
        promises.push(onControl('heating_curve_parallel_offset', parallelOffset))
      }
      if (deltaReduction !== null && deltaReduction !== saved.deltaReduction) {
        promises.push(onControl('deltaHeatingReduction', deltaReduction))
      }
      await Promise.all(promises)
      setEndPoint(null)
      setParallelOffset(null)
      setDeltaReduction(null)
    } finally {
      setPending(false)
    }
  }

  // Current operating point info
  const curveTarget = calculateCurveTemp(temperatures.outdoor, effectiveEndPoint, effectiveParallelOffset)
  const returnDelta = temperatures.heatingReturn - temperatures.heatingReturnTarget

  const confidenceLabel = {
    high: 'Confiance élevée',
    medium: 'Confiance moyenne',
    low: 'Peu de données',
  }
  const confidenceColor = {
    high: 'text-green-600',
    medium: 'text-yellow-600',
    low: 'text-muted-foreground',
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Chart area */}
      <div className="flex-1 min-w-0">
        <HeatingCurveChart
          endPoint={effectiveEndPoint}
          parallelOffset={effectiveParallelOffset}
          deltaReduction={effectiveDelta}
          savedEndPoint={saved.endPoint}
          savedParallelOffset={saved.parallelOffset}
          outdoorTemp={temperatures.outdoor}
          returnTemp={temperatures.heatingReturn}
          returnTarget={temperatures.heatingReturnTarget}
          history={history}
          showSavedCurve={showSavedCurve}
        />
        <div className="flex items-center justify-center gap-3 mt-2">
          <p className="text-xs text-muted-foreground">
            {history.length} point(s) d'historique ({Math.round(history.length * 10 / 60)}h de données)
          </p>
          <button
            onClick={toggleHistoryEnabled}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className={`inline-block w-7 h-4 rounded-full relative transition-colors ${historyEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${historyEnabled ? 'left-3.5' : 'left-0.5'}`} />
            </span>
            Collecte
          </button>
        </div>
      </div>

      {/* Side panel */}
      <div className="w-full lg:w-80 space-y-4 flex-shrink-0">
        {/* Recommendation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Assistant de recommandation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">Temp. ambiante souhaitée</span>
                <InfoTooltip paramKey="desiredRoomTemp" />
              </div>
              <div className="flex items-center gap-3">
                <Slider
                  value={[desiredTemp]}
                  onValueChange={([v]) => setDesiredTemp(v)}
                  min={18}
                  max={25}
                  step={0.5}
                  className="flex-1"
                />
                <span className="text-sm font-mono font-bold w-14 text-right">{desiredTemp.toFixed(1)}°C</span>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-sm space-y-2">
              <p>{recommendation.recommendation}</p>
              {recommendation.details && (
                <p className="text-xs text-muted-foreground">{recommendation.details}</p>
              )}
              <p className={`text-xs ${confidenceColor[recommendation.confidence]}`}>
                {confidenceLabel[recommendation.confidence]}
              </p>
            </div>

            {(recommendation.suggestedEndPoint !== saved.endPoint ||
              recommendation.suggestedParallelOffset !== saved.parallelOffset) && (
              <Button size="sm" variant="outline" className="w-full" onClick={applyRecommendation}>
                Appliquer la recommandation
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Manual controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Réglages manuels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* End point */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">Fin de courbe</span>
                  <InfoTooltip paramKey="heatingCurveEndPoint" />
                </div>
                <span className="text-sm font-mono font-bold">{effectiveEndPoint.toFixed(1)}°C</span>
              </div>
              <Slider
                value={[effectiveEndPoint]}
                onValueChange={([v]) => setEndPoint(v)}
                min={20}
                max={70}
                step={0.5}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>20°C</span>
                <span>70°C</span>
              </div>
            </div>

            {/* Parallel offset */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">Pied de courbe</span>
                  <InfoTooltip paramKey="heatingCurveParallelOffset" />
                </div>
                <span className="text-sm font-mono font-bold">{effectiveParallelOffset.toFixed(1)}°C</span>
              </div>
              <Slider
                value={[effectiveParallelOffset]}
                onValueChange={([v]) => setParallelOffset(v)}
                min={5}
                max={35}
                step={0.5}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5°C</span>
                <span>35°C</span>
              </div>
            </div>

            {/* Delta reduction */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">Abaissement nuit</span>
                  <InfoTooltip paramKey="heatingCurveDeltaReduction" />
                </div>
                <span className="text-sm font-mono font-bold">{effectiveDelta.toFixed(1)}°C</span>
              </div>
              <Slider
                value={[effectiveDelta]}
                onValueChange={([v]) => setDeltaReduction(v)}
                min={-15}
                max={10}
                step={0.5}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>-15°C</span>
                <span>+10°C</span>
              </div>
            </div>

            {hasChanges && (
              <div className="space-y-2">
                {confirm && (
                  <div className="rounded-md bg-yellow-50 border border-yellow-200 p-2 text-xs text-yellow-800">
                    Cliquez à nouveau pour confirmer l'envoi à la PAC.
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={applyChanges} disabled={pending} className="flex-1">
                    {pending ? 'Envoi...' : confirm ? 'Confirmer ?' : 'Appliquer'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelChanges} disabled={pending}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Infos en direct</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Temp. extérieure</span>
              <span className="font-mono">{temperatures.outdoor.toFixed(1)}°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consigne calculée</span>
              <span className="font-mono">{curveTarget.toFixed(1)}°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consigne PAC</span>
              <span className="font-mono">{temperatures.heatingReturnTarget.toFixed(1)}°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Retour réel</span>
              <span className="font-mono">{temperatures.heatingReturn.toFixed(1)}°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Écart retour</span>
              <span className={`font-mono font-bold ${
                Math.abs(returnDelta) < 1 ? 'text-green-600'
                  : Math.abs(returnDelta) < 2 ? 'text-yellow-600'
                  : 'text-red-600'
              }`}>
                {returnDelta >= 0 ? '+' : ''}{returnDelta.toFixed(1)}°C
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
