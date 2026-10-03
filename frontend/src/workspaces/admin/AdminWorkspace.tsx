import React, { useState, useEffect } from 'react';
import { useAuth } from '../../app/auth-context';

export const AdminWorkspace: React.FC<{ activeTab: string; onNavigate: (tab: string) => void }> = ({
  activeTab,
}) => {
  const { authFetch } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [uRes, cRes] = await Promise.all([
        authFetch('/api/admin/users'),
        authFetch('/api/categories'),
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      if (cRes.ok) setCategories(await cRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
        {activeTab === 'users' ? 'User Directory' : activeTab === 'categories' ? 'Category Management' : 'System Configuration'}
      </h2>

      {activeTab === 'users' && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-canvas)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Name</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Email</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Role</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Department</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)', height: '40px' }}>
                  <td style={{ padding: '8px 16px', fontWeight: 500 }}>{u.name}</td>
                  <td style={{ padding: '8px 16px', color: 'var(--color-text-muted)' }}>{u.email}</td>
                  <td style={{ padding: '8px 16px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: 'var(--color-canvas)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '8px 16px' }}>{u.department?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'categories' && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-canvas)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Category Name</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Department</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Default Priority</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)', height: '40px' }}>
                  <td style={{ padding: '8px 16px', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '8px 16px' }}>{c.department?.name}</td>
                  <td style={{ padding: '8px 16px' }}>{c.defaultPriority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
