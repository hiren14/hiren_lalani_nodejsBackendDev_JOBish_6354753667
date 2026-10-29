import { Router } from 'express';
import authRoutes from './auth.routes';
import messageRoutes from './message.routes';
import webhookRoutes from './webhook.routes';

const router = Router();
router.use('/auth', authRoutes);
// Webhook router is mounted before the message router: the latter applies
// authenticate('user') to everything under /api/v1 that reaches it.
router.use(webhookRoutes);
router.use(messageRoutes);

export default router;
