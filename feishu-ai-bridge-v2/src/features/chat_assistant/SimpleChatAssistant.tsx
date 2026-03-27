// 简化版聊天助手组件 - 用于测试和展示
import React, { useState } from 'react';
import './styles/ChatAssistant.css';

// 模拟AI助手类型
const AI_ASSISTANTS = [
  {
    type: 'claude_code',
    displayName: 'Claude Code',
    icon: '🔷',
    description: 'Claude代码助手，擅长代码分析和编程任务',
    capabilities: ['代码编写', '问题调试', '架构设计'],
    supportedSkills: ['plan-eng-review', 'review', 'investigate']
  },
  {
    type: 'opencode',
    displayName: 'OpenCode',
    icon: '🟠',
    description: '开源代码助手，专注于开源项目协作',
    capabilities: ['开源协作', '代码审查', '文档生成'],
    supportedSkills: ['review', 'qa', 'ship']
  },
  {
    type: 'codex',
    displayName: 'CodeX',
    icon: '⚡',
    description: '代码执行助手，提供高效的代码执行能力',
    capabilities: ['代码执行', '性能优化', '自动化测试'],
    supportedSkills: ['codex', 'qa-only', 'land-and-deploy']
  }
];

// 模拟消息类型
interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  assistant?: string;
}

