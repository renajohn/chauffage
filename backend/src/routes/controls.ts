import { Router, Request, Response } from 'express';
import { writeParameter } from '../services/luxtronik';
import { WRITABLE_PARAMS } from '../types/heatpump';

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

export default router;
