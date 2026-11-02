export const formatDate = (value, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, opts);
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const formatRelative = (value, now = Date.now()) => {
  if (!value) return '—';
  const diff = (new Date(value).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDate(value);
};

/** 125 → "2:05"; 3725 → "1:02:05" */
export const formatClock = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
};

/** 95 → "1h 35m"; 12 → "12m" */
export const formatMinutes = (minutes) => {
  const m = Math.round(minutes || 0);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim();
};

/** Score bands double as status colors — always paired with a text label. */
export const scoreBand = (score) => {
  if (score === null || score === undefined || Number.isNaN(score)) return { label: 'Not scored', tone: 'neutral' };
  if (score >= 75) return { label: 'Strong', tone: 'success' };
  if (score >= 55) return { label: 'Developing', tone: 'warning' };
  return { label: 'Needs work', tone: 'danger' };
};

export const STATUS_META = {
  created: { label: 'Not started', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'brass' },
  completed: { label: 'Completed', tone: 'success' },
  terminated: { label: 'Ended early', tone: 'danger' },
  abandoned: { label: 'Abandoned', tone: 'neutral' },
};

export const END_REASON_LABEL = {
  all_answered: 'All questions answered',
  submitted_early: 'Finished early',
  time_expired: 'Time ran out',
  proctoring: 'Ended by proctoring',
};

export const pluralize = (n, word, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`;

export const wordCount = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export const greeting = (date = new Date()) => {
  const h = date.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};
