export interface NussbaumRoom {
  id: number;
  name: string;
  controllerId: 'rez' | 'etage';
  controllerName: string;
  actualTemperature: number;
  targetTemperature: number;
  batteryLevel: number;       // 0-3 brut, converti en %
  signalStrength: number;     // 0-3 brut
  demanding: boolean;         // calculé: actual < target (chauffage) ou > (refroid.)
}

export interface ControllerStatus {
  id: 'rez' | 'etage';
  name: string;
  host: string;
  connected: boolean;
  cooling: boolean;
  diagnose: number;           // 0-1, indicateur Vorlauf
  errors: string[];
}

export interface DemandSummary {
  totalRooms: number;
  demandingRooms: number;
  maxDelta: number;
  maxDeltaRoom: string;
}

export interface RoomsData {
  timestamp: string;
  connected: boolean;
  controllers: ControllerStatus[];
  rooms: NussbaumRoom[];
  cooling: boolean;
  demand: DemandSummary;
}
