import React, { useState, useEffect } from 'react';
import RepoTypeSelect from '../components/RepoTypeSelect';
import LocalPathInput from '../components/LocalPathInput';
import RemoteUrlInput from '../components/RemoteUrlInput';
import WorkItemSelector from '../components/WorkItemSelector';
import { RepoConfig as RepoConfigType, RepoType } from '../types';

const STORAGE_KEY = 'feishu-ai-bridge-repo-configs';

export default function RepoPage() {
  const [configs, setConfigs] = useState<RepoConfigType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<RepoConfigType>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setConfigs(JSON.parse(saved));
      } catch { setConfigs([]); }
    }
    setLoading(false);
  }, []);

  const saveAll = (newConfigs: RepoConfigType[]) => {
    setConfigs(newConfigs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfigs));
  };

  const handleCreate = () => {
    setEditingId('__new__');
    setForm({ type: 'github', isDefault: false });
  };

  const handleEdit = (config: RepoConfigType) => {
    setEditingId(config.id);
    setForm({ ...config });
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定删除此仓库配置？')) return;
    saveAll(configs.filter(c => c.id !== id));
    setMessage({ type: 'success', text: '删除成功' });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (editingId === '__new__') {
        const newConfig: RepoConfigType = {
          id: crypto.randomUUID(),
          type: form.type || 'github',
          url: form.url,
          localPath: form.localPath,
          isDefault: form.isDefault || false,
          workItemId: form.workItemId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveAll([...configs, newConfig]);
      } else if (editingId) {
        saveAll(configs.map(c => c.id === editingId ? { ...c, ...form, updatedAt: new Date().toISOString() } : c));
      }
      setEditingId(null);
      setForm({});
      setMessage({ type: 'success', text: '保存成功' });
    } catch {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({});
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>📦 仓库配置</h1>
          <p>管理 GitHub / GitLab / 本地仓库的关联配置</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>
          + 新建配置
        </button>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.text}
        </div>
      )}

      <div className="repo-list">
        {configs.length === 0 ? (
          <div className="empty-state">
            <span>📭</span>
            <p>暂无仓库配置</p>
            <button className="btn btn-primary btn-sm" onClick={handleCreate}>创建第一个配置</button>
          </div>
        ) : (
          configs.map(config => (
            <div key={config.id} className="repo-card">
              <div className="repo-info">
                <div className="repo-type-icon">
                  {config.type === 'github' ? '🐙' : config.type === 'gitlab' ? '🦊' : '📁'}
                </div>
                <div className="repo-details">
                  <div className="repo-name">{config.url || config.localPath}</div>
                  <div className="repo-meta">
                    <span className="type-badge">{config.type}</span>
                    {config.isDefault && <span className="default-badge">默认</span>}
                    {config.workItemId && <span className="workitem-badge">工作项 #{config.workItemId}</span>}
                  </div>
                  <div className="repo-time">
                    创建于 {new Date(config.createdAt).toLocaleDateString('zh-CN')} · 更新于 {new Date(config.updatedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>
              <div className="repo-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(config)}>编辑</button>
                <button className="btn btn-sm btn-ghost text-error" onClick={() => handleDelete(config.id)}>删除</button>
              </div>
            </div>
          ))
        )}
      </div>

      {editingId && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId === '__new__' ? '新建仓库配置' : '编辑仓库配置'}</h2>
              <button className="btn-close" onClick={handleCancel}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>仓库类型</label>
                <RepoTypeSelect
                  value={form.type || 'github'}
                  onChange={t => setForm({ ...form, type: t as RepoType })}
                />
              </div>

              {form.type === 'local' ? (
                <div className="form-group">
                  <label>本地仓库路径</label>
                  <LocalPathInput
                    value={form.localPath || ''}
                    onChange={v => setForm({ ...form, localPath: v })}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>远程仓库地址</label>
                  <RemoteUrlInput
                    type={form.type || 'github'}
                    value={form.url || ''}
                    onChange={v => setForm({ ...form, url: v })}
                  />
                </div>
              )}

              <div className="form-group">
                <label>关联工作项 (可选)</label>
                <WorkItemSelector
                  value={form.workItemId || ''}
                  onChange={v => setForm({ ...form, workItemId: v })}
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.isDefault || false}
                    onChange={e => setForm({ ...form, isDefault: e.target.checked })}
                  />
                  设为默认仓库
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={handleCancel}>取消</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
