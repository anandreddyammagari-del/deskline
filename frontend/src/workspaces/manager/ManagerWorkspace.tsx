import React, { useState, useEffect } from 'react';
import { useAuth } from '../../app/auth-context';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';

export const ManagerWorkspace: React.FC<{ activeTab: string; onNavigate: (tab: string) => void }> = ({
  activeTab,
  onNavigate,
}) => {
  const { user, authFetch } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [aging, setAging] = useState<any>(null);
  const [workload, setWorkload] = useState<any[]>([]);
  const [triageTickets, setTriageTickets] = useState<any[]>([]);
  const [teamTickets, setTeamTickets] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [sumRes, ageRes, workRes, tktRes] = await Promise.all([
        authFetch('/api/dashboard/summary'),
        authFetch('/api/dashboard/backlog-aging'),
        authFetch('/api/dashboard/workload'),
        authFetch('/api/tickets'),
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (ageRes.ok) setAging(await ageRes.json());
      if (workRes.ok) {
        const wData = await workRes.json();
        setWorkload(wData);
        setAgents(wData);
      }
      if (tktRes.ok) {
        const all = await tktRes.json();
        setTeamTickets(all);
        setTriageTickets(all.filter((t: any) => t.needsTriage || !t.assigneeId));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeTab]);

  const handleAssign = async (ticketId: string, agentId: string) => {
    try {
      const res = await authFetch(`/api/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: agentId }),
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch {}
  };

  if (activeTab === 'triage') {
    return (
      <div style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Needs Triage</h2>
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
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Category</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Priority</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Created</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Assign to Agent</th>
              </tr>
            </thead>
            <tbody>
              {triageTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No pending triage requests. All tickets are assigned.
                  </td>
                </tr>
              ) : (
                triageTickets.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)', height: '40px' }}>
                    <td style={{ padding: '8px 16px', fontWeight: 500, color: 'var(--color-accent)' }}>{t.ticketNo}</td>
                    <td style={{ padding: '8px 16px' }}>{t.title}</td>
                    <td style={{ padding: '8px 16px' }}>{t.category?.name}</td>
                    <td style={{ padding: '8px 16px' }}><PriorityBadge priority={t.priority} /></td>
                    <td style={{ padding: '8px 16px' }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '8px 16px' }}>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) handleAssign(t.id, e.target.value);
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '3px',
                          border: '1px solid var(--color-border)',
                          fontSize: '12px',
                        }}
                      >
                        <option value="" disabled>Select agent...</option>
                        {agents.map((a) => (
                          <option key={a.agentId} value={a.agentId}>
                            {a.agentName} ({a.openTicketCount} open)
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (activeTab === 'team') {
    return (
      <div style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Department Requests</h2>
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
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Assignee</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Priority</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {teamTickets.slice(0, 50).map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)', height: '40px' }}>
                  <td style={{ padding: '8px 16px', fontWeight: 500, color: 'var(--color-accent)' }}>{t.ticketNo}</td>
                  <td style={{ padding: '8px 16px' }}>{t.title}</td>
                  <td style={{ padding: '8px 16px' }}>{t.requester?.name}</td>
                  <td style={{ padding: '8px 16px' }}>{t.assignee?.name || 'Unassigned'}</td>
                  <td style={{ padding: '8px 16px' }}><PriorityBadge priority={t.priority} /></td>
                  <td style={{ padding: '8px 16px' }}><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ActiveTab === 'dashboard'
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)' }}>
            Operational Dashboard
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {user?.departmentName || 'Enterprise'} Overview · Real-time Metrics
          </div>
        </div>
      </div>

      {/* Four KPI Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Open Requests</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>
            {summary?.openCount ?? '—'}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>SLA Breached</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: summary?.breachedCount > 0 ? 'var(--color-danger)' : 'var(--color-text)', marginTop: '4px' }}>
            {summary?.breachedCount ?? '—'}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>SLA Compliance</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--status-resolved-text)', marginTop: '4px' }}>
            {summary?.slaMetPercent !== undefined ? `${summary.slaMetPercent}%` : '—'}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Avg Resolution</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>
            {summary?.avgResolutionMinutes !== undefined ? `${Math.floor(summary.avgResolutionMinutes / 60)}h ${summary.avgResolutionMinutes % 60}m` : '—'}
          </div>
        </div>
      </div>

      {/* Two Breakdown Columns: Backlog Aging & Workload Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Backlog Aging */}
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Backlog Aging</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Under 1 day</span>
              <strong style={{ fontFamily: 'monospace' }}>{aging?.under1Day ?? 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>1 to 3 days</span>
              <strong style={{ fontFamily: 'monospace' }}>{aging?.from1To3Days ?? 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>3 to 7 days</span>
              <strong style={{ fontFamily: 'monospace' }}>{aging?.from3To7Days ?? 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Over 7 days</span>
              <strong style={{ fontFamily: 'monospace', color: aging?.over7Days > 0 ? 'var(--color-danger)' : 'inherit' }}>
                {aging?.over7Days ?? 0}
              </strong>
            </div>
          </div>
        </div>

        {/* Workload by Agent */}
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Workload Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {workload.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No agents in department.</div>
            ) : (
              workload.map((w) => (
                <div key={w.agentId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>{w.agentName}</span>
                  <strong style={{ fontFamily: 'monospace' }}>{w.openTicketCount}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Needs Triage Alert / Quick Assign Table */}
      {triageTickets.length > 0 && (
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-danger)' }}>
              Needs Triage ({triageTickets.length})
            </h3>
            <button
              onClick={() => onNavigate('triage')}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--color-accent)',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              View all triage →
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <tbody>
              {triageTickets.slice(0, 3).map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)', height: '36px' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 500, color: 'var(--color-accent)' }}>{t.ticketNo}</td>
                  <td style={{ padding: '6px 12px' }}>{t.title}</td>
                  <td style={{ padding: '6px 12px' }}>{t.category?.name}</td>
                  <td style={{ padding: '6px 12px' }}>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleAssign(t.id, e.target.value);
                      }}
                      style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        border: '1px solid var(--color-border)',
                        fontSize: '12px',
                      }}
                    >
                      <option value="" disabled>Quick assign...</option>
                      {agents.map((a) => (
                        <option key={a.agentId} value={a.agentId}>
                          {a.agentName}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
