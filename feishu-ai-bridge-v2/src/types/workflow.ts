import { AIRule, AIInsight } from '../api/mcp';

/**
 * 扩展的工作流规则接口
 * 在基础 AIRule 的基础上增加工作流特定的配置
 */
export interface WorkflowRule extends AIRule {
  // 节点类型过滤 - 指定此规则适用的工作流节点
  nodeTypes: string[];

  // 任务领取条件配置
  claimingCriteria: {
    priority?: string[];  // 优先级过滤 'urgent', 'high', 'medium', 'low'
    workItemTypes?: string[];  // 工作项类型过滤 'story', 'issue', 'task'
    autoAssign?: boolean;  // 是否自动分配给当前用户
    maxConcurrentTasks?: number;  // 最大并发任务数
  };

  // gstack 技能配置
  gstackSkills: {
    primary: string;  // 主要技能名称 如 'plan-eng-review'
    secondary?: string[];  // 辅助技能列表
    parameters?: Record<string, any>;  // 技能参数配置
    timeout?: number;  // 技能执行超时时间(毫秒)
  };

  // 结果输出映射配置
  resultMapping: {
    commentTemplate: string;  // 评论模板，支持变量替换
    fieldUpdates?: Array<{
      fieldKey: string;  // 字段键名
      valueExpression: string;  // 值表达式
      transform?: 'string' | 'number' | 'boolean' | 'json';  // 值转换类型
    }>;
    createFollowUpTasks?: boolean;  // 是否创建后续任务
  };

  // 条件执行配置（可选）
  conditions?: {
    fieldConditions?: Array<{
      fieldKey: string;
      operator: '=' | '!=' | '>' | '<' | 'contains' | 'exists';
      value: any;
    }>;
    timeConditions?: {
      workingHoursOnly?: boolean;  // 仅在工作时间执行
      excludeWeekends?: boolean;   // 排除周末
    };
  };
}

/**
 * 工作流执行状态跟踪
 */
export interface WorkflowExecution {
  id: string;  // 执行唯一标识
  workItemId: string;  // 关联的工作项ID
  nodeKey: string;  // 工作流节点键
  ruleId: string;  // 触发的规则ID
  status: WorkflowExecutionStatus;

  // 时间戳
  startTime: number;
  endTime?: number;

  // 执行结果
  results?: WorkflowExecutionResults;

  // 错误信息
  errors?: WorkflowExecutionError[];

  // 执行上下文
  context?: {
    workItemData: any;
    triggerEvent: string;
    userKey: string;
  };
}

/**
 * 工作流执行状态枚举
 */
export type WorkflowExecutionStatus =
  | 'pending'     // 等待执行
  | 'claimed'     // 已领取任务
  | 'analyzing'   // AI分析中
  | 'completed'   // 执行完成
  | 'failed'      // 执行失败
  | 'cancelled'   // 已取消
  | 'timeout';    // 超时

/**
 * 工作流执行结果
 */
export interface WorkflowExecutionResults {
  gstackOutput: string;  // gstack技能原始输出
  insights: AIInsight[];  // 提取的AI洞察
  commentsAdded: string[];  // 添加的评论ID列表
  fieldsUpdated: string[];  // 更新的字段键列表
  followUpTasksCreated?: string[];  // 创建的后续任务ID列表
  executionTime: number;  // 执行耗时(毫秒)
}

/**
 * 工作流执行错误
 */
export interface WorkflowExecutionError {
  type: 'api_error' | 'skill_error' | 'validation_error' | 'timeout_error';
  message: string;
  timestamp: number;
  details?: any;
}

/**
 * gstack 技能执行请求
 */
export interface GstackRequest {
  skill: string;  // 技能名称
  context: {
    workItemData: any;  // 工作项数据
    nodeType: string;   // 节点类型
    requirements: string;  // 需求描述
    repositoryInfo?: {
      type: 'github' | 'gitlab' | 'local';
      url?: string;
      localPath?: string;
    };
  };
  configuration?: Record<string, any>;  // 配置参数
}

/**
 * gstack 技能执行结果
 */
export interface GstackResult {
  success: boolean;
  output: string;  // 原始输出
  insights: AIInsight[];  // 结构化洞察
  executionTime: number;  // 执行耗时
  metadata?: {
    skillVersion?: string;
    tokensUsed?: number;
    confidence?: number;
  };
}

/**
 * 解析后的 gstack 分析结果
 */
