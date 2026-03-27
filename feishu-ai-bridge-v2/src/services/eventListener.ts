import { MCPClient } from '../api/mcp';
import { TaskProcessor } from './taskProcessor';
import { WorkflowRule, WORKFLOW_STORAGE_KEYS } from '../types/workflow';

/**
 * 飞书事件监听器
 * 负责监听飞书项目中的变更事件，并触发相应的工作流处理
 */
export class FeishuEventListener {
  private taskProcessor: TaskProcessor;
  private mcpClient: MCPClient;
  private workflowRules: WorkflowRule[] = [];
  private pollingInterval: number;
  private isListening: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastCheckTime: number = Date.now();

  constructor(
    taskProcessor: TaskProcessor,
    mcpClient: MCPClient,
    config?: {
      pollingInterval?: number; // 轮询间隔（毫秒），默认 30 秒
    }
  ) {
    this.taskProcessor = taskProcessor;
    this.mcpClient = mcpClient;
    this.pollingInterval = config?.pollingInterval || 30000; // 30秒默认间隔

    // 从本地存储加载工作流规则
    this.loadWorkflowRules();

    // 监听规则变更
    this.watchRuleChanges();
  }

  /**
   * 开始监听飞书事件
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      console.log('[EventListener] Already listening for events');
      return;
    }

    console.log(`[EventListener] Starting event listener with ${this.pollingInterval}ms polling interval`);

    this.isListening = true;

    // 立即执行一次检查
    await this.checkForEvents();

    // 设置定期轮询
    this.intervalId = setInterval(async () => {
      if (this.isListening) {
        await this.checkForEvents();
      }
    }, this.pollingInterval);

    console.log('[EventListener] Event listener started successfully');
  }

  /**
   * 停止监听事件
   */
  stopListening(): void {
    if (!this.isListening) {
      console.log('[EventListener] Not currently listening');
      return;
    }

    console.log('[EventListener] Stopping event listener');

    this.isListening = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[EventListener] Event listener stopped');
  }

