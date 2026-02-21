"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocket = setupWebSocket;
exports.broadcastData = broadcastData;
const ws_1 = require("ws");
let wss = null;
function setupWebSocket(server) {
    wss = new ws_1.WebSocketServer({ server });
    wss.on('connection', (ws) => {
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
function broadcastData(data) {
    if (!wss)
        return;
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(message);
        }
    });
}
//# sourceMappingURL=handler.js.map