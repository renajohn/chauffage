import { Router, Request, Response } from 'express';
import { getCachedData } from '../services/luxtronik';

const router = Router();

router.get('/data', (_req: Request, res: Response) => {
  const data = getCachedData();
  if (!data) {
    res.status(503).json({ error: 'Données non disponibles. PAC en cours de connexion...' });
    return;
  }
  res.json(data);
});

export default router;
