import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { HeatPumpData } from '../types/heatpump';
import { RoomsData } from '../types/nussbaum';
import { getCachedData } from '../services/luxtronik';
import { getCachedRoomsData } from '../services/nussbaum';

type WsMessage =
  | { type: 'heatpump'; data: HeatPumpData }
  | { type: 'rooms'; data: RoomsData };

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] Client connecté');

    // Send cached data immediately so the client doesn't wait for next poll
    const cachedHeatpump = getCachedData();
    if (cachedHeatpump) {
      ws.send(JSON.stringify({ type: 'heatpump', data: cachedHeatpump }));
    }
    const cachedRooms = getCachedRoomsData();
    if (cachedRooms) {
      ws.send(JSON.stringify({ type: 'rooms', data: cachedRooms }));
    }

    ws.on('close', () => {
      console.log('[WS] Client déconnecté');
    });

    ws.on('error', (err) => {
      console.error('[WS] Erreur:', err.message);
    });
  });

  console.log('[WS] WebSocket server prêt');
  return wss;
}

function broadcast(message: WsMessage): void {
  if (!wss) return;

  const json = JSON.stringify(message);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

export function broadcastData(data: HeatPumpData): void {
  broadcast({ type: 'heatpump', data });
}

export function broadcastRoomsData(data: RoomsData): void {
  broadcast({ type: 'rooms', data });
}
