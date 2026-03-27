import { MCPClient } from './api/mcp';
import { GstackBridge } from './services/gstackBridge';
import { TaskProcessor } from './services/taskProcessor';
import { ResultsPublisher } from './services/resultsPublisher';
import { WorkflowStateManager } from './services/workflowState';
import { FeishuEventListener, createEventListener, DEFAULT_EVENT_LISTENER_CONFIG } from './services/eventListener';
import { WorkflowRule, WORKFLOW_STORAGE_KEYS } from './types/workflow';

/**
 * AI 协同自动化工作流系统主应用
 * 统一管理各个服务组件，提供完整的工作流自动化能力
 */
export class FeishuAIBridgeApp {
  private mcpClient: MCPClient | null = null;
  private gstackBridge: GstackBridge | null = null;
  private taskProcessor: TaskProcessor | null = null;
  private resultsPublisher: ResultsPublisher | null = null;
  private stateManager: WorkflowStateManager;
  private eventListener: FeishuEventListener | null = null;

  private initialized: boolean = false;
  private config: AppConfig;

  constructor(config?: Partial<AppConfig>) {
    this.config = {
      ...DEFAULT_APP_CONFIG,
      ...config
    };

    // 工作流状态管理器是单例，可以立即初始化
    this.stateManager = WorkflowStateManager.getInstance();

    console.log('[FeishuAIBridge] Application initialized with config:', this.config);
  }

  /**
   * 初始化应用
   */
  async initialize(userKey: string): Promise<void> {
    if (this.initialized) {
      console.log('[FeishuAIBridge] Application already initialized');
      return;
    }

    console.log('[FeishuAIBridge] Initializing application...');

    try {
      // 1. 初始化 MCP 客户端
      console.log('[FeishuAIBridge] Initializing MCP client...');
      this.mcpClient = new MCPClient(userKey, this.config.mcp);
      await this.mcpClient.connect();

      // 2. 初始化 gstack 桥接服务
      console.log('[FeishuAIBridge] Initializing gstack bridge...');
      this.gstackBridge = new GstackBridge({
        endpoint: this.config.gstack.endpoint,
        apiKey: this.config.gstack.apiKey,
        timeout: this.config.gstack.timeout
      });

      // 3. 初始化结果发布服务
      console.log('[FeishuAIBridge] Initializing results publisher...');
      this.resultsPublisher = new ResultsPublisher(this.mcpClient);

      // 4. 初始化任务处理器
      console.log('[FeishuAIBridge] Initializing task processor...');
      this.taskProcessor = new TaskProcessor(
        this.mcpClient,
        this.gstackBridge,
        this.stateManager
      );

      // 5. 初始化事件监听器
      if (this.config.eventListener.enabled) {
        console.log('[FeishuAIBridge] Initializing event listener...');
        this.eventListener = createEventListener(
          this.taskProcessor,
          this.mcpClient,
          {
            pollingInterval: this.config.eventListener.pollingInterval,
            autoStart: false // 总是手动启动，给用户控制权
          }
        );

        if (this.config.eventListener.autoStart) {
          await this.eventListener.startListening();
        }
      }

      // 6. 执行初始化后的清理任务
      await this.performInitialMaintenance();

      this.initialized = true;
      console.log('[FeishuAIBridge] Application initialization completed successfully');

    } catch (error) {
      console.error('[FeishuAIBridge] Application initialization failed:', error);
      throw error;
    }
  }

  /**
   * 启动事件监听
   */
  async startEventListening(): Promise<void> {
    if (!this.eventListener) {
      throw new Error('Event listener not initialized. Enable eventListener in config first.');
    }

    if (!this.initialized) {
      throw new Error('Application not initialized. Call initialize() first.');
    }

    console.log('[FeishuAIBridge] Starting event listening...');
    await this.eventListener.startListening();
  }

  /**
   * 停止事件监听
   */
  stopEventListening(): void {
    if (this.eventListener) {
      console.log('[FeishuAIBridge] Stopping event listening...');
      this.eventListener.stopListening();
    }
  }

