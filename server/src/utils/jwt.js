import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Tokens carry only the user id. Profile data is always read fresh from the
 * database so a stale token can never resurrect or impersonate an account.
 */
export const generateToken = (userOrId) => {
  const id = typeof userOrId === 'object' && userOrId !== null ? userOrId._id || userOrId.id : userOrId;
  return jwt.sign({ id: String(id) }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

export const verifyToken = (token) => jwt.verify(token, env.JWT_SECRET);
