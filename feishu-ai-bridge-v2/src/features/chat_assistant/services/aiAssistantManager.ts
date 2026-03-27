// AI助手管理器服务

import { WebSocketClient } from './webSocketClient';
import {
  AIAssistant,
  AIAssistantType,
  ChatMessage,
  ConnectionStatus,
  WorkflowContext,
  SkillExecution
} from '../types/multiAIChat';

/**
 * AI助手配置
 */
const AI_ASSISTANTS: Record<AIAssistantType, AIAssistant> = {
  [AIAssistantType.CLAUDE_CODE]: {
    type: AIAssistantType.CLAUDE_CODE,
    name: 'claude_code',
    displayName: 'Claude Code',
    wsEndpoint: 'ws://localhost:4001/claude-code',
    capabilities: ['code_analysis', 'debugging', 'engineering_review', 'documentation'],
    supportedSkills: [
      'plan-eng-review',
      'investigate',
      'review',
      'qa',
      'design-review'
    ],
    icon: '🧠',
    description: '专业的代码分析和工程审查助手'
  },
  [AIAssistantType.OPENCODE]: {
    type: AIAssistantType.OPENCODE,
    name: 'opencode',
    displayName: 'OpenCode',
    wsEndpoint: 'ws://localhost:4002/opencode',
    capabilities: ['code_generation', 'optimization', 'testing', 'deployment'],
    supportedSkills: [
      'codex',
      'qa-only',
      'ship',
      'land-and-deploy'
    ],
    icon: '🚀',
    description: '开源代码生成和部署优化助手'
  },
  [AIAssistantType.CODEX]: {
    type: AIAssistantType.CODEX,
    name: 'codex',
    displayName: 'CodeX',
    wsEndpoint: 'ws://localhost:4003/codex',
    capabilities: ['architecture_design', 'performance_analysis', 'security_audit'],
    supportedSkills: [
      'plan-ceo-review',
      'plan-design-review',
      'office-hours'
    ],
    icon: '💻',
    description: '架构设计和性能优化专家'
  }
};

/**
 * AI助手管理器类
 */
export class AIAssistantManager {
  private assistants: Map<AIAssistantType, AIAssistant> = new Map();
  private connections: Map<AIAssistantType, WebSocketClient> = new Map();
  private messageHistory: Map<AIAssistantType, ChatMessage[]> = new Map();
  private activeAssistant: AIAssistantType = AIAssistantType.CLAUDE_CODE;
  private workflowContext: WorkflowContext | null = null;

  // 事件回调
  private messageCallbacks: Array<(type: AIAssistantType, message: ChatMessage) => void> = [];
  private statusCallbacks: Array<(type: AIAssistantType, status: ConnectionStatus) => void> = [];
  private assistantChangeCallbacks: Array<(type: AIAssistantType) => void> = [];

  constructor() {
    this.initializeAssistants();
  }

  /**
   * 初始化AI助手
   */
  private initializeAssistants(): void {
    Object.values(AI_ASSISTANTS).forEach(assistant => {
      this.assistants.set(assistant.type, assistant);
      this.messageHistory.set(assistant.type, []);
    });
  }

  /**
   * 连接到所有AI助手
   */
  async connectAll(): Promise<void> {
    const connectionPromises = Array.from(this.assistants.values()).map(
      assistant => this.connectAssistant(assistant.type)
    );

    // 并发连接，但不要求全部成功
    const results = await Promise.allSettled(connectionPromises);

    const failedConnections = results
      .map((result, index) => ({
        result,
        assistant: Array.from(this.assistants.keys())[index]
      }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ assistant, result }) => ({
        assistant,
        error: result.status === 'rejected' ? result.reason : null
      }));

    if (failedConnections.length > 0) {
      console.warn('[AIAssistantManager] Some connections failed:', failedConnections);
    }

