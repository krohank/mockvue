import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';
import { UnauthorizedError } from '../utils/customErrors.js';

export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw new UnauthorizedError('Please sign in to continue.');
    const decoded = verifyToken(header.slice(7));
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) throw new UnauthorizedError('This account is no longer available. Please sign in again.');
    req.user = user;
    next();
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError'].includes(error.name)) {
      return next(new UnauthorizedError('Your session has expired. Please sign in again.'));
    }
    next(error);
  }
};
