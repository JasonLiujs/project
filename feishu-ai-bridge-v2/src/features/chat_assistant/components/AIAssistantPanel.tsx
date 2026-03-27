// AI助手面板组件

import React, { useMemo } from 'react';
import { AIAssistantType, AIAssistant, ConnectionStatus } from '../types/multiAIChat';

interface AIAssistantPanelProps {
  activeAssistant: AIAssistantType;
  connections: Map<AIAssistantType, ConnectionStatus>;
  assistants: AIAssistant[];
  onSwitchAssistant: (type: AIAssistantType) => Promise<void>;
  onConnectAll?: () => Promise<void>;
  onDisconnectAll?: () => void;
  className?: string;
}

const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  activeAssistant,
  connections,
  assistants,
  onSwitchAssistant,
  onConnectAll,
  onDisconnectAll,
  className = ''
}) => {
  /**
   * 获取连接状态统计
   */
  const connectionStats = useMemo(() => {
    const stats = {
      connected: 0,
      connecting: 0,
      disconnected: 0,
      total: assistants.length
    };

    connections.forEach(status => {
      if (status.connected) {
        stats.connected++;
      } else if (status.connecting) {
        stats.connecting++;
      } else {
        stats.disconnected++;
      }
    });

    return stats;
  }, [connections, assistants.length]);

  /**
   * 获取连接状态指示器
   */
  const getConnectionIndicator = (type: AIAssistantType) => {
    const status = connections.get(type);

    if (!status) {
      return <span className="connection-indicator disconnected">⚪</span>;
    }

    if (status.connected) {
      return <span className="connection-indicator connected" title="已连接">🟢</span>;
    }

    if (status.connecting) {
      return <span className="connection-indicator connecting" title="连接中">🟡</span>;
    }

    return (
      <span
        className="connection-indicator disconnected"
        title={status.error || '未连接'}
      >
        🔴
      </span>
    );
  };

  /**
   * 获取助手状态描述
   */
  const getAssistantStatusText = (type: AIAssistantType) => {
    const status = connections.get(type);

    if (!status) return '未初始化';
    if (status.connected) return '已连接';
    if (status.connecting) return '连接中...';
    if (status.error) return `错误: ${status.error}`;
    return '未连接';
  };

  /**
   * 处理助手切换
   */
  const handleAssistantSwitch = async (type: AIAssistantType) => {
    try {
      await onSwitchAssistant(type);
    } catch (error) {
      console.error('[AIAssistantPanel] Failed to switch assistant:', error);
    }
  };

  return (
    <div className={`ai-assistant-panel ${className}`}>
      {/* 面板标题栏 */}
      <div className="panel-header">
        <div className="header-main">
          <h3>🤖 AI 助手</h3>
          <div className="connection-summary">
            <span className="summary-text">
              {connectionStats.connected}/{connectionStats.total} 已连接
            </span>
            {connectionStats.connecting > 0 && (
              <span className="connecting-notice">
                ({connectionStats.connecting} 连接中)
              </span>
            )}
          </div>
        </div>

        {/* 连接控制按钮 */}
        <div className="connection-controls">
          {onConnectAll && (
            <button
              className="control-btn connect-all"
              onClick={onConnectAll}
              title="连接所有助手"
            >
              🔗 全部连接
            </button>
          )}
          {onDisconnectAll && (
            <button
              className="control-btn disconnect-all"
              onClick={onDisconnectAll}
              title="断开所有连接"
            >
              🔌 断开连接
            </button>
          )}
        </div>
      </div>

      {/* AI助手列表 */}
      <div className="assistants-grid">
        {assistants.map(assistant => {
          const isActive = assistant.type === activeAssistant;
          const status = connections.get(assistant.type);
          const isConnected = status?.connected || false;

          return (
            <div
              key={assistant.type}
              className={`assistant-card ${isActive ? 'active' : ''} ${isConnected ? 'connected' : 'disconnected'}`}
              onClick={() => handleAssistantSwitch(assistant.type)}
            >
              {/* 助手图标和连接状态 */}
              <div className="card-header">
                <div className="assistant-icon">
                  {assistant.icon}
                </div>
                <div className="connection-status">
                  {getConnectionIndicator(assistant.type)}
                </div>
                {isActive && <div className="active-indicator">✨</div>}
              </div>

              {/* 助手信息 */}
              <div className="card-body">
                <h4 className="assistant-name">{assistant.displayName}</h4>
                <p className="assistant-description">{assistant.description}</p>

                <div className="status-line">
                  <span className="status-text">
                    {getAssistantStatusText(assistant.type)}
                  </span>
                  {status?.lastConnectedTime && (
                    <span className="last-connected">
                      上次连接: {new Date(status.lastConnectedTime).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {/* 支持的技能 */}
                {assistant.supportedSkills.length > 0 && (
                  <div className="supported-skills">
                    <span className="skills-label">技能:</span>
                    <div className="skills-tags">
                      {assistant.supportedSkills.slice(0, 3).map(skill => (
                        <span key={skill} className="skill-tag">
                          {skill}
                        </span>
                      ))}
                      {assistant.supportedSkills.length > 3 && (
                        <span className="skill-tag more">
                          +{assistant.supportedSkills.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 能力标签 */}
                {assistant.capabilities.length > 0 && (
                  <div className="capabilities">
                    <span className="capabilities-label">能力:</span>
                    <div className="capability-tags">
                      {assistant.capabilities.slice(0, 2).map(capability => (
                        <span key={capability} className="capability-tag">
                          {capability}
                        </span>
                      ))}
                      {assistant.capabilities.length > 2 && (
                        <span className="capability-tag more">
                          +{assistant.capabilities.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 重连次数提示 */}
              {status && status.reconnectAttempts > 0 && (
                <div className="reconnect-notice">
                  <span className="reconnect-text">
                    🔄 重连尝试: {status.reconnectAttempts}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 活跃助手信息栏 */}
      <div className="active-assistant-info">
        <div className="info-header">
          <span className="info-label">当前活跃:</span>
          <span className="active-assistant-name">
            {assistants.find(a => a.type === activeAssistant)?.displayName || '未知'}
          </span>
        </div>

        <div className="quick-actions">
          <button
            className="action-btn"
            disabled={!connections.get(activeAssistant)?.connected}
            title="测试连接"
          >
            🔍 测试连接
          </button>
          <button
            className="action-btn"
            disabled={!connections.get(activeAssistant)?.connected}
            title="查看日志"
          >
            📋 查看日志
          </button>
        </div>
      </div>

      {/* 连接错误信息 */}
      {Array.from(connections.entries()).some(([_, status]) => status.error) && (
        <div className="error-messages">
          <div className="error-header">⚠️ 连接错误</div>
          {Array.from(connections.entries())
            .filter(([_, status]) => status.error)
            .map(([type, status]) => (
              <div key={type} className="error-item">
                <span className="error-assistant">
                  {assistants.find(a => a.type === type)?.displayName}:
                </span>
                <span className="error-message">{status.error}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default AIAssistantPanel;