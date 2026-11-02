import mongoose from 'mongoose';
import { ValidationError } from './customErrors.js';

export const assertObjectId = (value, label = 'ID') => {
  if (!mongoose.isValidObjectId(value)) {
    throw new ValidationError(`Invalid ${label}.`);
  }
};

export const clampInt = (value, min, max, fallback) => {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

export const asTrimmedString = (value, maxLength = 1000) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

export const oneOf = (value, allowed, label) => {
  if (!allowed.includes(value)) {
    throw new ValidationError(`Invalid ${label}. Allowed values: ${allowed.join(', ')}.`);
  }
  return value;
};
