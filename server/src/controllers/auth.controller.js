import User, { EMAIL_PATTERN } from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { ValidationError, UnauthorizedError, AppError } from '../utils/customErrors.js';
import { TARGET_ROLES, EXPERIENCE_LEVELS, TOPICS } from '../config/constants.js';
import { asTrimmedString } from '../utils/validation.js';

export const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (email) => asTrimmedString(email, 254).toLowerCase();

export const register = async (req, res, next) => {
  try {
    const name = asTrimmedString(req.body?.name, 100);
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const { targetRole, experienceLevel, preferredTopics } = req.body || {};

    if (!name || !email || !password) {
      throw new ValidationError('Please provide your name, email, and password.');
    }
    if (!EMAIL_PATTERN.test(email)) {
      throw new ValidationError('Please provide a valid email address.');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    }
    if (password.length > 128) {
      throw new ValidationError('Password must be at most 128 characters long.');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('An account with this email address already exists. Try signing in.', 409);
    }

    const topics = Array.isArray(preferredTopics)
      ? preferredTopics.filter((t) => TOPICS.includes(t)).slice(0, 8)
      : [];

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      targetRole: TARGET_ROLES.includes(targetRole) ? targetRole : 'Software Development Engineer',
      experienceLevel: EXPERIENCE_LEVELS.includes(experienceLevel) ? experienceLevel : 'Entry-Level',
      preferredTopics: topics.length ? topics : ['Data Structures & Algorithms', 'Database Management Systems'],
    });

    res.status(201).json({
      success: true,
      message: 'Account created.',
      token: generateToken(user),
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      throw new ValidationError('Please provide both email and password.');
    }

    const user = await User.findOne({ email }).select('+passwordHash');
    // Same message for unknown email and wrong password: no account enumeration.
    if (!user || !(await user.matchPassword(password))) {
      throw new UnauthorizedError('Incorrect email or password.');
    }

    res.status(200).json({
      success: true,
      message: 'Signed in.',
      token: generateToken(user),
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};
