import { db } from '../config/db';
import { ApiError } from '../utils/ApiError';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
}

interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  tenantId: r.tenant_id,
  email: r.email,
  passwordHash: r.password_hash,
});

export const userRepository = {
  async create(input: User): Promise<User> {
    try {
      const [row] = await db('users')
        .insert({
          id: input.id,
          tenant_id: input.tenantId,
          email: input.email,
          password_hash: input.passwordHash,
        })
        .returning('*');
      return toUser(row as UserRow);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
      }
      throw err;
    }
  },

  async findByEmail(email: string): Promise<User | null> {
    const row = await db('users').where({ email }).first();
    return row ? toUser(row as UserRow) : null;
  },
};
