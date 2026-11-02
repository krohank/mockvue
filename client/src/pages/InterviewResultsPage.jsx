import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  ChevronDown,
  Eye,
  ScanFace,
  Users,
  Smartphone,
  FileText,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAsync, useDocumentTitle } from '../hooks/useAsync';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Alert, ErrorState, PageLoader, EmptyState } from '../components/ui/Feedback';
import { ScoreRing, Meter, ScorePill } from '../components/ui/Metrics';
import { PageContainer } from '../components/layout/PageHeader';
import { RUBRIC, TOPIC_SHORT } from '../lib/constants';
import { formatDate, formatClock, scoreBand, STATUS_META, END_REASON_LABEL, pluralize } from '../lib/format';
import api from '../services/api';

const EVENT_LABEL = {
  person_out_of_frame: 'Out of frame',
  no_face_detected: 'No face',
  multiple_faces_detected: 'Multiple faces',
  additional_person_detected: 'Another person',
  phone_detected: 'Phone detected',
  head_turned_away: 'Head turned away',
  eye_gaze_deviated: 'Looked away',
  looking_off_screen: 'Looked away',
  audio_anomaly_detected: 'Voices detected',
  window_blurred: 'Window lost focus',
  window_focus_lost: 'Switched app',
  tab_switched: 'Left the tab',
  fullscreen_exit: 'Exited full-screen',
  keyboard_shortcut_violation: 'Blocked shortcut',
  paste_attempt: 'Paste attempt',
  camera_disconnected: 'Camera disconnected',
  camera_unavailable: 'No camera',
  max_warnings_exceeded: 'Warning limit reached',
  proctoring_started: 'Monitoring started',
  proctoring_violation: 'Proctoring rule',
};

const ENGINE_LABEL = { mediapipe: 'Face, gaze & object detection', basic: 'Basic presence detection', none: 'Not monitored' };

const Chips = ({ items, tone }) =>
  items?.length ? (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <li key={c} className={`rounded-md px-2 py-0.5 text-xs text-ink-2 ${tone === 'good' ? 'bg-success-soft' : tone === 'bad' ? 'bg-warning-soft' : 'bg-surface-2'}`}>
          {c}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-xs text-ink-3">—</p>
  );

