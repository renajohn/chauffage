export const config = {
  pac: {
    host: process.env.PAC_HOST || '192.168.86.28',
    port: parseInt(process.env.PAC_PORT || '8889', 10),
    password: process.env.PAC_PASSWORD || '999999',
  },
  server: {
    port: parseInt(process.env.PORT || '3002', 10),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
  polling: {
    intervalMs: parseInt(process.env.POLL_INTERVAL || '10000', 10),
  },
};
