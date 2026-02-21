import { WebSocketServer } from 'ws';
import { Server } from 'http';
import { HeatPumpData } from '../types/heatpump';
export declare function setupWebSocket(server: Server): WebSocketServer;
export declare function broadcastData(data: HeatPumpData): void;
//# sourceMappingURL=handler.d.ts.map