// 多AI聊天Hook

import { useState, useEffect, useCallback, useRef } from 'react';
import { AIAssistantManager } from '../services/aiAssistantManager';
import {
  MultiAIChatState,
  AIAssistantType,
  ChatMessage,
  ConnectionStatus,
  WorkflowContext
} from '../types/multiAIChat';

/**
 * 多AI聊天Hook
 * 管理与多个AI助手的连接和消息交换
 */
export function useMultiAIChat() {
  const [chatState, setChatState] = useState<MultiAIChatState>({
    messages: new Map(),
    activeAssistant: AIAssistantType.CLAUDE_CODE,
    connections: new Map(),
    isProcessing: false,
    typingIndicator: new Map()
  });

  const assistantManager = useRef<AIAssistantManager>(new AIAssistantManager());
  const messageHistoryRef = useRef<Map<AIAssistantType, ChatMessage[]>>(new Map());
  const isInitialized = useRef(false);

  /**
   * 初始化AI助手连接
   */
  const initializeConnections = useCallback(async (): Promise<void> => {
    if (isInitialized.current) {
      return;
    }

    try {
      setChatState(prev => ({ ...prev, isProcessing: true }));

      // 设置事件监听器
      assistantManager.current.onMessage((type, message) => {
        handleIncomingMessage(type, message);
      });

      assistantManager.current.onStatusChange((type, status) => {
        handleConnectionStatusChange(type, status);
      });

      assistantManager.current.onAssistantChange((type) => {
        setChatState(prev => ({ ...prev, activeAssistant: type }));
      });

      // 初始化消息历史
      assistantManager.current.getAllAssistants().forEach(assistant => {
        messageHistoryRef.current.set(assistant.type, []);
      });

      // 连接所有助手
      await assistantManager.current.connectAll();

      isInitialized.current = true;

      setChatState(prev => ({
        ...prev,
        messages: new Map(messageHistoryRef.current),
        connections: assistantManager.current.getConnectionStatus(),
        isProcessing: false
      }));

      console.log('[useMultiAIChat] Initialized successfully');

    } catch (error) {
      console.error('[useMultiAIChat] Initialization failed:', error);
      setChatState(prev => ({ ...prev, isProcessing: false }));
    }
  }, []);

  /**
   * 处理收到的消息
   */
  const handleIncomingMessage = useCallback((type: AIAssistantType, message: ChatMessage): void => {
    // 更新消息历史
    const currentHistory = messageHistoryRef.current.get(type) || [];
    const updatedHistory = [...currentHistory, message];
    messageHistoryRef.current.set(type, updatedHistory);

    // 更新状态
    setChatState(prev => ({
      ...prev,
      messages: new Map(messageHistoryRef.current),
      typingIndicator: new Map(prev.typingIndicator).set(type, false)
    }));

    console.log(`[useMultiAIChat] Received message from ${type}:`, message.content.substring(0, 50));
  }, []);

  /**
   * 处理连接状态变化
   */
  const handleConnectionStatusChange = useCallback((type: AIAssistantType, status: ConnectionStatus): void => {
    setChatState(prev => {
      const newConnections = new Map(prev.connections);
      newConnections.set(type, status);

      return {
        ...prev,
        connections: newConnections
      };
    });

    console.log(`[useMultiAIChat] Connection status changed for ${type}:`, status);
  }, []);

  /**
   * 发送消息到活跃助手
   */
  const sendMessage = useCallback(async (
    content: string,
    target?: AIAssistantType,
    attachments?: any[]
  ): Promise<void> => {
    const targetAssistant = target || chatState.activeAssistant;

    try {
      setChatState(prev => ({ ...prev, isProcessing: true }));

      // 创建用户消息
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'user',
        content,
        timestamp: Date.now(),
        assistant: targetAssistant,
        attachments
      };

      // 添加到本地历史
      const currentHistory = messageHistoryRef.current.get(targetAssistant) || [];
      const updatedHistory = [...currentHistory, userMessage];
      messageHistoryRef.current.set(targetAssistant, updatedHistory);

      // 更新UI状态
      setChatState(prev => ({
        ...prev,
        messages: new Map(messageHistoryRef.current),
        typingIndicator: new Map(prev.typingIndicator).set(targetAssistant, true)
      }));

      // 发送消息
      if (target) {
        await assistantManager.current.sendMessage(target, userMessage);
      } else {
        await assistantManager.current.sendToActiveAssistant(content, attachments);
      }

    } catch (error) {
      console.error('[useMultiAIChat] Failed to send message:', error);

      // 添加错误消息
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'error',
        content: `📛 发送失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        assistant: targetAssistant
      };

      const currentHistory = messageHistoryRef.current.get(targetAssistant) || [];
      messageHistoryRef.current.set(targetAssistant, [...currentHistory, errorMessage]);

      setChatState(prev => ({
        ...prev,
        messages: new Map(messageHistoryRef.current)
      }));
    } finally {
      setChatState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [chatState.activeAssistant]);

  /**
   * 切换活跃助手
   */
  const switchAssistant = useCallback(async (type: AIAssistantType): Promise<void> => {
    try {
      setChatState(prev => ({ ...prev, isProcessing: true }));
      await assistantManager.current.switchAssistant(type);
      console.log(`[useMultiAIChat] Switched to ${type}`);
    } catch (error) {
      console.error('[useMultiAIChat] Failed to switch assistant:', error);

      // 添加切换失败的系统消息
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'system',
        content: `🔄 切换到 ${type} 失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        assistant: chatState.activeAssistant
      };

      const currentHistory = messageHistoryRef.current.get(chatState.activeAssistant) || [];
      messageHistoryRef.current.set(chatState.activeAssistant, [...currentHistory, errorMessage]);
    } finally {
      setChatState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [chatState.activeAssistant]);

  /**
   * 连接所有助手
   */
  const connectAll = useCallback(async (): Promise<void> => {
    try {
      setChatState(prev => ({ ...prev, isProcessing: true }));
      await assistantManager.current.connectAll();

      setChatState(prev => ({
        ...prev,
        connections: assistantManager.current.getConnectionStatus(),
        isProcessing: false
      }));
    } catch (error) {
      console.error('[useMultiAIChat] Failed to connect all:', error);
      setChatState(prev => ({ ...prev, isProcessing: false }));
    }
  }, []);

  /**
   * 断开所有连接
   */
  const disconnectAll = useCallback((): void => {
    assistantManager.current.disconnectAll();
    setChatState(prev => ({
      ...prev,
      connections: new Map(),
      isProcessing: false,
      typingIndicator: new Map()
    }));
  }, []);

  /**
   * 广播消息给所有助手
   */
  const broadcastMessage = useCallback(async (content: string): Promise<void> => {
    try {
      setChatState(prev => ({ ...prev, isProcessing: true }));

      const results = await assistantManager.current.broadcastMessage(content);

      // 为每个助手创建广播消息记录
      const broadcastTime = Date.now();
      results.forEach((success, assistantType) => {
        const message: ChatMessage = {
          id: generateMessageId(),
          type: 'user',
          content: `📢 [广播] ${content}`,
          timestamp: broadcastTime,
          assistant: assistantType
        };

        const currentHistory = messageHistoryRef.current.get(assistantType) || [];
        messageHistoryRef.current.set(assistantType, [...currentHistory, message]);

        if (!success) {
          const errorMessage: ChatMessage = {
            id: generateMessageId(),
            type: 'error',
            content: '📛 广播发送失败',
            timestamp: broadcastTime + 1,
            assistant: assistantType
          };
          messageHistoryRef.current.set(assistantType, [...messageHistoryRef.current.get(assistantType)!, errorMessage]);
        }
      });

      setChatState(prev => ({
        ...prev,
        messages: new Map(messageHistoryRef.current)
      }));

    } catch (error) {
      console.error('[useMultiAIChat] Failed to broadcast message:', error);
    } finally {
      setChatState(prev => ({ ...prev, isProcessing: false }));
    }
  }, []);

  /**
   * 更新工作流上下文
   */
  const updateWorkflowContext = useCallback(async (context: WorkflowContext): Promise<void> => {
    try {
      await assistantManager.current.updateWorkflowContext(context);

      // 添加上下文更新的系统消息
      const contextMessage = `🔄 工作流上下文已更新: ${context.nodeName} (${context.nodeStatus})`;

      assistantManager.current.getAllAssistants().forEach(assistant => {
        const systemMessage: ChatMessage = {
          id: generateMessageId(),
          type: 'system',
          content: contextMessage,
          timestamp: Date.now(),
          assistant: assistant.type,
          workflowContext: context
        };

        const currentHistory = messageHistoryRef.current.get(assistant.type) || [];
        messageHistoryRef.current.set(assistant.type, [...currentHistory, systemMessage]);
      });

      setChatState(prev => ({
        ...prev,
        messages: new Map(messageHistoryRef.current)
      }));

    } catch (error) {
      console.error('[useMultiAIChat] Failed to update workflow context:', error);
    }
  }, []);

  /**
   * 执行技能
   */
  const executeSkill = useCallback(async (
    skillName: string,
    targetAssistant?: AIAssistantType
  ): Promise<void> => {
    try {
      setChatState(prev => ({ ...prev, isProcessing: true }));
      await assistantManager.current.executeSkill(skillName, targetAssistant);
    } catch (error) {
      console.error('[useMultiAIChat] Failed to execute skill:', error);

      const assistant = targetAssistant || chatState.activeAssistant;
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'error',
        content: `❌ 技能执行失败: ${skillName} - ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        assistant: assistant
      };

      const currentHistory = messageHistoryRef.current.get(assistant) || [];
      messageHistoryRef.current.set(assistant, [...currentHistory, errorMessage]);

      setChatState(prev => ({
        ...prev,
        messages: new Map(messageHistoryRef.current)
      }));
    } finally {
      setChatState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [chatState.activeAssistant]);

  /**
   * 清理历史记录
   */
  const clearHistory = useCallback((assistantType?: AIAssistantType): void => {
    if (assistantType) {
      messageHistoryRef.current.set(assistantType, []);
    } else {
      messageHistoryRef.current.clear();
      assistantManager.current.getAllAssistants().forEach(assistant => {
        messageHistoryRef.current.set(assistant.type, []);
      });
    }

    setChatState(prev => ({
      ...prev,
      messages: new Map(messageHistoryRef.current)
    }));
  }, []);

  /**
   * 获取助手信息
   */
  const getAssistantInfo = useCallback((type: AIAssistantType) => {
    return assistantManager.current.getAssistant(type);
  }, []);

  /**
   * 获取所有助手信息
   */
  const getAllAssistants = useCallback(() => {
    return assistantManager.current.getAllAssistants();
  }, []);

  /**
   * 工具函数
   */
  const generateMessageId = (): string => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // 初始化连接
  useEffect(() => {
    initializeConnections();

    return () => {
      if (isInitialized.current) {
        assistantManager.current.destroy();
        isInitialized.current = false;
      }
    };
  }, [initializeConnections]);

  return {
    chatState,
    sendMessage,
    switchAssistant,
    connectAll,
    disconnectAll,
    broadcastMessage,
    updateWorkflowContext,
    executeSkill,
    clearHistory,
    getAssistantInfo,
    getAllAssistants
  };
}