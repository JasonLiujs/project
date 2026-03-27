import {
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowExecutionResults,
  WorkflowExecutionError,
  WORKFLOW_STORAGE_KEYS
} from '../types/workflow';

/**
 * 工作流状态管理器
 * 负责跟踪和管理工作流执行的完整生命周期
 */
export class WorkflowStateManager {
  private static instance: WorkflowStateManager;
  private executions: Map<string, WorkflowExecution> = new Map();

  private constructor() {
    this.loadExecutionsFromStorage();
  }

  /**
   * 单例模式获取实例
   */
  static getInstance(): WorkflowStateManager {
    if (!WorkflowStateManager.instance) {
      WorkflowStateManager.instance = new WorkflowStateManager();
    }
    return WorkflowStateManager.instance;
  }

  /**
   * 创建新的工作流执行记录
   */
  async createExecution(execution: Omit<WorkflowExecution, 'id' | 'startTime'>): Promise<string> {
    const executionId = this.generateExecutionId();

    const newExecution: WorkflowExecution = {
      ...execution,
      id: executionId,
      startTime: Date.now(),
      status: 'pending',
    };

    this.executions.set(executionId, newExecution);
    await this.saveExecutionsToStorage();

    console.log(`[WorkflowState] Created execution ${executionId} for workItem ${execution.workItemId}`);
    return executionId;
  }

  /**
   * 更新执行状态
   */
  async updateStatus(
    executionId: string,
    status: WorkflowExecutionStatus,
    data?: {
      results?: WorkflowExecutionResults;
      error?: WorkflowExecutionError;
      endTime?: number;
    }
  ): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    // 更新状态
    execution.status = status;

    // 更新结束时间
    if (data?.endTime || ['completed', 'failed', 'cancelled', 'timeout'].includes(status)) {
      execution.endTime = data?.endTime || Date.now();
    }

    // 更新结果
    if (data?.results) {
      execution.results = data.results;
    }

    // 添加错误信息
    if (data?.error) {
      execution.errors = execution.errors || [];
      execution.errors.push(data.error);
    }

