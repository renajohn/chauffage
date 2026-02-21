"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const luxtronik_1 = require("../services/luxtronik");
const router = (0, express_1.Router)();
router.get('/data', (_req, res) => {
    const data = (0, luxtronik_1.getCachedData)();
    if (!data) {
        res.status(503).json({ error: 'Données non disponibles. PAC en cours de connexion...' });
        return;
    }
    res.json(data);
});
exports.default = router;
//# sourceMappingURL=data.js.map