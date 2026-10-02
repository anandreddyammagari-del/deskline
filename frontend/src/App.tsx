import React, { useState } from 'react';
import { AuthProvider, useAuth } from './app/auth-context';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './app/login-page';
import { EvaluatorPage } from './app/evaluator-page';
import { EmployeeWorkspace } from './workspaces/employee/EmployeeWorkspace';
import { AgentWorkspace } from './workspaces/agent/AgentWorkspace';
import { ManagerWorkspace } from './workspaces/manager/ManagerWorkspace';
import { AdminWorkspace } from './workspaces/admin/AdminWorkspace';

const WorkspaceShell: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(() => {
    switch (user?.role) {
      case 'EMPLOYEE':
        return 'requests';
      case 'AGENT':
        return 'queue';
      case 'MANAGER':
        return 'dashboard';
      case 'ADMIN':
        return 'users';
      default:
        return 'requests';
    }
  });

  const getSidebarItems = () => {
    switch (user?.role) {
      case 'EMPLOYEE':
        return [
          { id: 'requests', label: 'My requests' },
          { id: 'new', label: 'New request' },
        ];
      case 'AGENT':
        return [
          { id: 'queue', label: 'My queue' },
          { id: 'department', label: 'Department queue' },
        ];
      case 'MANAGER':
        return [
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'triage', label: 'Needs triage' },
          { id: 'team', label: 'Team requests' },
        ];
      case 'ADMIN':
        return [
          { id: 'users', label: 'Users' },
          { id: 'categories', label: 'Categories' },
        ];
      default:
        return [];
    }
  };

  const renderActiveWorkspace = () => {
    switch (user?.role) {
      case 'EMPLOYEE':
        return <EmployeeWorkspace activeTab={activeTab} onNavigate={(tab) => setActiveTab(tab)} />;
      case 'AGENT':
        return <AgentWorkspace activeTab={activeTab} onNavigate={(tab) => setActiveTab(tab)} />;
      case 'MANAGER':
        return <ManagerWorkspace activeTab={activeTab} onNavigate={(tab) => setActiveTab(tab)} />;
      case 'ADMIN':
        return <AdminWorkspace activeTab={activeTab} onNavigate={(tab) => setActiveTab(tab)} />;
      default:
        return <div style={{ padding: '24px' }}>Unknown user role</div>;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-canvas)', display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar
          items={getSidebarItems()}
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id)}
        />
        <main style={{ flex: 1, minWidth: 0 }}>
          {renderActiveWorkspace()}
        </main>
      </div>
    </div>
  );
};

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [showEvaluator, setShowEvaluator] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '14px',
        }}
      >
        Restoring session...
      </div>
    );
  }

  if (user) {
    return <WorkspaceShell />;
  }

  if (showEvaluator) {
    return <EvaluatorPage onBackToLogin={() => setShowEvaluator(false)} />;
  }

  return <LoginPage onOpenEvaluator={() => setShowEvaluator(true)} />;
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
