import { test } from 'node:test';
import assert from 'node:assert/strict';
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) || null };
globalThis.window = new EventTarget();
const { default: api } = await import('../src/services/api.js');

test('an expired current session triggers one sign-out event', async () => {
  storage.set('mockvue_token', 'expired'); let events = 0;
  const listen = () => events++; window.addEventListener('mockvue:session-expired', listen);
  try {
    await assert.rejects(api.get('/auth/me', { adapter: async (config) => { throw { config, response: { status: 401, data: { message: 'Expired' } } }; } }), { status: 401 });
    assert.equal(events, 1);
  } finally { window.removeEventListener('mockvue:session-expired', listen); }
});
test('a stale failed request cannot sign out a newly authenticated session', async () => {
  storage.set('mockvue_token', 'old'); let events = 0;
  const listen = () => events++; window.addEventListener('mockvue:session-expired', listen);
  try {
    await assert.rejects(api.get('/auth/me', { adapter: async (config) => {
      storage.set('mockvue_token', 'new');
      throw { config, response: { status: 401, data: { message: 'Old request expired' } } };
    } }), { status: 401 });
    assert.equal(events, 0); assert.equal(storage.get('mockvue_token'), 'new');
  } finally { window.removeEventListener('mockvue:session-expired', listen); }
});
test('a connection failure returns an actionable message', async () => {
  await assert.rejects(api.get('/health', { adapter: async () => { throw { request: {} }; } }), (error) => /server is unavailable/.test(error.message));
});
