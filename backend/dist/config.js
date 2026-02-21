"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    pac: {
        host: process.env.PAC_HOST || '192.168.86.28',
        port: parseInt(process.env.PAC_PORT || '8889', 10),
        password: process.env.PAC_PASSWORD || '999999',
    },
    server: {
        port: parseInt(process.env.PORT || '3001', 10),
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    },
    polling: {
        intervalMs: parseInt(process.env.POLL_INTERVAL || '10000', 10),
    },
};
//# sourceMappingURL=config.js.map