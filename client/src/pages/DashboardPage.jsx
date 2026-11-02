import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  ArrowRight,
  PlayCircle,
  Trophy,
  Target,
  Clock,
  Flame,
  ChevronRight,
  Compass,
  Zap,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAsync, useDocumentTitle } from '../hooks/useAsync';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader } from '../components/ui/Card';
import { StatTile, ScorePill } from '../components/ui/Metrics';
import { Alert, EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { PageContainer } from '../components/layout/PageHeader';
import { ChartFrame, ScoreTrendChart } from '../components/charts/Charts';
import { PRESETS, TOPIC_SHORT } from '../lib/constants';
import { formatMinutes, formatRelative, greeting, STATUS_META, pluralize } from '../lib/format';
import api from '../services/api';

const READINESS_TONE = {
  'Placement Ready': 'success',
  Progressing: 'brass',
  'Needs Practice': 'warning',
  'Not Started': 'neutral',
};

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card space-y-3 p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
    <div className="card h-72 p-6">
      <Skeleton className="h-full w-full" />
    </div>
  </div>
);

export const DashboardPage = () => {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [startingPreset, setStartingPreset] = React.useState(null);

  const { data, loading, error, reload } = useAsync(async () => {
    const [overview, history, performance] = await Promise.all([
      api.get('/analytics/overview'),
      api.get('/interviews/history', { params: { limit: 6 } }),
      api.get('/analytics/performance'),
    ]);
    return { overview: overview.overview, interviews: history.interviews, analytics: performance.analytics };
  }, []);

  const startPreset = async (preset) => {
    setStartingPreset(preset.id);
    try {
      const res = await api.post('/interviews/generate', {
        targetRole: preset.config.targetRole || user?.targetRole || 'Software Development Engineer',
        ...preset.config,
      });
      navigate(`/interviews/${res.interviewId}/prep`);
    } catch (err) {
      toast.error(err.message);
      setStartingPreset(null);
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'there';
  const overview = data?.overview;
  const active = overview?.activeSession;
  const rec = data?.analytics?.recommendation;
  const trend = data?.analytics?.scoreTrend || [];

  return (
    <PageContainer size="full">
      <div className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink-3">
            {greeting()}, {firstName}
          </p>
          <h1 className="display mt-1 text-3xl sm:text-4xl">Your interview practice</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{user?.targetRole}</Badge>
            {overview && <Badge tone={READINESS_TONE[overview.readinessStatus] || 'neutral'} dot>{overview.readinessStatus}</Badge>}
          </div>
        </div>
        <Button as={Link} to="/interviews/new" icon={Plus} size="lg">
          New interview
        </Button>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          {active && (
            <Alert
              tone="info"
              icon={PlayCircle}
              title={active.status === 'in_progress' ? 'You have an interview in progress' : 'You have an interview ready to start'}
              action={
                <Button as={Link} to={`/interviews/${active._id}/${active.status === 'in_progress' ? 'room' : 'prep'}`} size="sm" iconRight={ArrowRight}>
                  {active.status === 'in_progress' ? 'Resume' : 'Start'}
                </Button>
              }
            >
              {active.title} · {pluralize(active.questionCount, 'question')}
            </Alert>
          )}

          <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Interviews completed"
              value={overview.completedCount}
              sub={overview.terminatedCount ? `${overview.terminatedCount} ended early by proctoring` : `${overview.totalInterviews} created in total`}
              icon={Target}
            />
            <StatTile label="Average score" value={overview.completedCount ? overview.averageScore : '—'} sub="Across finished sessions" icon={Trophy} />
            <StatTile label="Practice time" value={formatMinutes(overview.totalMinutesPracticed)} sub={`${overview.practiceDaysLast30} active days in the last 30`} icon={Clock} />
            <StatTile
              label="Current streak"
              value={pluralize(overview.streakDays, 'day')}
              sub={overview.lastSessionAt ? `Last session ${formatRelative(overview.lastSessionAt)}` : 'Practice today to start one'}
              icon={Flame}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            {trend.length >= 2 ? (
              <ChartFrame
                title="Score over time"
                description={`Overall score of your last ${trend.length} finished interviews`}
                height={240}
                table={{
                  columns: ['Date', 'Interview', 'Score'],
                  rows: trend.map((t) => [new Date(t.date).toLocaleDateString(), t.title, t.score]),
                }}
              >
                <ScoreTrendChart data={trend} />
              </ChartFrame>
            ) : (
              <Card>
                <CardHeader title="Score over time" description="Your trend appears after two finished interviews." />
                <EmptyState
                  icon={Compass}
                  title={trend.length === 1 ? 'One more to see a trend' : 'No finished interviews yet'}
                  description="Each interview adds a point here so you can see whether you’re improving."
                  action={
                    <Button as={Link} to="/interviews/new" size="sm" icon={Plus}>
                      Start an interview
                    </Button>
                  }
                />
              </Card>
            )}

            <div className="flex flex-col gap-6">
              {rec && (
                <Card>
                  <p className="eyebrow">Recommended next</p>
                  <h2 className="mt-2 text-lg font-semibold text-ink">
                    {TOPIC_SHORT[rec.topic] || rec.topic} · {rec.difficulty}
                  </h2>
                  <p className="mt-1.5 text-sm text-ink-2">{rec.reason}</p>
                  <Button
                    as={Link}
                    to={`/interviews/new?topic=${encodeURIComponent(rec.topic)}&difficulty=${rec.difficulty}`}
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    iconRight={ArrowRight}
                  >
                    Set up this session
                  </Button>
                </Card>
              )}
              <Card>
                <p className="eyebrow">Quick start</p>
                <ul className="mt-3 divide-y divide-line">
                  {PRESETS.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => startPreset(p)}
                        disabled={Boolean(startingPreset)}
                        className="group flex w-full items-center justify-between gap-3 py-3 text-left disabled:opacity-60"
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-ink-2 group-hover:bg-accent-soft group-hover:text-accent-ink">
                            <Zap className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-ink">{startingPreset === p.id ? 'Generating…' : p.title}</span>
                            <span className="block text-xs text-ink-3">{p.desc}</span>
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>

          <Card padded={false}>
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
              <h2 className="text-base font-semibold text-ink">Recent interviews</h2>
              <Link to="/history" className="link inline-flex items-center gap-1 text-sm">
                View all <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {data.interviews.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No interviews yet"
                description="Create your first interview to get scored answers and a full report."
                action={
                  <Button as={Link} to="/interviews/new" icon={Plus} size="sm">
                    Create an interview
                  </Button>
                }
              />
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {data.interviews.map((item) => {
                  const meta = STATUS_META[item.status] || STATUS_META.created;
                  const finished = ['completed', 'terminated'].includes(item.status);
                  const to = finished
                    ? `/interviews/${item._id}/results`
                    : `/interviews/${item._id}/${item.status === 'in_progress' ? 'room' : 'prep'}`;
                  return (
                    <li key={item._id}>
                      <Link to={to} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2/60 sm:px-6">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium text-ink">{item.title}</p>
                          <p className="mt-0.5 truncate text-xs text-ink-3">
                            {item.topics?.map((t) => TOPIC_SHORT[t] || t).join(' · ')} · {formatRelative(item.completedAt || item.createdAt)}
                          </p>
                        </div>
                        <Badge tone={meta.tone} size="sm" className="hidden sm:inline-flex">
                          {meta.label}
                        </Badge>
                        <span className="w-12 text-right">
                          <ScorePill score={finished ? item.overallScore : null} />
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </PageContainer>
  );
};

export default DashboardPage;
