import { MCPClient } from '../../../api/mcp';
import { WorkflowNodeInfo } from './workflowNodeService';

export interface MemoryChatMessage {
  type: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: number;
}

export interface MemoryFilePayload {
  projectId: string;
  projectKey?: string;
  spaceId: string;
  workItemId: string;
  workItemType: string;
  workItemTitle: string;
  workItemStatus?: string;
  node: WorkflowNodeInfo;
  agentName: string;
  collaborators: string[];
  startedAt?: string;
  completedAt: string;
  predecessorNodes: Array<{
    name: string;
    output: string;
  }>;
  nodeGoal: string;
  workDetails: {
    workItems: string[];
    executionLogic: string[];
    keyOperations: string[];
    exceptions: string[];
  };
  outcomes: Array<{
    name: string;
    format: string;
    path?: string;
    description: string;
    validation: string;
  }>;
  guidance: {
    people: string[];
    directions: string[];
    adjustments: string[];
    summary: string;
  };
  keywords: string[];
  remarks: string[];
  version: string;
  workspaceRoot?: string;
  backupDir?: string;
}

export interface GeneratedMemoryFile {
  fileName: string;
  filePath: string;
  content: string;
  completedAt: string;
}

export const MEMORY_FILE_FIELD_KEY_STORAGE = 'feishu-ai-bridge-v2-memory-field-key';
const DEFAULT_MEMORY_FIELD_KEY = '记忆文件';

function toDateTimeText(timestamp?: number): string | undefined {
  if (!timestamp) {
    return undefined;
  }

  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateText(value: string, maxLength = 220): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  const normalized = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalized));
}

function extractKeywords(nodeName: string, workItemTitle: string, messages: MemoryChatMessage[]): string[] {
  const rawWords = `${nodeName} ${workItemTitle} ${messages.map((message) => message.content).join(' ')}`
    .split(/[\s,，。；;:：()\[\]{}<>\/\\|]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);

  return Array.from(new Set(rawWords)).slice(0, 12);
}

export function getMemoryFileFieldKey(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_MEMORY_FIELD_KEY;
  }

  const saved = window.localStorage.getItem(MEMORY_FILE_FIELD_KEY_STORAGE);
  return saved?.trim() || DEFAULT_MEMORY_FIELD_KEY;
}

