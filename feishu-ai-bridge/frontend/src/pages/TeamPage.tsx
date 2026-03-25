import React, { useState, useEffect } from 'react';
import { TeamMember } from '../types';

const STORAGE_KEY = 'feishu-ai-bridge-team';

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [form, setForm] = useState({ name: '', role: 'Developer', email: '', avatar: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setMembers(JSON.parse(saved)); } catch { setMembers(getDefaultMembers()); }
    } else {
      setMembers(getDefaultMembers());
    }
    setLoading(false);
  }, []);

  const getDefaultMembers = (): TeamMember[] => [
    { id: '1', name: '张三', role: 'Developer', email: 'zhangsan@company.com', avatar: 'ZS', status: 'online' },
    { id: '2', name: '李四', role: 'Developer', email: 'lisi@company.com', avatar: 'LS', status: 'offline' },
    { id: '3', name: '王五', role: 'Designer', email: 'wangwu@company.com', avatar: 'WW', status: 'online' },
    { id: '4', name: '赵六', role: 'PM', email: 'zhaoliu@company.com', avatar: 'ZL', status: 'busy' },
  ];

  const saveMembers = (newMembers: TeamMember[]) => {
    setMembers(newMembers);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMembers));
  };

  const openCreate = () => {
    setEditingMember(null);
    setForm({ name: '', role: 'Developer', email: '', avatar: '' });
    setShowModal(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setForm({ name: member.name, role: member.role, email: member.email, avatar: member.avatar });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定移除此成员？')) return;
    saveMembers(members.filter(m => m.id !== id));
    setMessage({ type: 'success', text: '成员已移除' });
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const avatar = form.avatar || form.name.slice(0, 2).toUpperCase();
    if (editingMember) {
      saveMembers(members.map(m => m.id === editingMember.id ? { ...m, ...form, avatar } : m));
    } else {
      saveMembers([...members, { id: Date.now().toString(), ...form, avatar, status: 'offline' }]);
    }
    setShowModal(false);
    setMessage({ type: 'success', text: editingMember ? '成员已更新' : '成员已添加' });
  };

  const statusColors: Record<string, string> = { online: '#10b981', offline: '#9ca3af', busy: '#ef4444' };
  const statusLabels: Record<string, string> = { online: '在线', offline: '离线', busy: '忙碌' };
  const roleColors: Record<string, string> = { Developer: '#6366f1', Designer: '#ec4899', PM: '#f59e0b', QA: '#10b981' };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>👥 团队管理</h1>
          <p>管理 AI 协同团队的成员和角色</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ 添加成员</button>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.text}
        </div>
      )}

      <div className="team-grid">
        {members.map(member => (
          <div key={member.id} className="team-card">
            <div className="team-avatar" style={{ background: roleColors[member.role] || '#6366f1' }}>
              {member.avatar || member.name.slice(0, 2).toUpperCase()}
              <span className="status-dot" style={{ background: statusColors[member.status] }} />
            </div>
            <div className="team-info">
              <div className="team-name">{member.name}</div>
              <div className="team-role" style={{ color: roleColors[member.role] }}>{member.role}</div>
              <div className="team-email">{member.email}</div>
              <div className="team-status" style={{ color: statusColors[member.status] }}>
                ● {statusLabels[member.status]}
              </div>
            </div>
            <div className="team-actions">
              <button className="btn btn-sm btn-ghost" onClick={() => openEdit(member)}>编辑</button>
              <button className="btn btn-sm btn-ghost text-error" onClick={() => handleDelete(member.id)}>移除</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingMember ? '编辑成员' : '添加成员'}</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>姓名</label>
                <input className="input input-bordered w-full" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="成员姓名" />
              </div>
              <div className="form-group">
                <label>角色</label>
                <select className="select select-bordered w-full" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option>Developer</option>
                  <option>Designer</option>
                  <option>PM</option>
                  <option>QA</option>
                </select>
              </div>
              <div className="form-group">
                <label>邮箱</label>
                <input className="input input-bordered w-full" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="member@company.com" />
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
