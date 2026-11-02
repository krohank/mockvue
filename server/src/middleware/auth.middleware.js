import mongoose from 'mongoose';
import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';
import { UnauthorizedError } from '../utils/customErrors.js';

export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      return next(new UnauthorizedError('Authentication required. Please sign in.'));
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      const message =
        err.name === 'TokenExpiredError'
          ? 'Your session has expired. Please sign in again.'
          : 'Invalid authentication token. Please sign in again.';
      return next(new UnauthorizedError(message));
    }

    if (!decoded?.id || !mongoose.isValidObjectId(decoded.id)) {
      return next(new UnauthorizedError('Invalid authentication token. Please sign in again.'));
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new UnauthorizedError('This account no longer exists. Please sign in again.'));
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};
