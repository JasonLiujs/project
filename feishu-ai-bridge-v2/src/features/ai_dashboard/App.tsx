import React, { useState, useEffect } from 'react';
import { mcpClient } from '../../api/mcp';
import { STATUS_LABELS } from '../../constants';
import './Dashboard.css';

interface WorkItemSummary {
  work_item_id: string;
  title: string;
  status: string;
  status_name?: string;
  assignee?: string;
  [key: string]: unknown;
}

interface TeamMember {
  user_key: string;
  name: string;
  avatar?: string;
}

interface AIMetric {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
}

export default function AIDashboard() {
  const [workItems, setWorkItems] = useState<WorkItemSummary[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AIMetric[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [storiesResult, membersResult] = await Promise.allSettled([
          mcpClient.listWorkItems('story', undefined, 50),
          mcpClient.listTeamMembers(),
        ]);

        const stories = (storiesResult.status === 'fulfilled' && storiesResult.value?.data?.items) || [];
        const members = (membersResult.status === 'fulfilled' && membersResult.value?.data?.members) || [];

        setWorkItems(stories as WorkItemSummary[]);
        setTeamMembers(members as TeamMember[]);

        const statusCounts: Record<string, number> = {};
        stories.forEach((item: WorkItemSummary) => {
          const status = item.status || 'unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        const total = stories.length;
        const doing = statusCounts['doing'] || 0;
        const completed = statusCounts['end'] || statusCounts['closed'] || 0;

        setMetrics([
          { label: '总需求数', value: total },
          { label: '进行中', value: doing, trend: doing > 5 ? 'up' : 'neutral' },
          { label: '已完成', value: completed },
          { label: '团队成员', value: members.length },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredItems = workItems.filter(item => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'doing') return item.status === 'doing';
    if (selectedFilter === 'to_be_started') return item.status === 'to_be_started';
    if (selectedFilter === 'completed') return item.status === 'end' || item.status === 'closed';
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'doing': return '#6366f1';
      case 'to_be_started': return '#f59e0b';
      case 'end':
      case 'closed': return '#10b981';
      case 'started': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
        <span>加载数据中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <span>⚠️ {error}</span>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>🤖 AI 协同自动化</h1>
        <p>飞书项目智能工作流分析</p>
      </div>

      <div className="metrics-grid">
        {metrics.map((metric, idx) => (
          <div key={idx} className="metric-card">
            <span className="metric-label">{metric.label}</span>
            <span className="metric-value">{metric.value}</span>
            {metric.trend && (
              <span className={`metric-trend trend-${metric.trend}`}>
                {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="work-items-section">
        <div className="section-header">
          <h2>需求列表</h2>
          <div className="filter-tabs">
            {[
              { key: 'all', label: '全部' },
              { key: 'doing', label: '进行中' },
              { key: 'to_be_started', label: '未开始' },
              { key: 'completed', label: '已完成' },
            ].map(filter => (
              <button
                key={filter.key}
                className={`filter-tab ${selectedFilter === filter.key ? 'active' : ''}`}
                onClick={() => setSelectedFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <span>暂无数据</span>
          </div>
        ) : (
          <div className="work-items-grid">
            {filteredItems.map(item => (
              <div key={item.work_item_id} className="work-item-card">
                <div className="work-item-header">
                  <span className="work-item-id">#{item.work_item_id}</span>
                  <span
                    className="work-item-status"
                    style={{ backgroundColor: getStatusColor(item.status) }}
                  >
                    {STATUS_LABELS[item.status] || item.status}
                  </span>
                </div>
                <h3 className="work-item-title">{item.title}</h3>
                <div className="work-item-footer">
                  <span className="work-item-type">需求</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