export async function buildMemoryFilePayload(params: {
  spaceId: string;
  workItemType: string;
  workItemId: string;
  projectKey?: string;
  node: WorkflowNodeInfo;
  messages: MemoryChatMessage[];
  workspaceRoot?: string;
  detectedFilePath?: string;
  implementationSnippet?: string | null;
}): Promise<MemoryFilePayload> {
  const {
    spaceId,
    workItemType,
    workItemId,
    projectKey,
    node,
    messages,
    workspaceRoot,
    detectedFilePath,
    implementationSnippet,
  } = params;

  const mcpClient = new MCPClient();
  const [workItemBrief, commentsResult, opRecordResult] = await Promise.allSettled([
    mcpClient.getWorkItemBrief(workItemId, workItemType, spaceId),
    mcpClient.listWorkItemComments(workItemId, spaceId),
    mcpClient.getWorkItemOpRecord(workItemId, spaceId),
  ]);

  const briefData =
    workItemBrief.status === 'fulfilled'
      ? workItemBrief.value?.data || {}
      : {};
  const comments =
    commentsResult.status === 'fulfilled'
      ? commentsResult.value?.data?.comments || []
      : [];
  const opRecords =
    opRecordResult.status === 'fulfilled'
      ? opRecordResult.value?.data?.records || []
      : [];

  const userMessages = messages.filter((message) => message.type === 'user');
  const assistantMessages = messages.filter((message) => message.type === 'assistant');
  const latestUserMessages = userMessages.slice(-6).map((message) => truncateText(message.content));
  const latestAssistantMessages = assistantMessages.slice(-6).map((message) => truncateText(message.content));
  const recentComments = comments.slice(-5).map((comment) => truncateText(comment.content || ''));

  const guidancePeople = uniqueStrings(
    comments.slice(-5).map((comment) => comment.user_key).concat(node.owners || [])
  );

  const opRecordDetails = opRecords.slice(-5).map((record) => truncateText(record.detail || record.operation_type || ''));
  const outcomeDescriptionParts = [
    detectedFilePath ? `当前会话识别到主要修改文件: ${detectedFilePath}` : '',
    implementationSnippet ? `最近生成的实现片段已纳入记忆文件。` : '',
  ].filter(Boolean);

  return {
    projectId: projectKey || spaceId,
    projectKey,
    spaceId,
    workItemId,
    workItemType,
    workItemTitle: String(briefData.title || briefData.name || workItemId),
    workItemStatus: typeof briefData.status === 'string' ? briefData.status : undefined,
    node,
    agentName: 'Claude Code',
    collaborators: guidancePeople,
    startedAt: toDateTimeText(node.start_time),
    completedAt: toDateTimeText(Date.now()) || '',
    predecessorNodes: [
      {
        name: '最近评论/操作记录',
        output: recentComments[0] || opRecordDetails[0] || '暂无明确前置产出',
      },
    ],
    nodeGoal:
      node.description ||
      `完成 ${node.name} 节点要求的工作，并沉淀本节点可复用的结构化记忆。`,
    workDetails: {
      workItems: uniqueStrings([
        ...latestUserMessages,
        ...latestAssistantMessages.slice(0, 4),
      ]).slice(0, 8),
      executionLogic: uniqueStrings([
        `围绕工作项 ${String(briefData.title || workItemId)} 与节点 ${node.name} 收集上下文、执行技能、沉淀结果。`,
        opRecordDetails[0],
      ]).slice(0, 4),
      keyOperations: uniqueStrings([
        detectedFilePath ? `代码路径: ${detectedFilePath}` : '',
        implementationSnippet ? `实现片段: ${truncateText(implementationSnippet, 180)}` : '',
        ...opRecordDetails,
      ]).slice(0, 6),
      exceptions: ['无异常'],
    },
    outcomes: [
      {
        name: '节点记忆文件',
        format: 'Markdown',
        path: '',
        description:
          outcomeDescriptionParts.join(' ') || '沉淀当前节点的上下文、执行过程、成果与指导思路。',
        validation: '生成后写回工作项字段，并发布评论提示。',
      },
    ],
    guidance: {
      people: guidancePeople,
      directions: uniqueStrings([
        ...latestUserMessages,
        recentComments[0],
      ]).slice(0, 6),
      adjustments: uniqueStrings([
        ...recentComments.slice(1, 4),
        ...opRecordDetails.slice(0, 3),
      ]).slice(0, 5),
      summary: latestUserMessages[0] || '以当前节点目标为准，优先保证上下文完整与可追溯性。',
    },
    keywords: extractKeywords(node.name, String(briefData.title || workItemId), messages),
    remarks: uniqueStrings([
      detectedFilePath ? `后续节点可继续关注文件: ${detectedFilePath}` : '',
      `工作项ID: ${workItemId}`,
      `节点ID: ${node.id}`,
    ]),
    version: 'V1.0',
    workspaceRoot,
    backupDir: workspaceRoot ? `${workspaceRoot}/memory-files` : undefined,
  };
}

export async function syncMemoryFileToFeishu(params: {
  workItemId: string;
  workItemType: string;
  file: GeneratedMemoryFile;
  nodeName: string;
  fieldKey?: string;
  projectKey?: string;
}): Promise<{ fieldSynced: boolean; commentPublished: boolean; fieldKey: string }> {
  const { workItemId, workItemType, file, nodeName } = params;
  const fieldKey = params.fieldKey || getMemoryFileFieldKey();
  const projectKey = params.projectKey;
  const mcpClient = new MCPClient();
  const fieldValue = [
    `文件名: ${file.fileName}`,
    `备份路径: ${file.filePath}`,
    `生成时间: ${file.completedAt}`,
    '',
    file.content,
  ].join('\n');

  let fieldSynced = false;
  let commentPublished = false;

  try {
    await mcpClient.updateWorkItemFields(workItemId, workItemType, [
      {
        field_key: fieldKey,
        field_value: fieldValue,
      },
    ], projectKey);
    fieldSynced = true;
  } catch (error) {
    console.error('[nodeMemoryService] Failed to sync memory file field:', error);
  }

  try {
    await mcpClient.addComment(
      workItemId,
      [
        `## 🧠 节点记忆文件已生成`,
        '',
        `- 节点名称: ${nodeName}`,
        `- 文件名: ${file.fileName}`,
        `- 备份路径: ${file.filePath}`,
        `- 写入字段: ${fieldKey}`,
        `- 字段写回结果: ${fieldSynced ? '成功' : '失败（请检查字段 key 或权限）'}`,
      ].join('\n'),
      projectKey
    );

    commentPublished = true;
  } catch (error) {
    console.error('[nodeMemoryService] Failed to publish memory file comment:', error);
  }

  return {
    fieldSynced,
    commentPublished,
    fieldKey,
  };
}