export default function SimpleChatAssistant() {
  const [activeAssistant, setActiveAssistant] = useState('claude_code');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: '欢迎使用AI助手工作台！选择左侧的AI助手开始对话。',
      timestamp: Date.now()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [connections, setConnections] = useState(new Map([
    ['claude_code', { connected: true, connecting: false }],
    ['opencode', { connected: false, connecting: false }],
    ['codex', { connected: false, connecting: false }]
  ]));

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: Date.now(),
      assistant: activeAssistant
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: `这是来自 ${AI_ASSISTANTS.find(a => a.type === activeAssistant)?.displayName} 的模拟回复。在真实环境中，这里将显示AI助手的实际响应。`,
      timestamp: Date.now() + 1000,
      assistant: activeAssistant
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputMessage('');
  };

  const handleSwitchAssistant = (assistantType: string) => {
    setActiveAssistant(assistantType);
  };

  const toggleConnection = (assistantType: string) => {
    setConnections(prev => {
      const newConnections = new Map(prev);
      const current = newConnections.get(assistantType) || { connected: false, connecting: false };
      newConnections.set(assistantType, {
        ...current,
        connected: !current.connected
      });
      return newConnections;
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="chat-assistant-container">
      {/* 页面标题 */}
      <div className="assistant-header">
        <div className="header-title">
          <h1>💬 AI助手聊天</h1>
          <p>与多种AI助手进行实时对话和协作</p>
        </div>

        {/* 状态概览 */}
        <div className="status-overview">
          <div className="status-item">
            <span className="status-label">活跃助手:</span>
            <span className="status-value">
              {AI_ASSISTANTS.find(a => a.type === activeAssistant)?.displayName || '未知'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">连接状态:</span>
            <span className={`status-value ${connections.get(activeAssistant)?.connected ? 'connected' : 'disconnected'}`}>
              {connections.get(activeAssistant)?.connected ? '🟢 已连接' : '🔴 未连接'}
            </span>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="assistant-main-content">
        {/* AI聊天区域 */}
        <div className="ai-chat-section">
          {/* 左侧：AI助手面板 */}
          <div className="assistant-panel-wrapper">
            <div className="ai-assistant-panel">
              {/* 面板标题栏 */}
              <div className="panel-header">
                <div className="header-main">
                  <h3>🤖 AI 助手</h3>
                  <div className="connection-summary">
                    <span className="summary-text">
                      {Array.from(connections.values()).filter(c => c.connected).length}/
                      {connections.size} 已连接
                    </span>
                  </div>
                </div>
              </div>

              {/* AI助手列表 */}
              <div className="assistants-grid">
                {AI_ASSISTANTS.map(assistant => {
                  const isActive = assistant.type === activeAssistant;
                  const isConnected = connections.get(assistant.type)?.connected || false;

                  return (
                    <div
                      key={assistant.type}
                      className={`assistant-card ${isActive ? 'active' : ''} ${isConnected ? 'connected' : 'disconnected'}`}
                      onClick={() => handleSwitchAssistant(assistant.type)}
                    >
                      {/* 助手图标和连接状态 */}
                      <div className="card-header">
                        <div className="assistant-icon">
                          {assistant.icon}
                        </div>
                        <div className="connection-status">
                          {isConnected ? '🟢' : '🔴'}
                        </div>
                        {isActive && <div className="active-indicator">✨</div>}
                      </div>

                      {/* 助手信息 */}
                      <div className="card-body">
                        <h4 className="assistant-name">{assistant.displayName}</h4>
                        <p className="assistant-description">{assistant.description}</p>

                        <div className="status-line">
                          <span className="status-text">
                            {isConnected ? '已连接' : '未连接'}
                          </span>
                        </div>

                        {/* 支持的技能 */}
                        <div className="supported-skills">
                          <span className="skills-label">技能:</span>
                          <div className="skills-tags">
                            {assistant.supportedSkills.slice(0, 2).map(skill => (
                              <span key={skill} className="skill-tag">
                                {skill}
                              </span>
                            ))}
                            {assistant.supportedSkills.length > 2 && (
                              <span className="skill-tag more">
                                +{assistant.supportedSkills.length - 2}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 能力标签 */}
                        <div className="capabilities">
                          <span className="capabilities-label">能力:</span>
                          <div className="capability-tags">
                            {assistant.capabilities.slice(0, 2).map(capability => (
                              <span key={capability} className="capability-tag">
                                {capability}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* 连接按钮 */}
                        <button
                          className={`action-btn ${isConnected ? 'disconnect' : 'connect'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleConnection(assistant.type);
                          }}
                          style={{ marginTop: '8px', fontSize: '11px' }}
                        >
                          {isConnected ? '断开连接' : '连接'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 活跃助手信息 */}
              <div className="active-assistant-info">
                <div className="info-header">
                  <span className="info-label">当前活跃:</span>
                  <span className="active-assistant-name">
                    {AI_ASSISTANTS.find(a => a.type === activeAssistant)?.displayName || '未知'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：聊天窗口 */}
          <div className="chat-window-wrapper">
            <div className="chat-window">
              {/* 聊天窗口标题栏 */}
              <div className="chat-header">
                <div className="header-main">
                  <h3>💬 AI助手对话</h3>
                </div>

                <div className="header-controls">
                  {/* 连接状态 */}
                  <div className="connection-status">
                    <span
                      className={`status-indicator ${connections.get(activeAssistant)?.connected ? 'connected' : 'disconnected'}`}
                    >
                      {connections.get(activeAssistant)?.connected ? '🟢' : '🔴'}
                    </span>
                    <span className="status-text">
                      {connections.get(activeAssistant)?.connected ? '已连接' : '未连接'}
                    </span>
                  </div>

                  {/* 清理历史按钮 */}
                  <button
                    className="clear-history-btn"
                    onClick={() => setMessages([{
                      id: Date.now().toString(),
                      type: 'system',
                      content: '聊天历史已清空',
                      timestamp: Date.now()
                    }])}
                    title="清空聊天历史"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* 消息列表 */}
              <div className="messages-container">
                <div className="messages-list">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`message-item message-${message.type}`}
                    >
                      <div className="message-header">
                        <span className="message-sender">
                          {message.type === 'user' ? '👤 您' :
                           message.type === 'system' ? '🤖 系统' :
                           `🤖 ${AI_ASSISTANTS.find(a => a.type === message.assistant)?.displayName}`}
                        </span>
                        <span className="message-time">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>

                      <div className="message-body">
                        <div className="message-content-text">
                          {message.content.split('\n').map((line, index) => (
                            <div key={index}>{line}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 快速建议 */}
              <div className="quick-suggestions">
                {['你好，需要什么帮助？', '分析这个工作项', '查看代码质量', '生成报告'].map((suggestion, index) => (
                  <button
                    key={index}
                    className="suggestion-chip"
                    onClick={() => setInputMessage(suggestion)}
                    disabled={!connections.get(activeAssistant)?.connected}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {/* 消息输入区 */}
              <div className="message-input-area">
                {/* 工具栏 */}
                <div className="input-toolbar">
                  <span className="input-hint">
                    与 {AI_ASSISTANTS.find(a => a.type === activeAssistant)?.displayName} 对话
                  </span>
                </div>

                {/* 输入框区域 */}
                <div className="input-container">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={
                      connections.get(activeAssistant)?.connected
                        ? "输入消息... (Enter发送，Shift+Enter换行)"
                        : "请先连接AI助手..."
                    }
                    disabled={!connections.get(activeAssistant)?.connected}
                    rows={3}
                    className="message-input"
                  />

                  <button
                    className="send-button"
                    onClick={handleSendMessage}
                    disabled={!connections.get(activeAssistant)?.connected || !inputMessage.trim()}
                    title="发送消息"
                  >
                    📤
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部工具栏 */}
      <div className="assistant-footer">
        <div className="footer-actions">
          <button className="footer-btn">
            🔄 刷新
          </button>
          <button
            className="footer-btn"
            onClick={() => {
              // 模拟广播功能
              const broadcastMsg: Message = {
                id: Date.now().toString(),
                type: 'system',
                content: '广播消息：系统状态正常，所有AI助手工作正常',
                timestamp: Date.now()
              };
              setMessages(prev => [...prev, broadcastMsg]);
            }}
          >
            📢 广播
          </button>
        </div>

        <div className="footer-info">
          <span className="info-text">
            AI助手聊天 v1.0 | 活跃连接: {Array.from(connections.values()).filter(c => c.connected).length}
          </span>
        </div>
      </div>
    </div>
  );
}