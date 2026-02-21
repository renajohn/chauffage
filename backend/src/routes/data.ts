import { Router, Request, Response } from 'express';
import { getCachedData } from '../services/luxtronik';
import { getCachedRoomsData } from '../services/nussbaum';
import { getHistory } from '../services/history';

const router = Router();

router.get('/data', (_req: Request, res: Response) => {
  const data = getCachedData();
  if (!data) {
    res.status(503).json({ error: 'Données non disponibles. PAC en cours de connexion...' });
    return;
  }
  res.json(data);
});

router.get('/rooms', (_req: Request, res: Response) => {
  const data = getCachedRoomsData();
  if (!data) {
    res.status(503).json({ error: 'Données Nussbaum non disponibles.' });
    return;
  }
  res.json(data);
});

router.get('/history', (_req: Request, res: Response) => {
  res.json(getHistory());
});

router.get('/system', (_req: Request, res: Response) => {
  res.json({
    heatpump: getCachedData(),
    rooms: getCachedRoomsData(),
  });
});

export default router;
