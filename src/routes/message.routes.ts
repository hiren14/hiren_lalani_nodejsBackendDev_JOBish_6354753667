import { Router } from 'express';
import { messageController } from '../controllers/message.controller';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createMessageSchema,
  listMessagesParamsSchema,
  listMessagesQuerySchema,
  messageIdParamSchema,
} from '../validators/message.validator';

const router = Router();
router.use(authenticate('user'));

router.post('/messages', validate({ body: createMessageSchema }), asyncHandler(messageController.create));
router.get('/messages/:messageId', validate({ params: messageIdParamSchema }), asyncHandler(messageController.getById));
router.get(
  '/conversations/:conversationId/messages',
  validate({ params: listMessagesParamsSchema, query: listMessagesQuerySchema }),
  asyncHandler(messageController.listByConversation),
);

export default router;