const QuestionReport = ({ index, question, answer, defaultOpen }) => {
  const band = scoreBand(answer?.overallScore);
  return (
    <details className="card group overflow-hidden" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-start gap-4 p-5 hover:bg-surface-2/50 sm:p-6 [&::-webkit-details-marker]:hidden">
        <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-semibold text-ink-2">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <span>{TOPIC_SHORT[question.topic] || question.topic}</span>
            <span aria-hidden="true">·</span>
            <span>{question.difficulty}</span>
            {question.type !== 'Technical' && (
              <>
                <span aria-hidden="true">·</span>
                <span>{question.type}</span>
              </>
            )}
          </div>
          <p className="mt-1 font-serif text-[17px] font-semibold leading-snug text-ink">{question.questionText}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {answer ? (
            <span className="text-right">
              <ScorePill score={answer.overallScore} />
              <span className="mt-0.5 block text-[11px] text-ink-3">{band.label}</span>
            </span>
          ) : (
            <Badge size="sm">Unanswered</Badge>
          )}
          <ChevronDown className="h-4 w-4 text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" />
        </div>
      </summary>

      <div className="space-y-6 border-t border-line p-5 sm:p-6">
        {answer ? (
          <>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Your answer</h3>
                <span className="flex items-center gap-2 text-xs text-ink-3">
                  {answer.responseType !== 'text' && <Badge size="sm">{answer.responseType === 'voice' ? 'Dictated' : 'Typed + dictated'}</Badge>}
                  {answer.timeSpentSeconds ? <span className="num">{formatClock(answer.timeSpentSeconds)}</span> : null}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm leading-relaxed text-ink">{answer.responseText}</p>
            </div>

            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {RUBRIC.map((r) => (
                <Meter key={r.key} label={r.label} value={answer.criteriaScores?.[r.key] ?? 0} max={r.max} compact />
              ))}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Concepts covered
                </h3>
                <Chips items={answer.correctConcepts} tone="good" />
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-warning">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Concepts missed
                </h3>
                <Chips items={answer.missingConcepts} tone="bad" />
              </div>
            </div>

            {(answer.feedback || answer.mistakes?.length > 0) && (
              <div className="rounded-xl border border-line p-4">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Lightbulb className="h-4 w-4 text-brass" aria-hidden="true" /> Feedback
                </h3>
                {answer.feedback && <p className="mt-2 text-sm leading-relaxed text-ink-2">{answer.feedback}</p>}
                {answer.mistakes?.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-2">
                    {answer.mistakes.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {answer.improvedAnswer && (
              <div className="rounded-xl border border-accent-ink/20 bg-accent-soft p-4">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-accent-ink">
                  <BookOpen className="h-4 w-4" aria-hidden="true" /> {answer.isFallbackEvaluation ? 'Answer outline' : 'Model answer'}
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{answer.improvedAnswer}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-3">You didn’t answer this question, so it scored zero.</p>
        )}

        {question.referenceConcepts?.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">What a strong answer covers</h3>
            <Chips items={question.referenceConcepts} />
            {question.evaluationCriteria?.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-2">
                {question.evaluationCriteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </details>
  );
};

export const InterviewResultsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, loading, error, reload } = useAsync(async () => {
    try {
      const [report, monitoring] = await Promise.all([
        api.get(`/interviews/${id}/report`),
        api.get(`/interviews/${id}/monitoring`).catch(() => ({ events: [] })),
      ]);
      return { ...report, events: monitoring.events || [] };
    } catch (err) {
      if (err.status === 409) return { redirect: err.data?.status };
      throw err;
    }
  }, [id]);

  useDocumentTitle(data?.interview ? `Report · ${data.interview.title}` : 'Report');

  useEffect(() => {
    if (data?.redirect) navigate(`/interviews/${id}/${data.redirect === 'in_progress' ? 'room' : 'prep'}`, { replace: true });
  }, [data, id, navigate]);

  useEffect(() => {
    const score = data?.interview?.overallScore;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (score >= 75 && data?.interview?.status === 'completed' && !reduced) {
      try {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.3 }, colors: ['#7A263A', '#D9B26F', '#2F7A50', '#F7F4EE'], disableForReducedMotion: true });
      } catch {
        /* decorative */
      }
    }
  }, [data]);

  const stats = useMemo(() => {
    if (!data?.report) return null;
    const total = data.report.length || 1;
    const answered = data.report.filter((r) => r.answer);
    const criteria = Object.fromEntries(
      RUBRIC.map((r) => [r.key, Math.round(answered.reduce((s, x) => s + (x.answer.criteriaScores?.[r.key] || 0), 0) / total)])
    );
    const pct = RUBRIC.map((r) => ({ ...r, pct: (criteria[r.key] / r.max) * 100 }));
    const sorted = [...pct].sort((a, b) => b.pct - a.pct);
    const timeUsed = answered.reduce((s, x) => s + (x.answer.timeSpentSeconds || 0), 0);
    // Lowest-scoring question's topic (unanswered = 0) is the best thing to practise next.
    const weakest = [...data.report].sort((a, b) => (a.answer?.overallScore ?? 0) - (b.answer?.overallScore ?? 0))[0];
    return {
      criteria,
      strongest: sorted[0],
      weakest: sorted[sorted.length - 1],
      weakTopic: weakest?.question?.topic || data.interview.topics?.[0] || '',
      answeredCount: answered.length,
      timeUsed,
      total: data.report.length,
    };
  }, [data]);

  if (loading || data?.redirect) return <PageLoader label="Building your report…" />;
  if (error) return <ErrorState title="Report unavailable" message={error.message} onRetry={reload} action={<Link to="/history" className="link text-sm">All interviews</Link>} />;

  const { interview, report, events } = data;
  const score = interview.overallScore ?? 0;
  const band = scoreBand(score);
  const meta = STATUS_META[interview.status] || STATUS_META.completed;
  const summary = interview.proctoringSummary;
  const warningEvents = events.filter((e) => e.severity !== 'info');
  const startedAt = interview.startedAt ? new Date(interview.startedAt).getTime() : null;
  const retakeUrl = `/interviews/new?topic=${encodeURIComponent(stats.weakTopic)}&difficulty=${interview.difficulty}`;

  return (
    <PageContainer size="lg">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button as={Link} to="/history" variant="ghost" size="sm" icon={ArrowLeft}>
          All interviews
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
            Print / PDF
          </Button>
          <Button as={Link} to={retakeUrl} size="sm" icon={RotateCcw}>
            Practice again
          </Button>
        </div>
      </div>

      <header className="pb-6">
        <p className="eyebrow">Interview report</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">{interview.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-3">
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
          <span>{formatDate(interview.completedAt || interview.updatedAt, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <span aria-hidden="true">·</span>
          <span>{interview.difficulty}</span>
          <span aria-hidden="true">·</span>
          <span>{interview.interviewType}</span>
          {interview.endReason && interview.endReason !== 'all_answered' && interview.status !== 'terminated' && (
            <>
              <span aria-hidden="true">·</span>
              <span>{END_REASON_LABEL[interview.endReason]}</span>
            </>
          )}
        </div>
      </header>

      {interview.status === 'terminated' && (
        <Alert tone="danger" icon={ShieldAlert} title="This interview was ended by proctoring" className="mb-6">
          {interview.terminationReason} Answers submitted before that point were scored; the rest count as zero.
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center justify-center md:min-w-[240px]">
          <ScoreRing score={score} size={150} stroke={12} />
          <p className="mt-3 text-center text-sm text-ink-3">
            {stats.answeredCount} of {pluralize(stats.total, 'question')} answered
          </p>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-ink">Rubric breakdown</h2>
          <p className="mt-1 text-sm text-ink-2">
            {stats.answeredCount === 0
              ? 'No answers were submitted.'
              : `Overall ${band.label.toLowerCase()}. Strongest on ${stats.strongest.label.toLowerCase()}; the most room to improve is ${stats.weakest.label.toLowerCase()}.`}
          </p>
          <div className="mt-5 space-y-4">
            {RUBRIC.map((r) => (
              <Meter key={r.key} label={r.label} value={stats.criteria[r.key]} max={r.max} hint={r.desc} />
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              {summary?.engine && summary.engine !== 'none' ? (
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <Info className="h-4 w-4 text-ink-3" aria-hidden="true" />
              )}
              Proctoring
            </h2>
            <p className="mt-1 text-sm text-ink-3">{ENGINE_LABEL[summary?.engine || 'none']}{summary?.calibrated ? ' · calibrated' : ''}</p>
          </div>
          <Badge tone={interview.proctoringViolations === 0 ? 'success' : interview.proctoringViolations >= 3 ? 'danger' : 'warning'}>
            {pluralize(interview.proctoringViolations || 0, 'warning')}
          </Badge>
        </div>

        {summary && summary.engine !== 'none' && (
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { icon: ScanFace, label: 'Face in view', value: summary.facePresentPct },
              { icon: Eye, label: 'Looking at screen', value: summary.attentionPct },
              { icon: Users, label: 'Others in view', value: summary.multiplePeoplePct },
              { icon: Smartphone, label: 'Phone detections', value: summary.phoneDetections, raw: true },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-surface-2 p-3">
                <dt className="flex items-center gap-1.5 text-xs text-ink-3">
                  <m.icon className="h-3.5 w-3.5" aria-hidden="true" /> {m.label}
                </dt>
                <dd className="num mt-1 text-lg font-semibold text-ink">{m.value === null || m.value === undefined ? '—' : m.raw ? m.value : `${Math.round(m.value)}%`}</dd>
              </div>
            ))}
          </dl>
        )}

        {warningEvents.length > 0 ? (
          <ol className="mt-5 divide-y divide-line border-t border-line">
            {warningEvents.map((e) => (
              <li key={e._id} className="flex items-start gap-3 py-2.5 text-sm">
                <span className="num w-14 shrink-0 text-xs text-ink-3">
                  {startedAt ? `+${formatClock(Math.max(0, (new Date(e.timestamp).getTime() - startedAt) / 1000))}` : new Date(e.timestamp).toLocaleTimeString()}
                </span>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.severity === 'critical' ? 'bg-danger' : 'bg-warning'}`} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="font-medium text-ink">{EVENT_LABEL[e.eventType] || e.eventType}</span>
                  <span className="text-ink-3"> — {e.description}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-sm text-ink-2">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> No proctoring issues were recorded.
          </p>
        )}
      </Card>

      <section className="mt-10" aria-labelledby="questions-heading">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="questions-heading" className="display text-2xl">
            Question by question
          </h2>
          {stats.timeUsed > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-ink-3">
              <Clock className="h-4 w-4" aria-hidden="true" /> <span className="num">{formatClock(stats.timeUsed)}</span> answering
            </span>
          )}
        </div>
        {report.length === 0 ? (
          <EmptyState icon={FileText} title="No questions in this interview" />
        ) : (
          <div className="space-y-3">
            {report.map((item, i) => (
              <QuestionReport key={item.question._id} index={i} question={item.question} answer={item.answer} defaultOpen={i === 0} />
            ))}
          </div>
        )}
      </section>

      <p className="mt-10 text-center text-xs text-ink-3">
        {report.some((r) => r.answer?.isFallbackEvaluation)
          ? 'Scored by the offline rubric engine (concept coverage, structure and depth). Configure an AI provider on the server for semantic grading.'
          : 'Scored by an AI evaluator against the four-part rubric.'}{' '}
        Proctoring signals are indicators for practice, not proof of misconduct.
      </p>
    </PageContainer>
  );
};

export default InterviewResultsPage;
