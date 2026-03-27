// 聊天助手主应用组件

import React, { useEffect, useCallback } from 'react';
import { useNodeFlow } from './hooks/useNodeFlow';
import { useMultiAIChat } from './hooks/useMultiAIChat';
import NodeFlowChart from './components/NodeFlowChart';
import AIAssistantPanel from './components/AIAssistantPanel';
import ChatWindow from './components/ChatWindow';
import './styles/ChatAssistant.css';

const ChatAssistant: React.FC = () => {
  const nodeFlow = useNodeFlow();
  const multiAIChat = useMultiAIChat();

  /**
   * 当节点变化时，更新AI助手的工作流上下文
   */
  const handleNodeChange = useCallback(async () => {
    if (nodeFlow.flowState.currentNode) {
      try {
        const workflowContext = await nodeFlow.getWorkflowContext();
        if (workflowContext) {
          await multiAIChat.updateWorkflowContext(workflowContext);
        }
      } catch (error) {
        console.error('[ChatAssistant] Failed to update workflow context:', error);
      }
    }
  }, [nodeFlow.flowState.currentNode, nodeFlow, multiAIChat]);

  /**
   * 自动技能触发
   */
  const handleAutoSkillTrigger = useCallback(async () => {
    if (!nodeFlow.flowState.currentNode || !nodeFlow.flowState.configuredSkills.length) {
      return;
    }

    // 检查当前节点是否有配置的技能
    const currentNodeSkills = nodeFlow.flowState.configuredSkills.filter(
      config => config.nodeId === nodeFlow.flowState.currentNode?.state_key
    );

    console.log('[ChatAssistant] Current node skills:', currentNodeSkills);

    // 这里可以添加自动触发逻辑
    // 暂时不自动触发，让用户手动控制
  }, [nodeFlow.flowState.currentNode, nodeFlow.flowState.configuredSkills]);

  /**
   * 处理技能执行
   */
  const handleExecuteSkill = useCallback(async (skillName: string): Promise<void> => {
    try {
      await multiAIChat.executeSkill(skillName);
      console.log(`[ChatAssistant] Executed skill: ${skillName}`);
    } catch (error) {
      console.error('[ChatAssistant] Failed to execute skill:', error);
    }
  }, [multiAIChat]);

  /**
   * 处理节点导航
   */
  const handleNodeNavigate = useCallback(async (nodeId: string): Promise<void> => {
    try {
      await nodeFlow.navigateToNode(nodeId);
    } catch (error) {
      console.error('[ChatAssistant] Failed to navigate to node:', error);
    }
  }, [nodeFlow]);

  /**
   * 监听节点变化
   */
  useEffect(() => {
    const unsubscribe = nodeFlow.onNodeChange((node) => {
      console.log('[ChatAssistant] Node changed:', node?.name);
      handleNodeChange();
      handleAutoSkillTrigger();
    });

    return unsubscribe;
  }, [nodeFlow, handleNodeChange, handleAutoSkillTrigger]);

  /**
   * 初始化时更新上下文
   */
  useEffect(() => {
    if (nodeFlow.flowState.currentNode && !nodeFlow.flowState.isLoading) {
      handleNodeChange();
    }
  }, [nodeFlow.flowState.currentNode, nodeFlow.flowState.isLoading, handleNodeChange]);

  /**
   * 加载状态
   */
  if (nodeFlow.flowState.isLoading && !nodeFlow.flowState.currentNode) {
    return (
      <div className="chat-assistant-loading">
        <div className="loading-content">
          <div className="loading-spinner" />
          <h3>🤖 AI助手初始化中...</h3>
          <p>正在加载工作流信息和建立连接</p>
        </div>
      </div>
    );
  }

  /**
   * 错误状态
   */
  if (nodeFlow.flowState.error) {
    return (
      <div className="chat-assistant-error">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h3>加载失败</h3>
          <p className="error-message">{nodeFlow.flowState.error}</p>
          <button
            className="retry-button"
            onClick={() => nodeFlow.refreshFlow()}
          >
            🔄 重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-assistant-container">
      {/* 页面标题 */}
      <div className="assistant-header">
        <div className="header-title">
          <h1>🤖 AI助手工作台</h1>
          <p>智能工作流程助手 - 节点状态监控与AI对话</p>
        </div>

        {/* 状态概览 */}
        <div className="status-overview">
          <div className="status-item">
            <span className="status-label">当前节点:</span>
            <span className="status-value">
              {nodeFlow.flowState.currentNode?.name || '未知'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">活跃助手:</span>
            <span className="status-value">
              {multiAIChat.getAllAssistants().find(
                a => a.type === multiAIChat.chatState.activeAssistant
              )?.displayName || '未知'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">连接状态:</span>
            <span className={`status-value ${
              multiAIChat.chatState.connections.get(multiAIChat.chatState.activeAssistant)?.connected
                ? 'connected' : 'disconnected'
            }`}>
              {multiAIChat.chatState.connections.get(multiAIChat.chatState.activeAssistant)?.connected
                ? '🟢 已连接' : '🔴 未连接'}
            </span>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="assistant-main-content">
        {/* 上半部分：节点流程图 */}
        <div className="node-flow-section">
          <NodeFlowChart
            currentNode={nodeFlow.flowState.currentNode}
            previousNodes={nodeFlow.flowState.previousNodes}
            nextNodes={nodeFlow.flowState.nextNodes}
            configuredSkills={nodeFlow.flowState.configuredSkills}
            onNodeNavigate={handleNodeNavigate}
            className="main-flow-chart"
          />
        </div>

        {/* 下半部分：AI聊天区域 */}
        <div className="ai-chat-section">
          {/* 左侧：AI助手面板 */}
          <div className="assistant-panel-wrapper">
            <AIAssistantPanel
              activeAssistant={multiAIChat.chatState.activeAssistant}
              connections={multiAIChat.chatState.connections}
              assistants={multiAIChat.getAllAssistants()}
              onSwitchAssistant={multiAIChat.switchAssistant}
              onConnectAll={multiAIChat.connectAll}
              onDisconnectAll={multiAIChat.disconnectAll}
              className="main-assistant-panel"
            />
          </div>

          {/* 右侧：聊天窗口 */}
          <div className="chat-window-wrapper">
            <ChatWindow
              messages={
                multiAIChat.chatState.messages.get(multiAIChat.chatState.activeAssistant) || []
              }
              onSendMessage={multiAIChat.sendMessage}
              workflowContext={nodeFlow.flowState.currentNode}
              activeAssistant={multiAIChat.chatState.activeAssistant}
              isConnected={
                multiAIChat.chatState.connections.get(multiAIChat.chatState.activeAssistant)?.connected || false
              }
              isProcessing={multiAIChat.chatState.isProcessing}
              onExecuteSkill={handleExecuteSkill}
              onClearHistory={() => multiAIChat.clearHistory(multiAIChat.chatState.activeAssistant)}
              className="main-chat-window"
            />
          </div>
        </div>
      </div>

      {/* 底部工具栏 */}
      <div className="assistant-footer">
        <div className="footer-actions">
          <button
            className="footer-btn refresh"
            onClick={() => nodeFlow.refreshFlow()}
            disabled={nodeFlow.flowState.isLoading}
            title="刷新工作流数据"
          >
            🔄 刷新
          </button>

          <button
            className="footer-btn broadcast"
            onClick={() => {
              const message = "广播消息测试：当前工作流状态已更新";
              multiAIChat.broadcastMessage(message);
            }}
            disabled={multiAIChat.chatState.isProcessing}
            title="向所有助手广播消息"
          >
            📢 广播
          </button>

          <button
            className="footer-btn execute-skills"
            onClick={() => {
              nodeFlow.flowState.configuredSkills.forEach(config => {
                handleExecuteSkill(config.skill);
              });
            }}
            disabled={
              multiAIChat.chatState.isProcessing ||
              nodeFlow.flowState.configuredSkills.length === 0
            }
            title="执行当前节点的所有配置技能"
          >
            ⚡ 批量执行技能
          </button>
        </div>

        <div className="footer-info">
          <span className="info-text">
            最后更新: {new Date(nodeFlow.flowState.lastUpdated).toLocaleTimeString()}
          </span>
          <span className="version-text">
            聊天助手 v1.0 | 在线节点: {nodeFlow.flowState.configuredSkills.length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;