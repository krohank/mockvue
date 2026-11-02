import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Mic,
  ScanFace,
  Users,
  Smartphone,
  Eye,
  AudioLines,
  Maximize,
  ClipboardX,
  ShieldCheck,
  Lock,
  SlidersHorizontal,
  MessageSquareText,
  LineChart,
  CheckCircle2,
  Timer,
  BookOpenCheck,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ScoreRing, Meter } from '../components/ui/Metrics';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useAsync';
import { TOPICS, RUBRIC } from '../lib/constants';
import api from '../services/api';

const PROVIDER_LABEL = { gemini: 'Google Gemini', openai: 'OpenAI', fallback: 'Offline rubric engine' };

/** Stylised (not photographic) face-mesh illustration for the preview card. */
const MeshIllustration = () => (
  <svg viewBox="0 0 200 150" className="h-full w-full" aria-hidden="true">
    <defs>
      <radialGradient id="mv-bg" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stopColor="#3a332d" />
        <stop offset="100%" stopColor="#1b1815" />
      </radialGradient>
    </defs>
    <rect width="200" height="150" fill="url(#mv-bg)" />
    <path d="M60 150c4-24 20-34 40-34s36 10 40 34" fill="#2b2622" />
    <ellipse cx="100" cy="66" rx="27" ry="34" fill="#4a3f37" />
    <g fill="none" stroke="#5FA57A" strokeWidth="1.1" opacity="0.95">
      <ellipse cx="100" cy="66" rx="27" ry="34" />
      <path d="M84 58q5-4 10 0M106 58q5-4 10 0" />
      <ellipse cx="89" cy="62" rx="5" ry="2.6" />
      <ellipse cx="111" cy="62" rx="5" ry="2.6" />
      <path d="M100 63v12l-4 3h8" />
      <path d="M91 85q9 5 18 0" />
    </g>
    <g fill="#5FA57A">
      <circle cx="89" cy="62" r="1.5" />
      <circle cx="111" cy="62" r="1.5" />
    </g>
    <g fill="none" stroke="#5FA57A" strokeWidth="2.2" strokeLinecap="round">
      <path d="M66 32v-6h6M134 32v-6h-6M66 100v6h6M134 100v6h-6" />
    </g>
    <path d="M100 75l0-14" stroke="#5FA57A" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const ProductPreview = () => (
  <div className="relative">
    <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-accent-soft via-transparent to-brass-soft opacity-80 blur-2xl" aria-hidden="true" />
    <div className="card overflow-hidden shadow-raised" role="img" aria-label="Preview of the MockVue interview room: a question, a live camera check, and a scored answer.">
      <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-ink-2">
          <span className="rounded-md bg-surface px-2 py-0.5 num">Q2 / 5</span>
          <span>System Design · Medium</span>
        </div>
        <span className="num inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Timer className="h-3.5 w-3.5 text-ink-3" /> 14:32
        </span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[1.25fr_1fr] sm:p-5">
        <div className="space-y-3">
          <p className="font-serif text-[17px] font-semibold leading-snug text-ink">
            How would you add a Redis cache to a high-traffic service, and how would you handle invalidation?
          </p>
          <div className="rounded-xl border border-line bg-canvas p-3 text-[13px] leading-relaxed text-ink-2">
            I&apos;d use cache-aside: read Redis first, fall back to the database on a miss and populate with a TTL. On writes,
            delete the key and publish an event so other instances drop stale copies…
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-line p-3">
            <ScoreRing score={82} size={76} stroke={7} showBand={false} />
            <div className="flex-1 space-y-2">
              <Meter compact label="Technical" value={33} max={40} />
              <Meter compact label="Completeness" value={16} max={20} />
            </div>
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#1b1815]">
            <MeshIllustration />
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5FA57A]" /> On-device
            </span>
          </div>
          {[
            ['Face in frame', 'Yes'],
            ['Looking at screen', 'Yes'],
            ['People detected', '1'],
            ['Phone detected', 'No'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">
              <span className="text-ink-2">{k}</span>
              <span className="inline-flex items-center gap-1 font-medium text-ink">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const STEPS = [
  { icon: SlidersHorizontal, title: 'Configure', body: 'Pick a role, topics, difficulty and length — or start from a preset.' },
  { icon: MessageSquareText, title: 'Interview', body: 'Answer timed questions in full-screen. Type, or dictate with speech-to-text.' },
  { icon: LineChart, title: 'Review', body: 'Get a score per rubric criterion, what you missed, and a model answer. Track progress over time.' },
];

const VISION_CHECKS = [
  { icon: ScanFace, title: 'Presence', body: 'A face mesh with 478 landmarks confirms you are in frame.' },
  { icon: Users, title: 'Other people', body: 'Counts faces and bodies, so a helper off to the side is noticed.' },
  { icon: Eye, title: 'Head pose & gaze', body: 'Estimates where you are looking, calibrated to your own camera angle.' },
  { icon: Smartphone, title: 'Phones', body: 'An object detector looks for a mobile phone in view.' },
  { icon: AudioLines, title: 'Voices', body: 'Flags speech in the room while your own lips are not moving.' },
];

const BROWSER_RULES = [
  { icon: Maximize, text: 'The session runs in full-screen. Leaving it ends the interview.' },
  { icon: Lock, text: 'Switching tabs or apps ends the interview; a brief focus slip is a warning.' },
  { icon: ClipboardX, text: 'Copy, paste and developer tools are blocked and logged.' },
];

const FAIRNESS = [
  'Five warnings are allowed before a session ends.',
  'Conditions must persist (for example 5 s looking away) before a warning.',
  'Glancing down at the keyboard while typing is never counted.',
  'Each rule has a cool-down so one issue can’t pile up warnings.',
];

export const LandingPage = () => {
  useDocumentTitle(null);
  const { isAuthenticated, user } = useAuth();
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.get('/health').then(setHealth).catch(() => setHealth(null));
  }, []);

  const primaryCta = isAuthenticated
    ? { to: '/interviews/new', label: 'Start a new interview' }
    : { to: '/register', label: 'Start practicing — free' };

  return (
    <div className="overflow-x-clip">
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:pb-24">
        <div className="animate-slide-up">
          <Badge tone="accent" dot>
            For campus placements and technical rounds
          </Badge>
          <h1 className="display mt-5 text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[4.1rem]">
            Rehearse the interview <span className="italic text-accent-ink">before</span> it counts.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            Answer real technical and HR questions by typing or speaking. Every answer is scored on a four-part rubric with a
            model answer to compare against — and the session is proctored by computer vision that runs entirely in your browser.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button as={Link} to={primaryCta.to} size="lg" iconRight={ArrowRight}>
              {primaryCta.label}
            </Button>
            {isAuthenticated ? (
              <Button as={Link} to="/dashboard" size="lg" variant="secondary">
                Back to dashboard{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
              </Button>
            ) : (
              <Button as={Link} to="/#how-it-works" size="lg" variant="secondary">
                See how it works
              </Button>
            )}
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
            {[
              ['13', 'topics, Easy to Hard'],
              ['4', 'rubric criteria per answer'],
              ['0', 'video frames uploaded'],
            ].map(([n, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="num block text-2xl font-semibold text-ink">{n}</span>
                  <span className="mt-0.5 block text-sm text-ink-3">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
          {health?.ai && (
            <p className="mt-6 inline-flex items-center gap-2 text-xs text-ink-3">
              <span className={`h-1.5 w-1.5 rounded-full ${health.success ? 'bg-success' : 'bg-warning'}`} aria-hidden="true" />
              Grading engine: {PROVIDER_LABEL[health.ai.configuredProvider] || health.ai.configuredProvider}
              {health.ai.configuredProvider !== 'fallback' && !health.ai.hasApiKey ? ' (no API key — offline rubric in use)' : ''}
            </p>
          )}
        </div>
        <div className="animate-fade-in lg:pl-4">
          <ProductPreview />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="display mt-2 text-3xl sm:text-4xl">From blank page to a scored mock interview in a minute.</h2>
          </div>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="num flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-canvas text-sm font-semibold text-ink">
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-line-strong md:block" aria-hidden="true" />}
                </div>
                <h3 className="mt-5 flex items-center gap-2 text-lg font-semibold text-ink">
                  <s.icon className="h-5 w-5 text-accent-ink" aria-hidden="true" />
                  {s.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Rubric */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
        <div>
          <p className="eyebrow">Scoring</p>
          <h2 className="display mt-2 text-3xl sm:text-4xl">Graded like an interviewer would, not by word count.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            Each answer is scored out of 100 across four criteria. You see which concepts you covered, what you missed, specific
            gaps, and a model answer. With an AI key configured, grading is semantic; without one, an offline rubric engine checks
            concept coverage, structure and depth — and can’t be fooled by padding or gibberish.
          </p>
          <ul className="mt-6 space-y-2.5 text-[15px] text-ink-2">
            {['Concepts covered vs. missed', 'Actionable feedback for the next attempt', 'Model answer or answer outline', 'Progress by topic and criterion'].map(
              (t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" /> {t}
                </li>
              )
            )}
          </ul>
        </div>
        <div className="card p-6 sm:p-8">
          <p className="text-sm font-medium text-ink">Rubric weights</p>
          <div className="mt-3 flex h-7 w-full gap-0.5 overflow-hidden rounded-md" role="img" aria-label="Technical 40%, Relevance 20%, Completeness 20%, Clarity 20%">
            {RUBRIC.map((r, i) => (
              <div
                key={r.key}
                className={`flex items-center truncate px-2 text-xs font-semibold ${
                  ['bg-accent text-white', 'bg-accent/80 text-white', 'bg-accent/45 text-ink', 'bg-accent/30 text-ink'][i]
                }`}
                style={{ width: `${r.max}%` }}
              >
                {r.short} {r.max}%
              </div>
            ))}
          </div>
          <dl className="mt-6 divide-y divide-line">
            {RUBRIC.map((r) => (
              <div key={r.key} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <dt className="text-sm font-semibold text-ink">{r.label}</dt>
                  <dd className="mt-0.5 text-sm text-ink-3">{r.desc}</dd>
                </div>
                <span className="num shrink-0 text-sm font-semibold text-ink-2">{r.max} pts</span>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Proctoring */}
      <section id="proctoring" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow">Computer-vision proctoring</p>
            <h2 className="display mt-2 text-3xl sm:text-4xl">Real exam conditions, measured fairly.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              MediaPipe face-landmark and object-detection models run on your device at up to 15 frames per second. Before you start,
              a short calibration learns how you naturally sit, so an off-centre webcam doesn’t count against you.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="card grid gap-px overflow-hidden bg-line p-0 sm:grid-cols-2">
              {VISION_CHECKS.map((c, i) => (
                <div key={c.title} className={`bg-surface p-5 ${i === VISION_CHECKS.length - 1 ? 'sm:col-span-2' : ''}`}>
                  <c.icon className="h-5 w-5 text-accent-ink" aria-hidden="true" />
                  <h3 className="mt-3 text-[15px] font-semibold text-ink">{c.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-3">{c.body}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-6">
              <div className="card p-5">
                <h3 className="text-[15px] font-semibold text-ink">Browser rules</h3>
                <ul className="mt-3 space-y-3">
                  {BROWSER_RULES.map((r) => (
                    <li key={r.text} className="flex gap-3 text-sm text-ink-2">
                      <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                      {r.text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card p-5">
                <h3 className="text-[15px] font-semibold text-ink">Fair by design</h3>
                <ul className="mt-3 space-y-2.5">
                  {FAIRNESS.map((t) => (
                    <li key={t} className="flex gap-2.5 text-sm text-ink-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <p className="eyebrow">Privacy</p>
            <h2 className="display mt-2 text-3xl sm:text-4xl">Your camera stays on your device.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              Frames are analysed in memory and discarded immediately. No images, video or audio recordings are stored or sent
              anywhere — only a short log of proctoring events.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" /> Sent to the server
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-ink-2">
                <li>Event type and time (e.g. “looked away, 5 s”)</li>
                <li>A few numbers, like head angle or face count</li>
                <li>Session summary: % time present and attentive</li>
                <li>Your typed or dictated answers</li>
              </ul>
            </div>
            <div className="card p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Lock className="h-4 w-4 text-accent-ink" aria-hidden="true" /> Never leaves your browser
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-ink-2">
                <li>Camera frames or snapshots</li>
                <li>Face landmarks or biometric templates</li>
                <li>Microphone audio (only a loudness level is used)</li>
                <li>Anything after the session ends</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Topics + CTA */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="display text-3xl sm:text-4xl">Thirteen topics, three difficulty tiers.</h2>
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Available topics">
                {TOPICS.map((t) => (
                  <li key={t} className="rounded-full border border-line bg-canvas px-3 py-1 text-sm text-ink-2">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex shrink-0 flex-col gap-3 lg:items-end">
              <div className="flex items-center gap-3 text-sm text-ink-2">
                <BookOpenCheck className="h-5 w-5 text-accent-ink" aria-hidden="true" /> Behavioral questions use the STAR method.
              </div>
              <div className="flex items-center gap-3 text-sm text-ink-2">
                <Mic className="h-5 w-5 text-accent-ink" aria-hidden="true" /> Speak your answers with built-in dictation.
              </div>
              <Button as={Link} to={primaryCta.to} size="lg" iconRight={ArrowRight} className="mt-3">
                {primaryCta.label}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
