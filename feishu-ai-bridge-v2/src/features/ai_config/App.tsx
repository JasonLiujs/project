import React, { useState, useEffect } from 'react';
import { AIRule, AI_RULES_STORAGE_KEY } from '../../constants';
import './Config.css';

const DEFAULT_RULES: AIRule[] = [
  {
    id: 'rule-1',
    name: '自动评论摘要',
    description: '当工作项有新评论时，AI 自动生成简要总结',
    enabled: true,
    trigger: 'on_comment',
    actions: ['summarize'],
  },
  {
    id: 'rule-2',
    name: '状态变更提醒',
    description: '工作项状态变更为"进行中"时，自动提醒负责人',
    enabled: true,
    trigger: 'on_update',
    actions: ['notify'],
  },
  {
    id: 'rule-3',
    name: '风险检测',
    description: '工作项超过 7 天无更新时，自动标记风险',
    enabled: false,
    trigger: 'on_update',
    actions: ['risk_detect'],
  },
];

export default function AIConfig() {
  const [rules, setRules] = useState<AIRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AIRule | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', trigger: 'on_update' as AIRule['trigger'], actions: ['notify'] as string[] });

  useEffect(() => {
    const saved = localStorage.getItem(AI_RULES_STORAGE_KEY);
    if (saved) {
      try {
        setRules(JSON.parse(saved));
      } catch {
        setRules(DEFAULT_RULES);
      }
    } else {
      setRules(DEFAULT_RULES);
    }
    setLoading(false);
  }, []);

  const saveRules = (newRules: AIRule[]) => {
    setRules(newRules);
    localStorage.setItem(AI_RULES_STORAGE_KEY, JSON.stringify(newRules));
  };

  const toggleRule = (id: string) => {
    saveRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteRule = (id: string) => {
    if (confirm('确定删除此规则？')) {
      saveRules(rules.filter(r => r.id !== id));
    }
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setFormData({ name: '', description: '', trigger: 'on_update', actions: ['notify'] });
    setShowModal(true);
  };

  const openEditModal = (rule: AIRule) => {
    setEditingRule(rule);
    setFormData({ name: rule.name, description: rule.description, trigger: rule.trigger, actions: rule.actions });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;
    if (editingRule) {
      saveRules(rules.map(r => r.id === editingRule.id ? { ...r, ...formData } : r));
    } else {
      const newRule: AIRule = {
        id: `rule-${Date.now()}`,
        ...formData,
        enabled: true,
      };
      saveRules([...rules, newRule]);
    }
    setShowModal(false);
  };

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case 'on_create': return '创建时';
      case 'on_update': return '更新时';
      case 'on_comment': return '评论时';
      case 'on_schedule': return '排期变更时';
      default: return trigger;
    }
  };

  if (loading) {
    return (
      <div className="config-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="config-page">
      <div className="config-header">
        <div>
          <h1>⚙️ AI 规则配置</h1>
          <p>管理 AI 协同自动化规则</p>
        </div>
        <button className="btn-create" onClick={openCreateModal}>
          + 新建规则
        </button>
      </div>

      <div className="rules-list">
        {rules.length === 0 ? (
          <div className="empty-state">
            <span>暂无规则</span>
            <p>创建第一条 AI 自动化规则</p>
          </div>
        ) : (
          rules.map(rule => (
            <div key={rule.id} className={`rule-card ${rule.enabled ? '' : 'rule-disabled'}`}>
              <div className="rule-main">
                <div className="rule-header">
                  <h3>{rule.name}</h3>
                  <span className="rule-trigger">{getTriggerLabel(rule.trigger)}</span>
                </div>
                <p className="rule-description">{rule.description}</p>
                <div className="rule-actions">
                  {rule.actions.map(action => (
                    <span key={action} className="action-tag">{action}</span>
                  ))}
                </div>
              </div>
              <div className="rule-controls">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleRule(rule.id)}
                  />
                  <span className="toggle-slider" />
                </label>
                <button className="btn-icon" onClick={() => openEditModal(rule)} title="编辑">✏️</button>
                <button className="btn-icon btn-danger" onClick={() => deleteRule(rule.id)} title="删除">🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingRule ? '编辑规则' : '新建规则'}</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>规则名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：自动风险检测"
                />
              </div>
              <div className="form-group">
                <label>描述</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="规则的功能说明..."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>触发条件</label>
                <select
                  value={formData.trigger}
                  onChange={e => setFormData({ ...formData, trigger: e.target.value as AIRule['trigger'] })}
                >
                  <option value="on_create">创建时</option>
                  <option value="on_update">更新时</option>
                  <option value="on_comment">评论时</option>
                  <option value="on_schedule">排期变更时</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn-save" onClick={handleSave} disabled={!formData.name.trim()}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
