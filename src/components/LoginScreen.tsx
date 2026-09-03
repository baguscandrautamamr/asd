import React, { useState } from 'react';
import { Flame, Languages, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

/** Email sign-in / sign-up gate, styled to match the app shell. */
export const LoginScreen: React.FC = () => {
  const { t, lang, setLang } = useI18n();
  const { signIn, signUp, sendMagicLink } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        const pending = await signUp(email.trim(), password, fullName.trim());
        if (pending) setNotice(t('auth.confirmEmail'));
      }
    } catch (err) {
      // Surface Supabase's own message when it has one: "Invalid login
      // credentials" is more useful than a generic failure line.
      setError(err instanceof Error ? err.message : t('auth.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const magicLink = async () => {
    if (!email.trim()) {
      setError(t('auth.errorGeneric'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendMagicLink(email.trim());
      setNotice(t('auth.magicLinkSent'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="bg-shell border-b-[3px] border-brand-2">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <Flame className="w-4 h-4 text-white" />
            </span>
            <div className="leading-tight">
              <p className="font-extrabold text-sm text-white">{t('app.title')}</p>
              <p className="text-2xs text-white/55">{t('auth.tagline')}</p>
            </div>
          </div>

          <div className="pill-group">
            {(['id', 'en'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`pill ${
                  lang === code ? 'bg-brand-2 text-shell' : 'text-white/70 hover:text-white'
                }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 sm:p-8">
        <div className="surface-card w-full max-w-sm p-6 mt-8 sm:mt-16">
          <h1 className="font-extrabold text-lg text-ink mb-1">
            {mode === 'signin' ? t('auth.signInTitle') : t('auth.signUpTitle')}
          </h1>
          <p className="text-xs text-ink-3 mb-5">{t('auth.tagline')}</p>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1">
                  {t('auth.fullName')}
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder={t('auth.fullNamePh')}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="field"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1">
                {t('auth.email')}
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder={t('auth.emailPh')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1">
                {t('auth.password')}
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder={t('auth.passwordPh')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
              />
            </div>

            {error && (
              <p className="text-xs text-bad bg-bad-wash border border-bad/25 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {notice && (
              <p className="text-xs text-ok bg-ok-wash border border-ok/25 rounded-lg px-3 py-2">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-ink text-white font-bold text-sm transition-colors disabled:opacity-70"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy
                ? mode === 'signin'
                  ? t('auth.signingIn')
                  : t('auth.creating')
                : mode === 'signin'
                ? t('auth.signIn')
                : t('auth.signUp')}
            </button>
          </form>

          <button
            type="button"
            onClick={magicLink}
            disabled={busy}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-line text-ink-2 hover:bg-surface-2 font-semibold text-xs transition-colors disabled:opacity-70"
          >
            <Mail className="w-3.5 h-3.5" />
            {t('auth.magicLink')}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setNotice(null);
            }}
            className="w-full mt-4 text-xs font-semibold text-brand hover:text-brand-ink transition-colors"
          >
            {mode === 'signin' ? t('auth.toSignUp') : t('auth.toSignIn')}
          </button>
        </div>
      </main>
    </div>
  );
};
