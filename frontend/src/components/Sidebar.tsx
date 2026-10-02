import React from 'react';

interface SidebarProps {
  items: { label: string; id: string; count?: number }[];
  activeId: string;
  onSelect: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ items, activeId, onSelect }) => {
  return (
    <aside
      style={{
        width: '232px',
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        minHeight: 'calc(100vh - 48px)',
        padding: '16px 8px',
        flexShrink: 0,
      }}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '3px',
                border: 'none',
                backgroundColor: isActive ? 'var(--color-canvas)' : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                fontWeight: isActive ? 600 : 400,
                fontSize: '13px',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span
                  style={{
                    backgroundColor: isActive ? 'var(--color-accent)' : 'var(--color-border)',
                    color: isActive ? '#FFFFFF' : 'var(--color-text-muted)',
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
