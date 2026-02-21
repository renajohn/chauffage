import { HeatPumpData } from '../types/heatpump';
export declare function initLuxtronik(): void;
export declare function startPolling(onUpdate: (data: HeatPumpData) => void): void;
export declare function getCachedData(): HeatPumpData | null;
export declare function writeParameter(param: string, value: number): Promise<void>;
export declare function stopPolling(): void;
//# sourceMappingURL=luxtronik.d.ts.map