import React from 'react';
import { useAuth } from '../app/auth-context';

export const TopBar: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return {
          backgroundColor: '#FBEBDD',
          color: '#9A4A0C',
          border: '1px solid #E3B58C',
        };
      case 'MANAGER':
        return {
          backgroundColor: '#E1F0F9',
          color: '#0F5F8C',
          border: '1px solid #8FC0DE',
        };
      case 'AGENT':
        return {
          backgroundColor: '#F0E8F7',
          color: '#6B3F94',
          border: '1px solid #BFA3D8',
        };
      default:
        return {
          backgroundColor: '#E6ECF8',
          color: '#2F4B8F',
          border: '1px solid #9DB0DD',
        };
    }
  };

  return (
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
        <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
          | Employee Service Request System
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{user.name}</span>
          {user.departmentName && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
              ({user.departmentName})
            </span>
          )}
          <span
            style={{
              padding: '1px 6px',
              borderRadius: '3px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              ...getRoleBadgeStyle(user.role),
            }}
          >
            {user.role}
          </span>
        </div>

        <button
          onClick={logout}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: '3px',
            padding: '4px 10px',
            fontSize: '12px',
            color: 'var(--color-text)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
};
