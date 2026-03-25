export const API_CONFIG = {
  mcpUrl: 'https://project.feishu.cn/mcp_server/v1',
  mcpKey: 'm-7704188c-ef20-451f-89f9-57e4824587a0',
  projectKey: 'ntv21m',
  defaultUserKey: '7481325171635240962',
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
  trigger: 'on_create' | 'on_update' | 'on_comment' | 'on_schedule';
  actions: string[];
}
