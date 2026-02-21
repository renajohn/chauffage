import { useMemo } from 'react'
import type { HistoryPoint } from '@/types/heatpump'
import { generateCurvePoints } from '@/lib/heatingCurve'

interface HeatingCurveChartProps {
  // Preview values (from sliders)
  endPoint: number
  parallelOffset: number
  deltaReduction: number
  // Saved values (from PAC)
  savedEndPoint: number
  savedParallelOffset: number
  // Current operating point
  outdoorTemp: number
  returnTemp: number
  returnTarget: number
  // History
  history: HistoryPoint[]
  // Show saved curve as reference?
  showSavedCurve: boolean
}

// Chart dimensions in viewBox coordinates
const W = 600
const H = 400
const PAD = { top: 30, right: 30, bottom: 50, left: 55 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

// Axis ranges
const X_MIN = -20
const X_MAX = 25
const Y_MIN = 15
const Y_MAX = 70

function scaleX(v: number): number {
  return PAD.left + ((v - X_MIN) / (X_MAX - X_MIN)) * PLOT_W
}
function scaleY(v: number): number {
  return PAD.top + PLOT_H - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H
}

export function HeatingCurveChart({
  endPoint,
  parallelOffset,
  deltaReduction,
  savedEndPoint,
  savedParallelOffset,
  outdoorTemp,
  returnTemp,
  returnTarget,
  history,
  showSavedCurve,
}: HeatingCurveChartProps) {
  const previewPoints = useMemo(
    () => generateCurvePoints(endPoint, parallelOffset, X_MIN, X_MAX),
    [endPoint, parallelOffset],
  )

  const reducedPoints = useMemo(
    () => generateCurvePoints(endPoint - deltaReduction, parallelOffset - deltaReduction, X_MIN, X_MAX),
    [endPoint, parallelOffset, deltaReduction],
  )

  const savedPoints = useMemo(
    () => showSavedCurve ? generateCurvePoints(savedEndPoint, savedParallelOffset, X_MIN, X_MAX) : [],
    [savedEndPoint, savedParallelOffset, showSavedCurve],
  )

  const previewPath = pointsToPath(previewPoints)
  const reducedPath = pointsToPath(reducedPoints)
  const savedPath = showSavedCurve ? pointsToPath(savedPoints) : ''

  // Grid lines every 5°C
  const xGridLines = []
  for (let x = X_MIN; x <= X_MAX; x += 5) xGridLines.push(x)
  const yGridLines = []
  for (let y = Y_MIN; y <= Y_MAX; y += 5) yGridLines.push(y)

  // Clamp operating point for display
  const opX = Math.max(X_MIN, Math.min(X_MAX, outdoorTemp))
  const opTargetY = Math.max(Y_MIN, Math.min(Y_MAX, returnTarget))
  const opActualY = Math.max(Y_MIN, Math.min(Y_MAX, returnTemp))
  const delta = returnTemp - returnTarget
  const deltaColor = Math.abs(delta) < 1 ? '#22c55e' : Math.abs(delta) < 2 ? '#eab308' : '#ef4444'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="bg-card rounded-lg border">
      {/* Grid */}
      {xGridLines.map(x => (
        <line key={`gx${x}`} x1={scaleX(x)} x2={scaleX(x)} y1={PAD.top} y2={PAD.top + PLOT_H}
          stroke="currentColor" strokeOpacity={0.08} />
      ))}
      {yGridLines.map(y => (
        <line key={`gy${y}`} x1={PAD.left} x2={PAD.left + PLOT_W} y1={scaleY(y)} y2={scaleY(y)}
          stroke="currentColor" strokeOpacity={0.08} />
      ))}

      {/* Zero line */}
      <line x1={scaleX(0)} x2={scaleX(0)} y1={PAD.top} y2={PAD.top + PLOT_H}
        stroke="currentColor" strokeOpacity={0.2} strokeDasharray="4,4" />

      {/* Axes */}
      <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={PAD.top + PLOT_H} y2={PAD.top + PLOT_H}
        stroke="currentColor" strokeOpacity={0.3} />
      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + PLOT_H}
        stroke="currentColor" strokeOpacity={0.3} />

      {/* X-axis labels */}
      {xGridLines.filter((_, i) => i % 2 === 0 || xGridLines.length <= 10).map(x => (
        <text key={`lx${x}`} x={scaleX(x)} y={PAD.top + PLOT_H + 18}
          textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.5}>
          {x}°
        </text>
      ))}
      <text x={PAD.left + PLOT_W / 2} y={H - 5}
        textAnchor="middle" fontSize={12} fill="currentColor" opacity={0.6}>
        Température extérieure (°C)
      </text>

      {/* Y-axis labels */}
      {yGridLines.filter((_, i) => i % 2 === 0).map(y => (
        <text key={`ly${y}`} x={PAD.left - 8} y={scaleY(y) + 4}
          textAnchor="end" fontSize={11} fill="currentColor" opacity={0.5}>
          {y}°
        </text>
      ))}
      <text x={15} y={PAD.top + PLOT_H / 2}
        textAnchor="middle" fontSize={12} fill="currentColor" opacity={0.6}
        transform={`rotate(-90, 15, ${PAD.top + PLOT_H / 2})`}>
        Temp. cible (°C)
      </text>

      {/* History scatter points */}
      {history.map((p, i) => {
        const px = scaleX(Math.max(X_MIN, Math.min(X_MAX, p.outdoorTemp)))
        const py = scaleY(Math.max(Y_MIN, Math.min(Y_MAX, p.returnTemp)))
        return (
          <circle key={`h${i}`} cx={px} cy={py} r={3}
            fill="#6366f1" fillOpacity={0.3} stroke="#6366f1" strokeOpacity={0.5} strokeWidth={0.5} />
        )
      })}

      {/* Saved curve (grey dashed) */}
      {showSavedCurve && savedPath && (
        <path d={savedPath} fill="none" stroke="#9ca3af" strokeWidth={2} strokeDasharray="6,4" />
      )}

      {/* Reduced curve (dashed) */}
      {deltaReduction !== 0 && (
        <path d={reducedPath} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,4" opacity={0.6} />
      )}

      {/* Preview curve (main blue) */}
      <path d={previewPath} fill="none" stroke="#3b82f6" strokeWidth={2.5} />

      {/* Target operating point */}
      <circle cx={scaleX(opX)} cy={scaleY(opTargetY)} r={6}
        fill="#3b82f6" stroke="white" strokeWidth={2} />

      {/* Actual operating point */}
      <circle cx={scaleX(opX)} cy={scaleY(opActualY)} r={5}
        fill={deltaColor} stroke="white" strokeWidth={1.5} />

      {/* Delta line between target and actual */}
      {Math.abs(delta) > 0.3 && (
        <line x1={scaleX(opX)} x2={scaleX(opX)} y1={scaleY(opTargetY)} y2={scaleY(opActualY)}
          stroke={deltaColor} strokeWidth={1.5} strokeDasharray="2,2" />
      )}

      {/* Legend */}
      <g transform={`translate(${PAD.left + 10}, ${PAD.top + 10})`}>
        <line x1={0} x2={20} y1={0} y2={0} stroke="#3b82f6" strokeWidth={2.5} />
        <text x={25} y={4} fontSize={10} fill="currentColor" opacity={0.7}>Courbe preview</text>
        {deltaReduction !== 0 && (
          <>
            <line x1={0} x2={20} y1={16} y2={16} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,4" />
            <text x={25} y={20} fontSize={10} fill="currentColor" opacity={0.7}>Mode réduit</text>
          </>
        )}
        {showSavedCurve && (
          <>
            <line x1={0} x2={20} y1={deltaReduction !== 0 ? 32 : 16} y2={deltaReduction !== 0 ? 32 : 16}
              stroke="#9ca3af" strokeWidth={2} strokeDasharray="6,4" />
            <text x={25} y={deltaReduction !== 0 ? 36 : 20} fontSize={10} fill="currentColor" opacity={0.7}>
              Courbe PAC
            </text>
          </>
        )}
      </g>
    </svg>
  )
}

function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  return points
    .map((p, i) => {
      const sx = scaleX(Math.max(X_MIN, Math.min(X_MAX, p.x)))
      const sy = scaleY(Math.max(Y_MIN, Math.min(Y_MAX, p.y)))
      return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`
    })
    .join(' ')
}
