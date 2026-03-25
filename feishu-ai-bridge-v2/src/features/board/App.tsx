import React, { useState, useEffect } from 'react';
import { mcpClient } from '../../api/mcp';
import './Board.css';

type StaffStatus = 'online' | 'offline' | 'busy';

interface StaffMember {
  id: string;
  name: string;
  avatar: string;
  status: StaffStatus;
  workTime: string;
  serviceScope: string;
}

const statusLabels: Record<StaffStatus, string> = {
  online: '在线',
  offline: '离线',
  busy: '忙碌',
};

const avatarColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function Board() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const chineseDayOfWeek = weekdays[now.getDay()];

  useEffect(() => {
    const fetchTeamData = async () => {
      setLoading(true);
      try {
        const result = await mcpClient.listTeamMembers();
        const members = (result?.data?.members || []) as Array<{ user_key: string; name: string }>;
        
        if (members.length > 0) {
          setStaff(members.slice(0, 8).map((m, idx) => ({
            id: m.user_key,
            name: m.name || `成员${idx + 1}`,
            avatar: (m.name || '?').slice(0, 2).toUpperCase(),
            status: (['online', 'offline', 'busy'] as StaffStatus[])[idx % 3],
            workTime: '09:00-12:00, 13:00-18:00',
            serviceScope: idx % 3 === 0 ? '所有工单' : idx % 3 === 1 ? '服务工单' : '休假工单',
          })));
        } else {
          setStaff(getMockStaff());
        }
      } catch {
        setStaff(getMockStaff());
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, []);

  const getMockStaff = (): StaffMember[] => [
    { id: '1', name: '张三', avatar: 'ZS', status: 'online', workTime: '09:00-12:00, 13:00-18:00', serviceScope: '所有工单' },
    { id: '2', name: '李四', avatar: 'LS', status: 'offline', workTime: '10:00-12:00, 14:00-18:00', serviceScope: '服务工单' },
    { id: '3', name: '王五', avatar: 'WW', status: 'online', workTime: '09:00-18:00', serviceScope: '所有工单' },
    { id: '4', name: '赵六', avatar: 'ZL', status: 'busy', workTime: '14:00-22:00', serviceScope: '所有工单' },
  ];

  const handleChangeStatus = (index: number, newStatus: StaffStatus) => {
    setStaff(prev => prev.map((s, i) => i === index ? { ...s, status: newStatus } : s));
  };

  const getStatusColor = (status: StaffStatus) => {
    switch (status) {
      case 'online': return '#10b981';
      case 'offline': return '#9ca3af';
      case 'busy': return '#ef4444';
    }
  };

  const getStatusIcon = (status: StaffStatus) => {
    switch (status) {
      case 'online': return '🟢';
      case 'offline': return '⚫';
      case 'busy': return '🔴';
    }
  };

  if (loading) {
    return (
      <div className="board-loading">
        <div className="loading-spinner" />
        <span>加载排班数据...</span>
      </div>
    );
  }

  return (
    <div className="board-page">
      <div className="board-header">
        <h1>📅 AI 智能排班管理</h1>
        <div className="board-meta">
          <span>当前时间：{dateStr} {chineseDayOfWeek}</span>
          <span>工作时段：00:00-24:00</span>
          <span>共 {staff.length} 名成员</span>
        </div>
      </div>

      <div className="ai-schedule-hint">
        💡 AI 可根据团队成员负载自动推荐排班方案
      </div>

      <div className="staff-table">
        <div className="table-header">
          <div className="col-name">人员</div>
          <div className="col-status">当前状态</div>
          <div className="col-time">工作时间段</div>
          <div className="col-scope">服务工单范围</div>
        </div>
        {staff.map((member, idx) => (
          <div key={member.id} className="table-row">
            <div className="col-name">
              <div
                className="avatar"
                style={{ background: avatarColors[idx % avatarColors.length] }}
              >
                {member.avatar}
              </div>
              <span className="staff-name">{member.name}</span>
            </div>
            <div className="col-status">
              <div className="status-group">
                {(['online', 'offline', 'busy'] as StaffStatus[]).map(status => (
                  <label key={status} className={`status-radio ${member.status === status ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name={`status-${member.id}`}
                      value={status}
                      checked={member.status === status}
                      onChange={() => handleChangeStatus(idx, status)}
                    />
                    <span className="radio-indicator" style={{ background: member.status === status ? getStatusColor(status) : undefined }} />
                    <span className="radio-label">{getStatusIcon(status)} {statusLabels[status]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="col-time">{member.workTime}</div>
            <div className="col-scope">
              <span className="scope-tag">{member.serviceScope}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="board-footer">
        <div className="legend">
          <span className="legend-item"><span className="dot" style={{ background: '#10b981' }} />在线</span>
          <span className="legend-item"><span className="dot" style={{ background: '#9ca3af' }} />离线</span>
          <span className="legend-item"><span className="dot" style={{ background: '#ef4444' }} />忙碌</span>
        </div>
      </div>
    </div>
  );
}
