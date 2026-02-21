"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const luxtronik_1 = require("../services/luxtronik");
const heatpump_1 = require("../types/heatpump");
const router = (0, express_1.Router)();
router.post('/controls', async (req, res) => {
    const { parameter, value } = req.body;
    if (!parameter || value === undefined || value === null) {
        res.status(400).json({ error: 'Paramètres "parameter" et "value" requis' });
        return;
    }
    const paramConfig = heatpump_1.WRITABLE_PARAMS[parameter];
    if (!paramConfig) {
        res.status(400).json({
            error: `Paramètre "${parameter}" non autorisé`,
            allowed: Object.keys(heatpump_1.WRITABLE_PARAMS),
        });
        return;
    }
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < paramConfig.min || numValue > paramConfig.max) {
        res.status(400).json({
            error: `Valeur hors plage pour "${parameter}"`,
            min: paramConfig.min,
            max: paramConfig.max,
            received: value,
        });
        return;
    }
    try {
        await (0, luxtronik_1.writeParameter)(parameter, numValue);
        res.json({ success: true, parameter, value: numValue });
    }
    catch (err) {
        console.error('[Controls] Erreur écriture:', err);
        res.status(500).json({ error: `Erreur écriture: ${err.message}` });
    }
});
exports.default = router;
//# sourceMappingURL=controls.js.map