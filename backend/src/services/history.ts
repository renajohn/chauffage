import fs from 'fs';
import path from 'path';
import { getCachedData } from './luxtronik';
import { getCachedRoomsData } from './nussbaum';
import type { HistoryPoint } from '../types/heatpump';

const DATA_DIR = path.join(__dirname, '../../data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'history-settings.json');
const SAMPLE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

let history: HistoryPoint[] = [];
let sampleTimer: NodeJS.Timeout | null = null;
let enabled = true;

// Load history from disk at startup
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch { /* exists */ }

try {
  const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  enabled = settings.enabled !== false;
} catch { /* default enabled */ }

try {
  history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  // Purge stale points on load
  const cutoff = Date.now() - MAX_AGE_MS;
  history = history.filter((p) => p.timestamp > cutoff);
  console.log(`[History] ${history.length} points chargés depuis le disque`);
} catch {
  // No file yet
}

function saveToDisk(): void {
  fs.writeFile(HISTORY_FILE, JSON.stringify(history), (err) => {
    if (err) console.error('[History] Erreur sauvegarde:', err);
  });
}

function sample(): void {
  const pac = getCachedData();
  if (!pac) return; // PAC not connected yet

  // Only sample when PAC is in floor heating mode (not ECS/hot water)
  const mode = pac.operatingState.mode;
  if (mode === 'Eau chaude' || mode === 'Piscine' || mode === 'Dégivrage') {
    console.log(`[History] Échantillon ignoré (mode: ${mode})`);
    return;
  }

  const rooms = getCachedRoomsData();

  let avgRoomTemp: number | null = null;
  let avgRoomTarget: number | null = null;

  if (rooms && rooms.rooms.length > 0) {
    const sumActual = rooms.rooms.reduce((s, r) => s + r.actualTemperature, 0);
    const sumTarget = rooms.rooms.reduce((s, r) => s + r.targetTemperature, 0);
    avgRoomTemp = Math.round((sumActual / rooms.rooms.length) * 10) / 10;
    avgRoomTarget = Math.round((sumTarget / rooms.rooms.length) * 10) / 10;
  }

  const point: HistoryPoint = {
    timestamp: Date.now(),
    outdoorTemp: pac.temperatures.outdoor,
    returnTemp: pac.temperatures.heatingReturn,
    returnTarget: pac.temperatures.heatingReturnTarget,
    flowTemp: pac.temperatures.heatingFlow,
    avgRoomTemp,
    avgRoomTarget,
  };

  // Purge points older than 24h
  const cutoff = Date.now() - MAX_AGE_MS;
  history = history.filter((p) => p.timestamp > cutoff);

  history.push(point);
  saveToDisk();
  console.log(`[History] Échantillon enregistré (${history.length} points, outdoor=${point.outdoorTemp}°C)`);
}

function stopSampling(): void {
  if (sampleTimer) {
    clearInterval(sampleTimer);
    sampleTimer = null;
    console.log('[History] Échantillonnage arrêté');
  }
}

export function startHistorySampling(): void {
  if (!enabled) {
    console.log('[History] Collecte désactivée, échantillonnage non démarré');
    return;
  }
  // Take first sample immediately
  sample();
  sampleTimer = setInterval(sample, SAMPLE_INTERVAL_MS);
  console.log(`[History] Échantillonnage démarré (intervalle: ${SAMPLE_INTERVAL_MS / 1000}s)`);
}

export function getHistoryEnabled(): boolean {
  return enabled;
}

export function setHistoryEnabled(v: boolean): void {
  enabled = v;
  fs.writeFile(SETTINGS_FILE, JSON.stringify({ enabled }), (err) => {
    if (err) console.error('[History] Erreur sauvegarde settings:', err);
  });
  if (enabled) {
    if (!sampleTimer) {
      sample();
      sampleTimer = setInterval(sample, SAMPLE_INTERVAL_MS);
      console.log('[History] Échantillonnage repris');
    }
  } else {
    stopSampling();
  }
}

export function getHistory(): HistoryPoint[] {
  return history;
}
