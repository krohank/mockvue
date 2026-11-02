import User from '../models/User.js';
import { ValidationError } from '../utils/customErrors.js';
import { TARGET_ROLES, EXPERIENCE_LEVELS, TOPICS } from '../config/constants.js';
import { asTrimmedString } from '../utils/validation.js';
import { MIN_PASSWORD_LENGTH } from './auth.controller.js';

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, targetRole, experienceLevel, preferredTopics, bio } = req.body || {};
    const updates = {};

    if (name !== undefined) {
      const trimmed = asTrimmedString(name, 100);
      if (!trimmed) throw new ValidationError('Name cannot be empty.');
      updates.name = trimmed;
    }
    if (targetRole !== undefined) {
      if (!TARGET_ROLES.includes(targetRole)) {
        throw new ValidationError(`Invalid target role. Allowed: ${TARGET_ROLES.join(', ')}.`);
      }
      updates.targetRole = targetRole;
    }
    if (experienceLevel !== undefined) {
      if (!EXPERIENCE_LEVELS.includes(experienceLevel)) {
        throw new ValidationError(`Invalid experience level. Allowed: ${EXPERIENCE_LEVELS.join(', ')}.`);
      }
      updates.experienceLevel = experienceLevel;
    }
    if (preferredTopics !== undefined) {
      if (!Array.isArray(preferredTopics)) throw new ValidationError('preferredTopics must be a list.');
      const topics = [...new Set(preferredTopics.filter((t) => TOPICS.includes(t)))].slice(0, 8);
      if (topics.length === 0) throw new ValidationError('Select at least one focus topic.');
      updates.preferredTopics = topics;
    }
    if (bio !== undefined) {
      if (typeof bio !== 'string') throw new ValidationError('Bio must be text.');
      if (bio.trim().length > 300) throw new ValidationError('Bio cannot exceed 300 characters.');
      updates.bio = bio.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, message: 'Profile updated.', user: updatedUser });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      throw new ValidationError('Provide your current password and a new password.');
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > 128) {
      throw new ValidationError(`New password must be ${MIN_PASSWORD_LENGTH}–128 characters long.`);
    }

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user || !(await user.matchPassword(currentPassword))) {
      // 400, not 401: a wrong password here must not look like an expired session.
      throw new ValidationError('Current password is incorrect.');
    }

    user.passwordHash = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password updated.' });
  } catch (error) {
    next(error);
  }
};
