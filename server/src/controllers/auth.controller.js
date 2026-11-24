import User from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { ValidationError, UnauthorizedError } from '../utils/customErrors.js';

export const register = async (req, res, next) => {
  try {
    const { name, email, password, targetRole, experienceLevel, preferredTopics, bio } = req.body;

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email.trim() || !password) {
      throw new ValidationError('Please provide your name, email, and password.');
    }

    if (name.trim().length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new ValidationError('Enter a valid name and email address.');
    }
    if (Buffer.byteLength(password, 'utf8') > 72) throw new ValidationError('Password must be 72 bytes or fewer.');
    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long.');
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: password,
      targetRole: targetRole || 'Software Development Engineer',
      experienceLevel: experienceLevel || 'Entry-Level',
      preferredTopics: preferredTopics || ['Data Structures & Algorithms', 'Database Management Systems'],
      bio: bio || '',
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      throw new ValidationError('Please provide both email and password.');
    }

    // Query user and explicitly select passwordHash
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
    if (!user) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};