  /**
   * 更新轮询间隔
   */
  updatePollingInterval(intervalMs: number): void {
    const wasListening = this.isListening;

    if (wasListening) {
      this.stopListening();
    }

    this.pollingInterval = intervalMs;
    console.log(`[EventListener] Updated polling interval to ${intervalMs}ms`);

    if (wasListening) {
      this.startListening();
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    isListening: boolean;
    pollingInterval: number;
    rulesCount: number;
    lastCheckTime: number;
  } {
    return {
      isListening: this.isListening,
      pollingInterval: this.pollingInterval,
      rulesCount: this.workflowRules.filter(rule => rule.enabled).length,
      lastCheckTime: this.lastCheckTime,
    };
  }

  /**
   * 检查飞书事件
   */
  private async checkForEvents(): Promise<void> {
    try {
      console.log('[EventListener] Checking for new events...');

      const currentTime = Date.now();
      const checkWindow = currentTime - this.lastCheckTime;

      // 检查创建事件
      await this.checkCreateEvents(checkWindow);

      // 检查更新事件
      await this.checkUpdateEvents(checkWindow);

      // 检查评论事件
      await this.checkCommentEvents(checkWindow);

      this.lastCheckTime = currentTime;

      console.log('[EventListener] Event check completed');

    } catch (error) {
      console.error('[EventListener] Error during event check:', error);
    }
  }

  /**
   * 检查创建事件
   */
  private async checkCreateEvents(timeWindow: number): Promise<void> {
    try {
      const createRules = this.workflowRules.filter(rule => rule.enabled && rule.trigger === 'on_create');
      if (createRules.length === 0) return;

      // 获取最近创建的工作项
      const cutoffTime = Date.now() - timeWindow - 60000; // 添加1分钟缓冲

      console.log(`[EventListener] Checking for items created since ${new Date(cutoffTime).toISOString()}`);

      // 尝试多种可能的时间字段名
      let recentItems: any = { data: { items: [] } };
      const timeFields = ['created_time', 'create_time', 'createdTime', 'updated_time'];

      for (const fieldName of timeFields) {
        try {
          recentItems = await this.mcpClient.listWorkItems('story', [
            {
              field_key: fieldName,
              operator: '>=',
              field_value: cutoffTime
            }
          ]);

          if (recentItems.data?.items && recentItems.data.items.length > 0) {
            console.log(`[EventListener] Successfully used time field: ${fieldName}`);
            break;
          }
        } catch (error) {
          console.log(`[EventListener] Time field ${fieldName} not supported, trying next...`);
        }
      }

      // 如果时间筛选不工作，则获取所有工作项并手动筛选
      if (!recentItems.data?.items || recentItems.data.items.length === 0) {
        console.log('[EventListener] Time filtering not supported, falling back to manual filtering');

        try {
          const allItems = await this.mcpClient.listWorkItems('story');
          if (allItems.data?.items) {
            const filteredItems = allItems.data.items.filter(item => {
              const itemTime = item.created_time || item.create_time || item.updated_time;
              return itemTime && itemTime >= cutoffTime;
            });

            recentItems = { data: { items: filteredItems } };
          }
        } catch (fallbackError) {
          console.error('[EventListener] Fallback filtering also failed:', fallbackError);
        }
      }

      if (recentItems.data?.items && recentItems.data.items.length > 0) {
        console.log(`[EventListener] Found ${recentItems.data.items.length} newly created items`);

        for (const item of recentItems.data.items) {
          await this.taskProcessor.processWorkflowTrigger(
            'on_create',
            item.work_item_id,
            'story',
            createRules
          );
        }
      }

    } catch (error) {
      console.error('[EventListener] Error checking create events:', error);
    }
  }

  /**
   * 检查更新事件
   */
  private async checkUpdateEvents(timeWindow: number): Promise<void> {
    try {
      const updateRules = this.workflowRules.filter(rule => rule.enabled && rule.trigger === 'on_update');
      if (updateRules.length === 0) return;

      // 获取最近更新的工作项
      const cutoffTime = Date.now() - timeWindow - 60000; // 添加1分钟缓冲

      console.log(`[EventListener] Checking for items updated since ${new Date(cutoffTime).toISOString()}`);

      const updatedItems = await this.mcpClient.listWorkItems('story', [
        {
          field_key: 'updated_time',
          operator: '>=',
          field_value: cutoffTime
        }
      ]);

      if (updatedItems.data?.items && updatedItems.data.items.length > 0) {
        console.log(`[EventListener] Found ${updatedItems.data.items.length} recently updated items`);

        for (const item of updatedItems.data.items) {
          await this.taskProcessor.processWorkflowTrigger(
            'on_update',
            item.work_item_id,
            'story',
            updateRules
          );
        }
      }

    } catch (error) {
      console.error('[EventListener] Error checking update events:', error);
    }
  }

  /**
   * 检查评论事件
   */
  private async checkCommentEvents(timeWindow: number): Promise<void> {
    try {
      const commentRules = this.workflowRules.filter(rule => rule.enabled && rule.trigger === 'on_comment');
      if (commentRules.length === 0) return;

      // 注意：这里需要根据实际的 MCP API 接口来实现
      // 目前的 MCPClient 可能没有直接获取评论的方法
      console.log('[EventListener] Comment event checking not yet implemented - API limitations');

      // TODO: 当 MCP API 支持评论查询时，实现以下逻辑：
      // const recentComments = await this.mcpClient.listRecentComments(timeWindow);
      // 处理每个有新评论的工作项

    } catch (error) {
      console.error('[EventListener] Error checking comment events:', error);
    }
  }

  /**
   * 从本地存储加载工作流规则
   */
  private loadWorkflowRules(): void {
    try {
      const stored = localStorage.getItem(WORKFLOW_STORAGE_KEYS.RULES);
      if (stored) {
        this.workflowRules = JSON.parse(stored);
        console.log(`[EventListener] Loaded ${this.workflowRules.length} workflow rules`);
      } else {
        this.workflowRules = [];
        console.log('[EventListener] No workflow rules found in storage');
      }
    } catch (error) {
      console.error('[EventListener] Failed to load workflow rules:', error);
      this.workflowRules = [];
    }
  }

  /**
   * 监听规则变更
   */
  private watchRuleChanges(): void {
    // 监听 localStorage 变更
    window.addEventListener('storage', (event) => {
      if (event.key === WORKFLOW_STORAGE_KEYS.RULES) {
        console.log('[EventListener] Workflow rules changed, reloading...');
        this.loadWorkflowRules();
      }
    });

    // 定期重新加载规则（防止同窗口内的变更未被检测到）
    setInterval(() => {
      const currentRulesJson = localStorage.getItem(WORKFLOW_STORAGE_KEYS.RULES);
      const loadedRulesJson = JSON.stringify(this.workflowRules);

      if (currentRulesJson !== loadedRulesJson) {
        console.log('[EventListener] Detected rule changes, reloading...');
        this.loadWorkflowRules();
      }
    }, 10000); // 每10秒检查一次
  }

  /**
   * 手动触发事件检查
   */
  async triggerManualCheck(): Promise<{
    checkTime: number;
    eventsProcessed: number;
    errors?: string[];
  }> {
    console.log('[EventListener] Manual event check triggered');

    const startTime = Date.now();
    let eventsProcessed = 0;
    const errors: string[] = [];

    try {
      // 检查最近 5 分钟的事件
      const timeWindow = 5 * 60 * 1000;

      await this.checkCreateEvents(timeWindow);
      await this.checkUpdateEvents(timeWindow);
      await this.checkCommentEvents(timeWindow);

      console.log('[EventListener] Manual check completed');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      console.error('[EventListener] Manual check failed:', error);
    }

    return {
      checkTime: Date.now() - startTime,
      eventsProcessed,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 获取详细状态报告
   */
  getDetailedStatus(): {
    listener: {
      isListening: boolean;
      pollingInterval: number;
      nextCheckIn: number; // 距离下次检查的毫秒数
    };
    rules: {
      total: number;
      enabled: number;
      byTrigger: Record<string, number>;
    };
    lastCheck: {
      time: number;
      ago: number; // 距离上次检查的毫秒数
    };
  } {
    const now = Date.now();
    const nextCheckIn = this.isListening ? this.pollingInterval - (now % this.pollingInterval) : -1;

    const rulesByTrigger = this.workflowRules
      .filter(rule => rule.enabled)
      .reduce((acc, rule) => {
        acc[rule.trigger] = (acc[rule.trigger] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      listener: {
        isListening: this.isListening,
        pollingInterval: this.pollingInterval,
        nextCheckIn,
      },
      rules: {
        total: this.workflowRules.length,
        enabled: this.workflowRules.filter(rule => rule.enabled).length,
        byTrigger: rulesByTrigger,
      },
      lastCheck: {
        time: this.lastCheckTime,
        ago: now - this.lastCheckTime,
      },
    };
  }
}

/**
 * 事件监听配置
 */
export interface EventListenerConfig {
  pollingInterval: number;
  autoStart: boolean;
  enabledTriggers: ('on_create' | 'on_update' | 'on_comment' | 'on_schedule')[];
}

/**
 * 默认事件监听配置
 */
export const DEFAULT_EVENT_LISTENER_CONFIG: EventListenerConfig = {
  pollingInterval: 30000, // 30秒
  autoStart: false, // 不自动启动，需要手动启用
  enabledTriggers: ['on_create', 'on_update'], // 默认只监听创建和更新事件
};

/**
 * 事件监听器工厂函数
 */
export function createEventListener(
  taskProcessor: TaskProcessor,
  mcpClient: MCPClient,
  config?: Partial<EventListenerConfig>
): FeishuEventListener {
  const finalConfig = { ...DEFAULT_EVENT_LISTENER_CONFIG, ...config };

  return new FeishuEventListener(taskProcessor, mcpClient, {
    pollingInterval: finalConfig.pollingInterval,
  });
}