import React, { useState, useEffect } from 'react';
import { mcpClient } from '../../api/mcp';
import { STATUS_LABELS } from '../../constants';
import './View.css';

interface RequirementItem {
  work_item_id: string;
  title: string;
  status: string;
  priority?: string;
  description?: string;
  count?: number;
}

const priorityColors = ['#10b981', '#22c55e', '#eab308', '#f97316', '#ef4444'];
const priorityLabels = ['紧急', '高', '中', '低', '无'];

export default function ViewPage() {
  const [items, setItems] = useState<RequirementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await mcpClient.listWorkItems('story', undefined, 30);
        const data = result?.data?.items as RequirementItem[] | undefined;
        if (data && data.length > 0) {
          setItems(data.map((item, idx) => ({
            ...item,
            priority: priorityLabels[idx % 5],
            description: item.description || '暂无描述',
            count: Math.floor(Math.random() * 200) + 10,
          })));
        } else {
          setItems(getMockData());
        }
      } catch {
        setItems(getMockData());
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getMockData = (): RequirementItem[] => [
    { work_item_id: '1', title: '需求_1', status: 'doing', priority: '高', description: '用户登录模块优化', count: 124 },
    { work_item_id: '2', title: '需求_2', status: 'to_be_started', priority: '中', description: '首页改版设计', count: 108 },
    { work_item_id: '3', title: '需求_3', status: 'doing', priority: '紧急', description: '支付接口对接', count: 244 },
    { work_item_id: '4', title: '需求_4', status: 'end', priority: '低', description: '文档更新', count: 189 },
    { work_item_id: '5', title: '需求_5', status: 'started', priority: '高', description: '数据报表导出', count: 128 },
    { work_item_id: '6', title: '需求_6', status: 'to_be_started', priority: '无', description: '性能优化分析', count: 156 },
    { work_item_id: '7', title: '需求_7', status: 'doing', priority: '中', description: '通知系统升级', count: 95 },
    { work_item_id: '8', title: '需求_8', status: 'closed', priority: '低', description: '测试用例补充', count: 67 },
  ];

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);

  if (loading) {
    return (
      <div className="view-loading">
        <div className="loading-spinner" />
        <span>加载需求列表...</span>
      </div>
    );
  }

  return (
    <div className="view-page">
      <div className="view-header">
        <h1>📋 需求网格视图</h1>
        <div className="view-stats">
          <span>共 {items.length} 个需求</span>
          <span className="divider">|</span>
          <span>进行中: {items.filter(i => i.status === 'doing').length}</span>
        </div>
      </div>

      <div className="view-filters">
        {[
          { key: 'all', label: '全部' },
          { key: 'doing', label: '进行中' },
          { key: 'to_be_started', label: '未开始' },
          { key: 'started', label: '已提出' },
          { key: 'end', label: '已完成' },
        ].map(f => (
          <button
            key={f.key}
            className={`filter-btn ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="view-grid">
        {filtered.map(item => (
          <div key={item.work_item_id} className="req-card">
            <div className="req-header">
              <span className="req-id">#{item.work_item_id}</span>
              <span
                className="req-priority"
                style={{
                  background: priorityColors[priorityLabels.indexOf(item.priority || '无')] + '20',
                  color: priorityColors[priorityLabels.indexOf(item.priority || '无')],
                }}
              >
                {item.priority || '无'}
              </span>
            </div>
            <h3 className="req-title">{item.title}</h3>
            <p className="req-desc">{item.description}</p>
            <div className="req-footer">
              <span className={`req-status status-${item.status}`}>
                {STATUS_LABELS[item.status] || item.status}
              </span>
              <span className="req-count">
                <span className="count-icon">🐛</span>
                {item.count || 0}
              </span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="view-empty">
          <span>暂无数据</span>
        </div>
      )}
    </div>
  );
}