  /**
   * 手动处理工作项
   */
  async processWorkItem(
    workItemId: string,
    workItemType: string,
    ruleId?: string
  ): Promise<{
    success: boolean;
    executionId?: string;
    error?: string;
  }> {
    if (!this.initialized || !this.taskProcessor) {
      throw new Error('Application not initialized');
    }

    try {
      console.log(`[FeishuAIBridge] Processing work item ${workItemId} manually`);

      const executionId = await this.taskProcessor.processWorkItemAnalysis(
        workItemId,
        workItemType,
        ruleId || 'workflow-req-analysis' // 默认使用需求分析规则
      );

      return {
        success: true,
        executionId
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[FeishuAIBridge] Failed to process work item ${workItemId}:`, error);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 获取工作流执行状态
   */
  async getExecutionStatus(executionId: string): Promise<any> {
    return await this.stateManager.getExecution(executionId);
  }

  /**
   * 获取工作项的所有执行历史
   */
  async getWorkItemExecutions(workItemId: string): Promise<any[]> {
    return await this.stateManager.getExecutionsByWorkItem(workItemId);
  }

  /**
   * 获取系统状态
   */
  getSystemStatus(): SystemStatus {
    return {
      initialized: this.initialized,
      components: {
        mcpClient: !!this.mcpClient,
        gstackBridge: !!this.gstackBridge,
        taskProcessor: !!this.taskProcessor,
        resultsPublisher: !!this.resultsPublisher,
        stateManager: true, // 总是可用
        eventListener: !!this.eventListener
      },
      eventListener: this.eventListener?.getDetailedStatus() || {
        listener: { isListening: false, pollingInterval: 0, nextCheckIn: -1 },
        rules: { total: 0, enabled: 0, byTrigger: {} },
        lastCheck: { time: 0, ago: 0 }
      },
      config: this.config
    };
  }

  /**
   * 获取活跃的工作流执行
   */
  async getActiveExecutions(): Promise<any[]> {
    return await this.stateManager.listActiveExecutions();
  }

  /**
   * 获取工作流统计信息
   */
  async getExecutionStats(since?: number): Promise<any> {
    return await this.stateManager.getExecutionStats(since);
  }

  /**
   * 取消工作流执行
   */
  async cancelExecution(executionId: string, reason?: string): Promise<void> {
    await this.stateManager.cancelExecution(executionId, reason);
  }

  /**
   * 清理过期的执行记录
   */
  async cleanupExpiredExecutions(olderThanDays: number = 30): Promise<number> {
    return await this.stateManager.cleanupExpiredExecutions(olderThanDays);
  }

  /**
   * 重新加载工作流规则
   */
  reloadWorkflowRules(): void {
    console.log('[FeishuAIBridge] Reloading workflow rules...');
    // 事件监听器会自动监听规则变更，这里只是手动触发日志
    const stored = localStorage.getItem(WORKFLOW_STORAGE_KEYS.RULES);
    const rules = stored ? JSON.parse(stored) : [];
    console.log(`[FeishuAIBridge] Loaded ${rules.length} workflow rules`);
  }

  /**
   * 手动触发事件检查
   */
  async triggerEventCheck(): Promise<any> {
    if (!this.eventListener) {
      throw new Error('Event listener not available');
    }

    console.log('[FeishuAIBridge] Triggering manual event check...');
    return await this.eventListener.triggerManualCheck();
  }

  /**
   * 执行初始化维护任务
   */
  private async performInitialMaintenance(): Promise<void> {
    console.log('[FeishuAIBridge] Performing initial maintenance...');

    try {
      // 清理过期的执行记录
      const cleanedCount = await this.cleanupExpiredExecutions(7); // 清理7天前的记录
      if (cleanedCount > 0) {
        console.log(`[FeishuAIBridge] Cleaned up ${cleanedCount} expired execution records`);
      }

      // 检查是否有卡住的执行
      const activeExecutions = await this.getActiveExecutions();
      const staleThreshold = Date.now() - (60 * 60 * 1000); // 1小时前

      for (const execution of activeExecutions) {
        if (execution.startTime < staleThreshold) {
          console.warn(`[FeishuAIBridge] Found stale execution: ${execution.id}, cancelling...`);
          await this.cancelExecution(execution.id, 'Stale execution detected during startup');
        }
      }

      console.log('[FeishuAIBridge] Initial maintenance completed');

    } catch (error) {
      console.error('[FeishuAIBridge] Initial maintenance failed:', error);
      // 维护失败不应该阻止应用启动
    }
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    console.log('[FeishuAIBridge] Shutting down application...');

    // 停止事件监听
    this.stopEventListening();

    // 断开 MCP 连接
    if (this.mcpClient) {
      await this.mcpClient.disconnect();
    }

    // 清理资源
    this.initialized = false;
    this.mcpClient = null;
    this.gstackBridge = null;
    this.taskProcessor = null;
    this.resultsPublisher = null;
    this.eventListener = null;

    console.log('[FeishuAIBridge] Application shutdown completed');
  }
}

/**
 * 应用配置接口
 */
export interface AppConfig {
  mcp: {
    timeout?: number;
    retries?: number;
  };
  gstack: {
    endpoint?: string;
    apiKey?: string;
    timeout?: number;
  };
  eventListener: {
    enabled: boolean;
    pollingInterval: number;
    autoStart: boolean;
  };
}

/**
 * 默认应用配置
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  mcp: {
    timeout: 10000, // 10秒
    retries: 3
  },
  gstack: {
    endpoint: 'http://localhost:8000/api/skills', // 浏览器环境使用默认值
    apiKey: '',
    timeout: 300000 // 5分钟
  },
  eventListener: {
    enabled: false, // 默认不启用，需要用户手动开启
    pollingInterval: 30000, // 30秒
    autoStart: false
  }
};

/**
 * 系统状态接口
 */
export interface SystemStatus {
  initialized: boolean;
  components: {
    mcpClient: boolean;
    gstackBridge: boolean;
    taskProcessor: boolean;
    resultsPublisher: boolean;
    stateManager: boolean;
    eventListener: boolean;
  };
  eventListener: any;
  config: AppConfig;
}

/**
 * 全局应用实例
 * 使用单例模式确保整个应用只有一个实例
 */
let globalAppInstance: FeishuAIBridgeApp | null = null;

/**
 * 获取或创建应用实例
 */
export function getApp(config?: Partial<AppConfig>): FeishuAIBridgeApp {
  if (!globalAppInstance) {
    globalAppInstance = new FeishuAIBridgeApp(config);
  }
  return globalAppInstance;
}

/**
 * 销毁全局应用实例
 */
export async function destroyApp(): Promise<void> {
  if (globalAppInstance) {
    await globalAppInstance.shutdown();
    globalAppInstance = null;
  }
}

// 导出默认应用实例
export const app = getApp();

// 导出主要类
export {
  MCPClient,
  GstackBridge,
  TaskProcessor,
  ResultsPublisher,
  WorkflowStateManager,
  FeishuEventListener
};