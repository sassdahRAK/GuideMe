import React, { useState } from 'react';
import { FiX, FiLogIn, FiUserPlus, FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi';
import { GuideMeLogo } from '@guideme/tutorial-ui';

const API_BASE = import.meta.env.WXT_API_URL || 'http://localhost:4000';

/**
 * LoginOverlay — Inline email/password auth form for the extension popup.
 *
 * Calls the Express backend directly (/api/auth/login and /api/auth/register).
 * On success, persists authToken + userProfile to chrome.storage.local and
 * notifies the parent via onSuccess({ token, user }).
 */
export function LoginOverlay({ language = 'km', onSuccess, onClose }) {
  const isKhmer = language === 'km';

  const [mode, setMode]           = useState('login');   // 'login' | 'register'
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const label = {
    title:    { login: { km: 'ចូលគណនី', en: 'Sign In' },        register: { km: 'បង្កើតគណនី', en: 'Create Account' } },
    submit:   { login: { km: 'ចូល',     en: 'Sign In' },        register: { km: 'បង្កើតគណនី', en: 'Sign Up' } },
    toggle:   { login: { km: 'បង្កើតគណនីថ្មី', en: 'Create an account' }, register: { km: 'ចូលគណនី', en: 'Sign in' } },
    togglePre:{ login: { km: 'មិនទាន់មានគណនី?', en: "Don't have an account?" }, register: { km: 'មានគណនីហើយ?', en: 'Already have an account?' } },
    namePlh:  { km: 'ឈ្មោះរបស់អ្នក', en: 'Your name' },
    emailPlh: { km: 'អ៊ីម៉ែល', en: 'Email address' },
    pwdPlh:   { km: 'ពាក្យសម្ងាត់', en: 'Password' },
  };

  const t = (key, sub) => {
    const val = sub ? label[key]?.[sub]?.[language] : label[key]?.[language];
    return val || key;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login'
      ? { email: email.trim(), password, rememberMe: true }
      : { name: name.trim(), email: email.trim(), password, rememberMe: true };

    try {
      const res = await fetch(`${API_BASE.replace(/\/$/, '')}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.message || data?.message || (isKhmer ? 'មានបញ្ហា សូមព្យាយាមម្តងទៀត' : 'Something went wrong. Please try again.');
        setError(msg);
        return;
      }

      const { token, user } = data;
      if (!token) {
        setError(isKhmer ? 'គ្មានToken ត្រឡប់មក' : 'No token returned from server.');
        return;
      }

      // Persist to extension storage
      await chrome.storage.local.set({ authToken: token, userProfile: user || null });

      onSuccess?.({ token, user });
    } catch (err) {
      setError(isKhmer ? 'មិនអាចភ្ជាប់ទៅ Server បាន' : 'Cannot connect to server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[320px] bg-white dark:bg-[#181826] rounded-2xl border border-gray-100 dark:border-[#2d2d44] shadow-2xl overflow-hidden animate-[fadeIn_0.15s_ease-out]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
              <GuideMeLogo size={28} />
            </div>
            <span className="font-bold text-sm text-gray-900 dark:text-white">
              {t('title', mode)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252538] border-0 bg-transparent cursor-pointer transition-colors"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 flex flex-col gap-3">

          {mode === 'register' && (
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlh')}
                required
                autoComplete="name"
                className="w-full rounded-xl border border-gray-200 dark:border-[#2d2d44] bg-gray-50 dark:bg-[#101018] px-3.5 py-2.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>
          )}

          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlh')}
              required
              autoComplete="email"
              className="w-full rounded-xl border border-gray-200 dark:border-[#2d2d44] bg-gray-50 dark:bg-[#101018] px-3.5 py-2.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
          </div>

          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('pwdPlh')}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full rounded-xl border border-gray-200 dark:border-[#2d2d44] bg-gray-50 dark:bg-[#101018] px-3.5 py-2.5 pr-9 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 border-0 bg-transparent cursor-pointer p-0"
            >
              {showPwd ? <FiEyeOff className="w-3.5 h-3.5" /> : <FiEye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
              <FiAlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-snug">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-60 disabled:cursor-not-allowed border-0 cursor-pointer transition-colors shadow-sm shadow-purple-500/30"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : mode === 'login' ? (
              <FiLogIn className="w-3.5 h-3.5" />
            ) : (
              <FiUserPlus className="w-3.5 h-3.5" />
            )}
            <span>{t('submit', mode)}</span>
          </button>

          {/* Mode toggle */}
          <p className="text-center text-[11px] text-gray-500 dark:text-zinc-400">
            {t('togglePre', mode)}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-purple-600 dark:text-purple-400 font-semibold hover:underline border-0 bg-transparent cursor-pointer p-0"
            >
              {t('toggle', mode)}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
