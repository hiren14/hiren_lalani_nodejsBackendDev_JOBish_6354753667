import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { loginSchema, providerTokenSchema, registerSchema } from '../validators/auth.validator';

const router = Router();

router.post('/register', validate({ body: registerSchema }), asyncHandler(authController.register));
router.post('/login', validate({ body: loginSchema }), asyncHandler(authController.login));
router.post(
  '/provider-token',
  validate({ body: providerTokenSchema }),
  asyncHandler(async (req, res) => authController.providerToken(req, res)),
);

export default router;
