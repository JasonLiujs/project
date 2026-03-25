import React, { useState, useEffect } from 'react';
import DashboardPage from './pages/Dashboard';
import RepoPage from './pages/RepoPage';
import LLMConfigPage from './pages/LLMConfigPage';
import RulesPage from './pages/RulesPage';
import TeamPage from './pages/TeamPage';
import './styles/admin.css';

type Page = 'dashboard' | 'repo' | 'llm' | 'rules' | 'team';

const navItems: { key: Page; label: string; icon: string }[] = [
  { key: 'dashboard', label: '总览', icon: '📊' },
  { key: 'repo', label: '仓库配置', icon: '📦' },
  { key: 'llm', label: 'AI / LLM', icon: '🤖' },
  { key: 'rules', label: 'AI 规则', icon: '⚡' },
  { key: 'team', label: '团队管理', icon: '👥' },
];

export default function AdminApp() {
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'repo': return <RepoPage />;
      case 'llm': return <LLMConfigPage />;
      case 'rules': return <RulesPage />;
      case 'team': return <TeamPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <span className="logo-icon">🚀</span>
          {sidebarOpen && <span className="logo-text">AI Bridge</span>}
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${page === item.key ? 'active' : ''}`}
              onClick={() => setPage(item.key)}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="version-info">
            {sidebarOpen && (
              <>
                <span>v2.0.0</span>
                <span className="sdk-tag">SDK v2.0.5</span>
              </>
            )}
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-content">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
