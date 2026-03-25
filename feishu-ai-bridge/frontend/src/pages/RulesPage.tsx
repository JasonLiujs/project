import React, { useState, useEffect } from 'react';
import { AIRule } from '../types';

const DEFAULT_RULES: AIRule[] = [
  { id: 'rule-1', name: '自动评论摘要', description: '当工作项有新评论时，AI 自动生成简要总结', enabled: true, trigger: 'on_comment', actions: ['summarize'] },
  { id: 'rule-2', name: '状态变更提醒', description: '工作项状态变更时，自动提醒相关人员', enabled: true, trigger: 'on_update', actions: ['notify'] },
  { id: 'rule-3', name: '风险检测', description: '工作项超过 7 天无更新时，自动标记风险', enabled: false, trigger: 'on_update', actions: ['risk_detect'] },
  { id: 'rule-4', name: 'Kimi 评论助手', description: '提供 Kimi AI 评论生成辅助功能', enabled: true, trigger: 'on_comment', actions: ['ai_generate'] },
  { id: 'rule-5', name: '排期智能建议', description: '根据团队负载自动推荐排期方案', enabled: false, trigger: 'on_schedule', actions: ['schedule_suggest'] },
];

const STORAGE_KEY = 'feishu-ai-bridge-rules';

const triggerLabels: Record<string, string> = {
  on_create: '创建时',
  on_update: '更新时',
  on_comment: '评论时',
  on_schedule: '排期变更时',
};

export default function RulesPage() {
  const [rules, setRules] = useState<AIRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AIRule | null>(null);
  const [form, setForm] = useState({ name: '', description: '', trigger: 'on_update' as AIRule['trigger'], actions: ['notify'] as string[] });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setRules(JSON.parse(saved)); } catch { setRules(DEFAULT_RULES); }
    } else {
      setRules(DEFAULT_RULES);
    }
    setLoading(false);
  }, []);

  const saveRules = (newRules: AIRule[]) => {
    setRules(newRules);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRules));
  };

  const toggleRule = (id: string) => {
    saveRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteRule = (id: string) => {
    if (!confirm('确定删除此规则？')) return;
    saveRules(rules.filter(r => r.id !== id));
    setMessage({ type: 'success', text: '规则已删除' });
  };

  const openCreate = () => {
    setEditingRule(null);
    setForm({ name: '', description: '', trigger: 'on_update', actions: ['notify'] });
    setShowModal(true);
  };

  const openEdit = (rule: AIRule) => {
    setEditingRule(rule);
    setForm({ name: rule.name, description: rule.description, trigger: rule.trigger, actions: rule.actions });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingRule) {
      saveRules(rules.map(r => r.id === editingRule.id ? { ...r, ...form } : r));
    } else {
      saveRules([...rules, { id: `rule-${Date.now()}`, ...form, enabled: true }]);
    }
    setShowModal(false);
    setMessage({ type: 'success', text: editingRule ? '规则已更新' : '规则已创建' });
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const activeCount = rules.filter(r => r.enabled).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>⚡ AI 规则管理</h1>
          <p>管理 AI 协同自动化规则，支持触发条件和动作配置</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ 新建规则</button>
      </div>

      <div className="stats-row">
        <div className="mini-stat">
          <span className="mini-stat-value">{rules.length}</span>
          <span className="mini-stat-label">总规则数</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value text-success">{activeCount}</span>
          <span className="mini-stat-label">已启用</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value text-muted">{rules.length - activeCount}</span>
          <span className="mini-stat-label">已禁用</span>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.text}
        </div>
      )}

      <div className="rules-list">
        {rules.map(rule => (
          <div key={rule.id} className={`rule-card ${rule.enabled ? '' : 'disabled'}`}>
            <div className="rule-main">
              <div className="rule-header">
                <h3>{rule.name}</h3>
                <span className="trigger-badge">{triggerLabels[rule.trigger]}</span>
                <span className={`status-badge ${rule.enabled ? 'enabled' : 'disabled'}`}>
                  {rule.enabled ? '已启用' : '已禁用'}
                </span>
              </div>
              <p className="rule-desc">{rule.description}</p>
              <div className="rule-actions-tags">
                {rule.actions.map(a => (
                  <span key={a} className="action-tag">{a}</span>
                ))}
              </div>
            </div>
            <div className="rule-controls">
              <label className="toggle">
                <input type="checkbox" checked={rule.enabled} onChange={() => toggleRule(rule.id)} />
                <span className="toggle-slider" />
              </label>
              <button className="btn btn-sm btn-ghost" onClick={() => openEdit(rule)}>编辑</button>
              <button className="btn btn-sm btn-ghost text-error" onClick={() => deleteRule(rule.id)}>删除</button>
            </div>
          </div>
        ))}
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
                <input className="input input-bordered w-full" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="例如：自动风险检测" />
              </div>
              <div className="form-group">
                <label>描述</label>
                <textarea className="textarea textarea-bordered w-full" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="规则的功能说明..." />
              </div>
              <div className="form-group">
                <label>触发条件</label>
                <select className="select select-bordered w-full" value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value as AIRule['trigger'] })}>
                  <option value="on_create">创建时</option>
                  <option value="on_update">更新时</option>
                  <option value="on_comment">评论时</option>
                  <option value="on_schedule">排期变更时</option>
                </select>
              </div>
              <div className="form-group">
                <label>执行动作</label>
                <div className="action-checkboxes">
                  {['summarize', 'notify', 'risk_detect', 'ai_generate', 'schedule_suggest'].map(a => (
                    <label key={a} className="checkbox-label">
                      <input type="checkbox" checked={form.actions.includes(a)} onChange={e => {
                        if (e.target.checked) setForm({ ...form, actions: [...form.actions, a] });
                        else setForm({ ...form, actions: form.actions.filter(x => x !== a) });
                      }} />
                      {a}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
