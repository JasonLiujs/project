// Claude Code本地连接客户端

import { ChatMessage, AIAssistantType } from '../types/multiAIChat';

/**
 * Claude Code本地连接配置
 */
export interface ClaudeCodeConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  apiPath: string;
}

/**
 * 默认的Claude Code本地配置
 */
export const DEFAULT_CLAUDE_CODE_CONFIG: ClaudeCodeConfig = {
  host: 'localhost',
  port: 3001,  // 桥接服务器端口
  protocol: 'http',
  apiPath: '/api/chat'  // API端点路径
};

/**
 * Claude Code API消息格式
 */
export interface ClaudeCodeRequest {
  message: string;
  context?: {
    nodeId?: string;
    workflowContext?: any;
    skills?: string[];
  };
  stream?: boolean;
}

export interface ClaudeCodeResponse {
  response: string;
  status: 'success' | 'error';
  error?: string;
  metadata?: {
    skillExecution?: {
      skillName: string;
      status: string;
      result?: string;
    };
  };
}

/**
 * Claude Code本地连接客户端
 */
export class ClaudeCodeClient {
  private config: ClaudeCodeConfig;
  private abortController: AbortController | null = null;

  constructor(config: Partial<ClaudeCodeConfig> = {}) {
    this.config = { ...DEFAULT_CLAUDE_CODE_CONFIG, ...config };
  }

  /**
   * 检测Claude Code是否在运行
   */
  async isRunning(): Promise<boolean> {
    try {
      // 尝试多个可能的健康检查端点
      const possibleEndpoints = [
        '/health',
        '/api/health',
        '/status',
        '/',  // 根路径作为最后的尝试
      ];

      for (const endpoint of possibleEndpoints) {
        try {
          const url = `${this.config.protocol}://${this.config.host}:${this.config.port}${endpoint}`;
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(3000)
          });

          if (response.ok) {
            console.log(`[ClaudeCode] Health check succeeded on ${endpoint}`);
            return true;
          }
        } catch (endpointError) {
          // 继续尝试下一个端点
          console.log(`[ClaudeCode] Health check failed on ${endpoint}:`, endpointError);
        }
      }

      return false;
    } catch (error) {
      console.log('[ClaudeCode] Health check failed:', error);
      return false;
    }
  }

  /**
   * 发送消息到Claude Code
   */
  async sendMessage(message: string, context?: any): Promise<string> {
    // 尝试不同的API端点路径
    const possibleApiPaths = [
      '/api/chat',
      '/api/v1/chat',
      '/chat',
      '/api/message',
      '/message'
    ];

    this.abortController = new AbortController();

    const request: ClaudeCodeRequest = {
      message,
      context,
      stream: false
    };

    // 尝试简化的请求格式以兼容不同的Claude Code版本
    const simpleRequest = {
      message: message,
      ...context
    };

    for (const apiPath of possibleApiPaths) {
      try {
        const url = `${this.config.protocol}://${this.config.host}:${this.config.port}${apiPath}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(simpleRequest),
          signal: this.abortController.signal
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');

          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            console.log(`[ClaudeCode] API call succeeded on ${apiPath}`);

            // 处理不同的响应格式
            if (typeof data === 'string') {
              return data;
            } else if (data.response) {
              return data.response;
            } else if (data.content) {
              return data.content;
            } else if (data.message) {
              return data.message;
            } else {
              return JSON.stringify(data);
            }
          } else {
            // 处理纯文本响应
            const textData = await response.text();
            console.log(`[ClaudeCode] Text response from ${apiPath}`);
            return textData;
          }
        }

      } catch (error) {
        console.log(`[ClaudeCode] API call failed on ${apiPath}:`, error);
        // 继续尝试下一个端点
      }
    }

    // 如果所有端点都失败，抛出错误
    throw new Error(`无法连接到Claude Code。已尝试的API端点: ${possibleApiPaths.join(', ')}`);
  }

  /**
   * 发送流式消息到Claude Code (for real-time responses)
   */
  async sendStreamMessage(
    message: string,
    context?: any,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    try {
      // 获取完整响应
      const result = await this.sendMessage(message, { ...context, stream: true });

      // 如果有回调函数，模拟流式传输效果
      if (onChunk && result) {
        // 立即开始流式传输模拟
        const words = result.split(' ');
        let currentContent = '';

        for (let i = 0; i < words.length; i++) {
          currentContent += (i > 0 ? ' ' : '') + words[i];

          // 使用Promise.resolve().then()来确保异步但立即执行
          await new Promise(resolve => {
            setTimeout(() => {
              onChunk(currentContent);
              resolve(undefined);
            }, i * 30); // 每30ms输出累积内容
          });
        }
      }

      return result;
    } catch (error) {
      console.log('[ClaudeCode] Stream message failed:', error);
      throw error;
    }
  }

  /**
   * 执行技能
   */
  async executeSkill(skillName: string, context?: any): Promise<any> {
    const message = `Execute skill: ${skillName}`;
    const skillContext = {
      ...context,
      skillExecution: {
        skillName,
        requested: true
      }
    };

    return this.sendMessage(message, skillContext);
  }

  /**
   * 取消当前请求
   */
  cancelRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ClaudeCodeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): ClaudeCodeConfig {
    return { ...this.config };
  }
}

/**
 * 创建对不同端口的连接尝试
 */
export async function detectClaudeCodePort(
  host = 'localhost',
  ports = [3001, 3000, 8080, 8000, 8081, 5000]  // 3001端口优先（桥接服务器），然后是其他端口
): Promise<number | null> {
  const promises = ports.map(async (port) => {
    try {
      const client = new ClaudeCodeClient({ host, port });
      const isRunning = await client.isRunning();
      return isRunning ? port : null;
    } catch {
      return null;
    }
  });

  const results = await Promise.allSettled(promises);

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      return result.value;
    }
  }

  return null;
}