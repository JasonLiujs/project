import { MCPClient } from '../api/mcp';
import {
  WorkflowRule,
  GstackAnalysisResult,
  WorkflowExecution
} from '../types/workflow';

/**
 * 结果格式化与发布服务
 * 负责将 AI 分析结果格式化并发布到飞书项目中
 */
export class ResultsPublisher {
  private mcpClient: MCPClient;

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * 发布完整的分析结果到飞书
   */
  async publishToFeishu(
    workItemId: string,
    analysis: GstackAnalysisResult,
    rule: WorkflowRule,
    execution: WorkflowExecution
  ): Promise<{
    commentsAdded: string[];
    fieldsUpdated: string[];
    followUpTasksCreated?: string[];
  }> {
    console.log(`[ResultsPublisher] Publishing results for workItem ${workItemId}`);

    const result = {
      commentsAdded: [] as string[],
      fieldsUpdated: [] as string[],
      followUpTasksCreated: [] as string[],
    };

    try {
      // 1. 生成并发布结构化评论
      const commentId = await this.publishAnalysisComment(workItemId, analysis, rule, execution);
      if (commentId) {
        result.commentsAdded.push(commentId);
      }

      // 2. 更新工作项字段
      if (rule.resultMapping.fieldUpdates && rule.resultMapping.fieldUpdates.length > 0) {
        const updatedFields = await this.updateWorkItemFields(workItemId, analysis, rule);
        result.fieldsUpdated.push(...updatedFields);
      }

      // 3. 创建后续任务（如果配置）
      if (rule.resultMapping.createFollowUpTasks && analysis.nextSteps && analysis.nextSteps.length > 0) {
        const followUpTasks = await this.createFollowUpTasks(workItemId, analysis.nextSteps, rule);
        result.followUpTasksCreated = followUpTasks;
      }

      // 4. 发布进度更新（如果需要）
      await this.publishProgressUpdate(workItemId, execution, 'completed');

      console.log(`[ResultsPublisher] Successfully published results for workItem ${workItemId}`);
      return result;

    } catch (error) {
      console.error(`[ResultsPublisher] Failed to publish results for workItem ${workItemId}:`, error);

      // 尝试发布错误信息
      try {
        await this.publishErrorComment(workItemId, error as Error, execution);
      } catch (commentError) {
        console.error(`[ResultsPublisher] Failed to publish error comment:`, commentError);
      }

      throw error;
    }
  }

  /**
   * 发布分析评论
   */
  private async publishAnalysisComment(
    workItemId: string,
    analysis: GstackAnalysisResult,
    rule: WorkflowRule,
    execution: WorkflowExecution
  ): Promise<string | null> {
    try {
      const comment = this.formatAnalysisComment(analysis, rule, execution);

      await this.mcpClient.addComment(workItemId, comment);

      console.log(`[ResultsPublisher] Published analysis comment for workItem ${workItemId}`);
      return `comment_${Date.now()}`; // 模拟评论ID

    } catch (error) {
      console.error(`[ResultsPublisher] Failed to publish comment:`, error);
      throw error;
    }
  }

  /**
   * 更新工作项字段
   */
  private async updateWorkItemFields(
    workItemId: string,
    analysis: GstackAnalysisResult,
    rule: WorkflowRule
  ): Promise<string[]> {
    if (!rule.resultMapping.fieldUpdates) {
      return [];
    }

    const updatedFields: string[] = [];

    try {
      const fieldUpdates = rule.resultMapping.fieldUpdates.map(update => ({
        field_key: update.fieldKey,
        field_value: this.evaluateFieldValue(update.valueExpression, analysis, update.transform),
      }));

      await this.mcpClient.updateWorkItemFields(
        workItemId,
        'story', // TODO: 使用实际工作项类型
        fieldUpdates
      );

      updatedFields.push(...fieldUpdates.map(update => update.field_key));
      console.log(`[ResultsPublisher] Updated ${updatedFields.length} fields for workItem ${workItemId}`);

    } catch (error) {
      console.error(`[ResultsPublisher] Failed to update fields:`, error);
      throw error;
    }

    return updatedFields;
  }

