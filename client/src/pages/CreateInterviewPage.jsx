import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Sparkles, Clock, ListChecks, Layers, Gauge, Briefcase, Minus, Plus, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useAsync';
import { Button } from '../components/ui/Button';
import { Chip, ChoiceCard } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import { PageContainer, PageHeader } from '../components/layout/PageHeader';
import { TARGET_ROLES, TOPICS, ROLE_TOPICS, DIFFICULTIES, INTERVIEW_TYPES, PRESETS, TOPIC_SHORT } from '../lib/constants';
import api from '../services/api';

const DURATIONS = [10, 15, 20, 25, 30, 45, 60];
const MINUTES_PER_QUESTION = { Easy: 3, Medium: 4, Hard: 5 };
const MAX_TOPICS = 8;

const suggestDuration = (count, difficulty) => {
  const ideal = count * (MINUTES_PER_QUESTION[difficulty] || 4);
  return DURATIONS.find((d) => d >= ideal) || DURATIONS[DURATIONS.length - 1];
};

const Section = ({ icon: Icon, title, description, children }) => (
  <section className="card p-5 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
      </div>
    </div>
    {children}
  </section>
);

export const CreateInterviewPage = () => {
  useDocumentTitle('New interview');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const initialTopics = useMemo(() => {
    const fromQuery = params.get('topic');
    if (fromQuery && TOPICS.includes(fromQuery)) return [fromQuery];
    const preferred = (user?.preferredTopics || []).filter((t) => TOPICS.includes(t));
    return preferred.length ? preferred.slice(0, 4) : ROLE_TOPICS[user?.targetRole]?.slice(0, 2) || [TOPICS[0]];
  }, [params, user]);

  const [targetRole, setTargetRole] = useState(user?.targetRole || 'Software Development Engineer');
  const [topics, setTopics] = useState(initialTopics);
  const [difficulty, setDifficulty] = useState(['Easy', 'Medium', 'Hard'].includes(params.get('difficulty')) ? params.get('difficulty') : 'Medium');
  const [interviewType, setInterviewType] = useState(initialTopics.length === 1 && initialTopics[0] === 'HR & Behavioral' ? 'Behavioral' : 'Technical');
  const [questionCount, setQuestionCount] = useState(5);
  const [duration, setDuration] = useState(suggestDuration(5, difficulty));
  const [durationTouched, setDurationTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const effectiveDuration = durationTouched ? duration : suggestDuration(questionCount, difficulty);
  const suggested = ROLE_TOPICS[targetRole] || [];
  const orderedTopics = [...suggested, ...TOPICS.filter((t) => !suggested.includes(t))];

  const toggleTopic = (topic) => {
    setTopics((list) => {
      if (list.includes(topic)) return list.length === 1 ? list : list.filter((t) => t !== topic);
      return list.length >= MAX_TOPICS ? list : [...list, topic];
    });
  };

  const applyPreset = (preset) => {
    const c = preset.config;
    if (c.targetRole) setTargetRole(c.targetRole);
    setTopics(c.topics);
    setDifficulty(c.difficulty);
    setInterviewType(c.interviewType);
    setQuestionCount(c.questionCount);
    setDuration(c.durationMinutes);
    setDurationTouched(true);
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/interviews/generate', {
        targetRole,
        topics: interviewType === 'HR' || interviewType === 'Behavioral' ? ['HR & Behavioral'] : topics,
        difficulty,
        interviewType,
        questionCount,
        durationMinutes: effectiveDuration,
      });
      navigate(`/interviews/${res.interviewId}/prep`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const behavioralOnly = interviewType === 'HR' || interviewType === 'Behavioral';

  return (
    <PageContainer size="full">
      <PageHeader
        eyebrow="New interview"
        title="Set up your mock interview"
        description="Choose what you want to be asked. Questions are generated for your role and level, and you’ll do a quick camera check before the timer starts."
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-ink-3">Presets:</span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 hover:border-line-strong hover:text-ink"
          >
            <Sparkles className="h-3.5 w-3.5 text-brass" aria-hidden="true" />
            {p.title}
            <span className="text-ink-3">· {p.desc}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-6">
          <Section icon={Briefcase} title="Role" description="Questions and suggested topics follow the role you’re preparing for.">
            <div role="radiogroup" aria-label="Target role" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {TARGET_ROLES.map((r) => (
                <ChoiceCard key={r.value} selected={targetRole === r.value} onClick={() => setTargetRole(r.value)} title={r.value} description={r.desc} />
              ))}
            </div>
          </Section>

          <Section
            icon={Layers}
            title="Topics"
            description={behavioralOnly ? 'Behavioral and HR interviews use the HR & Behavioral question set.' : `Pick up to ${MAX_TOPICS}. Questions are spread evenly across them.`}
          >
            <div className="flex flex-wrap gap-2" aria-label="Topics">
              {orderedTopics.map((t) => (
                <Chip key={t} selected={topics.includes(t)} onClick={() => toggleTopic(t)} disabled={!topics.includes(t) && topics.length >= MAX_TOPICS}>
                  {t}
                  {suggested.includes(t) && !topics.includes(t) && <span className="text-[11px] text-brass">suggested</span>}
                </Chip>
              ))}
            </div>
          </Section>

          <Section icon={Gauge} title="Format & difficulty">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Interview type</p>
                <div role="radiogroup" aria-label="Interview type" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {INTERVIEW_TYPES.map((t) => (
                    <ChoiceCard key={t.value} selected={interviewType === t.value} onClick={() => setInterviewType(t.value)} title={t.value} description={t.desc} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Difficulty</p>
                <div role="radiogroup" aria-label="Difficulty" className="grid gap-3 sm:grid-cols-3">
                  {DIFFICULTIES.map((d) => (
                    <ChoiceCard key={d.value} selected={difficulty === d.value} onClick={() => setDifficulty(d.value)} title={d.value} description={d.desc} />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section icon={Clock} title="Length" description="We suggest a time budget from the question count and difficulty.">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-ink" id="qcount-label">
                  Questions
                </p>
                <div className="flex items-center gap-3" role="group" aria-labelledby="qcount-label">
                  <Button variant="secondary" size="icon" aria-label="Fewer questions" onClick={() => setQuestionCount((n) => Math.max(1, n - 1))} disabled={questionCount <= 1}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="num w-10 text-center text-2xl font-semibold text-ink" aria-live="polite">
                    {questionCount}
                  </span>
                  <Button variant="secondary" size="icon" aria-label="More questions" onClick={() => setQuestionCount((n) => Math.min(10, n + 1))} disabled={questionCount >= 10}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Time limit</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Time limit in minutes">
                  {DURATIONS.map((d) => (
                    <Chip
                      key={d}
                      selected={effectiveDuration === d}
                      onClick={() => {
                        setDuration(d);
                        setDurationTouched(true);
                      }}
                    >
                      <span className="num">{d}</span> min
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-24">
          <div className="card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <ListChecks className="h-4 w-4 text-accent-ink" aria-hidden="true" /> Summary
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ['Role', targetRole],
                ['Type', interviewType],
                ['Difficulty', difficulty],
                ['Questions', questionCount],
                ['Time limit', `${effectiveDuration} min`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
              <div>
                <dt className="text-ink-3">Topics</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {(behavioralOnly ? ['HR & Behavioral'] : topics).map((t) => (
                    <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
                      {TOPIC_SHORT[t] || t}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
            {error && (
              <Alert tone="danger" className="mt-5">
                {error}
              </Alert>
            )}
            <Button size="lg" className="mt-6 w-full" onClick={submit} isLoading={submitting} iconRight={ArrowRight}>
              {submitting ? 'Generating questions…' : 'Generate interview'}
            </Button>
            <p className="mt-3 text-center text-xs text-ink-3">
              The timer starts only when you enter the interview room.{' '}
              <Link to="/#proctoring" className="link">
                Proctoring rules
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
};

export default CreateInterviewPage;