    await this.saveExecutionsToStorage();
    console.log(`[WorkflowState] Updated execution ${executionId} to status ${status}`);
  }

  /**
   * 获取执行记录
   */
  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    return this.executions.get(executionId) || null;
  }

  /**
   * 获取工作项的所有执行记录
   */
  async getExecutionsByWorkItem(workItemId: string): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values())
      .filter(exec => exec.workItemId === workItemId)
      .sort((a, b) => b.startTime - a.startTime); // 按时间倒序
  }

  /**
   * 获取活跃的执行记录
   */
  async listActiveExecutions(): Promise<WorkflowExecution[]> {
    const activeStatuses: WorkflowExecutionStatus[] = ['pending', 'claimed', 'analyzing'];

    return Array.from(this.executions.values())
      .filter(exec => activeStatuses.includes(exec.status))
      .sort((a, b) => a.startTime - b.startTime); // 按时间正序
  }

  /**
   * 获取已完成的执行记录
   */
  async listCompletedExecutions(
    limit: number = 50,
    ruleId?: string
  ): Promise<WorkflowExecution[]> {
    let executions = Array.from(this.executions.values())
      .filter(exec => exec.status === 'completed');

    if (ruleId) {
      executions = executions.filter(exec => exec.ruleId === ruleId);
    }

    return executions
      .sort((a, b) => (b.endTime || b.startTime) - (a.endTime || a.startTime))
      .slice(0, limit);
  }

  /**
   * 获取失败的执行记录
   */
  async listFailedExecutions(
    limit: number = 20,
    since?: number
  ): Promise<WorkflowExecution[]> {
    let executions = Array.from(this.executions.values())
      .filter(exec => exec.status === 'failed');

    if (since) {
      executions = executions.filter(exec => exec.startTime >= since);
    }

    return executions
      .sort((a, b) => (b.endTime || b.startTime) - (a.endTime || a.startTime))
      .slice(0, limit);
  }

  /**
   * 取消执行
   */
  async cancelExecution(executionId: string, reason?: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (!['pending', 'claimed', 'analyzing'].includes(execution.status)) {
      throw new Error(`Cannot cancel execution in status ${execution.status}`);
    }

    await this.updateStatus(executionId, 'cancelled', {
      error: {
        type: 'validation_error',
        message: reason || 'Execution cancelled by user',
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 清理过期的执行记录
   */
  async cleanupExpiredExecutions(olderThanDays: number = 30): Promise<number> {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [id, execution] of this.executions.entries()) {
      const executionTime = execution.endTime || execution.startTime;
      if (executionTime < cutoffTime) {
        this.executions.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      await this.saveExecutionsToStorage();
      console.log(`[WorkflowState] Cleaned up ${cleanedCount} expired executions`);
    }

    return cleanedCount;
  }

  /**
   * 获取执行统计信息
   */
  async getExecutionStats(since?: number): Promise<{
    total: number;
    byStatus: Record<WorkflowExecutionStatus, number>;
    byRule: Record<string, number>;
    avgExecutionTime: number;
    successRate: number;
  }> {
    let executions = Array.from(this.executions.values());

    if (since) {
      executions = executions.filter(exec => exec.startTime >= since);
    }

    const stats = {
      total: executions.length,
      byStatus: {} as Record<WorkflowExecutionStatus, number>,
      byRule: {} as Record<string, number>,
      avgExecutionTime: 0,
      successRate: 0,
    };

    // 按状态统计
    const statusCounts: Record<string, number> = {};
    const ruleCounts: Record<string, number> = {};
    let totalExecutionTime = 0;
    let completedCount = 0;

    for (const execution of executions) {
      // 状态统计
      statusCounts[execution.status] = (statusCounts[execution.status] || 0) + 1;

      // 规则统计
      ruleCounts[execution.ruleId] = (ruleCounts[execution.ruleId] || 0) + 1;

      // 执行时间统计
      if (execution.endTime) {
        totalExecutionTime += execution.endTime - execution.startTime;
        completedCount++;
      }
    }

    stats.byStatus = statusCounts as Record<WorkflowExecutionStatus, number>;
    stats.byRule = ruleCounts;
    stats.avgExecutionTime = completedCount > 0 ? totalExecutionTime / completedCount : 0;

    const successCount = statusCounts.completed || 0;
    const totalFinished = (statusCounts.completed || 0) + (statusCounts.failed || 0);
    stats.successRate = totalFinished > 0 ? successCount / totalFinished : 0;

    return stats;
  }

  /**
   * 检查工作项是否有正在进行的执行
   */
  async hasActiveExecution(workItemId: string, ruleId?: string): Promise<boolean> {
    const activeStatuses: WorkflowExecutionStatus[] = ['pending', 'claimed', 'analyzing'];

    return Array.from(this.executions.values()).some(exec =>
      exec.workItemId === workItemId &&
      activeStatuses.includes(exec.status) &&
      (!ruleId || exec.ruleId === ruleId)
    );
  }

  /**
   * 生成执行ID
   */
  private generateExecutionId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 从本地存储加载执行记录
   */
  private loadExecutionsFromStorage(): void {
    try {
      const stored = localStorage.getItem(WORKFLOW_STORAGE_KEYS.EXECUTIONS);
      if (stored) {
        const executionsData = JSON.parse(stored) as WorkflowExecution[];

        // 重建 Map
        this.executions.clear();
        for (const execution of executionsData) {
          this.executions.set(execution.id, execution);
        }

        console.log(`[WorkflowState] Loaded ${executionsData.length} executions from storage`);
      }
    } catch (error) {
      console.error('[WorkflowState] Failed to load executions from storage:', error);
      this.executions.clear();
    }
  }

  /**
   * 保存执行记录到本地存储
   */
  private async saveExecutionsToStorage(): Promise<void> {
    try {
      const executionsData = Array.from(this.executions.values());
      localStorage.setItem(WORKFLOW_STORAGE_KEYS.EXECUTIONS, JSON.stringify(executionsData));
    } catch (error) {
      console.error('[WorkflowState] Failed to save executions to storage:', error);
    }
  }
}

/**
 * 执行状态工具函数
 */
export class ExecutionStatusHelper {
  /**
   * 判断状态是否为终态
   */
  static isTerminalStatus(status: WorkflowExecutionStatus): boolean {
    return ['completed', 'failed', 'cancelled', 'timeout'].includes(status);
  }

  /**
   * 判断状态是否为活跃状态
   */
  static isActiveStatus(status: WorkflowExecutionStatus): boolean {
    return ['pending', 'claimed', 'analyzing'].includes(status);
  }

  /**
   * 获取状态的中文描述
   */
  static getStatusLabel(status: WorkflowExecutionStatus): string {
    const labels: Record<WorkflowExecutionStatus, string> = {
      pending: '等待中',
      claimed: '已领取',
      analyzing: '分析中',
      completed: '已完成',
      failed: '执行失败',
      cancelled: '已取消',
      timeout: '执行超时',
    };
    return labels[status] || status;
  }

  /**
   * 获取状态对应的颜色类名
   */
  static getStatusColor(status: WorkflowExecutionStatus): string {
    const colors: Record<WorkflowExecutionStatus, string> = {
      pending: 'status-pending',
      claimed: 'status-claimed',
      analyzing: 'status-analyzing',
      completed: 'status-completed',
      failed: 'status-failed',
      cancelled: 'status-cancelled',
      timeout: 'status-timeout',
    };
    return colors[status] || 'status-unknown';
  }
}

// 导出单例实例
export const workflowStateManager = WorkflowStateManager.getInstance();