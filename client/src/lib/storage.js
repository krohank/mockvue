/**
 * Storage access can throw (private mode, disabled site data, quota). Every
 * read/write goes through these wrappers so the app keeps working regardless.
 */
const make = (getStore) => ({
  get(key, fallback = null) {
    try {
      const raw = getStore().getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      getStore().setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  remove(key) {
    try {
      getStore().removeItem(key);
    } catch {
      /* ignore */
    }
  },
});

export const local = make(() => window.localStorage);
export const session = make(() => window.sessionStorage);

export const KEYS = {
  token: 'mockvue_token',
  user: 'mockvue_user',
  theme: 'mockvue_theme',
  cvBaseline: 'mockvue_cv_baseline',
  draft: (interviewId, questionId) => `mockvue_draft_${interviewId}_${questionId}`,
};
