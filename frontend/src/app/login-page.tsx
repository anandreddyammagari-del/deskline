import React, { useState } from 'react';
import { useAuth } from './auth-context';

export const LoginPage: React.FC<{ onOpenEvaluator: () => void }> = ({ onOpenEvaluator }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--color-canvas)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          padding: '32px',
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
            Deskline
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Sign in to raise or manage requests
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#FEE4E2',
              border: '1px solid #FECDCA',
              color: 'var(--color-danger)',
              fontSize: '13px',
              borderRadius: '3px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              htmlFor="email"
              style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--color-text)' }}
            >
              Work email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. asha.rao@deskline.test"
              required
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                border: '1px solid var(--color-border)',
                borderRadius: '3px',
                fontSize: '14px',
                color: 'var(--color-text)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--color-text)' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                border: '1px solid var(--color-border)',
                borderRadius: '3px',
                fontSize: '14px',
                color: 'var(--color-text)',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              height: '36px',
              backgroundColor: 'var(--color-accent)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '3px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
          <button
            onClick={onOpenEvaluator}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-accent)',
              fontSize: '13px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Mentor or evaluator? Open quick access
          </button>
        </div>
      </div>
    </div>
  );
};