  /**
   * 创建后续任务
   */
  private async createFollowUpTasks(
    workItemId: string,
    nextSteps: Array<{
      action: string;
      priority: 'low' | 'medium' | 'high';
      estimatedTime?: string;
      assignee?: string;
    }>,
    rule: WorkflowRule
  ): Promise<string[]> {
    const createdTasks: string[] = [];

    for (const [index, step] of nextSteps.entries()) {
      try {
        // 只创建高优先级和中优先级的后续任务
        if (step.priority === 'low') {
          continue;
        }

        const taskTitle = `[AI生成] ${step.action}`;
        const taskDescription = `基于 AI 分析自动生成的后续任务\n\n**优先级**: ${this.getPriorityLabel(step.priority)}\n**预估时间**: ${step.estimatedTime || '待评估'}\n**父任务**: [WorkItem ${workItemId}]`;

        // TODO: 实际调用创建工作项的API
        console.log(`[ResultsPublisher] Would create follow-up task: ${taskTitle}`);

        const taskId = `task_${Date.now()}_${index}`;
        createdTasks.push(taskId);

      } catch (error) {
        console.error(`[ResultsPublisher] Failed to create follow-up task:`, error);
        // 不中断整个流程，继续创建其他任务
      }
    }

    return createdTasks;
  }

  /**
   * 发布进度更新
   */
  private async publishProgressUpdate(
    workItemId: string,
    execution: WorkflowExecution,
    status: string
  ): Promise<void> {
    const executionTime = execution.endTime ?
      ((execution.endTime - execution.startTime) / 1000).toFixed(1) : 'N/A';

    const progressComment = `🤖 **AI 工作流更新**

**执行状态**: ${this.getStatusLabel(status)}
**执行时间**: ${executionTime}秒
**规则**: ${execution.ruleId}
**完成时间**: ${new Date().toLocaleString('zh-CN')}

---
*自动生成的进度更新*`;

    try {
      await this.mcpClient.addComment(workItemId, progressComment);
    } catch (error) {
      console.error(`[ResultsPublisher] Failed to publish progress update:`, error);
      // 进度更新失败不应该影响主流程
    }
  }

  /**
   * 发布错误评论
   */
  private async publishErrorComment(
    workItemId: string,
    error: Error,
    execution: WorkflowExecution
  ): Promise<void> {
    const errorComment = `❌ **AI 工作流执行失败**

**错误类型**: 执行异常
**错误信息**: ${error.message}
**执行规则**: ${execution.ruleId}
**失败时间**: ${new Date().toLocaleString('zh-CN')}

请检查配置或联系管理员处理。

---
*自动生成的错误报告*`;

    try {
      await this.mcpClient.addComment(workItemId, errorComment);
    } catch (commentError) {
      console.error(`[ResultsPublisher] Failed to publish error comment:`, commentError);
    }
  }

