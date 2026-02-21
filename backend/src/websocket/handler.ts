import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { HeatPumpData } from '../types/heatpump';

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] Client connecté');

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

export function broadcastData(data: HeatPumpData): void {
  if (!wss) return;

  const message = JSON.stringify(data);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
