// 真实的聊天助手组件 - 连接本地Claude Code
import React, { useState, useEffect, useRef } from 'react';
import { ClaudeCodeClient, detectClaudeCodePort } from './services/claudeCodeClient';
import { workflowNodeService } from './services/workflowNodeService';
import CurrentNodesPanel from './components/CurrentNodesPanel';
import { useWorkItemContext } from '../../hooks/useContext';
import './styles/ChatAssistant.css';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: number;
  streaming?: boolean;
}

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  port: number | null;
  host: string;
}

export default function RealChatAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: '🤖 正在检测本地Claude Code连接...',
      timestamp: Date.now()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    connected: false,
    connecting: true,
    error: null,
    port: null,
    host: 'localhost'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStreamingId, setCurrentStreamingId] = useState<string | null>(null);
  const [autoSkillsTriggered, setAutoSkillsTriggered] = useState(new Set<string>());

  const claudeCodeClientRef = useRef<ClaudeCodeClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 获取工作项上下文
  const { spaceId, workItemType, workItemId } = useWorkItemContext();

  // 初始化检测Claude Code
  useEffect(() => {
    initializeClaudeCodeConnection();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * 初始化Claude Code连接
   */
  const initializeClaudeCodeConnection = async () => {
    try {
      setConnectionState(prev => ({ ...prev, connecting: true, error: null }));

      addSystemMessage('🔍 正在检测Claude Code端口...');
      addSystemMessage('📝 检测中: 3000, 8080, 8000, 8081, 3001, 5000');

      // 检测Claude Code运行端口
      const detectedPort = await detectClaudeCodePort();

      if (!detectedPort) {
        throw new Error('未检测到Claude Code运行实例。请确保Claude Code正在运行。');
      }

      addSystemMessage(`✅ 检测到Claude Code运行在端口 ${detectedPort}`);

      // 创建客户端
      claudeCodeClientRef.current = new ClaudeCodeClient({
        host: connectionState.host,
        port: detectedPort
      });

      // 测试连接
      const isHealthy = await claudeCodeClientRef.current.isRunning();

      if (!isHealthy) {
        throw new Error(`端口 ${detectedPort} 上的服务无法响应健康检查`);
      }

      setConnectionState({
        connected: true,
        connecting: false,
        error: null,
        port: detectedPort,
        host: connectionState.host
      });

      addSystemMessage(`🎉 Claude Code连接成功！可以开始对话了。`);

      // 发送欢迎消息
      setTimeout(() => {
        addSystemMessage(`💡 提示: 你可以向Claude Code发送任何消息，包括代码问题、工作流指令等。`);
      }, 1000);

      // 自动触发当前节点配置的技能
      setTimeout(() => {
        autoTriggerNodeSkills();
      }, 2000);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setConnectionState({
        connected: false,
        connecting: false,
        error: errorMsg,
        port: null,
        host: connectionState.host
      });

      addSystemMessage(`❌ 连接失败: ${errorMsg}`);

      // 提供更详细的帮助信息
      addSystemMessage(`💡 解决方案:`);
      addSystemMessage(`1. 确保 Claude Code 正在运行`);
      addSystemMessage(`2. 常见启动方式: 在终端运行 "claude-code" 或 "npx claude-code"`);
      addSystemMessage(`3. Claude Code 通常在以下端口启动: 3000, 8080, 8000`);
      addSystemMessage(`4. 检查防火墙设置是否阻止了连接`);
      addSystemMessage(`🔧 解决方案: 请启动Claude Code并确保它在默认端口(8080、3000等)运行`);
    }
  };

  /**
   * 添加系统消息
   */
  const addSystemMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, message]);
  };

  /**
   * 重新连接
   */
  const reconnect = async () => {
    await initializeClaudeCodeConnection();
  };

  /**
   * 发送消息
   */
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !connectionState.connected || isProcessing) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: Date.now()
    };

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      type: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
      streaming: true
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputMessage('');
    setIsProcessing(true);
    setCurrentStreamingId(assistantMessageId);

    try {
      if (!claudeCodeClientRef.current) {
        throw new Error('Claude Code客户端未初始化');
      }

      // 发送消息到Claude Code
      console.log('[ChatAssistant] 发送消息:', userMessage.content);

      // 直接调用sendMessage方法
      const response = await claudeCodeClientRef.current.sendMessage(
        userMessage.content,
        {
          nodeId: 'current',
          timestamp: Date.now()
        }
      );

      console.log('[ChatAssistant] 收到响应:', response);

      // 更新消息内容
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: response || '收到空响应', streaming: false }
            : msg
        )
      );

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // 移除未完成的assistant消息，添加错误消息
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== assistantMessageId);
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'error',
          content: `❌ 发送失败: ${errorMsg}`,
          timestamp: Date.now()
        };
        return [...filtered, errorMessage];
      });

      // 如果是连接错误，更新连接状态
      if (errorMsg.includes('连接') || errorMsg.includes('网络')) {
        setConnectionState(prev => ({
          ...prev,
          connected: false,
          error: errorMsg
        }));
      }
    } finally {
      setIsProcessing(false);
      setCurrentStreamingId(null);
    }
  };

  /**
   * 处理节点技能触发 (从节点面板触发)
   */
  const handleNodeSkillTrigger = async (skillName: string, nodeId: string) => {
    if (!connectionState.connected || !claudeCodeClientRef.current) {
      addSystemMessage(`❌ 无法执行节点技能 ${skillName}: 未连接到Claude Code`);
      return;
    }

    addSystemMessage(`🎯 节点技能触发: ${skillName} (节点ID: ${nodeId})`);

    try {
      const result = await claudeCodeClientRef.current.executeSkill(skillName, {
        timestamp: Date.now(),
        interface: 'feishu-plugin',
        nodeId: nodeId,
        autoTriggered: true
      });

      addSystemMessage(`✅ 节点技能 ${skillName} 执行完成`);

      // 添加技能执行结果
      const resultMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `**节点技能执行结果 (${skillName}):**\n\n${result}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, resultMessage]);

      // 标记该节点的技能已触发，避免重复自动触发
      setAutoSkillsTriggered(prev => new Set(prev).add(`${nodeId}-${skillName}`));

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addSystemMessage(`❌ 节点技能 ${skillName} 执行失败: ${errorMsg}`);
    }
  };

  /**
   * 自动触发当前节点配置的技能
   */
  const autoTriggerNodeSkills = async () => {
    if (!spaceId || !workItemType || !workItemId || !connectionState.connected) {
      return;
    }

    try {
      // 获取当前进行中的节点
      const runningNodes = await workflowNodeService.getCurrentRunningNodes(
        spaceId,
        workItemType,
        workItemId
      );

      for (const node of runningNodes) {
        // 触发该节点配置的gstack技能
        await workflowNodeService.triggerNodeSkills(node.id, async (skillName) => {
          const triggerKey = `${node.id}-${skillName}`;

          // 避免重复触发同一个节点的同一个技能
          if (!autoSkillsTriggered.has(triggerKey)) {
            console.log(`[RealChatAssistant] 自动触发节点技能: ${skillName} (节点: ${node.name})`);

            addSystemMessage(`🤖 自动触发节点技能: ${skillName} (节点: ${node.name})`);
            await handleNodeSkillTrigger(skillName, node.id);
          }
        });
      }
    } catch (error) {
      console.error('[RealChatAssistant] 自动触发节点技能失败:', error);
    }
  };

  /**
   * 执行技能
   */
  const executeSkill = async (skillName: string) => {
    if (!connectionState.connected || !claudeCodeClientRef.current) {
      addSystemMessage(`❌ 无法执行技能 ${skillName}: 未连接到Claude Code`);
      return;
    }

    addSystemMessage(`⚡ 正在执行技能: ${skillName}...`);

    try {
      const result = await claudeCodeClientRef.current.executeSkill(skillName, {
        timestamp: Date.now(),
        interface: 'feishu-plugin'
      });

      addSystemMessage(`✅ 技能 ${skillName} 执行完成`);

      // 添加技能执行结果
      const resultMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `**技能执行结果 (${skillName}):**\n\n${result}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, resultMessage]);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addSystemMessage(`❌ 技能 ${skillName} 执行失败: ${errorMsg}`);
    }
  };

  /**
   * 格式化时间
   */
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * 清空聊天历史
   */
  const clearHistory = () => {
    setMessages([{
      id: Date.now().toString(),
      type: 'system',
      content: '聊天历史已清空',
      timestamp: Date.now()
    }]);
  };

  return (
    <div className="chat-assistant-container">
      {/* 页面标题 */}
      <div className="assistant-header">
        <div className="header-title">
          <h1>🔷 Claude Code 聊天</h1>
          <p>与本地Claude Code实例进行实时对话</p>
        </div>

        {/* 连接状态 */}
        <div className="status-overview">
          <div className="status-item">
            <span className="status-label">连接状态:</span>
            <span className={`status-value ${connectionState.connected ? 'connected' : 'disconnected'}`}>
              {connectionState.connecting ? '🟡 连接中...' :
               connectionState.connected ? '🟢 已连接' : '🔴 未连接'}
            </span>
          </div>
          {connectionState.port && (
            <div className="status-item">
              <span className="status-label">端口:</span>
              <span className="status-value">{connectionState.host}:{connectionState.port}</span>
            </div>
          )}
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="assistant-main-content">
        {/* 当前节点面板 */}
        <CurrentNodesPanel
          onSkillTrigger={handleNodeSkillTrigger}
          refreshInterval={30000}
        />

        <div className="ai-chat-section">
          {/* 聊天窗口 */}
          <div className="chat-window-wrapper" style={{ width: '100%' }}>
            <div className="chat-window">
              {/* 聊天窗口标题栏 */}
              <div className="chat-header">
                <div className="header-main">
                  <h3>💬 Claude Code 对话</h3>
                </div>

                <div className="header-controls">
                  {/* 连接控制 */}
                  {!connectionState.connected && (
                    <>
                      <button
                        className="footer-btn"
                        onClick={reconnect}
                        disabled={connectionState.connecting}
                        title="重新连接Claude Code"
                      >
                        {connectionState.connecting ? '连接中...' : '🔄 重连'}
                      </button>

                      <button
                        className="footer-btn"
                        onClick={() => {
                          const port = prompt('输入Claude Code端口号 (如: 3000, 8080, 或其他):', '3000');
                          if (port && port.trim()) {
                            const portNum = parseInt(port.trim(), 10);
                            if (!isNaN(portNum) && portNum > 0 && portNum < 65536) {
                              claudeCodeClientRef.current = new ClaudeCodeClient({
                                host: connectionState.host,
                                port: portNum
                              });
                              addSystemMessage(`🔧 尝试连接到手动指定端口: ${portNum}`);
                              reconnect();
                            } else {
                              addSystemMessage(`❌ 无效端口号: ${port}`);
                            }
                          }
                        }}
                        title="手动设置Claude Code端口"
                      >
                        🔧 手动设置
                      </button>
                    </>
                  )}

                  {/* 清理历史按钮 */}
                  <button
                    className="clear-history-btn"
                    onClick={clearHistory}
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
                           message.type === 'error' ? '❌ 错误' :
                           '🔷 Claude Code'}
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
                          {message.streaming && (
                            <span className="streaming-indicator">▋</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* 处理指示器 */}
                  {isProcessing && (
                    <div className="processing-indicator">
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span className="processing-text">Claude Code 正在思考...</span>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </div>

              {/* 快速建议 */}
              <div className="quick-suggestions">
                {[
                  '你好，Claude Code',
                  '帮我分析一下当前项目',
                  '执行代码检查',
                  '生成项目摘要'
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    className="suggestion-chip"
                    onClick={() => setInputMessage(suggestion)}
                    disabled={!connectionState.connected || isProcessing}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {/* 技能按钮 */}
              <div className="quick-suggestions">
                {[
                  { name: 'plan-eng-review', label: '🔧 工程审查', icon: '🔧' },
                  { name: 'investigate', label: '🔍 调查分析', icon: '🔍' },
                  { name: 'review', label: '📝 代码审查', icon: '📝' },
                  { name: 'qa', label: '✅ 质量检查', icon: '✅' }
                ].map((skill) => (
                  <button
                    key={skill.name}
                    className="suggestion-chip"
                    onClick={() => executeSkill(skill.name)}
                    disabled={!connectionState.connected || isProcessing}
                    title={`执行 ${skill.name} 技能`}
                  >
                    {skill.icon} {skill.label}
                  </button>
                ))}
              </div>

              {/* 消息输入区 */}
              <div className="message-input-area">
                {/* 工具栏 */}
                <div className="input-toolbar">
                  <span className="input-hint">
                    {connectionState.connected
                      ? `与Claude Code对话 (${connectionState.host}:${connectionState.port})`
                      : "请先连接Claude Code"}
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
                      connectionState.connected
                        ? "输入消息... (Enter发送，Shift+Enter换行)"
                        : "请先连接Claude Code..."
                    }
                    disabled={!connectionState.connected || isProcessing}
                    rows={3}
                    className="message-input"
                  />

                  <button
                    className="send-button"
                    onClick={handleSendMessage}
                    disabled={!connectionState.connected || !inputMessage.trim() || isProcessing}
                    title="发送消息"
                  >
                    {isProcessing ? '发送中...' : '📤'}
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
          <button
            className="footer-btn"
            onClick={reconnect}
            disabled={connectionState.connecting}
          >
            🔄 {connectionState.connecting ? '连接中' : '重连'}
          </button>

          <button
            className="footer-btn"
            onClick={() => executeSkill('investigate')}
            disabled={!connectionState.connected || isProcessing}
          >
            🔍 项目分析
          </button>

          <button
            className="footer-btn"
            onClick={() => executeSkill('review')}
            disabled={!connectionState.connected || isProcessing}
          >
            📝 代码审查
          </button>
        </div>

        <div className="footer-info">
          <span className="info-text">
            Claude Code 聊天 v1.0 |
            {connectionState.connected
              ? ` 连接到 ${connectionState.host}:${connectionState.port}`
              : ' 未连接 - 请启动Claude Code或使用手动设置'}
          </span>
        </div>
      </div>
    </div>
  );
}