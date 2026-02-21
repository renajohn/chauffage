import type { HeatPumpData } from '../types/heatpump';
import { setCoolingMode } from './nussbaum';

let lastPacCooling: boolean | null = null;

/**
 * Check if PAC cooling mode changed and sync to Nussbaum controllers.
 * Called on every PAC poll update.
 */
export function checkCoolingSync(data: HeatPumpData): void {
  // Detect cooling mode from PAC operating state
  const isCooling = data.operatingState.mode === 'Refroidissement';

  // Skip if no change or first run
  if (lastPacCooling === isCooling) return;

  const wasNull = lastPacCooling === null;
  lastPacCooling = isCooling;

  // On first run, just record the state without sending commands
  if (wasNull) {
    console.log(`[Coordinator] État initial PAC: cooling = ${isCooling}`);
    return;
  }

  console.log(`[Coordinator] Transition PAC: cooling ${!isCooling} → ${isCooling}`);

  // Sync both controllers
  Promise.all([
    setCoolingMode('rez', isCooling),
    setCoolingMode('etage', isCooling),
  ]).then(() => {
    console.log(`[Coordinator] Nussbaum synchronisé: cooling = ${isCooling}`);
  }).catch((err) => {
    console.error('[Coordinator] Erreur synchronisation cooling:', err);
  });
}
