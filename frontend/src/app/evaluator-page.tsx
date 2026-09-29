import React, { useState } from 'react';
import { useAuth } from './auth-context';

interface DemoAccount {
  name: string;
  email: string;
  role: string;
  department: string;
  notes: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: 'Asha Rao',
    email: 'asha.rao@deskline.test',
    role: 'Employee',
    department: 'General',
    notes: 'Standard employee; creates requests, views own tickets only.',
  },
  {
    name: 'Vikram Shah',
    email: 'vikram.shah@deskline.test',
    role: 'Employee',
    department: 'General',
    notes: 'Secondary employee account for testing ticket isolation.',
  },
  {
    name: 'Ravi Mehta',
    email: 'ravi.mehta@deskline.test',
    role: 'Agent',
    department: 'IT',
    notes: 'IT support agent; views and processes IT tickets.',
  },
  {
    name: 'Sunita Iyer',
    email: 'sunita.iyer@deskline.test',
    role: 'Agent',
    department: 'HR',
    notes: 'HR agent; restricted to HR department tickets.',
  },
  {
    name: 'Prakash Nair',
    email: 'prakash.nair@deskline.test',
    role: 'Agent',
    department: 'Facilities',
    notes: 'Facilities agent; restricted to Facilities requests.',
  },
  {
    name: 'Meera Kapoor',
    email: 'meera.kapoor@deskline.test',
    role: 'Manager',
    department: 'IT',
    notes: 'IT Team lead; dashboard, triage unassigned requests, reassign.',
  },
  {
    name: 'Arjun Desai',
    email: 'arjun.desai@deskline.test',
    role: 'Admin',
    department: 'Global',
    notes: 'System administrator; global visibility, SLA policy configuration.',
  },
];

export const EvaluatorPage: React.FC<{ onBackToLogin: () => void }> = ({ onBackToLogin }) => {
  const { login } = useAuth();
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQuickLogin = async (email: string, role: string) => {
    setLoadingEmail(email);
    setError(null);
    try {
      const password =
        role === 'Employee'
          ? 'Employee123!'
          : role === 'Agent'
          ? 'Agent123!'
          : role === 'Manager'
          ? 'Manager123!'
          : 'Admin123!';

      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Quick login failed');
    } finally {
      setLoadingEmail(null);
    }
  };

  return (
    <div style={{ maxWidth: '840px', margin: '40px auto', padding: '0 24px' }}>
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)' }}>
              Evaluator Quick Access (Mentor Tool)
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              One-click sign-in for seeded demo personas. Strictly for mentor review and grading.
            </p>
          </div>
          <button
            onClick={onBackToLogin}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              padding: '6px 12px',
              borderRadius: '3px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Back to regular login
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
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

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Name</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Role</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Department</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Description</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-muted)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_ACCOUNTS.map((acc) => (
              <tr key={acc.email} style={{ borderBottom: '1px solid var(--color-border)', height: '44px' }}>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{acc.name}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: '#E6ECF8',
                      color: '#2F4B8F',
                    }}
                  >
                    {acc.role}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{acc.department}</td>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)', fontSize: '12px' }}>{acc.notes}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                  <button
                    onClick={() => handleQuickLogin(acc.email, acc.role)}
                    disabled={loadingEmail === acc.email}
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {loadingEmail === acc.email ? 'Signing in...' : 'Sign in'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