  /**
   * 格式化分析评论
   */
  private formatAnalysisComment(
    analysis: GstackAnalysisResult,
    rule: WorkflowRule,
    execution: WorkflowExecution
  ): string {
    let comment = rule.resultMapping.commentTemplate;

    // 基本变量替换
    const basicReplacements: Record<string, string> = {
      '{summary}': analysis.summary || '暂无分析摘要',
      '{timestamp}': new Date().toLocaleString('zh-CN'),
      '{execution_id}': execution.id,
      '{execution_time}': execution.endTime ?
        `${((execution.endTime - execution.startTime) / 1000).toFixed(1)}秒` : '计算中...',
    };

    // 架构相关变量
    const architectureReplacements: Record<string, string> = {
      '{architecture_recommendations}': this.formatArchitectureRecommendations(analysis),
      '{risk_assessment}': this.formatRiskAssessment(analysis.risks || []),
      '{technical_approach}': this.formatTechnicalApproach(analysis),
      '{next_steps}': this.formatNextSteps(analysis.nextSteps || []),
    };

    // 质量相关变量
    const qualityReplacements: Record<string, string> = {
      '{quality_score}': this.calculateQualityScore(analysis),
      '{complexity_score}': this.calculateComplexityScore(analysis),
      '{recommendations}': this.formatList(analysis.recommendations || []),
    };

    // 合并所有替换
    const allReplacements = {
      ...basicReplacements,
      ...architectureReplacements,
      ...qualityReplacements,
    };

    // 执行替换
    for (const [key, value] of Object.entries(allReplacements)) {
      comment = comment.replace(new RegExp(key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), value);
    }

    // 添加执行信息
    const executionInfo = `

---
**🔧 执行信息**
- 执行ID: \`${execution.id}\`
- 规则: ${rule.name}
- 技能: ${rule.gstackSkills.primary}${rule.gstackSkills.secondary ? ` + ${rule.gstackSkills.secondary.length} 辅助技能` : ''}
- 完成时间: ${new Date().toLocaleString('zh-CN')}`;

    return comment + executionInfo;
  }

  /**
   * 格式化架构建议
   */
  private formatArchitectureRecommendations(analysis: GstackAnalysisResult): string {
    const insights = analysis.architectureInsights;
    if (!insights || (!insights.suggestions?.length && !insights.patterns?.length)) {
      return '暂无架构建议';
    }

    let result = '';

    if (insights.patterns && insights.patterns.length > 0) {
      result += '**设计模式建议:**\n';
      result += insights.patterns.map(pattern => `- ${pattern}`).join('\n');
      result += '\n\n';
    }

    if (insights.suggestions && insights.suggestions.length > 0) {
      result += '**架构优化建议:**\n';
      result += insights.suggestions.map(suggestion => `- ${suggestion}`).join('\n');
    }

    if (insights.concerns && insights.concerns.length > 0) {
      result += '\n\n**需要关注的问题:**\n';
      result += insights.concerns.map(concern => `⚠️ ${concern}`).join('\n');
    }

    return result || '暂无架构建议';
  }

