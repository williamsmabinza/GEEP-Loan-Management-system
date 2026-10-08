import { Router } from 'express';
import { handleHealthCheck } from '../controllers/health.controller.js';

const router = Router();

router.get('/', handleHealthCheck);

export default router;
