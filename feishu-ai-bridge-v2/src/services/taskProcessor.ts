import { MCPClient } from '../api/mcp';
import { GstackBridge } from './gstackBridge';
import { WorkflowStateManager, workflowStateManager } from './workflowState';
import {
  WorkflowRule,
  GstackRequest,
  WorkflowExecution,
  GstackAnalysisResult,
  WORKFLOW_STORAGE_KEYS
} from '../types/workflow';

/**
 * 任务发现与处理引擎
 * 负责工作流触发、任务分析、技能执行和结果处理的完整流程
 */
export class TaskProcessor {
  private mcpClient: MCPClient;
  private gstackBridge: GstackBridge;
  private stateManager: WorkflowStateManager;

  constructor(
    mcpClient: MCPClient,
    gstackBridge: GstackBridge,
    stateManager?: WorkflowStateManager
  ) {
    this.mcpClient = mcpClient;
    this.gstackBridge = gstackBridge;
    this.stateManager = stateManager || workflowStateManager;
  }

  /**
   * 处理工作流触发事件
   */
  async processWorkflowTrigger(
    trigger: 'on_create' | 'on_update' | 'on_comment' | 'on_schedule',
    workItemId: string,
    workItemType: string,
    rules: WorkflowRule[]
  ): Promise<void> {
    console.log(`[TaskProcessor] Processing trigger ${trigger} for workItem ${workItemId}`);

    try {
      // 1. 获取工作项详情
      const workItemData = await this.mcpClient.getWorkItemBrief(workItemId, workItemType);

      if (!workItemData?.data) {
        console.warn(`[TaskProcessor] WorkItem ${workItemId} not found or has no data`);
        return;
      }

      // 2. 筛选适用的规则
      const applicableRules = await this.filterApplicableRules(workItemData, rules, trigger);

      if (applicableRules.length === 0) {
        console.log(`[TaskProcessor] No applicable rules for workItem ${workItemId}`);
        return;
      }

      console.log(`[TaskProcessor] Found ${applicableRules.length} applicable rules`);

      // 3. 并发执行工作流规则（避免相互阻塞）
      const execPromises = applicableRules.map(rule =>
        this.executeWorkflowRule(workItemData, rule, trigger)
          .catch(error => {
            console.error(`[TaskProcessor] Rule ${rule.id} failed:`, error);
          })
      );

      await Promise.allSettled(execPromises);

    } catch (error) {
      console.error(`[TaskProcessor] Failed to process trigger ${trigger}:`, error);
    }
  }

  /**
   * 处理单个工作项的自动分析
   */
  async processWorkItemAnalysis(
    workItemId: string,
    workItemType: string,
    ruleId: string
  ): Promise<string | null> {
    console.log(`[TaskProcessor] Processing analysis for workItem ${workItemId} with rule ${ruleId}`);

    try {
      // 获取规则配置
      const rules = await this.loadWorkflowRules();
      const rule = rules.find(r => r.id === ruleId);

      if (!rule) {
        throw new Error(`Rule ${ruleId} not found`);
      }

      // 获取工作项数据
      const workItemData = await this.mcpClient.getWorkItemBrief(workItemId, workItemType);

      if (!workItemData?.data) {
        throw new Error(`WorkItem ${workItemId} not found`);
      }

      // 执行工作流规则
      const executionId = await this.executeWorkflowRule(workItemData, rule, 'on_update');

      return executionId;

    } catch (error) {
      console.error(`[TaskProcessor] Failed to process analysis:`, error);
      throw error;
    }
  }

  /**
   * 筛选适用的工作流规则
   */
  private async filterApplicableRules(
    workItemData: any,
    rules: WorkflowRule[],
    trigger: string
  ): Promise<WorkflowRule[]> {
    const applicableRules: WorkflowRule[] = [];

    for (const rule of rules) {
      try {
        if (await this.isRuleApplicable(workItemData, rule, trigger)) {
          applicableRules.push(rule);
        }
      } catch (error) {
        console.error(`[TaskProcessor] Error checking rule ${rule.id}:`, error);
      }
    }

    return applicableRules;
  }

