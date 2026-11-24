import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  AlertCircle,
  Check,
  Compass,
  Plus,
  TrendingUp,
  Target
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar
} from 'recharts';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import api from '../services/api';
import { PageError } from '../components/PageError';

export const AnalyticsPage = () => {
  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/analytics/overview'), api.get('/analytics/performance')])
      .then(([ovRes, perfRes]) => {
        setOverview(ovRes.overview);
        setAnalytics(perfRes.analytics);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load analytics.');
        setLoading(false);
      });
  }, []);

  if (error) return <PageError title="Could not load your progress" message={error} />;
  if (loading) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center">
        <Spinner size="lg" label="Loading your progress..." />
      </div>
    );
  }

  const scoreTrend = analytics?.scoreTrend || [];
  const topicPerformance = analytics?.topicPerformance || [];
  const recommendation = analytics?.recommendation;
  const hasData = scoreTrend.length > 0 || (analytics?.topicPerformance?.length || 0) > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DED9D0] dark:border-[#332F2A]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-[#7A263A] dark:text-[#D4AA6A] font-semibold uppercase tracking-wider">
              Your practice
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#171717] dark:text-[#F7F4EE] tracking-tight">
            Progress
          </h1>
          <p className="text-xs text-[#68645E] dark:text-[#9E988F] mt-0.5 font-mono">
            Scores and topics from your interviews.
          </p>
        </div>

        <Link to="/interviews/new">
          <Button icon={Plus} size="md">
            New interview
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[#FAF0F0] dark:bg-[#A33B3B]/20 border border-[#E8C4C4] dark:border-[#A33B3B]/40 flex items-center gap-2 text-xs text-[#A33B3B] dark:text-[#E59797] font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Overview Stat Cards - Editorial Monospace Standard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 sm:p-5 shadow-paper">
          <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#68645E] dark:text-[#9E988F] block mb-1">
            Completed interviews
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-mono text-3xl font-bold text-[#171717] dark:text-[#F7F4EE]">
              {overview?.completedCount || 0}
            </span>
            <span className="text-xs text-[#68645E] dark:text-[#9E988F] font-mono">of {overview?.totalInterviews || 0} started</span>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 shadow-paper">
          <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#68645E] dark:text-[#9E988F] block mb-1">
            Average score
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-mono text-3xl font-bold text-[#7A263A] dark:text-[#D4AA6A]">
              {overview?.gradedCount ? `${overview.averageScore}%` : '—'}
            </span>
            <Badge variant={overview?.averageScore >= 75 ? 'success' : 'neutral'} size="sm">
              {overview?.gradedCount ? 'Model graded' : 'No grades yet'}
            </Badge>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 shadow-paper">
          <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#68645E] dark:text-[#9E988F] block mb-1">
            Practice time
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-mono text-3xl font-bold text-[#171717] dark:text-[#F7F4EE]">
              {overview?.totalMinutesPracticed || 0}m
            </span>
            <span className="text-xs text-[#68645E] dark:text-[#9E988F] font-mono">In interviews</span>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 shadow-paper">
          <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#68645E] dark:text-[#9E988F] block mb-1">
            Answers reviewed
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-mono text-3xl font-bold text-[#3F6B52] dark:text-[#88BA9D]">
              {analytics?.totalAnswersAnalyzed || 0}
            </span>
            <span className="text-xs text-[#68645E] dark:text-[#9E988F] font-mono">Model-graded answers</span>
          </div>
        </Card>
      </div>

      {/* Targeted Next Best Action Advisory */}
      {recommendation && (
        <div className="p-5 rounded-xl border border-[#DED9D0] dark:border-[#332F2A] bg-[#FFFDF9] dark:bg-[#1C1916] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-paper">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#FAF0F2] dark:bg-[#7A263A]/20 text-[#7A263A] dark:text-[#E8A5B2] border border-[#E8C5CC] dark:border-[#7A263A]/40">
                What to practice next
              </span>
              <Badge variant="warning" size="sm">{recommendation.difficulty?.toUpperCase()}</Badge>
            </div>
            <h3 className="text-base font-serif font-bold text-[#171717] dark:text-[#F7F4EE]">
              Topic: {recommendation.topic}
            </h3>
            <p className="text-xs text-[#68645E] dark:text-[#9E988F] leading-relaxed font-sans">
              {recommendation.reason}
            </p>
          </div>

          <Link to={"/interviews/new?topic=" + encodeURIComponent(recommendation.topic) + "&difficulty=" + encodeURIComponent(recommendation.difficulty)} className="shrink-0">
            <Button size="sm">
              Practice {recommendation.topic}
            </Button>
          </Link>
        </div>
      )}

      {/* Visual Analytics Charts Section */}
      {!hasData ? (
        <Card className="p-12 text-center max-w-lg mx-auto shadow-paper">
          <div className="w-10 h-10 rounded-lg bg-[#F0ECE4] dark:bg-[#24201C] text-[#68645E] dark:text-[#9E988F] flex items-center justify-center mx-auto mb-3 border border-[#DED9D0] dark:border-[#332F2A]">
            <BarChart3 className="w-5 h-5 text-[#7A263A] dark:text-[#D4AA6A]" />
          </div>
          <h3 className="text-sm font-serif font-bold text-[#171717] dark:text-[#F7F4EE] mb-1">
            No model grades yet
          </h3>
          <p className="text-xs text-[#68645E] dark:text-[#9E988F] mb-5 leading-relaxed">
            Score charts require local-model grading. Guided practice answers remain ungraded and are excluded from these charts.
          </p>
          <Link to="/interviews/new">
            <Button size="sm" icon={Plus}>Start an interview</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Chart 1: Score Progression Over Time */}
          <Card className="p-5 shadow-paper">
            <CardHeader
              title="Scores over time"
              subtitle="Your score for each completed interview."
            />
            <CardBody className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scoreTrend} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DED9D0" opacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#68645E' }} stroke="#DED9D0" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#68645E' }} stroke="#DED9D0" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#171717',
                      border: '1px solid #332F2A',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#F7F4EE',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#7A263A"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#7A263A', strokeWidth: 1.5, stroke: '#FFFDF9' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {/* Chart 2: Average Score by Topic */}
          <Card className="p-5 shadow-paper">
            <CardHeader
              title="Scores by topic"
              subtitle="Your average answer score in each topic."
            />
            <CardBody className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicPerformance} margin={{ top: 10, right: 20, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DED9D0" opacity={0.5} />
                  <XAxis dataKey="topic" tick={{ fontSize: 9, fill: '#68645E' }} interval={0} angle={-15} textAnchor="end" stroke="#DED9D0" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#68645E' }} stroke="#DED9D0" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#171717',
                      border: '1px solid #332F2A',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#F7F4EE',
                    }}
                  />
                  <Bar dataKey="averageScore" fill="#C59A5B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Strong vs Weak Topics Diagnoser */}
      {hasData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5 shadow-paper">
            <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-[#171717] dark:text-[#F7F4EE] mb-3 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#3F6B52]" />
              Higher-scoring topics (65%+)
            </h3>
            {analytics?.strongestTopics?.length > 0 ? (
              <div className="space-y-2">
                {analytics.strongestTopics.map((t) => (
                  <div key={t.topic} className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-[#EFF5F1] dark:bg-[#3F6B52]/20 border border-[#C2D9CB] dark:border-[#3F6B52]/40 font-mono">
                    <span className="font-medium text-[#171717] dark:text-[#F7F4EE]">{t.topic}</span>
                    <span className="font-bold text-[#3F6B52] dark:text-[#88BA9D]">{t.averageScore}% avg</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#68645E] dark:text-[#9E988F] font-mono">Complete more interviews to see your higher-scoring topics.</p>
            )}
          </Card>

          <Card className="p-5 shadow-paper">
            <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-[#171717] dark:text-[#F7F4EE] mb-3 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-[#A66A24]" />
              Topics to work on (below 65%)
            </h3>
            {analytics?.weakestTopics?.length > 0 ? (
              <div className="space-y-2">
                {analytics.weakestTopics.map((t) => (
                  <div key={t.topic} className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-[#FBF5EC] dark:bg-[#A66A24]/20 border border-[#E8D5BE] dark:border-[#A66A24]/40 font-mono">
                    <span className="font-medium text-[#171717] dark:text-[#F7F4EE]">{t.topic}</span>
                    <span className="font-bold text-[#A66A24] dark:text-[#DEAC74]">{t.averageScore}% avg</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#68645E] dark:text-[#9E988F] font-mono">No topics are below 65%.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