    console.log('[AIAssistantManager] Connected assistants:',
      Array.from(this.connections.keys()));
  }

  /**
   * 连接到特定AI助手
   */
  async connectAssistant(type: AIAssistantType): Promise<void> {
    const assistant = this.assistants.get(type);
    if (!assistant) {
      throw new Error(`Unknown assistant type: ${type}`);
    }

    // 如果已经连接，先断开
    if (this.connections.has(type)) {
      this.disconnectAssistant(type);
    }

    const client = new WebSocketClient(type);

    // 设置事件监听器
    client.onMessage((message) => {
      this.handleMessage(type, message);
    });

    client.onConnectionChange((status) => {
      this.handleStatusChange(type, status);
    });

    try {
      await client.connect(assistant.wsEndpoint);
      this.connections.set(type, client);

      // 如果有工作流上下文，发送给新连接的助手
      if (this.workflowContext) {
        await client.sendWorkflowContext(this.workflowContext);
      }

      console.log(`[AIAssistantManager] Connected to ${assistant.displayName}`);
    } catch (error) {
      console.error(`[AIAssistantManager] Failed to connect to ${assistant.displayName}:`, error);
      throw error;
    }
  }

  /**
   * 断开特定AI助手连接
   */
  disconnectAssistant(type: AIAssistantType): void {
    const client = this.connections.get(type);
    if (client) {
      client.destroy();
      this.connections.delete(type);
    }
  }

  /**
   * 断开所有连接
   */
  disconnectAll(): void {
    this.connections.forEach((client, type) => {
      this.disconnectAssistant(type);
    });
  }

  /**
   * 切换活跃助手
   */
  async switchAssistant(type: AIAssistantType): Promise<void> {
    if (!this.assistants.has(type)) {
      throw new Error(`Unknown assistant type: ${type}`);
    }

    const previousActive = this.activeAssistant;
    this.activeAssistant = type;

    // 确保目标助手已连接
    if (!this.connections.has(type)) {
      try {
        await this.connectAssistant(type);
      } catch (error) {
        // 连接失败，回退到之前的助手
        this.activeAssistant = previousActive;
        throw new Error(`Failed to switch to ${type}: ${error}`);
      }
    }

    // 通知监听器
    this.assistantChangeCallbacks.forEach(callback => {
      try {
        callback(type);
      } catch (error) {
        console.error('[AIAssistantManager] Error in assistant change callback:', error);
      }
    });

    console.log(`[AIAssistantManager] Switched to ${this.assistants.get(type)?.displayName}`);
  }

  /**
   * 发送消息到活跃助手
   */
  async sendToActiveAssistant(content: string, attachments?: any[]): Promise<void> {
    const message: ChatMessage = {
      id: this.generateMessageId(),
      type: 'user',
      content,
      timestamp: Date.now(),
      assistant: this.activeAssistant,
      workflowContext: this.workflowContext || undefined,
      attachments
    };

    await this.sendMessage(this.activeAssistant, message);
  }

  /**
   * 发送消息到指定助手
   */
  async sendMessage(type: AIAssistantType, message: ChatMessage): Promise<void> {
    const client = this.connections.get(type);
    if (!client) {
      throw new Error(`Assistant ${type} is not connected`);
    }

    // 添加到消息历史
    this.addMessageToHistory(type, message);

    try {
      await client.sendMessage(message);
    } catch (error) {
      console.error(`[AIAssistantManager] Failed to send message to ${type}:`, error);
      throw error;
    }
  }

  /**
   * 广播消息到所有助手
   */
  async broadcastMessage(content: string): Promise<Map<AIAssistantType, boolean>> {
    const results = new Map<AIAssistantType, boolean>();

    const broadcastPromises = Array.from(this.connections.keys()).map(async (type) => {
      try {
        const message: ChatMessage = {
          id: this.generateMessageId(),
          type: 'user',
          content,
          timestamp: Date.now(),
          assistant: type,
          workflowContext: this.workflowContext || undefined
        };

        await this.sendMessage(type, message);
        results.set(type, true);
      } catch (error) {
        console.error(`[AIAssistantManager] Failed to broadcast to ${type}:`, error);
        results.set(type, false);
      }
    });

    await Promise.allSettled(broadcastPromises);
    return results;
  }

  /**
   * 触发技能执行
   */
  async executeSkill(skillName: string, targetAssistant?: AIAssistantType): Promise<void> {
    if (!this.workflowContext) {
      throw new Error('No workflow context available for skill execution');
    }

    // 确定目标助手
    const assistant = targetAssistant || this.determineSkillAssistant(skillName);
    const client = this.connections.get(assistant);

    if (!client) {
      throw new Error(`Assistant ${assistant} is not connected`);
    }

    try {
      await client.triggerSkillExecution(skillName, this.workflowContext);

      // 添加系统消息
      const skillMessage: ChatMessage = {
        id: this.generateMessageId(),
        type: 'system',
        content: `🔧 开始执行技能: ${skillName}`,
        timestamp: Date.now(),
        assistant: assistant,
        skillExecution: {
          id: this.generateExecutionId(),
          skillName,
          status: 'pending',
          startTime: Date.now()
        }
      };

      this.addMessageToHistory(assistant, skillMessage);
      this.notifyMessage(assistant, skillMessage);

    } catch (error) {
      console.error(`[AIAssistantManager] Failed to execute skill ${skillName}:`, error);
      throw error;
    }
  }

  /**
   * 更新工作流上下文
   */
  async updateWorkflowContext(context: WorkflowContext): Promise<void> {
    this.workflowContext = context;

    // 发送上下文到所有连接的助手
    const updatePromises = Array.from(this.connections.entries()).map(
      async ([type, client]) => {
        try {
          await client.sendWorkflowContext(context);
        } catch (error) {
          console.error(`[AIAssistantManager] Failed to update context for ${type}:`, error);
        }
      }
    );

    await Promise.allSettled(updatePromises);
  }

  /**
   * 根据技能确定目标助手
   */
  private determineSkillAssistant(skillName: string): AIAssistantType {
    for (const [type, assistant] of this.assistants) {
      if (assistant.supportedSkills.includes(skillName)) {
        return type;
      }
    }

    // 默认返回Claude Code
    return AIAssistantType.CLAUDE_CODE;
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(type: AIAssistantType, message: ChatMessage): void {
    this.addMessageToHistory(type, message);
    this.notifyMessage(type, message);
  }

  /**
   * 处理连接状态变化
   */
  private handleStatusChange(type: AIAssistantType, status: ConnectionStatus): void {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(type, status);
      } catch (error) {
        console.error('[AIAssistantManager] Error in status callback:', error);
      }
    });
  }

  /**
   * 添加消息到历史
   */
  private addMessageToHistory(type: AIAssistantType, message: ChatMessage): void {
    const history = this.messageHistory.get(type) || [];
    history.push(message);

    // 限制历史消息数量
    const maxHistory = 100;
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }

    this.messageHistory.set(type, history);
  }

  /**
   * 通知消息监听器
   */
  private notifyMessage(type: AIAssistantType, message: ChatMessage): void {
    this.messageCallbacks.forEach(callback => {
      try {
        callback(type, message);
      } catch (error) {
        console.error('[AIAssistantManager] Error in message callback:', error);
      }
    });
  }

  /**
   * 工具方法
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 事件监听器
   */
  onMessage(callback: (type: AIAssistantType, message: ChatMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  onStatusChange(callback: (type: AIAssistantType, status: ConnectionStatus) => void): void {
    this.statusCallbacks.push(callback);
  }

  onAssistantChange(callback: (type: AIAssistantType) => void): void {
    this.assistantChangeCallbacks.push(callback);
  }

  /**
   * 获取器方法
   */
  getAssistant(type: AIAssistantType): AIAssistant | undefined {
    return this.assistants.get(type);
  }

  getAllAssistants(): AIAssistant[] {
    return Array.from(this.assistants.values());
  }

  getActiveAssistant(): AIAssistantType {
    return this.activeAssistant;
  }

  getMessageHistory(type: AIAssistantType): ChatMessage[] {
    return this.messageHistory.get(type) || [];
  }

  getConnectionStatus(): Map<AIAssistantType, ConnectionStatus> {
    const statusMap = new Map<AIAssistantType, ConnectionStatus>();

    this.connections.forEach((client, type) => {
      statusMap.set(type, client.getConnectionStatus());
    });

    return statusMap;
  }

  getWorkflowContext(): WorkflowContext | null {
    return this.workflowContext;
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.disconnectAll();
    this.messageCallbacks.length = 0;
    this.statusCallbacks.length = 0;
    this.assistantChangeCallbacks.length = 0;
    this.messageHistory.clear();
  }
}