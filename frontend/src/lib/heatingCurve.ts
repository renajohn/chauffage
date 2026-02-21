import type { HeatingCurve, HistoryPoint } from '@/types/heatpump'
import type { NussbaumRoom } from '@/types/nussbaum'

/**
 * Calculate target return temperature from outdoor temperature using
 * a power-law curve (like real Luxtronik controllers):
 *   +20°C outdoor → parallelOffset (foot of curve)
 *   -15°C outdoor → endPoint (end of curve)
 *
 * The exponent (~1.4) gives the characteristic concave shape:
 * steeper at low outdoor temps, flatter near +20°C.
 */
const CURVE_EXPONENT = 1.4

export function calculateCurveTemp(
  outdoorTemp: number,
  endPoint: number,
  parallelOffset: number,
): number {
  // t goes from 0 (at +20°C) to 1 (at -15°C)
  const t = Math.max(0, (20 - outdoorTemp) / 35)
  return parallelOffset + (endPoint - parallelOffset) * Math.pow(t, CURVE_EXPONENT)
}

export interface CurvePoint {
  x: number // outdoor temp
  y: number // target return temp
}

export function generateCurvePoints(
  endPoint: number,
  parallelOffset: number,
  xMin: number = -20,
  xMax: number = 25,
  step: number = 0.5,
): CurvePoint[] {
  const points: CurvePoint[] = []
  for (let x = xMin; x <= xMax; x += step) {
    points.push({ x, y: calculateCurveTemp(x, endPoint, parallelOffset) })
  }
  return points
}

export interface Recommendation {
  recommendation: string
  suggestedEndPoint: number
  suggestedParallelOffset: number
  confidence: 'high' | 'medium' | 'low'
  details: string
}

export function analyzeAndRecommend(
  history: HistoryPoint[],
  rooms: NussbaumRoom[],
  currentCurve: HeatingCurve,
  desiredRoomTemp: number,
): Recommendation {
  const { endPoint, parallelOffset } = currentCurve

  // Not enough data
  if (history.length < 3 && rooms.length === 0) {
    return {
      recommendation: 'Pas assez de données pour une recommandation. Attendez quelques heures de fonctionnement.',
      suggestedEndPoint: endPoint,
      suggestedParallelOffset: parallelOffset,
      confidence: 'low',
      details: `${history.length} point(s) d'historique disponible(s).`,
    }
  }

  // Calculate average room delta from desired temperature
  let avgRoomDelta = 0
  if (rooms.length > 0) {
    const totalDelta = rooms.reduce((sum, r) => sum + (r.actualTemperature - desiredRoomTemp), 0)
    avgRoomDelta = totalDelta / rooms.length
  } else if (history.length > 0) {
    // Fall back to history avgRoomTemp
    const withRoom = history.filter(h => h.avgRoomTemp !== null)
    if (withRoom.length > 0) {
      avgRoomDelta = withRoom.reduce((sum, h) => sum + (h.avgRoomTemp! - desiredRoomTemp), 0) / withRoom.length
    }
  }

  const confidence: 'high' | 'medium' | 'low' =
    history.length >= 72 ? 'high' : history.length >= 12 ? 'medium' : 'low'

  // Well adapted
  if (Math.abs(avgRoomDelta) < 0.5) {
    return {
      recommendation: `La courbe actuelle semble bien adaptée. Écart moyen : ${avgRoomDelta >= 0 ? '+' : ''}${avgRoomDelta.toFixed(1)}°C.`,
      suggestedEndPoint: endPoint,
      suggestedParallelOffset: parallelOffset,
      confidence,
      details: `Température moyenne des pièces proche de la consigne (${desiredRoomTemp}°C). Aucun ajustement nécessaire.`,
    }
  }

  // Analyze correlation with outdoor temperature
  let coldWeatherDelta = avgRoomDelta
  let mildWeatherDelta = avgRoomDelta
  if (history.length >= 6) {
    const cold = history.filter(h => h.outdoorTemp < 0 && h.avgRoomTemp !== null)
    const mild = history.filter(h => h.outdoorTemp >= 5 && h.avgRoomTemp !== null)
    if (cold.length >= 2) {
      coldWeatherDelta = cold.reduce((s, h) => s + (h.avgRoomTemp! - desiredRoomTemp), 0) / cold.length
    }
    if (mild.length >= 2) {
      mildWeatherDelta = mild.reduce((s, h) => s + (h.avgRoomTemp! - desiredRoomTemp), 0) / mild.length
    }
  }

  // Correction factor (proportional, clamped)
  const correction = Math.min(Math.max(-avgRoomDelta * 1.5, -5), 5)

  let suggestedEndPoint = endPoint
  let suggestedParallelOffset = parallelOffset
  let recommendation = ''
  let details = ''

  if (avgRoomDelta < -0.5) {
    // Too cold
    const coldBias = Math.abs(coldWeatherDelta) > Math.abs(mildWeatherDelta) + 0.5
    if (coldBias) {
      // Worse in cold weather → increase end point
      suggestedEndPoint = round1(endPoint - correction) // correction is positive here
      recommendation = `Vos pièces sont en moyenne ${Math.abs(avgRoomDelta).toFixed(1)}°C en dessous de la consigne, surtout par temps froid. On recommande d'augmenter la fin de courbe de ${endPoint.toFixed(0)}→${suggestedEndPoint.toFixed(0)}°C.`
      details = `Écart par temps froid : ${coldWeatherDelta.toFixed(1)}°C, par temps doux : ${mildWeatherDelta.toFixed(1)}°C. L'augmentation de la fin de courbe améliore le chauffage par grand froid.`
    } else {
      // Constant deficit → increase parallel offset
      suggestedParallelOffset = round1(parallelOffset - correction)
      recommendation = `Vos pièces sont en moyenne ${Math.abs(avgRoomDelta).toFixed(1)}°C en dessous de la consigne. On recommande d'augmenter le pied de courbe de ${parallelOffset.toFixed(0)}→${suggestedParallelOffset.toFixed(0)}°C.`
      details = `Écart constant quelle que soit la température extérieure. Le pied de courbe décale toute la courbe vers le haut.`
    }
  } else {
    // Too hot
    const hotBias = Math.abs(mildWeatherDelta) > Math.abs(coldWeatherDelta) + 0.5
    if (hotBias) {
      suggestedParallelOffset = round1(parallelOffset - correction) // correction is negative here
      recommendation = `Vos pièces sont en moyenne ${avgRoomDelta.toFixed(1)}°C au-dessus de la consigne, surtout par temps doux. On recommande de baisser le pied de courbe de ${parallelOffset.toFixed(0)}→${suggestedParallelOffset.toFixed(0)}°C.`
      details = `Surchauffe plus prononcée par temps doux. Le pied de courbe réduit la température en mi-saison.`
    } else {
      suggestedEndPoint = round1(endPoint - correction)
      recommendation = `Vos pièces sont en moyenne ${avgRoomDelta.toFixed(1)}°C au-dessus de la consigne. On recommande de baisser la fin de courbe de ${endPoint.toFixed(0)}→${suggestedEndPoint.toFixed(0)}°C.`
      details = `Surchauffe globale. La fin de courbe réduit la puissance par temps froid.`
    }
  }

  return {
    recommendation,
    suggestedEndPoint,
    suggestedParallelOffset,
    confidence,
    details,
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}
