export const API_CONFIG = {
  mcpUrl: '/mcp_server/v1',  // 使用相对路径，由前端框架代理处理
  mcpKey: 'm-7704188c-ef20-451f-89f9-57e4824587a0',
  projectKey: '69a00d715adc93d52b944bfa',  // 从实际请求日志中获取的项目ID
  defaultUserKey: '7481325171635240962',
  // 飞书插件认证配置
  pluginId: 'MII_68C1113184964013',
  pluginSecret: 'E44F922D93A3EC7CDA8129403895CA7C',
  siteDomain: 'project.feishu.cn',
  // 开发环境配置
  useProxy: true,   // 使用后端API服务器
  proxyUrl: 'http://localhost:8888',     // 代理服务器地址
};

export const WORK_ITEM_TYPES = {
  story: 'story',
  issue: 'issue',
  task: 'task',
} as const;

export const STATUS_LABELS: Record<string, string> = {
  to_be_started: '未开始',
  started: '已提出',
  doing: '进行中',
  end: '已结束',
  closed: '已终止',
  not_started: '未开始',
  completed: '已完成',
};

export const PRIORITY_LABELS: Record<string, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

export const AI_RULES_STORAGE_KEY = 'feishu-ai-bridge-v2-rules';
export const AI_CONFIG_STORAGE_KEY = 'feishu-ai-bridge-v2-config';

export interface AIRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: 'node_enter' | 'node_exit' | 'node_assign' | 'on_comment';
  targetNode?: string; // 目标节点，如 'requirement_analysis'、'development'、'testing'
  actions: string[];
}

// 工作流相关常量
export const WORKFLOW_CONFIG = {
  DEFAULT_TIMEOUT: 300000, // 5分钟
  DEFAULT_POLLING_INTERVAL: 30000, // 30秒
  MAX_CONCURRENT_EXECUTIONS: 10,
  EXECUTION_RETENTION_DAYS: 30,
} as const;

export const GSTACK_SKILLS = {
  ENGINEERING: [
    'plan-eng-review',
    'investigate',
    'review',
    'qa',
    'qa-only'
  ],
  DESIGN: [
    'plan-design-review',
    'design-review',
    'office-hours'
  ],
  BUSINESS: [
    'plan-ceo-review'
  ],
  DEPLOYMENT: [
    'ship',
    'land-and-deploy'
  ],
  ANALYSIS: [
    'codex'
  ]
} as const;

export const NODE_TYPE_LABELS: Record<string, string> = {
  requirement_analysis: '需求分析',
  design_review: '设计评审',
  development: '开发',
  testing: '测试',
  deployment: '部署',
  maintenance: '维护',
};

export const EXECUTION_STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  claimed: '已领取',
  analyzing: '分析中',
  completed: '已完成',
  failed: '执行失败',
  cancelled: '已取消',
  timeout: '执行超时',
};
