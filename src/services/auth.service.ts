import bcrypt from 'bcryptjs';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { userRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/ApiError';
import { signToken } from '../utils/jwt';
import { maskEmail } from '../utils/mask';

const BCRYPT_COST = 10;

const digest = (value: string) => createHash('sha256').update(value).digest();

export const authService = {
  async register(input: { tenantId: string; email: string; password: string }) {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const user = await userRepository.create({
      id: randomUUID(),
      tenantId: input.tenantId,
      email: input.email.toLowerCase(),
      passwordHash,
    });
    logger.info(
      { userId: user.id, tenantId: user.tenantId, emailMasked: maskEmail(user.email) },
      'user registered',
    );
    return { id: user.id, tenantId: user.tenantId, email: user.email };
  },

  async login(input: { email: string; password: string }) {
    const user = await userRepository.findByEmail(input.email.toLowerCase());
    const valid = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !valid) {
      logger.warn({ emailMasked: maskEmail(input.email) }, 'login failed');
      // Same message for unknown email and wrong password (no account enumeration).
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const accessToken = signToken({ sub: user.id, role: 'user', tenantId: user.tenantId });
    return { accessToken, tokenType: 'Bearer', expiresIn: env.jwtExpiresIn };
  },

  /** The provider trades its shared API key for a short-lived JWT used on the webhook route. */
  providerToken(apiKey: string) {
    const ok = timingSafeEqual(digest(apiKey), digest(env.providerApiKey));
    if (!ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid provider API key');
    const accessToken = signToken({ sub: 'provider', role: 'provider' });
    return { accessToken, tokenType: 'Bearer', expiresIn: env.jwtExpiresIn };
  },
};
