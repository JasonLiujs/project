// 聊天窗口主组件

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, SkillExecution, WorkflowNode, AIAssistantType } from '../../types/multiAIChat';

interface ChatWindowProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, target?: AIAssistantType, attachments?: any[]) => Promise<void>;
  workflowContext?: WorkflowNode | null;
  skillExecutions?: Map<string, SkillExecution>;
  activeAssistant: AIAssistantType;
  isConnected: boolean;
  isProcessing: boolean;
  onExecuteSkill?: (skillName: string) => Promise<void>;
  onClearHistory?: () => void;
  className?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  onSendMessage,
  workflowContext,
  skillExecutions = new Map(),
  activeAssistant,
  isConnected,
  isProcessing,
  onExecuteSkill,
  onClearHistory,
  className = ''
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /**
   * 自动滚动到底部
   */
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  /**
   * 处理消息发送
   */
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSubmitting || !isConnected) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSendMessage(inputMessage.trim(), activeAssistant, attachments);
      setInputMessage('');
      setAttachments([]);
    } catch (error) {
      console.error('[ChatWindow] Failed to send message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 处理键盘事件
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * 格式化消息时间
   */
  const formatMessageTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * 获取消息类型样式
   */
  const getMessageTypeClass = (type: ChatMessage['type']): string => {
    switch (type) {
      case 'user':
        return 'message-user';
      case 'assistant':
        return 'message-assistant';
      case 'system':
        return 'message-system';
      case 'skill_trigger':
        return 'message-skill';
      case 'error':
        return 'message-error';
      default:
        return 'message-default';
    }
  };

  /**
   * 渲染消息内容
   */
  const renderMessageContent = (message: ChatMessage) => {
    // 检查是否是代码块
    if (message.content.includes('```')) {
      const parts = message.content.split(/(```[\s\S]*?```)/);
      return (
        <div className="message-content-formatted">
          {parts.map((part, index) => {
            if (part.startsWith('```') && part.endsWith('```')) {
              const codeContent = part.slice(3, -3);
              const [language, ...codeLines] = codeContent.split('\n');
              return (
                <div key={index} className="code-block">
                  {language && <div className="code-language">{language}</div>}
                  <pre className="code-content">
                    <code>{codeLines.join('\n')}</code>
                  </pre>
                </div>
              );
            }
            return (
              <div key={index} className="text-content">
                {part.split('\n').map((line, lineIndex) => (
                  <div key={lineIndex}>{line}</div>
                ))}
              </div>
            );
          })}
        </div>
      );
    }

    // 普通文本，保持换行
    return (
      <div className="message-content-text">
        {message.content.split('\n').map((line, index) => (
          <div key={index}>{line}</div>
        ))}
      </div>
    );
  };

  /**
   * 渲染技能执行状态
   */
  const renderSkillExecution = (skillExecution: SkillExecution) => {
    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'pending': return '⏳';
        case 'running': return '⚡';
        case 'completed': return '✅';
        case 'failed': return '❌';
        case 'cancelled': return '⏹️';
        default: return '📋';
      }
    };

    return (
      <div className="skill-execution-status">
        <div className="skill-header">
          <span className="skill-icon">{getStatusIcon(skillExecution.status)}</span>
          <span className="skill-name">{skillExecution.skillName}</span>
          <span className="skill-status">{skillExecution.status}</span>
        </div>

        {skillExecution.progress && skillExecution.status === 'running' && (
          <div className="skill-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.round(skillExecution.progress * 100)}%` }}
              />
            </div>
            <span className="progress-text">{Math.round(skillExecution.progress * 100)}%</span>
          </div>
        )}

        {skillExecution.error && (
          <div className="skill-error">
            <span className="error-label">错误:</span>
            <span className="error-text">{skillExecution.error}</span>
          </div>
        )}
      </div>
    );
  };

  /**
   * 生成快速建议
   */
  const quickSuggestions = workflowContext ? [
    `分析当前节点 "${workflowContext.name}" 的状态`,
    '执行代码审查',
    '生成任务总结',
    '检查潜在风险',
  ] : [
    '你好，需要什么帮助？',
    '分析这个工作项',
    '查看代码质量',
    '生成报告',
  ];

  return (
    <div className={`chat-window ${className}`}>
      {/* 聊天窗口标题栏 */}
      <div className="chat-header">
        <div className="header-main">
          <h3>💬 AI助手对话</h3>
          <div className="context-info">
            {workflowContext && (
              <span className="context-text">
                📍 节点: {workflowContext.name}
                {workflowContext.is_milestone && ' ⭐'}
              </span>
            )}
          </div>
        </div>

        <div className="header-controls">
          {/* 连接状态 */}
          <div className="connection-status">
            <span
              className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}
              title={isConnected ? '已连接' : '未连接'}
            >
              {isConnected ? '🟢' : '🔴'}
            </span>
            <span className="status-text">
              {isConnected ? '已连接' : '未连接'}
            </span>
          </div>

          {/* 清理历史按钮 */}
          {onClearHistory && (
            <button
              className="clear-history-btn"
              onClick={onClearHistory}
              title="清空聊天历史"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-messages">
            <div className="empty-icon">💬</div>
            <p>暂无对话消息</p>
            <small>发送消息开始与AI助手对话</small>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message-item ${getMessageTypeClass(message.type)}`}
              >
                <div className="message-header">
                  <span className="message-sender">
                    {message.type === 'user' ? '👤 您' : `🤖 ${message.assistant}`}
                  </span>
                  <span className="message-time">
                    {formatMessageTime(message.timestamp)}
                  </span>
                </div>

                <div className="message-body">
                  {renderMessageContent(message)}

                  {/* 技能执行状态 */}
                  {message.skillExecution && renderSkillExecution(message.skillExecution)}

                  {/* 附件显示 */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="message-attachments">
                      {message.attachments.map((attachment, index) => (
                        <div key={index} className="attachment-item">
                          <span className="attachment-icon">📎</span>
                          <span className="attachment-name">{attachment.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 正在处理指示器 */}
        {isProcessing && (
          <div className="processing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="processing-text">AI助手正在思考...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 快速建议 */}
      <div className="quick-suggestions">
        {quickSuggestions.map((suggestion, index) => (
          <button
            key={index}
            className="suggestion-chip"
            onClick={() => {
              setInputMessage(suggestion);
              inputRef.current?.focus();
            }}
            disabled={!isConnected || isSubmitting}
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
            {workflowContext
              ? `在 "${workflowContext.name}" 节点中与 ${activeAssistant} 对话`
              : `与 ${activeAssistant} 对话`}
          </span>

          <div className="toolbar-actions">
            {/* 技能执行按钮 */}
            {onExecuteSkill && workflowContext && (
              <button
                className="action-btn execute-skill"
                onClick={() => onExecuteSkill('plan-eng-review')}
                disabled={!isConnected}
                title="执行技能"
              >
                ⚡ 执行技能
              </button>
            )}
          </div>
        </div>

        {/* 输入框区域 */}
        <div className="input-container">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isConnected
                ? "输入消息... (Enter发送，Shift+Enter换行)"
                : "请先连接AI助手..."
            }
            disabled={!isConnected || isSubmitting}
            rows={3}
            className="message-input"
          />

          <button
            className="send-button"
            onClick={handleSendMessage}
            disabled={!isConnected || !inputMessage.trim() || isSubmitting}
            title="发送消息"
          >
            {isSubmitting ? '发送中...' : '📤'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;