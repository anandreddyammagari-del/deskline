import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyles = () => {
    switch (status) {
      case 'NEW':
        return { color: 'var(--status-new-text)', bg: 'var(--status-new-bg)', border: 'var(--status-new-border)', label: 'New' };
      case 'ASSIGNED':
        return { color: 'var(--status-assigned-text)', bg: 'var(--status-assigned-bg)', border: 'var(--status-assigned-border)', label: 'Assigned' };
      case 'IN_PROGRESS':
        return { color: 'var(--status-assigned-text)', bg: 'var(--status-assigned-bg)', border: 'var(--status-assigned-border)', label: 'In progress' };
      case 'WAITING_ON_REQUESTER':
        return { color: 'var(--status-waiting-text)', bg: 'var(--status-waiting-bg)', border: 'var(--status-waiting-border)', label: 'Waiting on requester' };
      case 'RESOLVED':
        return { color: 'var(--status-resolved-text)', bg: 'var(--status-resolved-bg)', border: 'var(--status-resolved-border)', label: 'Resolved' };
      case 'REOPENED':
        return { color: 'var(--status-reopened-text)', bg: 'var(--status-reopened-bg)', border: 'var(--status-reopened-border)', label: 'Reopened' };
      case 'CLOSED':
        return { color: 'var(--status-closed-text)', bg: 'var(--status-closed-bg)', border: 'var(--status-closed-border)', label: 'Closed' };
      case 'CANCELLED':
        return { color: 'var(--status-cancelled-text)', bg: 'var(--status-cancelled-bg)', border: 'var(--status-cancelled-border)', label: 'Cancelled' };
      default:
        return { color: 'var(--color-text)', bg: 'var(--color-canvas)', border: 'var(--color-border)', label: status };
    }
  };

  const s = getStyles();

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '3px',
        fontSize: '12px',
        fontWeight: 500,
        color: s.color,
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
};
