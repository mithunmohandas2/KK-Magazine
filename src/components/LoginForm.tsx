'use client';

import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordAction = showPassword ? 'Hide password' : 'Show password';
  const PasswordIcon = showPassword ? EyeOff : Eye;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-KK-Request': '1' },
        body: JSON.stringify({ email: fields.get('email'), password: fields.get('password') }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      window.location.assign('/dashboard');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to log in.');
      setBusy(false);
    }
  }

  return <form className="stack" onSubmit={submit}>
    <label>Email<input className="field" name="email" type="email" autoComplete="username" maxLength={254} required /></label>
    <div>
      <label htmlFor="login-password">Password</label>
      <div className="login-password-control">
        <input
          id="login-password"
          className="field"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          maxLength={128}
          required
        />
        <button
          type="button"
          className="login-password-toggle"
          aria-label={passwordAction}
          title={passwordAction}
          onClick={() => setShowPassword((visible) => !visible)}
        >
          <PasswordIcon size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
  </form>;
}
