export interface Temperatures {
  outdoor: number;
  outdoorAvg24h: number;
  heatingFlow: number;        // Départ chauffage
  heatingReturn: number;      // Retour chauffage
  heatingReturnTarget: number; // Consigne retour
  hotWater: number;           // ECS (ballon)
  sourceIn: number;           // Saumure entrée (du sol)
  sourceOut: number;          // Saumure sortie (vers le sol)
  hotGas: number;             // Gaz chaud (refoulement)
}

export interface SystemOutputs {
  compressor: boolean;
  heatingPump: boolean;       // HUP - Pompe circulation chauffage
  brinePump: boolean;         // VBO - Pompe saumure
  hotWaterValve: boolean;     // BUP - Vanne eau chaude
  recirculationPump: boolean; // ZUP - Pompe de bouclage
  defrostValve: boolean;      // Vanne dégivrage
}

export interface OperatingState {
  mode: string;               // Mode actuel (chauffage, ECS, repos, erreur)
  heatingMode: number;        // 0=Auto, 1=2nde source, 2=Fête, 3=Vacances, 4=Off
  hotWaterMode: number;       // 0=Auto, 1=2nde source, 2=Fête, 3=Vacances, 4=Off
  heatingTargetTemp: number;
  hotWaterTargetTemp: number;
}

export interface RuntimeStats {
  compressorHours: number;
  heatingHours: number;
  hotWaterHours: number;
  totalHours: number;
  compressorImpulses: number;
  heatingEnergy: number;      // kWh
  hotWaterEnergy: number;     // kWh
  totalEnergy: number;        // kWh
}

export interface ErrorEntry {
  timestamp: string;
  code: string;
  description: string;
}

export interface Pressures {
  high: number;
  low: number;
}

export interface HeatingCurve {
  endPoint: number;
  parallelOffset: number;
  deltaReduction: number;
}

export interface HeatPumpData {
  timestamp: string;
  connected: boolean;
  temperatures: Temperatures;
  outputs: SystemOutputs;
  operatingState: OperatingState;
  runtime: RuntimeStats;
  errors: ErrorEntry[];
  pressures: Pressures;
  heatingCurve: HeatingCurve;
}

export interface HistoryPoint {
  timestamp: number;
  outdoorTemp: number;
  returnTemp: number;
  returnTarget: number;
  flowTemp: number;
  avgRoomTemp: number | null;
  avgRoomTarget: number | null;
}

export interface ControlParameter {
  parameter: string;
  value: number;
}

export const OPERATION_MODES: Record<number, string> = {
  0: 'Automatique',
  1: '2nde source',
  2: 'Fête',
  3: 'Vacances',
  4: 'Off',
};

export const WRITABLE_PARAMS: Record<string, { min: number; max: number; type: string }> = {
  heating_target_temperature: { min: -10, max: 10, type: 'temperature' },
  warmwater_target_temperature: { min: 30, max: 65, type: 'temperature' },
  heating_operation_mode: { min: 0, max: 4, type: 'mode' },
  warmwater_operation_mode: { min: 0, max: 4, type: 'mode' },
  heating_curve_end_point: { min: 20, max: 70, type: 'temperature' },
  heating_curve_parallel_offset: { min: 5, max: 35, type: 'temperature' },
  deltaHeatingReduction: { min: -15, max: 10, type: 'temperature' },
};
