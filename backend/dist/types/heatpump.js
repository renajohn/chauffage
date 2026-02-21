"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WRITABLE_PARAMS = exports.OPERATION_MODES = void 0;
exports.OPERATION_MODES = {
    0: 'Automatique',
    1: '2nde source',
    2: 'Fête',
    3: 'Vacances',
    4: 'Off',
};
exports.WRITABLE_PARAMS = {
    heating_target_temperature: { min: -10, max: 10, type: 'temperature' },
    warmwater_target_temperature: { min: 30, max: 65, type: 'temperature' },
    heating_operation_mode: { min: 0, max: 4, type: 'mode' },
    warmwater_operation_mode: { min: 0, max: 4, type: 'mode' },
};
//# sourceMappingURL=heatpump.js.map