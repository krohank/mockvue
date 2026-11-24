import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, AlertCircle, Eye, EyeOff, Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';

const AuthForm = ({ registering = false }) => {
  const auth = useAuth(), navigate = useNavigate(), location = useLocation();
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [role, setRole] = useState('Software Development Engineer'), [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [demoLogin, setDemoLogin] = useState(false);
  const destination = demoLogin ? '/dashboard' : location.state?.from?.pathname || '/dashboard';
  useEffect(() => { if (auth.isAuthenticated && !auth.loading) navigate(destination, { replace: true }); }, [auth.isAuthenticated, auth.loading, navigate, destination]);
  const submit = async (event, demo = false) => {
    event?.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); if (demo) setDemoLogin(true);
    try {
      if (demo) await auth.login('candidate@mockvue.edu', 'password123');
      else if (registering) await auth.register({ name: name.trim(), email: email.trim(), password, targetRole: role });
      else await auth.login(email.trim(), password);
      navigate(demo ? '/dashboard' : destination, { replace: true });
    } catch (err) { setError(err.message || 'Could not sign in. Please try again.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 grid lg:grid-cols-2 gap-10 lg:gap-20 items-center min-h-[80vh]">
      <div className="max-w-lg">
        <p className="text-sm font-semibold text-[#7A263A] dark:text-[#D4AA6A] mb-5">MockVue</p>
        <h1 className="text-4xl sm:text-5xl font-serif font-bold leading-[1.12] tracking-tight">Get comfortable answering out loud.</h1>
        <p className="mt-5 text-base leading-relaxed text-[#68645E] dark:text-[#9E988F]">Practice technical questions, review your answers, and see what to work on next.</p>
        <ul className="mt-8 space-y-4 text-sm text-[#68645E] dark:text-[#9E988F]">
          {['Choose questions by role and topic.', 'Record an answer or type at your own pace.', 'Keep your results and pick up where you left off.'].map((text) => <li key={text} className="flex gap-3 items-start"><Check className="w-4 h-4 text-[#3F6B52] shrink-0 mt-0.5" />{text}</li>)}
        </ul>
      </div>
      <Card className="!p-6 sm:!p-8">
        <h2 className="font-serif text-2xl font-bold">{registering ? 'Create an account' : 'Sign in'}</h2>
        <p className="mt-2 text-sm text-[#68645E] dark:text-[#9E988F]">{registering ? 'Save your interviews and track your progress.' : 'Continue your interview practice.'}</p>
        {error && <div role="alert" className="mv-alert mt-5"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        <form onSubmit={submit} className="mt-6 space-y-5">
          {registering && <div><label htmlFor="auth-name" className="mv-label">Full name</label><input id="auth-name" name="name" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mv-input" /></div>}
          <div><label htmlFor="auth-email" className="mv-label">Email</label><input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="mv-input" placeholder="you@example.com" /></div>
          <div><label htmlFor="auth-password" className="mv-label">Password</label><div className="relative"><input id="auth-password" name="password" type={visible ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 6 : undefined} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} className="mv-input !pr-11" /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#68645E] dark:text-[#9E988F]">{visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>{registering && <p className="mt-1.5 text-xs text-[#68645E] dark:text-[#9E988F]">Use at least 6 characters.</p>}</div>
          {registering && <div><label htmlFor="auth-role" className="mv-label">Target role</label><select id="auth-role" value={role} onChange={(e) => setRole(e.target.value)} className="mv-input">{['Software Development Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Data Analyst', 'Java Developer'].map((value) => <option key={value}>{value}</option>)}</select></div>}
          <Button type="submit" size="lg" className="w-full" isLoading={busy} icon={ArrowRight}>{registering ? 'Create account' : 'Sign in'}</Button>
        </form>
        {!registering && <div className="mt-6 pt-5 border-t border-[#DED9D0] dark:border-[#332F2A]"><Button type="button" className="w-full" variant="outline" disabled={busy} onClick={(event) => submit(event, true)}>Try the demo</Button><p className="mt-2 text-center text-xs text-[#68645E] dark:text-[#9E988F]">Explore with a sample account.</p></div>}
        <p className="mt-6 text-center text-sm text-[#68645E] dark:text-[#9E988F]">{registering ? 'Already have an account? ' : 'New to MockVue? '}<Link to={registering ? '/login' : '/register'} className="font-semibold text-[#7A263A] dark:text-[#D4AA6A] hover:underline">{registering ? 'Sign in' : 'Create an account'}</Link></p>
      </Card>
    </div>
  );
};
export const LoginPage = () => <AuthForm />;
export const RegisterPage = () => <AuthForm registering />;
