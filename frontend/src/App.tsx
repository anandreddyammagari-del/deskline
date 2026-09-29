import React, { useState } from 'react';
import { AuthProvider, useAuth } from './app/auth-context';
import { TopBar } from './components/TopBar';
import { LoginPage } from './app/login-page';
import { EvaluatorPage } from './app/evaluator-page';

const DashboardContent: React.FC = () => {
  const { user, authFetch } = useAuth();
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async (title: string, url: string) => {
    setActiveTest(title);
    setLoading(true);
    setTestResult(null);

    try {
      const res = await authFetch(url);
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : await res.text();

      setTestResult({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        data,
      });
    } catch (err: any) {
      setTestResult({
        status: 0,
        statusText: 'Network / Client Error',
        ok: false,
        data: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-canvas)' }}>
      <TopBar />

      <main style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        {/* Welcome Banner */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            padding: '20px 24px',
            marginBottom: '20px',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
            Welcome, {user?.name}
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Signed in as <strong>{user?.role}</strong>{' '}
            {user?.departmentName && <span>in the <strong>{user.departmentName}</strong> department</span>}.
            Your JWT access token is stored safely in-memory only.
          </p>
        </div>

        {/* Verification & RBAC Diagnostics Panel */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            padding: '24px',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
              Phase 1 Authorization & RBAC Probes
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Test backend role guards and department scope guards directly from this session:
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={() => runTest('Categories (Any signed-in user)', '/api/categories')}
              style={{
                backgroundColor: 'var(--color-accent)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '3px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Test GET /categories (Public Auth)
            </button>

            <button
              onClick={() => runTest('Agent Queue (Agent / Manager / Admin)', '/api/agent/queue')}
              style={{
                backgroundColor: '#0F5F8C',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '3px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Test GET /agent/queue (Staff Only)
            </button>

            <button
              onClick={() => runTest('Admin User Directory (Admin Only)', '/api/admin/users')}
              style={{
                backgroundColor: '#9A4A0C',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '3px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Test GET /admin/users (Admin Only)
            </button>

            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: '3px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Reload Page (Verify Refresh Token)
            </button>
          </div>

          {loading && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', padding: '12px 0' }}>
              Dispatching request with in-memory Bearer token...
            </div>
          )}

          {testResult && (
            <div
              style={{
                backgroundColor: 'var(--color-canvas)',
                border: `1px solid ${testResult.ok ? 'var(--status-resolved-border)' : 'var(--color-danger)'}`,
                borderRadius: '4px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
                  {activeTest}
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '3px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: testResult.ok ? 'var(--status-resolved-bg)' : '#FEE4E2',
                    color: testResult.ok ? 'var(--status-resolved-text)' : 'var(--color-danger)',
                  }}
                >
                  HTTP {testResult.status} {testResult.statusText}
                </span>
              </div>

              <pre
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--color-border)',
                  borderRadius: '3px',
                  padding: '12px',
                  fontSize: '12px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}
              >
                {typeof testResult.data === 'object'
                  ? JSON.stringify(testResult.data, null, 2)
                  : testResult.data}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [showEvaluator, setShowEvaluator] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '14px',
        }}
      >
        Restoring session...
      </div>
    );
  }

  if (user) {
    return <DashboardContent />;
  }

  if (showEvaluator) {
    return <EvaluatorPage onBackToLogin={() => setShowEvaluator(false)} />;
  }

  return <LoginPage onOpenEvaluator={() => setShowEvaluator(true)} />;
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
