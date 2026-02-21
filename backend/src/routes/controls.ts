import { Router, Request, Response } from 'express';
import { writeParameter } from '../services/luxtronik';
import { WRITABLE_PARAMS } from '../types/heatpump';
import { setRoomTemperature, getAllLabels, setRoomLabel } from '../services/nussbaum';

const router = Router();

router.post('/controls', async (req: Request, res: Response) => {
  const { parameter, value } = req.body;

  if (!parameter || value === undefined || value === null) {
    res.status(400).json({ error: 'Paramètres "parameter" et "value" requis' });
    return;
  }

  const paramConfig = WRITABLE_PARAMS[parameter];
  if (!paramConfig) {
    res.status(400).json({
      error: `Paramètre "${parameter}" non autorisé`,
      allowed: Object.keys(WRITABLE_PARAMS),
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
    await writeParameter(parameter, numValue);
    res.json({ success: true, parameter, value: numValue });
  } catch (err: any) {
    console.error('[Controls] Erreur écriture:', err);
    res.status(500).json({ error: `Erreur écriture: ${err.message}` });
  }
});

router.post('/rooms/:controllerId/:roomId/temperature', async (req: Request, res: Response) => {
  const controllerId = req.params.controllerId as string;
  const roomId = req.params.roomId as string;
  const { temperature } = req.body;

  if (!['rez', 'etage'].includes(controllerId)) {
    res.status(400).json({ error: 'controllerId doit être "rez" ou "etage"' });
    return;
  }

  const roomIdNum = parseInt(roomId, 10);
  if (isNaN(roomIdNum) || roomIdNum < 1 || roomIdNum > 4) {
    res.status(400).json({ error: 'roomId doit être entre 1 et 4' });
    return;
  }

  const temp = Number(temperature);
  if (isNaN(temp) || temp < 15 || temp > 30) {
    res.status(400).json({ error: 'temperature doit être entre 15 et 30°C', received: temperature });
    return;
  }

  try {
    await setRoomTemperature(controllerId as 'rez' | 'etage', roomIdNum, temp);
    res.json({ success: true, controllerId, roomId: roomIdNum, temperature: temp });
  } catch (err: any) {
    console.error('[Controls] Erreur écriture Nussbaum:', err);
    res.status(500).json({ error: `Erreur écriture: ${err.message}` });
  }
});

router.get('/rooms/labels', (_req: Request, res: Response) => {
  res.json(getAllLabels());
});

router.put('/rooms/:controllerId/:roomId/label', (req: Request, res: Response) => {
  const controllerId = req.params.controllerId as string;
  const roomId = req.params.roomId as string;
  const { name } = req.body;

  if (!['rez', 'etage'].includes(controllerId)) {
    res.status(400).json({ error: 'controllerId doit être "rez" ou "etage"' });
    return;
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name requis' });
    return;
  }

  setRoomLabel(controllerId, parseInt(roomId, 10), name.trim());
  res.json({ success: true, controllerId, roomId: parseInt(roomId, 10), name: name.trim() });
});

export default router;
