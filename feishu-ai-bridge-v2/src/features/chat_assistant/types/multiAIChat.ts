// 多AI助手聊天类型定义

/**
 * AI助手类型枚举
 */
export enum AIAssistantType {
  CLAUDE_CODE = 'claude_code',
  OPENCODE = 'opencode',
  CODEX = 'codex'
}

/**
 * AI助手配置接口
 */
export interface AIAssistant {
  type: AIAssistantType;
  name: string;
  displayName: string;
  wsEndpoint: string;
  capabilities: string[];
  supportedSkills: string[];
  icon: string;
  description: string;
}

/**
 * 聊天消息接口
 */
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'skill_trigger' | 'error';
  content: string;
  timestamp: number;
  assistant: AIAssistantType;
  workflowContext?: WorkflowContext;
  skillExecution?: SkillExecution;
  attachments?: MessageAttachment[];
  metadata?: MessageMetadata;
}

/**
 * 工作流上下文
 */
export interface WorkflowContext {
  nodeId: string;
  nodeName: string;
  workItemId: string;
  workItemType: string;
  workItemTitle?: string;
  configuredSkills: string[];
  nodeStatus: 'pending' | 'active' | 'completed' | 'failed';
  previousNodes: string[];
  nextNodes: string[];
  spaceId: string;
  workObjectId: string;
}

/**
 * 技能执行状态
 */
export interface SkillExecution {
  id: string;
  skillName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  progress?: number;
  result?: string;
  error?: string;
  logs?: string[];
}

/**
 * 消息附件
 */
export interface MessageAttachment {
  id: string;
  type: 'file' | 'image' | 'code' | 'link';
  name: string;
  url?: string;
  content?: string;
  size?: number;
  language?: string; // 代码语言类型
}

/**
 * 消息元数据
 */
export interface MessageMetadata {
  isRead: boolean;
  isImportant: boolean;
  reactions?: string[];
  threadId?: string;
}

/**
 * 多AI聊天状态
 */
export interface MultiAIChatState {
  messages: Map<AIAssistantType, ChatMessage[]>;
  activeAssistant: AIAssistantType;
  connections: Map<AIAssistantType, ConnectionStatus>;
  isProcessing: boolean;
  typingIndicator: Map<AIAssistantType, boolean>;
}

/**
 * 连接状态
 */
export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  lastConnectedTime?: number;
}

/**
 * 节点流程状态
 */
export interface NodeFlowState {
  currentNode: WorkflowNode | null;
  previousNodes: WorkflowNode[];
  nextNodes: WorkflowNode[];
  configuredSkills: NodeSkillConfig[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
}

/**
 * 工作流节点
 */
export interface WorkflowNode {
  state_key: string;
  name: string;
  is_milestone: boolean;
  owner_roles: string[];
  visibility_usage_mode: number;
  status?: 'active' | 'completed' | 'pending';
}

/**
 * 节点技能配置
 */
export interface NodeSkillConfig {
  nodeId: string;
  skill: string;
}

/**
 * 技能执行状态管理
 */
export interface SkillExecutionState {
  runningSkills: Map<string, SkillExecution>;
  executionHistory: SkillExecution[];
  autoTriggerEnabled: boolean;
  maxConcurrentExecutions: number;
}

/**
 * WebSocket消息协议
 */
export interface WebSocketMessage {
  type: 'chat' | 'skill' | 'workflow' | 'control';
  action: string;
  data: any;
  timestamp: number;
  requestId?: string;
}

/**
 * 自动技能触发配置
 */
export interface AutoSkillTrigger {
  nodeId: string;
  configuredSkills: string[];
  triggerConditions: {
    onNodeEnter: boolean;
    onUserMessage: boolean;
    onWorkItemChange: boolean;
  };
  targetAssistant: AIAssistantType;
}

/**
 * AI助手能力配置
 */
export interface AssistantCapabilities {
  supportsCodeAnalysis: boolean;
  supportsFileUpload: boolean;
  supportsWorkflowIntegration: boolean;
  supportsRealTimeChat: boolean;
  maxMessageLength: number;
  supportedFileTypes: string[];
}