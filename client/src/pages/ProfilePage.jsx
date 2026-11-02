import React, { useState } from 'react';
import { Save, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useAsync';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Field, Input, PasswordInput, Select, Textarea, Chip } from '../components/ui/Field';
import { PageContainer, PageHeader } from '../components/layout/PageHeader';
import { TARGET_ROLES, EXPERIENCE_LEVELS, TOPICS } from '../lib/constants';
import { local, session } from '../lib/storage';
import api from '../services/api';

const BIO_MAX = 300;

export const ProfilePage = () => {
  useDocumentTitle('Profile & settings');
  const { user, updateProfile } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    name: user?.name || '',
    targetRole: user?.targetRole || 'Software Development Engineer',
    experienceLevel: user?.experienceLevel || 'Entry-Level',
    preferredTopics: user?.preferredTopics?.filter((t) => TOPICS.includes(t)) || [],
    bio: user?.bio || '',
  });
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleTopic = (t) =>
    setForm((f) => {
      const has = f.preferredTopics.includes(t);
      if (has && f.preferredTopics.length === 1) return f;
      if (!has && f.preferredTopics.length >= 8) return f;
      return { ...f, preferredTopics: has ? f.preferredTopics.filter((x) => x !== t) : [...f.preferredTopics, t] };
    });

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ ...form, name: form.name.trim(), bio: form.bio.trim() });
      toast.success('Profile saved.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pw.newPassword.length < 8) return setPwError('New password must be at least 8 characters.');
    if (pw.newPassword !== pw.confirm) return setPwError('New passwords don’t match.');
    setPwSaving(true);
    try {
      await api.put('/users/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast.success('Password updated.');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
    return undefined;
  };

  const clearLocalData = () => {
    for (const store of [window.localStorage, window.sessionStorage]) {
      try {
        Object.keys(store)
          .filter((k) => k.startsWith('mockvue_draft_') || k.startsWith('mockvue_proctoring_') || k === 'mockvue_cv_baseline')
          .forEach((k) => store.removeItem(k));
      } catch {
        /* ignore */
      }
    }
    local.remove('mockvue_cv_baseline');
    session.remove('mockvue_cv_baseline');
    toast.success('Saved drafts and calibration data cleared from this browser.');
  };

  return (
    <PageContainer size="md">
      <PageHeader eyebrow="Account" title="Profile & settings" description="Your role, level and focus topics shape the questions you get." />

      <form onSubmit={save}>
        <Card>
          <CardHeader title="Profile" description={user?.email} />
          <div className="space-y-5">
            <Field label="Full name" htmlFor="p-name">
              <Input id="p-name" value={form.name} onChange={set('name')} autoComplete="name" maxLength={100} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Target role" htmlFor="p-role">
                <Select id="p-role" value={form.targetRole} onChange={set('targetRole')}>
                  {TARGET_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.value}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Experience level" htmlFor="p-level">
                <Select id="p-level" value={form.experienceLevel} onChange={set('experienceLevel')}>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label} — {l.desc}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Focus topics" hint="Pre-selected when you create an interview. Up to 8.">
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((t) => (
                  <Chip key={t} selected={form.preferredTopics.includes(t)} onClick={() => toggleTopic(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Goal" htmlFor="p-bio" optional hint={`${form.bio.length}/${BIO_MAX}`}>
              <Textarea
                id="p-bio"
                rows={3}
                maxLength={BIO_MAX}
                value={form.bio}
                onChange={set('bio')}
                placeholder="e.g. Final-year CS student preparing for SDE-1 roles at product companies."
              />
            </Field>
          </div>
          <div className="mt-6 flex justify-end border-t border-line pt-5">
            <Button type="submit" icon={Save} isLoading={saving}>
              Save changes
            </Button>
          </div>
        </Card>
      </form>

      <form onSubmit={changePassword} className="mt-6">
        <Card>
          <CardHeader title="Password" icon={KeyRound} description="Use at least 8 characters." />
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Current" htmlFor="pw-current">
              <PasswordInput id="pw-current" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} />
            </Field>
            <Field label="New" htmlFor="pw-new">
              <PasswordInput id="pw-new" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} />
            </Field>
            <Field label="Confirm new" htmlFor="pw-confirm">
              <PasswordInput id="pw-confirm" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
            </Field>
          </div>
          {pwError && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {pwError}
            </p>
          )}
          <div className="mt-6 flex justify-end border-t border-line pt-5">
            <Button type="submit" variant="secondary" isLoading={pwSaving} disabled={!pw.currentPassword || !pw.newPassword}>
              Update password
            </Button>
          </div>
        </Card>
      </form>

      <Card className="mt-6">
        <CardHeader title="Privacy" icon={ShieldCheck} description="What MockVue keeps about you." />
        <ul className="space-y-2 text-sm text-ink-2">
          <li>Camera video and microphone audio are analysed on your device and never stored or uploaded.</li>
          <li>We store your answers, scores, and a short log of proctoring events for each interview.</li>
          <li>You can delete any interview (and its log) from the Interviews page.</li>
        </ul>
        <div className="mt-5 flex justify-end border-t border-line pt-5">
          <Button variant="ghost" icon={Trash2} onClick={clearLocalData}>
            Clear drafts saved in this browser
          </Button>
        </div>
      </Card>
    </PageContainer>
  );
};

export default ProfilePage;
