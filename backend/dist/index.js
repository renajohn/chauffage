"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const config_1 = require("./config");
const luxtronik_1 = require("./services/luxtronik");
const handler_1 = require("./websocket/handler");
const data_1 = __importDefault(require("./routes/data"));
const controls_1 = __importDefault(require("./routes/controls"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Middleware
app.use((0, cors_1.default)({ origin: config_1.config.server.corsOrigin }));
app.use(express_1.default.json());
// Routes
app.use('/api', data_1.default);
app.use('/api', controls_1.default);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// WebSocket
(0, handler_1.setupWebSocket)(server);
// Init PAC connection and start polling
(0, luxtronik_1.initLuxtronik)();
(0, luxtronik_1.startPolling)((data) => {
    (0, handler_1.broadcastData)(data);
});
// Start server
server.listen(config_1.config.server.port, () => {
    console.log(`[Server] Backend démarré sur http://localhost:${config_1.config.server.port}`);
    console.log(`[Server] PAC: ${config_1.config.pac.host}:${config_1.config.pac.port}`);
    console.log(`[Server] Polling: ${config_1.config.polling.intervalMs}ms`);
});
//# sourceMappingURL=index.js.map