  /**
   * 格式化风险评估
   */
  private formatRiskAssessment(risks: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    mitigation?: string;
  }>): string {
    if (risks.length === 0) {
      return '✅ 未发现明显风险';
    }

    return risks.map(risk => {
      const emoji = {
        low: '🟢',
        medium: '🟡',
        high: '🔴',
        critical: '🚨'
      }[risk.severity] || '🟡';

      const severityLabel = {
        low: '低风险',
        medium: '中风险',
        high: '高风险',
        critical: '严重风险'
      }[risk.severity] || '中风险';

      let riskText = `${emoji} **${severityLabel}**: ${risk.description}`;

      if (risk.mitigation) {
        riskText += `\n  💡 *缓解措施*: ${risk.mitigation}`;
      }

      return riskText;
    }).join('\n\n');
  }

  /**
   * 格式化技术方案
   */
  private formatTechnicalApproach(analysis: GstackAnalysisResult): string {
    const recommendations = analysis.recommendations || [];

    if (recommendations.length === 0) {
      return '暂无具体技术方案建议';
    }

    return recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n');
  }

  /**
   * 格式化下一步行动
   */
  private formatNextSteps(nextSteps: Array<{
    action: string;
    priority: 'low' | 'medium' | 'high';
    estimatedTime?: string;
    assignee?: string;
  }>): string {
    if (nextSteps.length === 0) {
      return '暂无具体行动计划';
    }

    return nextSteps.map((step, index) => {
      const priorityEmoji = {
        high: '🔥',
        medium: '🟡',
        low: '🔵'
      }[step.priority] || '🟡';

      let stepText = `${index + 1}. ${priorityEmoji} ${step.action}`;

      if (step.estimatedTime) {
        stepText += ` *(预估: ${step.estimatedTime})*`;
      }

      if (step.assignee) {
        stepText += ` *[@${step.assignee}]*`;
      }

      return stepText;
    }).join('\n');
  }

  /**
   * 计算质量分数
   */
  private calculateQualityScore(analysis: GstackAnalysisResult): string {
    // 基于分析结果计算一个质量分数
    let score = 70; // 基础分

    // 有摘要 +10
    if (analysis.summary && analysis.summary.length > 50) {
      score += 10;
    }

    // 有建议 +10
    if (analysis.recommendations && analysis.recommendations.length > 0) {
      score += 10;
    }

    // 有下一步行动 +5
    if (analysis.nextSteps && analysis.nextSteps.length > 0) {
      score += 5;
    }

    // 根据风险扣分
    if (analysis.risks) {
      const highRiskCount = analysis.risks.filter(r => r.severity === 'high' || r.severity === 'critical').length;
      score -= highRiskCount * 5;
    }

    score = Math.max(0, Math.min(100, score));
    return `${score}/100`;
  }

  /**
   * 计算复杂度分数
   */
  private calculateComplexityScore(analysis: GstackAnalysisResult): string {
    // 基于分析内容计算复杂度
    let complexity = 'medium';

    const recommendations = analysis.recommendations?.length || 0;
    const risks = analysis.risks?.length || 0;
    const nextSteps = analysis.nextSteps?.length || 0;

    const totalItems = recommendations + risks + nextSteps;

    if (totalItems <= 3) {
      complexity = 'low';
    } else if (totalItems <= 8) {
      complexity = 'medium';
    } else {
      complexity = 'high';
    }

    const labels = {
      low: '🟢 简单',
      medium: '🟡 中等',
      high: '🔴 复杂'
    };

    return labels[complexity as keyof typeof labels] || labels.medium;
  }

  /**
   * 格式化列表
   */
  private formatList(items: string[]): string {
    if (items.length === 0) return '暂无项目';
    return items.map(item => `- ${item}`).join('\n');
  }

  /**
   * 评估字段值
   */
  private evaluateFieldValue(
    expression: string,
    analysis: GstackAnalysisResult,
    transform?: 'string' | 'number' | 'boolean' | 'json'
  ): any {
    let value: any = expression;

    // 处理模板变量
    if (expression.includes('{') && expression.includes('}')) {
      const context = {
        summary: analysis.summary,
        recommendation_count: analysis.recommendations?.length || 0,
        risk_count: analysis.risks?.length || 0,
        next_steps_count: analysis.nextSteps?.length || 0,
        quality_score: parseInt(this.calculateQualityScore(analysis)),
        complexity_score: this.calculateComplexityScore(analysis),
        timestamp: Date.now(),
      };

      // 简单的变量替换
      for (const [key, val] of Object.entries(context)) {
        value = value.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
      }
    }

    // 类型转换
    switch (transform) {
      case 'number':
        return typeof value === 'number' ? value : parseInt(value) || 0;
      case 'boolean':
        return typeof value === 'boolean' ? value : value === 'true' || value === '1';
      case 'json':
        return typeof value === 'object' ? JSON.stringify(value) : value;
      case 'string':
      default:
        return String(value);
    }
  }

  /**
   * 获取优先级标签
   */
  private getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      low: '🔵 低',
      medium: '🟡 中',
      high: '🔴 高',
      critical: '🚨 严重',
    };
    return labels[priority] || labels.medium;
  }

  /**
   * 获取状态标签
   */
  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: '⏳ 等待中',
      claimed: '📋 已领取',
      analyzing: '🔄 分析中',
      completed: '✅ 已完成',
      failed: '❌ 失败',
      cancelled: '⏹️ 已取消',
      timeout: '⏰ 超时',
    };
    return labels[status] || status;
  }
}