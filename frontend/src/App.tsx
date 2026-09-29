import React, { useEffect, useState } from 'react';

interface HealthData {
  status: string;
  service: string;
  timestamp: string;
  uptime?: number;
}

export default function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: HealthData = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to API proxy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar - 48px */}
      <header
        style={{
          height: '48px',
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-text)' }}>Deskline</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>| Employee Service Request System</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          <span>Phase 0: Environment Setup</span>
          <span
            style={{
              padding: '2px 8px',
              backgroundColor: health?.status === 'ok' ? 'var(--status-resolved-bg)' : 'var(--status-new-bg)',
              color: health?.status === 'ok' ? 'var(--status-resolved-text)' : 'var(--status-new-text)',
              border: `1px solid ${health?.status === 'ok' ? 'var(--status-resolved-border)' : 'var(--status-new-border)'}`,
              borderRadius: '3px',
              fontWeight: 500,
            }}
          >
            {loading ? 'Checking...' : health?.status === 'ok' ? 'System Ready' : 'Standby'}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            padding: '24px',
            borderRadius: '4px',
          }}
        >
          <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text)' }}>
            Service Desk Architecture Skeleton
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '20px' }}>
            Verification checkpoint for single-origin reverse proxy, container orchestration, and API health.
          </p>

          <div
            style={{
              backgroundColor: 'var(--color-canvas)',
              border: '1px solid var(--color-border)',
              padding: '16px',
              borderRadius: '4px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 500, fontSize: '13px' }}>Web Proxy to API Health Probe: <code>/api/health</code></span>
              <button
                onClick={checkHealth}
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Re-check Probe
              </button>
            </div>

            {loading && <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Probing /api/health...</div>}

            {error && (
              <div
                style={{
                  color: 'var(--color-danger)',
                  fontSize: '13px',
                  backgroundColor: '#FEE4E2',
                  padding: '8px 12px',
                  borderRadius: '3px',
                  border: '1px solid #FECDCA',
                }}
              >
                Proxy Connection Error: {error}
              </div>
            )}

            {health && (
              <pre
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '12px',
                  borderRadius: '3px',
                  border: '1px solid var(--color-border)',
                  fontSize: '12px',
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify(health, null, 2)}
              </pre>
            )}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            <strong>Container Architecture:</strong>
            <ul style={{ marginTop: '6px', marginLeft: '18px', lineHeight: '1.8' }}>
              <li><strong>db:</strong> PostgreSQL 16 on port 5432 with <code>pg_isready</code> health check</li>
              <li><strong>api:</strong> NestJS API on internal port 4000 responding to <code>/api/health</code> and <code>/health</code></li>
              <li><strong>web:</strong> Single-origin web proxy serving React application on port 3000 and forwarding <code>/api/*</code> to the API</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
