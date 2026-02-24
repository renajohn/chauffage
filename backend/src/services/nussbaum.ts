import fs from 'fs';
import path from 'path';
import { config } from '../config';
import type { NussbaumRoom, ControllerStatus, DemandSummary, RoomsData } from '../types/nussbaum';

// Persistent data directory (volume-mounted in Docker)
const DATA_DIR = path.join(__dirname, '../../data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* exists */ }

// Persistent label overrides file
const LABELS_FILE = path.join(DATA_DIR, 'room-labels.json');

// Persistent rooms data cache file
const CACHE_FILE = path.join(DATA_DIR, 'rooms-cache.json');

function loadLabels(): Record<string, Record<string, string>> {
  try {
    return JSON.parse(fs.readFileSync(LABELS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveLabels(labels: Record<string, Record<string, string>>): void {
  fs.writeFileSync(LABELS_FILE, JSON.stringify(labels, null, 2));
}

/** Get label override for a room, or null if none */
function getLabelOverride(controllerId: string, roomId: number): string | null {
  const labels = loadLabels();
  return labels[controllerId]?.[String(roomId)] ?? null;
}

export function setRoomLabel(controllerId: string, roomId: number, name: string): void {
  const labels = loadLabels();
  if (!labels[controllerId]) labels[controllerId] = {};
  labels[controllerId][String(roomId)] = name;
  saveLabels(labels);
}

export function getAllLabels(): Record<string, Record<string, string>> {
  return loadLabels();
}

// Controller configuration
const CONTROLLERS = [
  {
    id: 'rez' as const,
    name: 'Rez-de-chaussée',
    host: config.nussbaum.rez.host,
  },
  {
    id: 'etage' as const,
    name: 'Étage',
    host: config.nussbaum.etage.host,
  },
];

// XSRF token cache per host
const xsrfCache = new Map<string, string>();

// Cached rooms data (initialized from disk cache if available)
let cachedRoomsData: RoomsData | null = null;
let pollTimer: NodeJS.Timeout | null = null;

// Load disk cache at startup
try {
  cachedRoomsData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  console.log(`[Nussbaum] Cache disque chargé (${cachedRoomsData!.rooms.length} pièces, ${cachedRoomsData!.timestamp})`);
} catch {
  // No cache file yet, that's fine
}

function saveCache(data: RoomsData): void {
  fs.writeFile(CACHE_FILE, JSON.stringify(data), (err) => {
    if (err) console.error('[Nussbaum] Erreur sauvegarde cache:', err);
  });
}

/**
 * Fetch XSRF token from a controller by loading its homepage
 */
async function fetchXsrfToken(host: string): Promise<string> {
  const url = `http://${host}/`;
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });

  // Try getSetCookie() first, then fall back to get('set-cookie')
  let cookieStrings: string[] = [];
  if (typeof res.headers.getSetCookie === 'function') {
    cookieStrings = res.headers.getSetCookie();
  }
  if (cookieStrings.length === 0) {
    const raw = res.headers.get('set-cookie');
    if (raw) cookieStrings = [raw];
  }

  for (const cookie of cookieStrings) {
    const match = cookie.match(/XSRF-TOKEN=([^;]+)/);
    if (match) {
      const token = decodeURIComponent(match[1]);
      xsrfCache.set(host, token);
      return token;
    }
  }
  throw new Error(`No XSRF token in response from ${host}`);
}

/**
 * Get cached XSRF token or fetch a new one
 */
async function getXsrfToken(host: string): Promise<string> {
  const cached = xsrfCache.get(host);
  if (cached) return cached;
  return fetchXsrfToken(host);
}

/**
 * Make an authenticated GET request to a controller
 */
async function controllerGet(host: string, path: string): Promise<any> {
  const token = await getXsrfToken(host);
  const url = `http://${host}${path}`;
  const res = await fetch(url, {
    headers: {
      'X-XSRF-TOKEN': token,
      'Cookie': `XSRF-TOKEN=${encodeURIComponent(token)}`,
    },
    signal: AbortSignal.timeout(30_000),
  });

  // If 403, refresh token and retry once
  if (res.status === 403) {
    const newToken = await fetchXsrfToken(host);
    const retryRes = await fetch(url, {
      headers: {
        'X-XSRF-TOKEN': newToken,
        'Cookie': `XSRF-TOKEN=${encodeURIComponent(newToken)}`,
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!retryRes.ok) throw new Error(`HTTP ${retryRes.status} from ${url}`);
    return retryRes.json();
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

/**
 * Make an authenticated POST request to a controller (form-encoded)
 */
async function controllerPost(host: string, path: string, body: string, contentType = 'application/x-www-form-urlencoded'): Promise<any> {
  const token = await getXsrfToken(host);
  const url = `http://${host}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'X-XSRF-TOKEN': token,
      'Cookie': `XSRF-TOKEN=${encodeURIComponent(token)}`,
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });

  // If 403, refresh token and retry once
  if (res.status === 403) {
    const newToken = await fetchXsrfToken(host);
    const retryRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'X-XSRF-TOKEN': newToken,
        'Cookie': `XSRF-TOKEN=${encodeURIComponent(newToken)}`,
      },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    if (!retryRes.ok) throw new Error(`HTTP ${retryRes.status} from ${url}`);
    const retryText = await retryRes.text();
    return retryText ? JSON.parse(retryText) : null;
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Convert battery/signal level (0-3) to percentage
 */
function levelToPercent(level: number): number {
  switch (level) {
    case 0: return 0;
    case 1: return 33;
    case 2: return 66;
    case 3: return 100;
    default: return 0;
  }
}

/**
 * Read rooms and settings from a single controller
 */
async function readController(ctrl: typeof CONTROLLERS[number], cooling: boolean): Promise<{
  rooms: NussbaumRoom[];
  status: ControllerStatus;
}> {
  const [roomsRes, settingsRes] = await Promise.all([
    controllerGet(ctrl.host, '/api/rooms/'),
    controllerGet(ctrl.host, '/api/settings/'),
  ]);

  const isCooling = settingsRes.cooling ?? cooling;
  const diagnose = settingsRes.diagnose ?? 0;
  const errors: string[] = settingsRes.errors ?? [];

  const rooms: NussbaumRoom[] = [];
  const roomList = Array.isArray(roomsRes) ? roomsRes : (roomsRes.rooms ?? []);

  for (const room of roomList) {
    const id = room.id;
    const name = getLabelOverride(ctrl.id, id) || room.name || `Pièce ${id}`;
    const actual = room.actualTemperature ?? 0;
    const target = room.temperature ?? 0;  // API uses "temperature" for target

    // Demanding: in heating mode, actual < target; in cooling mode, actual > target
    const demanding = isCooling
      ? actual > target
      : actual < target;

    rooms.push({
      id,
      name,
      controllerId: ctrl.id,
      controllerName: ctrl.name,
      actualTemperature: actual,
      targetTemperature: target,
      batteryLevel: levelToPercent(room.thermostatBatteryLevel ?? 0),
      signalStrength: room.thermostatSignalStrength ?? 0,
      demanding,
    });
  }

  return {
    rooms,
    status: {
      id: ctrl.id,
      name: ctrl.name,
      host: ctrl.host,
      connected: true,
      cooling: isCooling,
      diagnose,
      errors,
    },
  };
}

/**
 * Build demand summary from rooms
 */
function buildDemandSummary(rooms: NussbaumRoom[], cooling: boolean): DemandSummary {
  let maxDelta = 0;
  let maxDeltaRoom = '';
  let demandingRooms = 0;

  for (const room of rooms) {
    if (room.demanding) demandingRooms++;
    const delta = cooling
      ? room.actualTemperature - room.targetTemperature
      : room.targetTemperature - room.actualTemperature;
    if (delta > maxDelta) {
      maxDelta = delta;
      maxDeltaRoom = room.name;
    }
  }

  return {
    totalRooms: rooms.length,
    demandingRooms,
    maxDelta: Math.round(maxDelta * 10) / 10,
    maxDeltaRoom,
  };
}

/**
 * Poll all controllers and build RoomsData
 */
async function pollAll(): Promise<RoomsData> {
  const results = await Promise.allSettled(
    CONTROLLERS.map((ctrl) => readController(ctrl, false))
  );

  const allRooms: NussbaumRoom[] = [];
  const allControllers: ControllerStatus[] = [];
  let anyCooling = false;
  let anyConnected = false;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const ctrl = CONTROLLERS[i];

    if (result.status === 'fulfilled') {
      allRooms.push(...result.value.rooms);
      allControllers.push(result.value.status);
      anyConnected = true;
      if (result.value.status.cooling) anyCooling = true;
    } else {
      console.error(`[Nussbaum] Erreur lecture ${ctrl.name} (${ctrl.host}):`, result.reason);
      allControllers.push({
        id: ctrl.id,
        name: ctrl.name,
        host: ctrl.host,
        connected: false,
        cooling: false,
        diagnose: 0,
        errors: [String(result.reason)],
      });

      // Keep last known rooms from cache for this controller
      if (cachedRoomsData) {
        const staleRooms = cachedRoomsData.rooms.filter((r) => r.controllerId === ctrl.id);
        if (staleRooms.length > 0) {
          console.log(`[Nussbaum] ${ctrl.name} hors-ligne, conservation de ${staleRooms.length} pièces du cache`);
          allRooms.push(...staleRooms);
        }
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    connected: anyConnected,
    controllers: allControllers,
    rooms: allRooms,
    cooling: anyCooling,
    demand: buildDemandSummary(allRooms, anyCooling),
  };
}

/**
 * Start polling Nussbaum controllers
 */
export function startNussbaumPolling(onUpdate: (data: RoomsData) => void): void {
  const poll = async () => {
    try {
      cachedRoomsData = await pollAll();
      saveCache(cachedRoomsData);
      console.log(`[Nussbaum] ${cachedRoomsData.rooms.length} pièces, ${cachedRoomsData.demand.demandingRooms} en demande`);
      onUpdate(cachedRoomsData);
    } catch (err) {
      console.error('[Nussbaum] Erreur polling:', err);
    }
  };

  // Poll immediately, then at interval
  poll();
  pollTimer = setInterval(poll, config.nussbaum.pollIntervalMs);
}

/**
 * Get cached rooms data
 */
export function getCachedRoomsData(): RoomsData | null {
  return cachedRoomsData;
}

/**
 * Set cooling mode on a specific controller
 */
export async function setCoolingMode(controllerId: 'rez' | 'etage', cooling: boolean): Promise<void> {
  const ctrl = CONTROLLERS.find((c) => c.id === controllerId);
  if (!ctrl) throw new Error(`Contrôleur inconnu: ${controllerId}`);

  // Read current settings first
  const settings = await controllerGet(ctrl.host, '/api/settings/');

  // Build form data with all current settings, modifying cooling
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(settings)) {
    if (key === 'cooling') {
      params.set(key, cooling ? 'true' : 'false');
    } else {
      params.set(key, String(value));
    }
  }

  await controllerPost(ctrl.host, '/api/settings/update/', params.toString());
  console.log(`[Nussbaum] ${ctrl.name}: cooling = ${cooling}`);
}

/**
 * Set room target temperature
 */
export async function setRoomTemperature(
  controllerId: 'rez' | 'etage',
  roomId: number,
  temperature: number
): Promise<void> {
  const ctrl = CONTROLLERS.find((c) => c.id === controllerId);
  if (!ctrl) throw new Error(`Contrôleur inconnu: ${controllerId}`);

  // Fetch current room data to get all fields
  const rooms = await controllerGet(ctrl.host, '/api/rooms/');
  const roomList = Array.isArray(rooms) ? rooms : (rooms.rooms ?? []);
  const room = roomList.find((r: any) => r.id === roomId);
  if (!room) throw new Error(`Pièce ${roomId} introuvable sur ${ctrl.name}`);

  // Update temperature and POST full room object (Nussbaum API requires this)
  room.temperature = temperature;
  room.changed = 1;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(room)) {
    params.set(key, value == null ? '' : String(value));
  }

  await controllerPost(ctrl.host, `/api/base-stations/${room.baseStation}/rooms/${roomId}/update/`, params.toString());
  console.log(`[Nussbaum] ${ctrl.name} pièce ${roomId}: consigne = ${temperature}°C (propagation ~30-60s)`);
}

export function stopNussbaumPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
