import React, { useState, useEffect } from 'react';
import { useAuth } from '../../app/auth-context';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { SlaChip } from '../../components/SlaChip';

interface Ticket {
  id: string;
  ticketNo: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  departmentId: string;
  department: { name: string };
  category: { name: string };
  assigneeId?: string | null;
  assignee?: { id: string; name: string } | null;
  requester: { name: string };
  createdAt: string;
  resolvedAt?: string | null;
  firstResponseAt?: string | null;
  needsTriage: boolean;
  sla?: {
    responseDueAt: string;
    resolutionDueAt: string;
    responseBreached: boolean;
    resolutionBreached: boolean;
    pausedAt?: string | null;
  } | null;
  comments?: Array<{
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: string;
    author: { name: string; role: string };
  }>;
}

export const AgentWorkspace: React.FC<{ activeTab: string; onNavigate: (tab: string) => void }> = ({
  activeTab,
}) => {
  const { user, authFetch } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      // activeTab: 'queue' -> agent/queue, 'department' -> tickets scoped
      const url = activeTab === 'queue' ? '/api/agent/queue' : '/api/tickets';
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [activeTab]);

  const openTicketDetail = async (id: string) => {
    try {
      const res = await authFetch(`/api/tickets/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTicket(data);
      }
    } catch {}
  };

  const handleStatusChange = async (nextStatus: string, note?: string) => {
    if (!selectedTicket) return;
    try {
      const res = await authFetch(`/api/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, note }),
      });
      if (res.ok) {
        openTicketDetail(selectedTicket.id);
        fetchTickets();
      }
    } catch {}
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !commentText.trim()) return;

    try {
      const res = await authFetch(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentText, isInternal }),
      });

      if (res.ok) {
        setCommentText('');
        setIsInternal(false);
        openTicketDetail(selectedTicket.id);
        fetchTickets();
      }
    } catch {}
  };

  const handleClaimTicket = async (ticketId: string, expectedCurrentAssigneeId?: string | null) => {
    try {
      const res = await authFetch(`/api/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: user?.id, expectedCurrentAssigneeId }),
      });
      if (res.ok) {
        if (selectedTicket) openTicketDetail(ticketId);
        fetchTickets();
      }
    } catch {}
  };

  if (selectedTicket) {
    const isAssignee = selectedTicket.assigneeId === user?.id;

    return (
      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        <button
          onClick={() => setSelectedTicket(null)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--color-accent)',
            cursor: 'pointer',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          ← Back to queue
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Main pane */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {selectedTicket.ticketNo} · Raised by {selectedTicket.requester?.name}
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: '4px' }}>
                  {selectedTicket.title}
                </h2>
              </div>

              {/* Status Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedTicket.status === 'ASSIGNED' && isAssignee && (
                  <button
                    onClick={() => handleStatusChange('IN_PROGRESS')}
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
                    Start working
                  </button>
                )}

                {selectedTicket.status === 'IN_PROGRESS' && isAssignee && (
                  <>
                    <button
                      onClick={() => {
                        const note = prompt('Enter note for requester (required to pause SLA):');
                        if (note) handleStatusChange('WAITING_ON_REQUESTER', note);
                      }}
                      style={{
                        backgroundColor: '#F0E8F7',
                        color: '#6B3F94',
                        border: '1px solid #BFA3D8',
                        borderRadius: '3px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Wait on requester
                    </button>
                    <button
                      onClick={() => handleStatusChange('RESOLVED')}
                      style={{
                        backgroundColor: '#E2F3E9',
                        color: '#256B45',
                        border: '1px solid #8FCBA8',
                        borderRadius: '3px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Mark resolved
                    </button>
                  </>
                )}

                {selectedTicket.status === 'WAITING_ON_REQUESTER' && isAssignee && (
                  <button
                    onClick={() => handleStatusChange('IN_PROGRESS')}
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Resume working
                  </button>
                )}
              </div>
            </div>

            <p style={{ marginTop: '12px', color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
              {selectedTicket.description}
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />

            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Conversation & Internal Notes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {selectedTicket.comments?.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '12px',
                    borderRadius: '4px',
                    backgroundColor: c.isInternal ? '#FFF8E6' : 'var(--color-canvas)',
                    border: `1px solid ${c.isInternal ? '#FFE08A' : 'var(--color-border)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                      {c.author.name} ({c.author.role}) {c.isInternal && <strong style={{ color: '#8A6A00' }}>[Internal Staff Note]</strong>}
                    </span>
                    <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ fontSize: '13px' }}>{c.body}</div>
                </div>
              ))}
            </div>

            {selectedTicket.status !== 'CLOSED' && selectedTicket.status !== 'CANCELLED' && (
              <form onSubmit={handleAddComment}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a reply or internal note..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '3px',
                    border: '1px solid var(--color-border)',
                    fontSize: '13px',
                    marginBottom: '10px',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                    />
                    Mark as internal staff note (hidden from employee)
                  </label>

                  <button
                    type="submit"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Send reply
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right sidebar */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              padding: '20px',
              height: 'fit-content',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Status</div>
              <div style={{ marginTop: '4px' }}><StatusBadge status={selectedTicket.status} /></div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Priority</div>
              <div style={{ marginTop: '4px' }}><PriorityBadge priority={selectedTicket.priority} /></div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Assignee</div>
              <div style={{ marginTop: '2px', fontWeight: 500 }}>
                {selectedTicket.assignee?.name || 'Unassigned (Needs triage)'}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Department / Category</div>
              <div style={{ marginTop: '2px' }}>
                {selectedTicket.department?.name} · {selectedTicket.category?.name}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Resolution Target</div>
              <div style={{ marginTop: '4px' }}>
                <SlaChip
                  dueAt={selectedTicket.sla?.resolutionDueAt}
                  isBreached={selectedTicket.sla?.resolutionBreached}
                  isPaused={Boolean(selectedTicket.sla?.pausedAt)}
                  isResolved={Boolean(selectedTicket.resolvedAt)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
        {activeTab === 'queue' ? 'My Assigned Queue' : 'Department Requests'}
      </h2>

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
              <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Request</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Title</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Requester</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Priority</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Status</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Due</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Assignee</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  Loading queue...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  Queue is clear. No active tickets.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => openTicketDetail(t.id)}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    height: '40px',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: '8px 16px', fontWeight: 500, color: 'var(--color-accent)' }}>
                    {t.ticketNo}
                  </td>
                  <td style={{ padding: '8px 16px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </td>
                  <td style={{ padding: '8px 16px' }}>{t.requester?.name}</td>
                  <td style={{ padding: '8px 16px' }}><PriorityBadge priority={t.priority} /></td>
                  <td style={{ padding: '8px 16px' }}><StatusBadge status={t.status} /></td>
                  <td style={{ padding: '8px 16px' }}>
                    <SlaChip
                      dueAt={t.sla?.resolutionDueAt}
                      isBreached={t.sla?.resolutionBreached}
                      isPaused={Boolean(t.sla?.pausedAt)}
                      isResolved={Boolean(t.resolvedAt)}
                    />
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    {t.assignee?.name || (
                      <span style={{ color: 'var(--color-warning-text)', fontWeight: 500 }}>Unassigned</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
