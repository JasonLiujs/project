// WebSocket客户端服务

import {
  ChatMessage,
  WebSocketMessage,
  ConnectionStatus,
  AIAssistantType,
  WorkflowContext
} from '../types/multiAIChat';

/**
 * WebSocket客户端类
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private endpoint: string = '';
  private assistantType: AIAssistantType;
  private messageQueue: WebSocketMessage[] = [];
  private connectionStatus: ConnectionStatus = {
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0
  };
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // 事件回调
  private messageCallbacks: Array<(message: ChatMessage) => void> = [];
  private statusCallbacks: Array<(status: ConnectionStatus) => void> = [];

  // 配置
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectInterval = 5000; // 5秒
  private readonly heartbeatInterval_ms = 30000; // 30秒心跳
  private readonly messageTimeout = 10000; // 10秒消息超时

  constructor(assistantType: AIAssistantType) {
    this.assistantType = assistantType;
  }

  /**
   * 连接到WebSocket端点
   */
  async connect(endpoint: string): Promise<void> {
    if (this.connectionStatus.connecting) {
      throw new Error('Connection already in progress');
    }

    this.endpoint = endpoint;
    this.updateConnectionStatus({
      ...this.connectionStatus,
      connecting: true,
      error: null
    });

    try {
      await this.establishConnection();
    } catch (error) {
      this.updateConnectionStatus({
        ...this.connectionStatus,
        connecting: false,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 建立WebSocket连接
   */
  private async establishConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.endpoint);

        this.ws.onopen = () => {
          console.log(`[WebSocket] Connected to ${this.assistantType}`);
          this.updateConnectionStatus({
            connected: true,
            connecting: false,
            error: null,
            reconnectAttempts: 0,
            lastConnectedTime: Date.now()
          });

          this.startHeartbeat();
          this.processMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const wsMessage: WebSocketMessage = JSON.parse(event.data);
            this.handleIncomingMessage(wsMessage);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
            this.notifyError('Failed to parse incoming message');
          }
        };

        this.ws.onerror = (event) => {
          console.error(`[WebSocket] Connection error for ${this.assistantType}:`, event);
          this.notifyError('WebSocket connection error');
        };

        this.ws.onclose = (event) => {
          console.log(`[WebSocket] Connection closed for ${this.assistantType}:`, event.code, event.reason);
          this.handleConnectionClose(event);

          if (!this.connectionStatus.connecting) {
            // 只有在非主动断开时才设置为断开状态
            this.updateConnectionStatus({
              connected: false,
              connecting: false,
              error: event.reason || 'Connection closed',
              reconnectAttempts: this.connectionStatus.reconnectAttempts
            });
          }
        };

        // 连接超时处理
        setTimeout(() => {
          if (this.connectionStatus.connecting) {
            reject(new Error('Connection timeout'));
            this.disconnect();
          }
        }, 10000); // 10秒超时

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    this.updateConnectionStatus({
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0
    });
  }

  /**
   * 发送聊天消息
   */
  async sendMessage(message: ChatMessage): Promise<void> {
    const wsMessage: WebSocketMessage = {
      type: 'chat',
      action: 'send_message',
      data: message,
      timestamp: Date.now(),
      requestId: this.generateRequestId()
    };

    await this.sendWebSocketMessage(wsMessage);
  }

  /**
   * 发送工作流上下文
   */
  async sendWorkflowContext(context: WorkflowContext): Promise<void> {
    const wsMessage: WebSocketMessage = {
      type: 'workflow',
      action: 'update_context',
      data: context,
      timestamp: Date.now(),
      requestId: this.generateRequestId()
    };

    await this.sendWebSocketMessage(wsMessage);
  }

  /**
   * 触发技能执行
   */
  async triggerSkillExecution(skillName: string, context: WorkflowContext): Promise<void> {
    const wsMessage: WebSocketMessage = {
      type: 'skill',
      action: 'execute',
      data: {
        skillName,
        context,
        assistantType: this.assistantType
      },
      timestamp: Date.now(),
      requestId: this.generateRequestId()
    };

    await this.sendWebSocketMessage(wsMessage);
  }

  /**
   * 发送WebSocket消息
   */
  private async sendWebSocketMessage(message: WebSocketMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // 将消息加入队列
      this.messageQueue.push(message);

      if (!this.connectionStatus.connected && !this.connectionStatus.connecting) {
        // 尝试重连
        this.attemptReconnect();
      }
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error);
      this.messageQueue.push(message); // 发送失败，加入重试队列
      throw new Error('Failed to send message');
    }
  }

  /**
   * 处理传入消息
   */
  private handleIncomingMessage(wsMessage: WebSocketMessage): void {
    switch (wsMessage.type) {
      case 'chat':
        if (wsMessage.action === 'message_received') {
          const chatMessage: ChatMessage = {
            ...wsMessage.data,
            assistant: this.assistantType
          };
          this.notifyMessage(chatMessage);
        }
        break;

      case 'skill':
        if (wsMessage.action === 'execution_update') {
          const skillMessage: ChatMessage = {
            id: this.generateMessageId(),
            type: 'skill_trigger',
            content: this.formatSkillExecutionMessage(wsMessage.data),
            timestamp: Date.now(),
            assistant: this.assistantType,
            skillExecution: wsMessage.data
          };
          this.notifyMessage(skillMessage);
        }
        break;

      case 'control':
        if (wsMessage.action === 'ping') {
          this.sendPong();
        }
        break;

      default:
        console.warn('[WebSocket] Unknown message type:', wsMessage.type);
    }
  }

  /**
   * 处理连接关闭
   */
  private handleConnectionClose(event: CloseEvent): void {
    this.stopHeartbeat();

    // 检查是否需要重连
    if (event.code !== 1000 && // 不是正常关闭
        this.connectionStatus.reconnectAttempts < this.maxReconnectAttempts) {
      this.attemptReconnect();
    }
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (this.connectionStatus.connecting ||
        this.connectionStatus.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const attempt = this.connectionStatus.reconnectAttempts + 1;
    const delay = this.reconnectInterval * attempt; // 递增延迟

    console.log(`[WebSocket] Attempting to reconnect ${this.assistantType} (attempt ${attempt}/${this.maxReconnectAttempts}) in ${delay}ms`);

    this.updateConnectionStatus({
      ...this.connectionStatus,
      reconnectAttempts: attempt
    });

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect(this.endpoint);
      } catch (error) {
        console.error(`[WebSocket] Reconnection attempt ${attempt} failed:`, error);

        if (attempt < this.maxReconnectAttempts) {
          this.attemptReconnect();
        } else {
          console.error(`[WebSocket] Max reconnection attempts reached for ${this.assistantType}`);
          this.notifyError('Maximum reconnection attempts exceeded');
        }
      }
    }, delay);
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendPing();
      }
    }, this.heartbeatInterval_ms);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 发送ping消息
   */
  private sendPing(): void {
    const pingMessage: WebSocketMessage = {
      type: 'control',
      action: 'ping',
      data: {},
      timestamp: Date.now()
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(pingMessage));
    }
  }

  /**
   * 发送pong响应
   */
  private sendPong(): void {
    const pongMessage: WebSocketMessage = {
      type: 'control',
      action: 'pong',
      data: {},
      timestamp: Date.now()
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(pongMessage));
    }
  }

  /**
   * 处理消息队列
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 &&
           this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()!;
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[WebSocket] Failed to send queued message:', error);
        this.messageQueue.unshift(message); // 重新加入队列头部
        break;
      }
    }
  }

  /**
   * 格式化技能执行消息
   */
  private formatSkillExecutionMessage(skillExecution: any): string {
    const { skillName, status, progress, result, error } = skillExecution;

    switch (status) {
      case 'pending':
        return `🔄 技能 "${skillName}" 等待执行...`;
      case 'running':
        return `⚡ 技能 "${skillName}" 执行中... ${progress ? `(${Math.round(progress * 100)}%)` : ''}`;
      case 'completed':
        return `✅ 技能 "${skillName}" 执行完成\n\n${result || ''}`;
      case 'failed':
        return `❌ 技能 "${skillName}" 执行失败: ${error || '未知错误'}`;
      case 'cancelled':
        return `⏹️ 技能 "${skillName}" 执行已取消`;
      default:
        return `📋 技能 "${skillName}" 状态: ${status}`;
    }
  }

  /**
   * 工具方法
   */
  private generateRequestId(): string {
    return `${this.assistantType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('[WebSocket] Error in status callback:', error);
      }
    });
  }

  private notifyMessage(message: ChatMessage): void {
    this.messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('[WebSocket] Error in message callback:', error);
      }
    });
  }

  private notifyError(error: string): void {
    const errorMessage: ChatMessage = {
      id: this.generateMessageId(),
      type: 'error',
      content: `🚫 ${this.assistantType} 连接错误: ${error}`,
      timestamp: Date.now(),
      assistant: this.assistantType
    };
    this.notifyMessage(errorMessage);
  }

  /**
   * 事件监听器注册
   */
  onMessage(callback: (message: ChatMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void): void {
    this.statusCallbacks.push(callback);
  }

  /**
   * 移除事件监听器
   */
  removeMessageListener(callback: (message: ChatMessage) => void): void {
    const index = this.messageCallbacks.indexOf(callback);
    if (index > -1) {
      this.messageCallbacks.splice(index, 1);
    }
  }

  removeStatusListener(callback: (status: ConnectionStatus) => void): void {
    const index = this.statusCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusCallbacks.splice(index, 1);
    }
  }

  /**
   * 获取当前连接状态
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.disconnect();
    this.messageCallbacks.length = 0;
    this.statusCallbacks.length = 0;
    this.messageQueue.length = 0;
  }
}