import { config } from '../config';
import { HeatPumpData, ErrorEntry } from '../types/heatpump';

// luxtronik2 is a CommonJS module without types
const luxtronik = require('luxtronik2');

let connection: any = null;
let cachedData: HeatPumpData | null = null;
let pollTimer: NodeJS.Timeout | null = null;

function isOn(value: unknown): boolean {
  if (typeof value === 'string') return value === 'on';
  return Boolean(value);
}

function parseData(rawData: any): HeatPumpData {
  const values = rawData.values || {};
  const parameters = rawData.parameters || {};

  // Parse errors from the raw data
  const errors: ErrorEntry[] = [];
  if (values.errors) {
    const errArr = Array.isArray(values.errors) ? values.errors : [];
    for (const err of errArr.slice(0, 5)) {
      if (err) {
        errors.push({
          timestamp: err.timestamp || new Date().toISOString(),
          code: String(err.code || err),
          description: err.message || err.description || `Erreur ${err.code || err}`,
        });
      }
    }
  }

  // Operating state - use the string directly from luxtronik2 if available
  const modeString = values.heatpump_state_string
    || values.opStateHeatingString
    || getOperatingModeString(values.opStateHeating);

  return {
    timestamp: new Date().toISOString(),
    connected: true,
    temperatures: {
      outdoor: values.temperature_outside ?? 0,
      outdoorAvg24h: values.temperature_outside_avg ?? 0,
      heatingFlow: values.temperature_supply ?? 0,
      heatingReturn: values.temperature_return ?? 0,
      heatingReturnTarget: values.temperature_target_return ?? 0,
      hotWater: values.temperature_hot_water ?? 0,
      sourceIn: values.temperature_heat_source_in ?? 0,
      sourceOut: values.temperature_heat_source_out ?? 0,
      hotGas: values.temperature_hot_gas ?? 0,
    },
    outputs: {
      compressor: isOn(values.compressor1),
      heatingPump: isOn(values.heatingSystemCircPump) || isOn(values.HUPout),
      brinePump: isOn(values.VBOout) || isOn(values.sourceSystemCircPump),
      hotWaterValve: isOn(values.BUPout) || isOn(values.hotWaterSystemCircPump),
      recirculationPump: isOn(values.ZUPout) || isOn(values.hotWaterRecircPump),
      defrostValve: isOn(values.AVout),
    },
    operatingState: {
      mode: modeString,
      heatingMode: parameters.heating_operation_mode ?? 0,
      hotWaterMode: parameters.warmwater_operation_mode ?? 0,
      heatingTargetTemp: parameters.heating_temperature ?? parameters.heating_target_temperature ?? 0,
      hotWaterTargetTemp: parameters.warmwater_temperature ?? parameters.temperature_hot_water_target ?? 0,
    },
    runtime: {
      compressorHours: values.hours_compressor1 ?? 0,
      heatingHours: values.hours_heating ?? values.hours_heatpump ?? 0,
      hotWaterHours: values.hours_hot_water ?? 0,
      totalHours: values.hours_heatpump ?? values.hours_compressor1 ?? 0,
      compressorImpulses: values.starts_compressor1 ?? 0,
      heatingEnergy: values.energy_heating ?? 0,
      hotWaterEnergy: values.energy_hot_water ?? 0,
      totalEnergy: (values.energy_heating ?? 0) + (values.energy_hot_water ?? 0),
    },
    errors,
    pressures: {
      high: values.HDin_pressure ?? 0,
      low: values.NDin_pressure ?? 0,
    },
  };
}

function getOperatingModeString(state: number | undefined): string {
  switch (state) {
    case 0: return 'Chauffage';
    case 1: return 'Eau chaude';
    case 2: return 'Piscine';
    case 3: return 'Dégivrage';
    case 4: return 'Repos';
    case 5: return 'Erreur';
    case 6: return 'Refroidissement';
    default: return 'Inconnu';
  }
}

export function initLuxtronik(): void {
  const { host, port } = config.pac;
  console.log(`[Luxtronik] Connexion à ${host}:${port}...`);
  connection = luxtronik.createConnection(host, port);
}

export function startPolling(onUpdate: (data: HeatPumpData) => void): void {
  const poll = () => {
    if (!connection) {
      console.error('[Luxtronik] Pas de connexion');
      return;
    }

    connection.read((err: Error | null, data: any) => {
      if (err) {
        console.error('[Luxtronik] Erreur lecture:', err.message);
        cachedData = {
          timestamp: new Date().toISOString(),
          connected: false,
          temperatures: { outdoor: 0, outdoorAvg24h: 0, heatingFlow: 0, heatingReturn: 0, heatingReturnTarget: 0, hotWater: 0, sourceIn: 0, sourceOut: 0, hotGas: 0 },
          outputs: { compressor: false, heatingPump: false, brinePump: false, hotWaterValve: false, recirculationPump: false, defrostValve: false },
          operatingState: { mode: 'Erreur connexion', heatingMode: 0, hotWaterMode: 0, heatingTargetTemp: 0, hotWaterTargetTemp: 0 },
          runtime: { compressorHours: 0, heatingHours: 0, hotWaterHours: 0, totalHours: 0, compressorImpulses: 0, heatingEnergy: 0, hotWaterEnergy: 0, totalEnergy: 0 },
          errors: [],
          pressures: { high: 0, low: 0 },
        };
        onUpdate(cachedData);
        return;
      }

      cachedData = parseData(data);
      console.log(`[Luxtronik] Données reçues - Ext: ${cachedData.temperatures.outdoor}°C, Mode: ${cachedData.operatingState.mode}`);
      onUpdate(cachedData);
    });
  };

  // First poll immediately
  poll();
  pollTimer = setInterval(poll, config.polling.intervalMs);
}

export function getCachedData(): HeatPumpData | null {
  return cachedData;
}

export function writeParameter(param: string, value: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!connection) {
      reject(new Error('Pas de connexion à la PAC'));
      return;
    }

    console.log(`[Luxtronik] Écriture: ${param} = ${value}`);
    connection.write(param, value, (err: Error | null) => {
      if (err) {
        console.error(`[Luxtronik] Erreur écriture ${param}:`, err.message);
        reject(err);
        return;
      }
      console.log(`[Luxtronik] ${param} mis à jour: ${value}`);
      resolve();
    });
  });
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
