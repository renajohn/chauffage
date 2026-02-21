import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import { initLuxtronik, startPolling } from './services/luxtronik';
import { startNussbaumPolling } from './services/nussbaum';
import { checkCoolingSync } from './services/coordinator';
import { setupWebSocket, broadcastData, broadcastRoomsData } from './websocket/handler';
import dataRoutes from './routes/data';
import controlsRoutes from './routes/controls';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: config.server.corsOrigin }));
app.use(express.json());

// Routes
app.use('/api', dataRoutes);
app.use('/api', controlsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket
setupWebSocket(server);

// Init PAC connection and start polling
initLuxtronik();
startPolling((data) => {
  broadcastData(data);
  checkCoolingSync(data);
});

// Start Nussbaum polling
startNussbaumPolling((data) => {
  broadcastRoomsData(data);
});

// Start server
server.listen(config.server.port, () => {
  console.log(`[Server] Backend démarré sur http://localhost:${config.server.port}`);
  console.log(`[Server] PAC: ${config.pac.host}:${config.pac.port}`);
  console.log(`[Server] Polling PAC: ${config.polling.intervalMs}ms`);
  console.log(`[Server] Nussbaum Rez: ${config.nussbaum.rez.host}`);
  console.log(`[Server] Nussbaum Étage: ${config.nussbaum.etage.host}`);
  console.log(`[Server] Polling Nussbaum: ${config.nussbaum.pollIntervalMs}ms`);
});