  /**
   * 检查规则是否适用
   */
  private async isRuleApplicable(
    workItemData: any,
    rule: WorkflowRule,
    trigger: string
  ): Promise<boolean> {
    const workItem = workItemData.data;

    // 1. 检查触发条件
    if (rule.trigger !== trigger) {
      return false;
    }

    // 2. 检查规则是否启用
    if (!rule.enabled) {
      return false;
    }

    // 3. 检查工作项类型
    if (rule.claimingCriteria.workItemTypes && rule.claimingCriteria.workItemTypes.length > 0) {
      if (!rule.claimingCriteria.workItemTypes.includes(workItem.type)) {
        return false;
      }
    }

    // 4. 检查优先级
    if (rule.claimingCriteria.priority && rule.claimingCriteria.priority.length > 0) {
      const priority = this.extractFieldValue(workItem, 'priority');
      if (priority && !rule.claimingCriteria.priority.includes(priority)) {
        return false;
      }
    }

    // 5. 检查节点类型（如果指定）
    if (rule.nodeTypes && rule.nodeTypes.length > 0) {
      const nodeType = await this.detectNodeType(workItem);
      if (nodeType && !rule.nodeTypes.includes(nodeType)) {
        return false;
      }
    }

    // 6. 检查并发限制
    if (rule.claimingCriteria.maxConcurrentTasks) {
      const activeCount = (await this.stateManager.listActiveExecutions())
        .filter(exec => exec.ruleId === rule.id).length;

      if (activeCount >= rule.claimingCriteria.maxConcurrentTasks) {
        console.log(`[TaskProcessor] Rule ${rule.id} reached max concurrent limit`);
        return false;
      }
    }

    // 7. 检查是否已有活跃执行
    if (await this.stateManager.hasActiveExecution(workItem.work_item_id, rule.id)) {
      console.log(`[TaskProcessor] WorkItem ${workItem.work_item_id} already has active execution for rule ${rule.id}`);
      return false;
    }

    // 8. 检查字段条件
    if (rule.conditions?.fieldConditions) {
      for (const condition of rule.conditions.fieldConditions) {
        if (!this.evaluateFieldCondition(workItem, condition)) {
          return false;
        }
      }
    }

    // 9. 检查时间条件
    if (rule.conditions?.timeConditions) {
      if (!this.evaluateTimeConditions(rule.conditions.timeConditions)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 执行工作流规则
   */
  private async executeWorkflowRule(
    workItemData: any,
    rule: WorkflowRule,
    trigger: string
  ): Promise<string> {
    const workItem = workItemData.data;

    // 创建执行记录
    const executionId = await this.stateManager.createExecution({
      workItemId: workItem.work_item_id,
      nodeKey: await this.detectNodeType(workItem) || 'unknown',
      ruleId: rule.id,
      status: 'pending',
      context: {
        workItemData: workItemData,
        triggerEvent: trigger,
        userKey: this.mcpClient['userKey'], // 访问私有属性
      },
    });

    console.log(`[TaskProcessor] Created execution ${executionId} for rule ${rule.id}`);

    try {
      // 1. 自动领取任务（如果配置）
      if (rule.claimingCriteria.autoAssign) {
        await this.claimTask(workItemData, rule);
        await this.stateManager.updateStatus(executionId, 'claimed');
      }

      // 2. 执行 gstack 技能分析
      await this.stateManager.updateStatus(executionId, 'analyzing');

      const gstackResult = await this.executeGstackAnalysis(workItemData, rule);

      // 3. 发布结果到飞书
      await this.publishResults(workItem.work_item_id, gstackResult, rule);

      // 4. 更新执行状态为完成
      await this.stateManager.updateStatus(executionId, 'completed', {
        results: {
          gstackOutput: gstackResult.rawOutput,
          insights: gstackResult.insights,
          commentsAdded: [], // TODO: 实际的评论ID
          fieldsUpdated: [], // TODO: 实际更新的字段
          executionTime: gstackResult.executionTime,
        },
      });

      console.log(`[TaskProcessor] Execution ${executionId} completed successfully`);

      return executionId;

    } catch (error) {
      console.error(`[TaskProcessor] Execution ${executionId} failed:`, error);

      await this.stateManager.updateStatus(executionId, 'failed', {
        error: {
          type: 'skill_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
          details: error,
        },
      });

      throw error;
    }
  }

  /**
   * 自动领取任务
   */
  private async claimTask(workItemData: any, rule: WorkflowRule): Promise<void> {
    const workItem = workItemData.data;

    console.log(`[TaskProcessor] Auto-claiming task ${workItem.work_item_id}`);

    try {
      // 更新工作项的分配人字段
      await this.mcpClient.updateWorkItemFields(
        workItem.work_item_id,
        workItem.type || 'story',
        [
          {
            field_key: 'field_assigned', // 假设这是分配人字段
            field_value: this.mcpClient['userKey'], // 分配给当前用户
          },
        ]
      );

      console.log(`[TaskProcessor] Successfully claimed task ${workItem.work_item_id}`);

    } catch (error) {
      console.error(`[TaskProcessor] Failed to claim task ${workItem.work_item_id}:`, error);
      throw new Error(`Failed to claim task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 执行 gstack 技能分析
   */
  private async executeGstackAnalysis(
    workItemData: any,
    rule: WorkflowRule
  ): Promise<{
    rawOutput: string;
    insights: any[];
    executionTime: number;
    analysisResult: GstackAnalysisResult;
  }> {
    const workItem = workItemData.data;

    // 构建 gstack 请求
    const gstackRequest: GstackRequest = {
      skill: rule.gstackSkills.primary,
      context: {
        workItemData: workItemData,
        nodeType: await this.detectNodeType(workItem) || 'requirement_analysis',
        requirements: this.extractFieldValue(workItem, 'description') || workItem.title || '',
        repositoryInfo: await this.getRepositoryInfo(workItem),
      },
      configuration: rule.gstackSkills.parameters,
    };

    // 执行主要技能
    const primaryResult = await this.gstackBridge.executeSkill(gstackRequest);

    if (!primaryResult.success) {
      throw new Error(`Primary skill ${rule.gstackSkills.primary} failed`);
    }

    // 执行辅助技能（如果有）
    let secondaryResults: any[] = [];
    if (rule.gstackSkills.secondary && rule.gstackSkills.secondary.length > 0) {
      const secondaryRequests = rule.gstackSkills.secondary.map(skill => ({
        ...gstackRequest,
        skill,
      }));

      secondaryResults = await this.gstackBridge.executeSkillSequence(secondaryRequests);
    }

    // 解析结构化分析结果
    const analysisResult = await this.gstackBridge.parseGstackOutput(
      primaryResult.output,
      rule.gstackSkills.primary
    );

    return {
      rawOutput: primaryResult.output,
      insights: [...primaryResult.insights, ...secondaryResults.flatMap(r => r.insights || [])],
      executionTime: primaryResult.executionTime,
      analysisResult,
    };
  }

  /**
   * 发布分析结果到飞书
   */
  private async publishResults(
    workItemId: string,
    analysisResult: any,
    rule: WorkflowRule
  ): Promise<void> {
    try {
      // 1. 生成格式化的评论
      const comment = this.formatAnalysisComment(
        analysisResult.analysisResult,
        rule.resultMapping.commentTemplate
      );

      await this.mcpClient.addComment(workItemId, comment);

      // 2. 更新相关字段（如果配置）
      if (rule.resultMapping.fieldUpdates && rule.resultMapping.fieldUpdates.length > 0) {
        const fieldUpdates = rule.resultMapping.fieldUpdates.map(update => ({
          field_key: update.fieldKey,
          field_value: this.evaluateValueExpression(update.valueExpression, analysisResult),
        }));

        await this.mcpClient.updateWorkItemFields(
          workItemId,
          'story', // TODO: 使用实际的工作项类型
          fieldUpdates
        );
      }

      // 3. 创建后续任务（如果配置）
      if (rule.resultMapping.createFollowUpTasks && analysisResult.analysisResult.nextSteps) {
        await this.createFollowUpTasks(workItemId, analysisResult.analysisResult.nextSteps);
      }

      console.log(`[TaskProcessor] Successfully published results for workItem ${workItemId}`);

    } catch (error) {
      console.error(`[TaskProcessor] Failed to publish results for workItem ${workItemId}:`, error);
      throw error;
    }
  }

  /**
   * 格式化分析评论
   */
  private formatAnalysisComment(
    analysisResult: GstackAnalysisResult,
    template: string
  ): string {
    let comment = template;

    // 替换模板变量
    const replacements: Record<string, string> = {
      '{summary}': analysisResult.summary || '暂无摘要',
      '{architecture_recommendations}': this.formatList(analysisResult.architectureInsights?.suggestions || []),
      '{risk_assessment}': this.formatRiskAssessment(analysisResult.risks || []),
      '{technical_approach}': this.formatList(analysisResult.recommendations || []),
      '{next_steps}': this.formatNextSteps(analysisResult.nextSteps || []),
      '{timestamp}': new Date().toLocaleString('zh-CN'),
    };

    for (const [key, value] of Object.entries(replacements)) {
      comment = comment.replace(new RegExp(key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), value);
    }

    return comment;
  }

  /**
   * 格式化列表
   */
  private formatList(items: string[]): string {
    if (items.length === 0) return '暂无信息';
    return items.map(item => `- ${item}`).join('\\n');
  }

  /**
   * 格式化风险评估
   */
  private formatRiskAssessment(risks: any[]): string {
    if (risks.length === 0) return '暂无发现的风险';

    return risks.map(risk => {
      const emoji = {
        low: '🟢',
        medium: '🟡',
        high: '🔴',
        critical: '⚫'
      }[risk.severity] || '🟡';

      return `${emoji} **${risk.severity.toUpperCase()}**: ${risk.description}`;
    }).join('\\n');
  }

  /**
   * 格式化下一步行动
   */
  private formatNextSteps(nextSteps: any[]): string {
    if (nextSteps.length === 0) return '暂无具体行动计划';

    return nextSteps.map((step, index) => {
      const priority = step.priority === 'high' ? '🔥' : step.priority === 'low' ? '🔵' : '🟡';
      return `${index + 1}. ${priority} ${step.action}`;
    }).join('\\n');
  }

  /**
   * 检测工作项的节点类型
   */
  private async detectNodeType(workItem: any): Promise<string | null> {
    // 这里可以根据工作项的字段来推断节点类型
    // 实际实现中可能需要调用飞书API获取更详细的节点信息

    const status = this.extractFieldValue(workItem, 'status');
    const title = workItem.title?.toLowerCase() || '';
    const description = this.extractFieldValue(workItem, 'description')?.toLowerCase() || '';

    // 基于关键词推断节点类型
    if (title.includes('需求') || title.includes('requirement') || description.includes('需求分析')) {
      return 'requirement_analysis';
    }

    if (title.includes('设计') || title.includes('design') || description.includes('设计评审')) {
      return 'design_review';
    }

    if (title.includes('开发') || title.includes('dev') || title.includes('coding')) {
      return 'development';
    }

    if (title.includes('测试') || title.includes('test') || title.includes('qa')) {
      return 'testing';
    }

    if (title.includes('部署') || title.includes('deploy') || description.includes('上线')) {
      return 'deployment';
    }

    // 默认返回需求分析
    return 'requirement_analysis';
  }

  /**
   * 提取字段值
   */
  private extractFieldValue(workItem: any, fieldKey: string): any {
    // 尝试多种可能的字段位置
    return workItem[fieldKey] ||
           workItem.fields?.[fieldKey] ||
           workItem.field_values?.[fieldKey] ||
           null;
  }

  /**
   * 评估字段条件
   */
  private evaluateFieldCondition(workItem: any, condition: any): boolean {
    const fieldValue = this.extractFieldValue(workItem, condition.fieldKey);

    switch (condition.operator) {
      case '=':
        return fieldValue === condition.value;
      case '!=':
        return fieldValue !== condition.value;
      case '>':
        return fieldValue > condition.value;
      case '<':
        return fieldValue < condition.value;
      case 'contains':
        return fieldValue && fieldValue.toString().includes(condition.value);
      case 'exists':
        return condition.value ? (fieldValue !== null && fieldValue !== undefined) :
                                (fieldValue === null || fieldValue === undefined);
      default:
        return true;
    }
  }

  /**
   * 评估时间条件
   */
  private evaluateTimeConditions(timeConditions: any): boolean {
    const now = new Date();

    // 检查工作时间限制
    if (timeConditions.workingHoursOnly) {
      const hour = now.getHours();
      if (hour < 9 || hour > 18) { // 假设工作时间是9-18点
        return false;
      }
    }

    // 检查周末限制
    if (timeConditions.excludeWeekends) {
      const day = now.getDay();
      if (day === 0 || day === 6) { // 周日或周六
        return false;
      }
    }

    return true;
  }

  /**
   * 获取仓库信息
   */
  private async getRepositoryInfo(workItem: any): Promise<any> {
    // TODO: 实现从本地配置获取仓库信息的逻辑
    // 这里应该根据工作项关联的项目来查找对应的仓库配置
    return null;
  }

  /**
   * 评估值表达式
   */
  private evaluateValueExpression(expression: string, context: any): any {
    // 简单的变量替换实现
    if (expression.startsWith('{') && expression.endsWith('}')) {
      const key = expression.slice(1, -1);
      return context[key] || expression;
    }
    return expression;
  }

  /**
   * 创建后续任务
   */
  private async createFollowUpTasks(workItemId: string, nextSteps: any[]): Promise<void> {
    // TODO: 实现创建后续任务的逻辑
    console.log(`[TaskProcessor] Would create ${nextSteps.length} follow-up tasks for workItem ${workItemId}`);
  }

  /**
   * 加载工作流规则
   */
  private async loadWorkflowRules(): Promise<WorkflowRule[]> {
    try {
      const stored = localStorage.getItem(WORKFLOW_STORAGE_KEYS.RULES);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[TaskProcessor] Failed to load workflow rules:', error);
      return [];
    }
  }
}