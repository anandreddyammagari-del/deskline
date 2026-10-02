import React from 'react';

interface SlaChipProps {
  dueAt?: string | Date | null;
  isBreached?: boolean;
  isPaused?: boolean;
  isResolved?: boolean;
}

export const SlaChip: React.FC<SlaChipProps> = ({
  dueAt,
  isBreached,
  isPaused,
  isResolved,
}) => {
  if (isResolved) {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '3px',
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--status-resolved-text)',
          backgroundColor: 'var(--status-resolved-bg)',
          border: '1px solid var(--status-resolved-border)',
        }}
      >
        Met
      </span>
    );
  }

  if (isPaused) {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '3px',
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--status-waiting-text)',
          backgroundColor: 'var(--status-waiting-bg)',
          border: '1px solid var(--status-waiting-border)',
        }}
      >
        Paused
      </span>
    );
  }

  if (isBreached) {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '3px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#FFFFFF',
          backgroundColor: 'var(--color-danger)',
        }}
      >
        Breached
      </span>
    );
  }

  if (!dueAt) {
    return <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>—</span>;
  }

  const dueDate = new Date(dueAt);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '3px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#FFFFFF',
          backgroundColor: 'var(--color-danger)',
        }}
      >
        Breached
      </span>
    );
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const timeText = diffHours > 0 ? `${diffHours}h ${diffMins}m` : `${diffMins}m`;

  const isWarning = diffMs < 60 * 60 * 1000; // under 1 hour warning

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '3px',
        fontSize: '12px',
        fontWeight: 500,
        color: isWarning ? 'var(--color-warning-text)' : 'var(--color-text)',
        backgroundColor: isWarning ? 'var(--color-warning-bg)' : 'var(--color-canvas)',
        border: `1px solid ${isWarning ? '#E3B58C' : 'var(--color-border)'}`,
      }}
    >
      {timeText}
    </span>
  );
};
