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
  department: { name: string };
  category: { name: string };
  assignee?: { name: string } | null;
  createdAt: string;
  resolvedAt?: string | null;
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
    createdAt: string;
    author: { name: string; role: string };
  }>;
}

export const EmployeeWorkspace: React.FC<{ activeTab: string; onNavigate: (tab: string) => void }> = ({
  activeTab,
  onNavigate,
}) => {
  const { authFetch } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // New Request Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [commentText, setCommentText] = useState('');

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/tickets/mine');
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await authFetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        if (data.length > 0 && !categoryId) {
          setCategoryId(data[0].id);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchTickets();
    fetchCategories();
  }, []);

  const openTicketDetail = async (id: string) => {
    try {
      const res = await authFetch(`/api/tickets/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTicket(data);
      }
    } catch {}
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await authFetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, categoryId }),
      });

      if (res.ok) {
        setTitle('');
        setDescription('');
        onNavigate('requests');
        fetchTickets();
      } else {
        const err = await res.json();
        setErrorMsg(err.message || 'Failed to submit request');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !commentText.trim()) return;

    try {
      const res = await authFetch(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentText }),
      });

      if (res.ok) {
        setCommentText('');
        openTicketDetail(selectedTicket.id);
        fetchTickets();
      }
    } catch {}
  };

  const handleCancelTicket = async () => {
    if (!selectedTicket) return;
    try {
      const res = await authFetch(`/api/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (res.ok) {
        openTicketDetail(selectedTicket.id);
        fetchTickets();
      }
    } catch {}
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket) return;
    try {
      const res = await authFetch(`/api/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REOPENED' }),
      });
      if (res.ok) {
        openTicketDetail(selectedTicket.id);
        fetchTickets();
      }
    } catch {}
  };

  if (selectedTicket) {
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
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ← Back to my requests
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Main conversation pane */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              padding: '24px',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {selectedTicket.ticketNo}
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: '4px' }}>
                {selectedTicket.title}
              </h2>
              <p style={{ marginTop: '8px', color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                {selectedTicket.description}
              </p>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />

            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Conversation</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {selectedTicket.comments?.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '12px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-canvas)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{c.author.name}</span>
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
                  placeholder="Write a reply..."
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

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {selectedTicket.status === 'RESOLVED' && (
                      <button
                        type="button"
                        onClick={handleReopenTicket}
                        style={{
                          backgroundColor: '#FBEBDD',
                          color: '#9A4A0C',
                          border: '1px solid #E3B58C',
                          borderRadius: '3px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        Reopen request
                      </button>
                    )}
                    {selectedTicket.status !== 'RESOLVED' && (
                      <button
                        type="button"
                        onClick={handleCancelTicket}
                        style={{
                          backgroundColor: 'transparent',
                          color: 'var(--color-danger)',
                          border: '1px solid var(--color-danger)',
                          borderRadius: '3px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel request
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Right sidebar info */}
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
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Department</div>
              <div style={{ marginTop: '2px', fontWeight: 500 }}>{selectedTicket.department?.name}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Category</div>
              <div style={{ marginTop: '2px', fontWeight: 500 }}>{selectedTicket.category?.name}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Resolution Due</div>
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

  if (activeTab === 'new') {
    return (
      <div style={{ padding: '24px', maxWidth: '640px', margin: '0 auto' }}>
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            padding: '24px',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Raise New Request</h2>

          {errorMsg && (
            <div
              style={{
                backgroundColor: '#FEE4E2',
                color: 'var(--color-danger)',
                border: '1px solid var(--color-danger)',
                borderRadius: '3px',
                padding: '10px 12px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '3px',
                  border: '1px solid var(--color-border)',
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.department.name} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of your issue..."
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '3px',
                  border: '1px solid var(--color-border)',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details of what happened, error codes, steps..."
                rows={4}
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '3px',
                  border: '1px solid var(--color-border)',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => onNavigate('requests')}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: '3px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ActiveTab === 'requests'
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600 }}>My Requests</h2>
        <button
          onClick={() => onNavigate('new')}
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
          New request
        </button>
      </div>

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
              <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Dept</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Priority</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Status</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  Loading requests...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No requests yet. Raise your first request.
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
                  <td style={{ padding: '8px 16px', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </td>
                  <td style={{ padding: '8px 16px' }}>{t.department?.name}</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
