import React from 'react';
import { KIMI_CONFIG } from '../../config/llm';

interface DashboardStats {
  repoCount: number;
  activeRules: number;
  teamSize: number;
  apiCalls: number;
}

interface RecentActivity {
  id: string;
  action: string;
  target: string;
  time: string;
  type: 'success' | 'info' | 'warning';
}

export default function Dashboard() {
  const stats: DashboardStats = {
    repoCount: 3,
    activeRules: 2,
    teamSize: 8,
    apiCalls: 247,
  };

  const activities: RecentActivity[] = [
    { id: '1', action: '配置已更新', target: 'Kimi API Key', time: '5 分钟前', type: 'success' },
    { id: '2', action: '规则已启用', target: '自动评论摘要', time: '10 分钟前', type: 'info' },
    { id: '3', action: '新增仓库', target: 'github.com/JasonLiujs/project', time: '1 小时前', type: 'success' },
    { id: '4', action: 'API 调用', target: 'list_workitems', time: '2 小时前', type: 'info' },
    { id: '5', action: '团队成员更新', target: '张三加入团队', time: '1 天前', type: 'info' },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      default: return '📌';
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>控制台总览</h1>
        <p>飞书 AI Bridge 配置管理后台</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <span className="stat-value">{stats.repoCount}</span>
            <span className="stat-label">配置仓库</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <span className="stat-value">{stats.activeRules}</span>
            <span className="stat-label">活跃规则</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <span className="stat-value">{stats.teamSize}</span>
            <span className="stat-label">团队成员</span>
          </div>
        </div>
        <div className="stat-card highlight">
          <div className="stat-icon">🤖</div>
          <div className="stat-content">
            <span className="stat-value">{stats.apiCalls}</span>
            <span className="stat-label">Kimi API 调用</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h2>⚡ AI 规则概览</h2>
          </div>
          <div className="card-body">
            <div className="rule-summary">
              <div className="rule-item">
                <span className="rule-name">自动评论摘要</span>
                <span className="rule-status enabled">已启用</span>
              </div>
              <div className="rule-item">
                <span className="rule-name">状态变更提醒</span>
                <span className="rule-status enabled">已启用</span>
              </div>
              <div className="rule-item">
                <span className="rule-name">风险检测</span>
                <span className="rule-status disabled">已禁用</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>🔗 LLM 配置状态</h2>
          </div>
          <div className="card-body">
            <div className="llm-status">
              <div className="status-row">
                <span className="status-label">Provider</span>
                <span className="status-value">Kimi (Moonshot)</span>
              </div>
              <div className="status-row">
                <span className="status-label">Model</span>
                <span className="status-value">{KIMI_CONFIG.model}</span>
              </div>
              <div className="status-row">
                <span className="status-label">Temperature</span>
                <span className="status-value">{KIMI_CONFIG.temperature}</span>
              </div>
              <div className="status-row">
                <span className="status-label">Max Tokens</span>
                <span className="status-value">{KIMI_CONFIG.maxTokens}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card wide">
          <div className="card-header">
            <h2>📜 最近活动</h2>
          </div>
          <div className="card-body">
            <div className="activity-list">
              {activities.map(activity => (
                <div key={activity.id} className="activity-item">
                  <span className="activity-icon">{getActivityIcon(activity.type)}</span>
                  <div className="activity-content">
                    <span className="activity-action">{activity.action}</span>
                    <span className="activity-target">{activity.target}</span>
                  </div>
                  <span className="activity-time">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
