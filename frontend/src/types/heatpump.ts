export interface Temperatures {
  outdoor: number
  outdoorAvg24h: number
  heatingFlow: number
  heatingReturn: number
  heatingReturnTarget: number
  hotWater: number
  sourceIn: number
  sourceOut: number
  hotGas: number
}

export interface SystemOutputs {
  compressor: boolean
  heatingPump: boolean
  brinePump: boolean
  hotWaterValve: boolean
  recirculationPump: boolean
  defrostValve: boolean
}

export interface OperatingState {
  mode: string
  heatingMode: number
  hotWaterMode: number
  heatingTargetTemp: number
  hotWaterTargetTemp: number
}

export interface RuntimeStats {
  compressorHours: number
  heatingHours: number
  hotWaterHours: number
  totalHours: number
  compressorImpulses: number
  heatingEnergy: number
  hotWaterEnergy: number
  totalEnergy: number
}

export interface ErrorEntry {
  timestamp: string
  code: string
  description: string
}

export interface Pressures {
  high: number
  low: number
}

export interface HeatPumpData {
  timestamp: string
  connected: boolean
  temperatures: Temperatures
  outputs: SystemOutputs
  operatingState: OperatingState
  runtime: RuntimeStats
  errors: ErrorEntry[]
  pressures: Pressures
}

export const OPERATION_MODES: Record<number, string> = {
  0: 'Automatique',
  1: '2nde source',
  2: 'Fête',
  3: 'Vacances',
  4: 'Off',
}
