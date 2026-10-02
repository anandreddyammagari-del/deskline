import React from 'react';

interface PriorityBadgeProps {
  priority: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const getStyles = () => {
    switch (priority) {
      case 'URGENT':
        return { color: 'var(--priority-urgent)', label: 'Urgent', isHollow: false, isBold: true };
      case 'HIGH':
        return { color: 'var(--priority-high)', label: 'High', isHollow: false, isBold: false };
      case 'MEDIUM':
        return { color: 'var(--priority-medium)', label: 'Medium', isHollow: false, isBold: false };
      case 'LOW':
      default:
        return { color: 'var(--priority-low)', label: 'Low', isHollow: true, isBold: false };
    }
  };

  const s = getStyles();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        fontWeight: s.isBold ? 600 : 400,
        color: 'var(--color-text)',
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: s.isHollow ? 'transparent' : s.color,
          border: `1.5px solid ${s.color}`,
        }}
      />
      {s.label}
    </span>
  );
};
