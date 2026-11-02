import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight, BarChart3, Trophy, Target, Clock, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAsync, useDocumentTitle } from '../hooks/useAsync';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatTile, Meter } from '../components/ui/Metrics';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { PageContainer, PageHeader } from '../components/layout/PageHeader';
import { ChartFrame, ScoreTrendChart, TopicBarChart } from '../components/charts/Charts';
import { RUBRIC, TOPIC_SHORT } from '../lib/constants';
import { formatMinutes, pluralize } from '../lib/format';
import api from '../services/api';

const LoadingSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card space-y-3 p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card h-80 p-6">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="card h-80 p-6">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  </div>
);

export const AnalyticsPage = () => {
  useDocumentTitle('Progress');
  const { data, loading, error, reload } = useAsync(async () => {
    const [ov, perf] = await Promise.all([api.get('/analytics/overview'), api.get('/analytics/performance')]);
    return { overview: ov.overview, analytics: perf.analytics };
  }, []);

  const header = (
    <PageHeader
      eyebrow="Progress"
      title="How you’re improving"
      description="Scores across every finished interview, broken down by topic, rubric criterion and difficulty."
      actions={
        <Button as={Link} to="/interviews/new" icon={Plus}>
          New interview
        </Button>
      }
    />
  );

  if (loading) return <PageContainer size="full">{header}<LoadingSkeleton /></PageContainer>;
  if (error) return <PageContainer size="full">{header}<ErrorState message={error.message} onRetry={reload} /></PageContainer>;

  const { overview, analytics } = data;
  const hasData = analytics.scoreTrend.length > 0;
  const topicRows = analytics.topicPerformance;

  return (
    <PageContainer size="full">
      {header}

      <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Average score" value={overview.completedCount ? overview.averageScore : '—'} sub={overview.readinessStatus} icon={Trophy} />
        <StatTile label="Best score" value={overview.bestScore ?? '—'} sub={`${pluralize(overview.completedCount, 'finished interview')}`} icon={Target} />
        <StatTile label="Answers scored" value={analytics.totalAnswersAnalyzed} sub={`${topicRows.length} topics practised`} icon={BarChart3} />
        <StatTile label="Practice time" value={formatMinutes(overview.totalMinutesPracticed)} sub={`${pluralize(overview.streakDays, 'day')} streak`} icon={Clock} />
      </section>

      {!hasData ? (
        <Card className="mt-6">
          <EmptyState
            icon={BarChart3}
            title="Nothing to chart yet"
            description="Finish your first interview to see score trends, topic strengths and rubric breakdowns here."
            action={
              <Button as={Link} to="/interviews/new" icon={Plus}>
                Start an interview
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartFrame
              title="Overall score by interview"
              description="Oldest to newest. Hover a point for details."
              height={260}
              table={{
                columns: ['Date', 'Interview', 'Difficulty', 'Score'],
                rows: analytics.scoreTrend.map((t) => [new Date(t.date).toLocaleDateString(), t.title, t.difficulty, t.score]),
              }}
            >
              <ScoreTrendChart data={analytics.scoreTrend} />
            </ChartFrame>

            <ChartFrame
              title="Average score by topic"
              description="Green ≥ 75 · amber 55–74 · red below 55"
              height={Math.max(260, topicRows.length * 34)}
              table={{
                columns: ['Topic', 'Answers', 'Average'],
                rows: topicRows.map((t) => [t.topic, t.attempts, t.averageScore]),
              }}
            >
              <TopicBarChart data={topicRows} />
            </ChartFrame>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card>
              <h2 className="text-base font-semibold text-ink">Rubric criteria</h2>
              <p className="mt-0.5 text-sm text-ink-3">Average across all your answers</p>
              <div className="mt-5 space-y-4">
                {RUBRIC.map((r) => (
                  <Meter
                    key={r.key}
                    label={r.label}
                    value={analytics.criteriaAverages[r.key] ?? 0}
                    max={100}
                    valueLabel={analytics.criteriaAverages[r.key] === null ? '—' : `${analytics.criteriaAverages[r.key]}%`}
                  />
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="text-base font-semibold text-ink">By difficulty</h2>
              <p className="mt-0.5 text-sm text-ink-3">Average overall score per tier</p>
              <div className="mt-5 space-y-4">
                {analytics.difficultyPerformance.map((d) => (
                  <Meter
                    key={d.difficulty}
                    label={`${d.difficulty} · ${pluralize(d.count, 'interview')}`}
                    value={d.averageScore}
                    max={100}
                    tone={d.count ? undefined : 'neutral'}
                    valueLabel={d.count ? `${d.averageScore}` : '—'}
                  />
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" /> Proctoring
              </h2>
              <p className="mt-0.5 text-sm text-ink-3">{pluralize(analytics.proctoring.sessionsMonitored, 'monitored session')}</p>
              <dl className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ['Looking at screen', analytics.proctoring.avgAttentionPct === null ? '—' : `${analytics.proctoring.avgAttentionPct}%`],
                  ['Face in view', analytics.proctoring.avgFacePresentPct === null ? '—' : `${analytics.proctoring.avgFacePresentPct}%`],
                  ['Total warnings', analytics.proctoring.totalWarnings],
                  ['Ended early', analytics.proctoring.terminatedSessions],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-xs text-ink-3">{k}</dt>
                    <dd className="num mt-1 text-lg font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr_1.1fr]">
            <Card>
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> Strengths
              </h2>
              {analytics.strongestTopics.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {analytics.strongestTopics.map((t) => (
                    <li key={t.topic} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-ink">{t.topic}</span>
                      <span className="num font-semibold text-ink">{t.averageScore}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-ink-3">Topics averaging 65 or more will appear here.</p>
              )}
            </Card>
            <Card>
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" /> Focus areas
              </h2>
              {analytics.weakestTopics.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {analytics.weakestTopics.map((t) => (
                    <li key={t.topic} className="flex items-center justify-between py-2.5 text-sm">
                      <Link to={`/interviews/new?topic=${encodeURIComponent(t.topic)}`} className="text-ink hover:text-accent-ink hover:underline">
                        {t.topic}
                      </Link>
                      <span className="num font-semibold text-ink">{t.averageScore}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-ink-3">No topics below 65. Nice work.</p>
              )}
            </Card>
            <Card className="bg-accent-soft/60">
              <p className="eyebrow">Recommended next</p>
              <h2 className="mt-2 text-lg font-semibold text-ink">
                {TOPIC_SHORT[analytics.recommendation.topic] || analytics.recommendation.topic}
              </h2>
              <Badge className="mt-2">{analytics.recommendation.difficulty}</Badge>
              <p className="mt-3 text-sm text-ink-2">{analytics.recommendation.reason}</p>
              <Button
                as={Link}
                to={`/interviews/new?topic=${encodeURIComponent(analytics.recommendation.topic)}&difficulty=${analytics.recommendation.difficulty}`}
                className="mt-5"
                iconRight={ArrowRight}
              >
                Practise this
              </Button>
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
};

export default AnalyticsPage;
