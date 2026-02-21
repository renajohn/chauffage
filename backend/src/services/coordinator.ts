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

  // Skip if no change
  if (lastPacCooling === isCooling) return;

  const wasNull = lastPacCooling === null;
  lastPacCooling = isCooling;

  if (wasNull) {
    console.log(`[Coordinator] Sync initiale: cooling = ${isCooling}`);
  } else {
    console.log(`[Coordinator] Transition PAC: cooling ${!isCooling} → ${isCooling}`);
  }

  // Sync both controllers (including on first poll)
  Promise.all([
    setCoolingMode('rez', isCooling),
    setCoolingMode('etage', isCooling),
  ]).then(() => {
    console.log(`[Coordinator] Nussbaum synchronisé: cooling = ${isCooling}`);
  }).catch((err) => {
    console.error('[Coordinator] Erreur synchronisation cooling:', err);
  });
}