export interface GstackAnalysisResult {
  summary: string;  // 分析摘要
  recommendations: string[];  // 建议列表
  risks: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    mitigation?: string;
  }>;
  nextSteps: Array<{
    action: string;
    priority: 'low' | 'medium' | 'high';
    estimatedTime?: string;
    assignee?: string;
  }>;
  architectureInsights?: {
    patterns: string[];
    concerns: string[];
    suggestions: string[];
  };
  testingStrategy?: {
    approaches: string[];
    coverage: string;
    tools: string[];
  };
}

/**
 * 工作流配置存储键
 */
export const WORKFLOW_STORAGE_KEYS = {
  RULES: 'feishu-ai-bridge-workflow-rules',
  EXECUTIONS: 'feishu-ai-bridge-workflow-executions',
  CONFIG: 'feishu-ai-bridge-workflow-config',
} as const;

/**
 * 默认工作流规则模板
 */
export const DEFAULT_WORKFLOW_RULES: WorkflowRule[] = [
  {
    id: 'workflow-req-analysis',
    name: '需求分析自动化',
    description: '新需求创建时自动进行工程分析评审',
    enabled: true,
    trigger: 'on_create',
    actions: ['plan_eng_review'],
    nodeTypes: ['requirement_analysis', 'design_review'],
    claimingCriteria: {
      priority: ['high', 'urgent'],
      workItemTypes: ['story'],
      autoAssign: true,
      maxConcurrentTasks: 3,
    },
    gstackSkills: {
      primary: 'plan-eng-review',
      parameters: {
        depth: 'comprehensive',
        includeTests: true,
        includeArchitecture: true,
      },
      timeout: 300000, // 5分钟
    },
    resultMapping: {
      commentTemplate: `## 🤖 AI 需求分析报告

### 📋 分析摘要
{summary}

### 🏗️ 架构建议
{architecture_recommendations}

### ⚠️ 风险评估
{risk_assessment}

### 🔧 技术方案
{technical_approach}

### 📝 下一步行动
{next_steps}

---
*由 AI 自动分析生成 | 生成时间: {timestamp}*`,
      fieldUpdates: [
        {
          fieldKey: 'ai_analysis_status',
          valueExpression: 'completed',
          transform: 'string',
        },
        {
          fieldKey: 'complexity_score',
          valueExpression: '{complexity_score}',
          transform: 'number',
        },
      ],
      createFollowUpTasks: true,
    },
    conditions: {
      fieldConditions: [
        {
          fieldKey: 'description',
          operator: 'exists',
          value: true,
        },
      ],
      timeConditions: {
        workingHoursOnly: false,
        excludeWeekends: false,
      },
    },
  },
  {
    id: 'workflow-code-review',
    name: '代码审查自动化',
    description: '开发任务完成时自动进行代码审查',
    enabled: false, // 默认关闭，需要手动启用
    trigger: 'on_update',
    actions: ['code_review'],
    nodeTypes: ['development', 'coding'],
    claimingCriteria: {
      workItemTypes: ['story', 'task'],
      autoAssign: false, // 不自动领取，仅分析
    },
    gstackSkills: {
      primary: 'review',
      secondary: ['qa'],
      parameters: {
        includeSecurityCheck: true,
        includePerformanceCheck: true,
      },
      timeout: 180000, // 3分钟
    },
    resultMapping: {
      commentTemplate: `## 🔍 AI 代码审查报告

### 代码质量评估
{quality_assessment}

### 发现的问题
{issues_found}

### 改进建议
{improvement_suggestions}

---
*AI 代码审查 | {timestamp}*`,
    },
  },
];

/**
 * 节点类型映射到 gstack 技能
 */
export const NODE_TYPE_TO_GSTACK_SKILLS: Record<string, string[]> = {
  'requirement_analysis': ['plan-eng-review', 'office-hours'],
  'design_review': ['plan-design-review', 'design-consultation'],
  'development': ['investigate', 'review'],
  'testing': ['qa', 'qa-only'],
  'deployment': ['ship', 'land-and-deploy'],
  'maintenance': ['investigate', 'cso'],
};

/**
 * 工作流规则验证器
 */
export class WorkflowRuleValidator {
  static validate(rule: WorkflowRule): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!rule.name?.trim()) {
      errors.push('规则名称不能为空');
    }

    if (!rule.nodeTypes?.length) {
      errors.push('必须指定至少一个节点类型');
    }

    if (!rule.gstackSkills?.primary) {
      errors.push('必须指定主要gstack技能');
    }

    if (!rule.resultMapping?.commentTemplate) {
      errors.push('必须提供评论模板');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}