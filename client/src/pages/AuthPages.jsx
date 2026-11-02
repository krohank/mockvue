import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Lock, User, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Field, Input, PasswordInput, Select } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import { LogoMark } from '../components/layout/Logo';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useAsync';
import { TARGET_ROLES, EXPERIENCE_LEVELS } from '../lib/constants';
import api from '../services/api';

const DEMO_ACCOUNTS = [
  { email: 'candidate@mockvue.edu', name: 'Aarav Sharma', note: 'Entry level · SDE' },
  { email: 'megenta.point@gmail.com', name: 'Magenta Point', note: 'Mid level · SDE' },
];
const DEMO_PASSWORD = 'password123';

const AuthShell = ({ title, subtitle, children, footer }) => (
  <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
    <div className="mx-auto w-full max-w-md animate-slide-up">
      <LogoMark className="h-10 w-10" />
      <h1 className="display mt-6 text-3xl">{title}</h1>
      {subtitle && <p className="mt-2 text-ink-2">{subtitle}</p>}
      <div className="mt-8">{children}</div>
      {footer && <p className="mt-8 text-sm text-ink-3">{footer}</p>}
    </div>
    <aside className="hidden lg:block" aria-hidden="true">
      <div className="card relative overflow-hidden p-10">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent-soft blur-3xl" />
        <div className="relative">
          <Sparkles className="h-6 w-6 text-brass" />
          <p className="display mt-6 text-[1.75rem] leading-snug">
            The best preparation for an interview is doing one — out loud, on the clock, with honest feedback.
          </p>
          <ul className="mt-8 space-y-3 text-[15px] text-ink-2">
            {[
              'Questions matched to your role and level',
              'Rubric scores and model answers for every response',
              'On-device proctoring that mirrors real exams',
              'Progress tracked by topic and criterion',
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  </div>
);

export const LoginPage = () => {
  useDocumentTitle('Sign in');
  const { login, sessionNotice, clearSessionNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null); // 'form' | email of demo account
  const [demoAvailable, setDemoAvailable] = useState(false);

  useEffect(() => {
    api.get('/health').then((h) => setDemoAvailable(Boolean(h?.demoAccounts))).catch(() => {});
  }, []);

  const goNext = () => navigate(location.state?.from?.pathname || '/dashboard', { replace: true });

  const submit = async (e, creds) => {
    e?.preventDefault();
    const loginEmail = creds?.email ?? email;
    const loginPassword = creds?.password ?? password;
    if (!loginEmail || !loginPassword) {
      setError('Enter your email and password.');
      return;
    }
    setError('');
    clearSessionNotice();
    setPending(creds ? loginEmail : 'form');
    try {
      await login(loginEmail, loginPassword);
      goNext();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(null);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue practicing."
      footer={
        <>
          New to MockVue?{' '}
          <Link to="/register" className="link">
            Create an account
          </Link>
        </>
      }
    >
      {sessionNotice && (
        <Alert tone="warning" className="mb-5">
          {sessionNotice}
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mb-5">
          {error}
        </Alert>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="login-email">
          <Input
            id="login-email"
            type="email"
            icon={Mail}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@college.edu"
            required
          />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <PasswordInput
            id="login-password"
            icon={Lock}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" isLoading={pending === 'form'} iconRight={ArrowRight}>
          Sign in
        </Button>
      </form>

      {demoAvailable && (
        <div className="mt-8">
          <div className="flex items-center gap-3 text-xs text-ink-3">
            <span className="h-px flex-1 bg-line" />
            or try a demo account
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={Boolean(pending)}
                onClick={() => submit(null, { email: acc.email, password: DEMO_PASSWORD })}
                className="card-interactive flex flex-col items-start rounded-xl p-3 text-left disabled:opacity-60"
              >
                <span className="text-sm font-semibold text-ink">{pending === acc.email ? 'Signing in…' : acc.name}</span>
                <span className="text-xs text-ink-3">{acc.note}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-3">Demo accounts come with sample sessions so you can explore reports and progress.</p>
        </div>
      )}
    </AuthShell>
  );
};

const passwordStrength = (pw) => {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (pw.length < 8) return { label: 'Too short', tone: 'bg-danger', width: '20%' };
  if (score <= 2) return { label: 'Okay', tone: 'bg-warning', width: '50%' };
  if (score <= 3) return { label: 'Good', tone: 'bg-success', width: '75%' };
  return { label: 'Strong', tone: 'bg-success', width: '100%' };
};

export const RegisterPage = () => {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    targetRole: 'Software Development Engineer',
    experienceLevel: 'Entry-Level',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const strength = passwordStrength(form.password);

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.password.length < 8) next.password = 'Use at least 8 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setPending(true);
    setError('');
    try {
      await register({ ...form, name: form.name.trim(), email: form.email.trim() });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free, takes a minute. We’ll tailor questions to your role."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="link">
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <Alert tone="danger" className="mb-5">
          {error}
        </Alert>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="reg-name" error={errors.name}>
          <Input id="reg-name" icon={User} autoComplete="name" value={form.name} onChange={set('name')} placeholder="Aarav Sharma" />
        </Field>
        <Field label="Email" htmlFor="reg-email" error={errors.email}>
          <Input id="reg-email" type="email" icon={Mail} autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@college.edu" />
        </Field>
        <Field label="Password" htmlFor="reg-password" error={errors.password} hint={!errors.password && 'At least 8 characters.'}>
          <PasswordInput id="reg-password" icon={Lock} autoComplete="new-password" value={form.password} onChange={set('password')} />
          {form.password && (
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div className={`h-full rounded-full ${strength.tone} transition-all`} style={{ width: strength.width }} />
              </div>
              <span className="w-16 text-right text-xs text-ink-3">{strength.label}</span>
            </div>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target role" htmlFor="reg-role">
            <Select id="reg-role" value={form.targetRole} onChange={set('targetRole')}>
              {TARGET_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Experience" htmlFor="reg-level">
            <Select id="reg-level" value={form.experienceLevel} onChange={set('experienceLevel')}>
              {EXPERIENCE_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button type="submit" size="lg" className="w-full" isLoading={pending} iconRight={ArrowRight}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
};
