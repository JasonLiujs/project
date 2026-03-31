import { API_CONFIG } from '../../../constants';
import { MCPClient } from '../../../api/mcp';
import { WorkflowNodeInfo } from './workflowNodeService';

export interface WorkflowMemoryEntry {
  nodeId: string;
  nodeName: string;
  memoryFile: string;
}

interface WorkflowMemoryFieldDefinition {
  fieldKey: string;
  fieldName?: string;
  fieldAlias?: string;
  subFieldKeys: {
    nodeId: string;
    nodeName: string;
    memoryFile: string;
  } | null;
  subFieldAttachmentKeys: {
    memoryFile: string;
  } | null;
  subFieldTypeKeys: {
    nodeId: string;
    nodeName: string;
    memoryFile: string;
  } | null;
}

interface WorkflowConnection {
  source_state_key: string;
  target_state_key: string;
}

const FLOW_MEMORY_FIELD_NAME = '流程记忆';
const FLOW_MEMORY_GROUP_UUID_STORAGE_KEY = 'feishu-ai-bridge-v2-workflow-memory-group-uuids';
const FLOW_MEMORY_SUBFIELD_NAMES = {
  nodeId: '节点ID',
  nodeName: '节点名称',
  memoryFile: '节点记忆文件',
};

function normalizeFieldLabel(value: unknown): string {
  return String(value || '').replace(/\s+/g, '').trim();
}

function buildGroupUuidStorageEntryKey(params: {
  spaceId: string;
  workObjectId: string;
  workItemId: string;
  fieldKey: string;
  nodeId: string;
  nodeName: string;
}) {
  return [
    params.spaceId,
    params.workObjectId,
    params.workItemId,
    params.fieldKey,
    params.nodeId || '',
    params.nodeName || '',
  ].join('::');
}

function readPersistedGroupUuid(params: {
  spaceId: string;
  workObjectId: string;
  workItemId: string;
  fieldKey: string;
  nodeId: string;
  nodeName: string;
}): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(FLOW_MEMORY_GROUP_UUID_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Record<string, string>;
    const entryKey = buildGroupUuidStorageEntryKey(params);
    const groupUuid = parsed?.[entryKey];
    return typeof groupUuid === 'string' && groupUuid.trim() ? groupUuid.trim() : null;
  } catch {
    return null;
  }
}

function persistGroupUuid(params: {
  spaceId: string;
  workObjectId: string;
  workItemId: string;
  fieldKey: string;
  nodeId: string;
  nodeName: string;
  groupUuid: string | null | undefined;
}) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedGroupUuid = typeof params.groupUuid === 'string' ? params.groupUuid.trim() : '';
  if (!normalizedGroupUuid) {
    return;
  }

  try {
    const stored = window.localStorage.getItem(FLOW_MEMORY_GROUP_UUID_STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as Record<string, string>) : {};
    const entryKey = buildGroupUuidStorageEntryKey(params);
    parsed[entryKey] = normalizedGroupUuid;
    window.localStorage.setItem(FLOW_MEMORY_GROUP_UUID_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore localStorage persistence failures and keep runtime flow working
  }
}

function extractGroupUuidFromRawEntry(entry: any): string | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  if (typeof entry.group_uuid === 'string' && entry.group_uuid.trim()) {
    return entry.group_uuid.trim();
  }

  if (typeof entry.groupUuid === 'string' && entry.groupUuid.trim()) {
    return entry.groupUuid.trim();
  }

  return null;
}

function extractGroupUuidDeep(input: unknown): string | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const matched = extractGroupUuidDeep(item);
      if (matched) {
        return matched;
      }
    }
    return null;
  }

  const rawEntryUuid = extractGroupUuidFromRawEntry(input);
  if (rawEntryUuid) {
    return rawEntryUuid;
  }

  for (const value of Object.values(input)) {
    const matched = extractGroupUuidDeep(value);
    if (matched) {
      return matched;
    }
  }

  return null;
}

function normalizeWorkItemRecord(result: any): any | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  if (Array.isArray(result.data) && result.data.length > 0) {
    return result.data[0];
  }

  if (Array.isArray(result.data?.items) && result.data.items.length > 0) {
    return result.data.items[0];
  }

  return result.data || result.item || null;
}

function collectFieldCandidates(input: any, bucket: Array<{ fieldKey: string; fieldName?: string; fieldValue: unknown }>) {
  if (!input || typeof input !== 'object') {
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((item) => collectFieldCandidates(item, bucket));
    return;
  }

  const maybeFieldKey = typeof input.field_key === 'string' ? input.field_key : undefined;
  const maybeFieldName = typeof input.field_name === 'string' ? input.field_name : undefined;

  if (maybeFieldKey) {
    bucket.push({
      fieldKey: maybeFieldKey,
      fieldName: maybeFieldName,
      fieldValue: input.field_value,
    });
  }

  Object.values(input).forEach((value) => collectFieldCandidates(value, bucket));
}

function findFlowMemoryField(
  workItem: any,
  preferredFieldKey?: string
): { fieldKey: string; fieldValue: unknown } | null {
  const candidates: Array<{ fieldKey: string; fieldName?: string; fieldValue: unknown }> = [];
  collectFieldCandidates(workItem, candidates);

  const matched =
    (preferredFieldKey
      ? candidates.find((item) => item.fieldKey === preferredFieldKey)
      : null) ||
    candidates.find((item) => normalizeFieldLabel(item.fieldName) === FLOW_MEMORY_FIELD_NAME) ||
    candidates.find((item) => normalizeFieldLabel(item.fieldKey) === FLOW_MEMORY_FIELD_NAME);

  return matched ? { fieldKey: matched.fieldKey, fieldValue: matched.fieldValue } : null;
}

function normalizeMemoryEntries(
  fieldValue: unknown,
  subFieldKeys?: WorkflowMemoryFieldDefinition['subFieldKeys']
): WorkflowMemoryEntry[] {
  if (!fieldValue) {
    return [];
  }

  let rawValue: unknown = fieldValue;
  if (typeof fieldValue === 'string') {
    try {
      rawValue = JSON.parse(fieldValue);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const readFromCompoundRow = (fieldKey?: string) => {
        if (!Array.isArray(item) || !fieldKey) {
          return undefined;
        }

        const matchedCell = item.find(
          (cell: any) => cell && typeof cell === 'object' && cell.field_key === fieldKey
        );

        if (!matchedCell) {
          return undefined;
        }

        if (Array.isArray(matchedCell.field_value)) {
          return matchedCell.field_value
            .map((value: any) => (typeof value?.name === 'string' ? value.name.trim() : ''))
            .filter(Boolean)
            .join(', ');
        }

        return matchedCell.field_value;
      };

      const nodeId =
        String(
          readFromCompoundRow(subFieldKeys?.nodeId) ||
            (subFieldKeys?.nodeId ? (item as any)[subFieldKeys.nodeId] : undefined) ||
            (item as any)[FLOW_MEMORY_SUBFIELD_NAMES.nodeId] ||
            (item as any).nodeId ||
            ''
        ).trim();
      const nodeName =
        String(
          readFromCompoundRow(subFieldKeys?.nodeName) ||
            (subFieldKeys?.nodeName ? (item as any)[subFieldKeys.nodeName] : undefined) ||
            (item as any)[FLOW_MEMORY_SUBFIELD_NAMES.nodeName] ||
            (item as any).nodeName ||
            ''
        ).trim();
      const memoryFile =
        String(
          readFromCompoundRow(subFieldKeys?.memoryFile) ||
            (subFieldKeys?.memoryFile ? (item as any)[subFieldKeys.memoryFile] : undefined) ||
            (item as any)[FLOW_MEMORY_SUBFIELD_NAMES.memoryFile] ||
            (item as any).memoryFile ||
            ''
        ).trim();

      if (!nodeId && !nodeName) {
        return null;
      }

      return { nodeId, nodeName, memoryFile };
    })
    .filter((item): item is WorkflowMemoryEntry => Boolean(item));
}

function findWorkflowMemoryEntryIndex(
  entries: WorkflowMemoryEntry[],
  target: WorkflowMemoryEntry,
  preferLast = false
): number {
  const matchedIndexes = entries.reduce<number[]>((bucket, entry, index) => {
    const sameNodeId = target.nodeId && entry.nodeId === target.nodeId;
    const sameNodeName = target.nodeName && entry.nodeName === target.nodeName;

    if (sameNodeId || sameNodeName) {
      bucket.push(index);
    }

    return bucket;
  }, []);

  if (matchedIndexes.length === 0) {
    return -1;
  }

  return preferLast ? matchedIndexes[matchedIndexes.length - 1] : matchedIndexes[0];
}

function serializeMemoryEntries(
  entries: WorkflowMemoryEntry[],
  subFieldKeys?: WorkflowMemoryFieldDefinition['subFieldKeys']
) {
  return entries.map((entry) => ({
    [subFieldKeys?.nodeId || FLOW_MEMORY_SUBFIELD_NAMES.nodeId]: entry.nodeId,
    [subFieldKeys?.nodeName || FLOW_MEMORY_SUBFIELD_NAMES.nodeName]: entry.nodeName,
    [subFieldKeys?.memoryFile || FLOW_MEMORY_SUBFIELD_NAMES.memoryFile]: entry.memoryFile,
  }));
}

async function queryWorkItemRecord(spaceId: string, workObjectId: string, workItemId: string) {
  const mcpClient = new MCPClient();
  const headers = await mcpClient.getAuthHeaders();

  const response = await fetch(`${API_CONFIG.proxyUrl}/api/work-items/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      work_item_ids: [Number(workItemId)],
      space_id: spaceId,
      work_object_id: workObjectId,
      need_group_uuid_for_compound: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`工作项查询失败: ${response.status}`);
  }

  return response.json();
}

async function queryWorkflowTemplate(spaceId: string, workObjectId: string, workItemId: string) {
  const mcpClient = new MCPClient();
  const headers = await mcpClient.getAuthHeaders();

  const response = await fetch(`${API_CONFIG.proxyUrl}/api/workflow/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      spaceId,
      workObjectId,
      activeWorkItemId: workItemId,
      query_type: 'running_nodes',
      include_skills: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`流程模板查询失败: ${response.status}`);
  }

  return response.json();
}

async function queryFieldDefinitions(projectKey: string) {
  const mcpClient = new MCPClient();
  const headers = await mcpClient.getAuthHeaders();

  const response = await fetch(`${API_CONFIG.proxyUrl}/api/fields/all`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      project_key: projectKey,
    }),
  });

  if (!response.ok) {
    throw new Error(`字段定义查询失败: ${response.status}`);
  }

  return response.json();
}

function flattenFieldDefinitions(
  input: any,
  bucket: Array<{ fieldKey: string; fieldName?: string; fieldAlias?: string; raw: any }>
) {
  if (!input || typeof input !== 'object') {
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((item) => flattenFieldDefinitions(item, bucket));
    return;
  }

  if (typeof input.field_key === 'string') {
    bucket.push({
      fieldKey: input.field_key,
      fieldName: typeof input.field_name === 'string' ? input.field_name : undefined,
      fieldAlias: typeof input.field_alias === 'string' ? input.field_alias : undefined,
      raw: input,
    });
  }

  Object.values(input).forEach((value) => flattenFieldDefinitions(value, bucket));
}

function resolveSubFieldKeys(fieldDefinition: any): WorkflowMemoryFieldDefinition['subFieldKeys'] {
  const flattened: Array<{ fieldKey: string; fieldName?: string; fieldAlias?: string; raw: any }> = [];
  flattenFieldDefinitions(fieldDefinition, flattened);

  const resolveFieldKey = (targetName: string) => {
    const matched = flattened.find(
      (item) =>
        normalizeFieldLabel(item.fieldName) === normalizeFieldLabel(targetName) ||
        normalizeFieldLabel(item.fieldAlias) === normalizeFieldLabel(targetName) ||
        normalizeFieldLabel(item.fieldKey) === normalizeFieldLabel(targetName)
    );
    return matched?.fieldKey || null;
  };

  const nodeId = resolveFieldKey(FLOW_MEMORY_SUBFIELD_NAMES.nodeId);
  const nodeName = resolveFieldKey(FLOW_MEMORY_SUBFIELD_NAMES.nodeName);
  const memoryFile = resolveFieldKey(FLOW_MEMORY_SUBFIELD_NAMES.memoryFile);

  if (!nodeId || !nodeName || !memoryFile) {
    return null;
  }

  return { nodeId, nodeName, memoryFile };
}

function resolveSubFieldTypeKeys(fieldDefinition: any): WorkflowMemoryFieldDefinition['subFieldTypeKeys'] {
  const flattened: Array<{ fieldKey: string; fieldName?: string; fieldAlias?: string; raw: any }> = [];
  flattenFieldDefinitions(fieldDefinition, flattened);

  const resolveTypeKey = (targetName: string, fallback: string) => {
    const matched = flattened.find(
      (item) =>
        normalizeFieldLabel(item.fieldName) === normalizeFieldLabel(targetName) ||
        normalizeFieldLabel(item.fieldAlias) === normalizeFieldLabel(targetName) ||
        normalizeFieldLabel(item.fieldKey) === normalizeFieldLabel(targetName)
    );
    return matched?.raw?.field_type_key || fallback;
  };

  return {
    nodeId: resolveTypeKey(FLOW_MEMORY_SUBFIELD_NAMES.nodeId, 'text'),
    nodeName: resolveTypeKey(FLOW_MEMORY_SUBFIELD_NAMES.nodeName, 'text'),
    memoryFile: resolveTypeKey(FLOW_MEMORY_SUBFIELD_NAMES.memoryFile, 'multi_file'),
  };
}

function isAttachmentField(rawField: any): boolean {
  if (!rawField || typeof rawField !== 'object') {
    return false;
  }

  const normalized = JSON.stringify(rawField).toLowerCase();
  return (
    normalized.includes('attachment') ||
    normalized.includes('multi_file') ||
    normalized.includes('"file"')
  );
}

function resolveAttachmentSubFieldKeys(fieldDefinition: any): WorkflowMemoryFieldDefinition['subFieldAttachmentKeys'] {
  const flattened: Array<{ fieldKey: string; fieldName?: string; fieldAlias?: string; raw: any }> = [];
  flattenFieldDefinitions(fieldDefinition, flattened);

  const matched = flattened.find(
    (item) =>
      (normalizeFieldLabel(item.fieldName) === normalizeFieldLabel(FLOW_MEMORY_SUBFIELD_NAMES.memoryFile) ||
        normalizeFieldLabel(item.fieldAlias) === normalizeFieldLabel(FLOW_MEMORY_SUBFIELD_NAMES.memoryFile) ||
        normalizeFieldLabel(item.fieldKey) === normalizeFieldLabel(FLOW_MEMORY_SUBFIELD_NAMES.memoryFile)) &&
      isAttachmentField(item.raw)
  );

  if (!matched) {
    return null;
  }

  return { memoryFile: matched.fieldKey };
}

function findFlowMemoryFieldDefinition(fieldDefinitions: any): WorkflowMemoryFieldDefinition | null {
  const flattened: Array<{ fieldKey: string; fieldName?: string; fieldAlias?: string; raw: any }> = [];
  flattenFieldDefinitions(fieldDefinitions, flattened);

  const matched =
    flattened.find((item) => normalizeFieldLabel(item.fieldName) === FLOW_MEMORY_FIELD_NAME) ||
    flattened.find((item) => normalizeFieldLabel(item.fieldAlias) === FLOW_MEMORY_FIELD_NAME) ||
    flattened.find((item) => normalizeFieldLabel(item.fieldKey) === FLOW_MEMORY_FIELD_NAME);

  if (!matched) {
    return null;
  }

  return {
    fieldKey: matched.fieldKey,
    fieldName: matched.fieldName,
    fieldAlias: matched.fieldAlias,
    subFieldKeys: resolveSubFieldKeys(matched.raw),
    subFieldAttachmentKeys: resolveAttachmentSubFieldKeys(matched.raw),
    subFieldTypeKeys: resolveSubFieldTypeKeys(matched.raw),
  };
}

function parseRawMemoryEntries(fieldValue: unknown): any[] {
  if (!fieldValue) {
    return [];
  }

  if (Array.isArray(fieldValue)) {
    return fieldValue.map((item) => {
      if (Array.isArray(item)) {
        return item.map((cell) => (cell && typeof cell === 'object' ? { ...cell } : cell));
      }

      return item && typeof item === 'object' ? { ...item } : item;
    });
  }

  if (typeof fieldValue === 'string') {
    try {
      const parsed = JSON.parse(fieldValue);
      return Array.isArray(parsed)
        ? parsed.map((item) => {
            if (Array.isArray(item)) {
              return item.map((cell) => (cell && typeof cell === 'object' ? { ...cell } : cell));
            }

            return item && typeof item === 'object' ? { ...item } : item;
          })
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

function getRawRowCell(row: any, fieldKey: string) {
  if (!Array.isArray(row)) {
    return null;
  }

  return row.find((item) => item && typeof item === 'object' && item.field_key === fieldKey) || null;
}

function getRawRowAttachmentNames(row: any, fieldKey: string): string[] {
  const cell = getRawRowCell(row, fieldKey);
  if (!Array.isArray(cell?.field_value)) {
    return [];
  }

  return cell.field_value
    .map((item: any) => (typeof item?.name === 'string' ? item.name.trim() : ''))
    .filter(Boolean);
}

function findMatchingEntryIndexes(entries: WorkflowMemoryEntry[], target: WorkflowMemoryEntry): number[] {
  return entries.reduce<number[]>((bucket, entry, index) => {
    const sameNodeId = target.nodeId && entry.nodeId === target.nodeId;
    const sameNodeName = target.nodeName && entry.nodeName === target.nodeName;

    if (sameNodeId || sameNodeName) {
      bucket.push(index);
    }

    return bucket;
  }, []);
}

function buildCompoundFieldRow(params: {
  entry: WorkflowMemoryEntry;
  subFieldKeys?: WorkflowMemoryFieldDefinition['subFieldKeys'];
  subFieldTypeKeys?: WorkflowMemoryFieldDefinition['subFieldTypeKeys'];
  includeMemoryText: boolean;
}) {
  const { entry, subFieldKeys, subFieldTypeKeys, includeMemoryText } = params;
  const row = [
    {
      field_key: subFieldKeys?.nodeId || FLOW_MEMORY_SUBFIELD_NAMES.nodeId,
      field_value: entry.nodeId,
      field_type_key: subFieldTypeKeys?.nodeId || 'text',
      field_alias: '',
    },
    {
      field_key: subFieldKeys?.nodeName || FLOW_MEMORY_SUBFIELD_NAMES.nodeName,
      field_value: entry.nodeName,
      field_type_key: subFieldTypeKeys?.nodeName || 'text',
      field_alias: '',
    },
  ];

  if (includeMemoryText) {
    row.push({
      field_key: subFieldKeys?.memoryFile || FLOW_MEMORY_SUBFIELD_NAMES.memoryFile,
      field_value: entry.memoryFile,
      field_type_key: subFieldTypeKeys?.memoryFile || 'multi_file',
      field_alias: '',
    });
  }

  return row;
}

function buildWorkflowMemoryFieldValue(params: {
  currentRawEntries: any[];
  currentEntries: WorkflowMemoryEntry[];
  entry: WorkflowMemoryEntry;
  subFieldKeys?: WorkflowMemoryFieldDefinition['subFieldKeys'];
  includeMemoryText: boolean;
}): { fieldValue: any[]; index: number; entryCount: number } {
  const { currentRawEntries, currentEntries, entry, subFieldKeys, includeMemoryText } = params;
  const nextRawEntries = [...currentRawEntries];
  const matchedIndex = currentEntries.findIndex(
    (item) => item.nodeId === entry.nodeId || item.nodeName === entry.nodeName
  );
  const targetIndex = matchedIndex >= 0 ? matchedIndex : nextRawEntries.length;
  const currentRawEntry =
    nextRawEntries[targetIndex] && typeof nextRawEntries[targetIndex] === 'object'
      ? { ...nextRawEntries[targetIndex] }
      : {};

  currentRawEntry[subFieldKeys?.nodeId || FLOW_MEMORY_SUBFIELD_NAMES.nodeId] = entry.nodeId;
  currentRawEntry[subFieldKeys?.nodeName || FLOW_MEMORY_SUBFIELD_NAMES.nodeName] = entry.nodeName;

  if (includeMemoryText) {
    currentRawEntry[subFieldKeys?.memoryFile || FLOW_MEMORY_SUBFIELD_NAMES.memoryFile] = entry.memoryFile;
  }

  nextRawEntries[targetIndex] = currentRawEntry;
  return {
    fieldValue: nextRawEntries,
    index: targetIndex,
    entryCount: nextRawEntries.length,
  };
}

async function uploadWorkflowMemoryAttachment(params: {
  spaceId: string;
  workObjectId: string;
  workItemId: string;
  fieldKey: string;
  index: number;
  fileName: string;
  content: string;
}) {
  const mcpClient = new MCPClient();
  const authHeaders = await mcpClient.getAuthHeaders();
  const headers: Record<string, string> = {};

  Object.entries(authHeaders).forEach(([key, value]) => {
    if (key.toLowerCase() !== 'content-type') {
      headers[key] = value;
    }
  });

  const normalizedFileName = params.fileName.endsWith('.md')
    ? params.fileName
    : `${params.fileName}.md`;

  const formData = new FormData();
  const blob = new Blob([params.content], { type: 'text/markdown;charset=utf-8' });
  formData.append('file', blob, normalizedFileName);
  formData.append('field_key', params.fieldKey);
  formData.append('index', String(params.index));

  const response = await fetch(
    `${API_CONFIG.proxyUrl}/api/work-items/file/upload?space_id=${encodeURIComponent(params.spaceId)}&work_item_type=${encodeURIComponent(params.workObjectId)}&work_item_id=${encodeURIComponent(params.workItemId)}`,
    {
      method: 'POST',
      headers,
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`流程记忆附件上传失败: ${response.status} ${errorText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

function findPredecessorNodes(
  currentNode: WorkflowNodeInfo,
  workflowData: any
): Array<{ nodeId: string; nodeName: string }> {
  const workflowNodes = Array.isArray(workflowData?.data?.workflow_nodes)
    ? workflowData.data.workflow_nodes
    : Array.isArray(workflowData?.data?.nodes)
      ? workflowData.data.nodes
      : [];
  const connections = Array.isArray(workflowData?.data?.connections)
    ? workflowData.data.connections as WorkflowConnection[]
    : [];

  const targetKeys = new Set([currentNode.id, currentNode.state_key].filter(Boolean));
  const predecessorKeys = connections
    .filter((connection) => targetKeys.has(connection.target_state_key))
    .map((connection) => connection.source_state_key);

  return predecessorKeys
    .map((key) => {
      const matchedNode = workflowNodes.find((node: any) => node.id === key || node.state_key === key);
      return {
        nodeId: matchedNode?.id || matchedNode?.state_key || key,
        nodeName: matchedNode?.name || key,
      };
    })
    .filter((item, index, array) => array.findIndex((candidate) => candidate.nodeId === item.nodeId) === index);
}

export async function loadPredecessorNodeMemories(params: {
  spaceId: string;
  workObjectId: string;
  workItemId: string;
  currentNode: WorkflowNodeInfo;
}): Promise<WorkflowMemoryEntry[]> {
  const { spaceId, workObjectId, workItemId, currentNode } = params;
  const [workItemResult, workflowResult, fieldDefinitions] = await Promise.all([
    queryWorkItemRecord(spaceId, workObjectId, workItemId),
    queryWorkflowTemplate(spaceId, workObjectId, workItemId),
    queryFieldDefinitions(spaceId),
  ]);

  const workItem = normalizeWorkItemRecord(workItemResult);
  const memoryFieldDefinition = findFlowMemoryFieldDefinition(fieldDefinitions);
  const memoryField = findFlowMemoryField(workItem, memoryFieldDefinition?.fieldKey);
  const allEntries = normalizeMemoryEntries(memoryField?.fieldValue, memoryFieldDefinition?.subFieldKeys);
  const predecessorNodes = findPredecessorNodes(currentNode, workflowResult);
  const predecessorNodeKeys = new Set(predecessorNodes.map((item) => item.nodeId));
  const predecessorNodeNames = new Set(predecessorNodes.map((item) => item.nodeName));

  return allEntries.filter(
    (entry) => predecessorNodeKeys.has(entry.nodeId) || predecessorNodeNames.has(entry.nodeName)
  );
}

export async function appendWorkflowMemoryEntry(params: {
  spaceId: string;
  workObjectId: string;
  workItemId: string;
  entry: WorkflowMemoryEntry;
  attachmentFile?: {
    fileName: string;
    content: string;
  };
}): Promise<{ fieldKey: string; entryCount: number; uploadedAsAttachment: boolean }> {
  const { spaceId, workObjectId, workItemId, entry } = params;
  const [workItemResult, fieldDefinitions] = await Promise.all([
    queryWorkItemRecord(spaceId, workObjectId, workItemId),
    queryFieldDefinitions(spaceId),
  ]);
  const workItem = normalizeWorkItemRecord(workItemResult);
  const memoryFieldDefinition = findFlowMemoryFieldDefinition(fieldDefinitions);
  const memoryField = findFlowMemoryField(workItem, memoryFieldDefinition?.fieldKey);
  const fieldKey = memoryFieldDefinition?.fieldKey || memoryField?.fieldKey;

  if (!fieldKey) {
    throw new Error('未找到复合字段「流程记忆」');
  }

  const currentEntries = normalizeMemoryEntries(memoryField?.fieldValue, memoryFieldDefinition?.subFieldKeys);
  const currentRawEntries = parseRawMemoryEntries(memoryField?.fieldValue);
  const shouldUploadAttachment =
    Boolean(params.attachmentFile?.content) && Boolean(memoryFieldDefinition?.subFieldAttachmentKeys?.memoryFile);
  const normalizedEntry: WorkflowMemoryEntry = shouldUploadAttachment && params.attachmentFile
    ? {
        ...entry,
        memoryFile: params.attachmentFile.fileName.endsWith('.md')
          ? params.attachmentFile.fileName
          : `${params.attachmentFile.fileName}.md`,
      }
    : entry;
  const matchedIndexes = findMatchingEntryIndexes(currentEntries, normalizedEntry);
  const matchedIndex = matchedIndexes.length > 0 ? matchedIndexes[matchedIndexes.length - 1] : -1;
  const rawMatchedEntry =
    matchedIndex >= 0 && currentRawEntries[matchedIndex] && typeof currentRawEntries[matchedIndex] === 'object'
      ? currentRawEntries[matchedIndex]
      : null;
  const persistedGroupUuid = readPersistedGroupUuid({
    spaceId,
    workObjectId,
    workItemId,
    fieldKey,
    nodeId: normalizedEntry.nodeId,
    nodeName: normalizedEntry.nodeName,
  });
  const groupUuid = persistedGroupUuid || extractGroupUuidFromRawEntry(rawMatchedEntry);

  if (groupUuid) {
    persistGroupUuid({
      spaceId,
      workObjectId,
      workItemId,
      fieldKey,
      nodeId: normalizedEntry.nodeId,
      nodeName: normalizedEntry.nodeName,
      groupUuid,
    });
  }

  const normalizedAttachmentFileName =
    shouldUploadAttachment && params.attachmentFile
      ? (params.attachmentFile.fileName.endsWith('.md')
          ? params.attachmentFile.fileName
          : `${params.attachmentFile.fileName}.md`)
      : null;

  if (
    shouldUploadAttachment &&
    normalizedAttachmentFileName &&
    matchedIndex >= 0 &&
    memoryFieldDefinition?.subFieldAttachmentKeys?.memoryFile
  ) {
    const existingAttachmentNames = getRawRowAttachmentNames(
      rawMatchedEntry,
      memoryFieldDefinition.subFieldAttachmentKeys.memoryFile
    );

    if (existingAttachmentNames.includes(normalizedAttachmentFileName)) {
      return {
        fieldKey,
        entryCount: currentEntries.length,
        uploadedAsAttachment: true,
      };
    }
  }

  const mcpClient = new MCPClient();
  const headers = await mcpClient.getAuthHeaders();
  const compoundRow = buildCompoundFieldRow({
    entry: normalizedEntry,
    subFieldKeys: memoryFieldDefinition?.subFieldKeys,
    subFieldTypeKeys: memoryFieldDefinition?.subFieldTypeKeys,
    includeMemoryText: !shouldUploadAttachment,
  });
  const shouldUpdateExistingGroup = Boolean(groupUuid);
  const shouldReuseExistingRowWithoutGroupUuid =
    !shouldUpdateExistingGroup && shouldUploadAttachment && matchedIndex >= 0;
  const compoundRequestBody = {
    project_key: spaceId,
    work_item_id: Number(workItemId),
    field_key: fieldKey,
    action: shouldUpdateExistingGroup ? 'update' : 'add',
    ...(shouldUpdateExistingGroup ? { group_uuid: groupUuid } : {}),
    fields: shouldUpdateExistingGroup ? compoundRow : [compoundRow],
  };

  let responsePayload: any = null;
  let activeGroupUuid = groupUuid;

  if (!shouldReuseExistingRowWithoutGroupUuid) {
    const response = await fetch(`${API_CONFIG.proxyUrl}/api/work-items/update-compound-field`, {
      method: 'POST',
      headers,
      body: JSON.stringify(compoundRequestBody),
    });

    const responseText = await response.text();

    try {
      responsePayload = responseText ? JSON.parse(responseText) : null;
    } catch {
      responsePayload = null;
    }

    if (!response.ok) {
      const errorText = responseText || 'Unknown error';
      throw new Error(`流程记忆复合字段写回失败: ${response.status} ${errorText}`);
    }

    const returnedGroupUuid = extractGroupUuidDeep(responsePayload);
    activeGroupUuid = returnedGroupUuid || groupUuid;
  }

  if (activeGroupUuid) {
    persistGroupUuid({
      spaceId,
      workObjectId,
      workItemId,
      fieldKey,
      nodeId: normalizedEntry.nodeId,
      nodeName: normalizedEntry.nodeName,
      groupUuid: activeGroupUuid,
    });
  }

  if (shouldUploadAttachment && params.attachmentFile) {
    const latestWorkItemResult = await queryWorkItemRecord(spaceId, workObjectId, workItemId);
    const latestWorkItem = normalizeWorkItemRecord(latestWorkItemResult);
    const latestMemoryField = findFlowMemoryField(latestWorkItem, memoryFieldDefinition?.fieldKey);
    const latestEntries = normalizeMemoryEntries(latestMemoryField?.fieldValue, memoryFieldDefinition?.subFieldKeys);
    const latestRawEntries = parseRawMemoryEntries(latestMemoryField?.fieldValue);
    const latestPersistedGroupUuid = readPersistedGroupUuid({
      spaceId,
      workObjectId,
      workItemId,
      fieldKey,
      nodeId: normalizedEntry.nodeId,
      nodeName: normalizedEntry.nodeName,
    });
    const resolvedGroupUuid = latestPersistedGroupUuid || activeGroupUuid;
    const resolvedByGroupUuid =
      resolvedGroupUuid
        ? latestRawEntries.findIndex((rawEntry) => extractGroupUuidFromRawEntry(rawEntry) === resolvedGroupUuid)
        : -1;
    const resolvedIndex = findWorkflowMemoryEntryIndex(
      latestEntries,
      normalizedEntry,
      !shouldUpdateExistingGroup
    );
    const targetIndex =
      resolvedByGroupUuid >= 0
        ? resolvedByGroupUuid
        : shouldReuseExistingRowWithoutGroupUuid && matchedIndex >= 0
          ? matchedIndex
          : resolvedIndex;

    if (targetIndex < 0) {
      throw new Error('流程记忆行已写入，但未能定位新建的复合字段分组，无法上传记忆文件附件');
    }

    const latestRawEntry =
      latestRawEntries[targetIndex] && typeof latestRawEntries[targetIndex] === 'object'
        ? latestRawEntries[targetIndex]
        : null;
    const latestGroupUuid = extractGroupUuidFromRawEntry(latestRawEntry);

    if (latestGroupUuid) {
      persistGroupUuid({
        spaceId,
        workObjectId,
        workItemId,
        fieldKey,
        nodeId: normalizedEntry.nodeId,
        nodeName: normalizedEntry.nodeName,
        groupUuid: latestGroupUuid,
      });
    }

    await uploadWorkflowMemoryAttachment({
      spaceId,
      workObjectId,
      workItemId,
      fieldKey: memoryFieldDefinition!.subFieldAttachmentKeys!.memoryFile,
      index: targetIndex,
      fileName: params.attachmentFile.fileName,
      content: params.attachmentFile.content,
    });
  }

  return {
    fieldKey,
    entryCount: matchedIndex >= 0 ? currentEntries.length : currentEntries.length + 1,
    uploadedAsAttachment: shouldUploadAttachment,
  };
}

export async function operateWorkflowNode(params: {
  projectKey: string;
  workItemTypeKey: string;
  workItemId: string;
  nodeId: string;
  action?: string;
  rollbackReason?: string;
  nodeOwners?: string[];
  nodeSchedule?: Record<string, unknown>;
  schedules?: Array<Record<string, unknown>>;
  fields?: Array<Record<string, unknown>>;
  roleAssignee?: Array<Record<string, unknown>>;
}): Promise<any> {
  const mcpClient = new MCPClient();
  const headers = await mcpClient.getAuthHeaders();

  const response = await fetch(`${API_CONFIG.proxyUrl}/api/workflow/node/operate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      project_key: params.projectKey,
      work_item_type_key: params.workItemTypeKey,
      work_item_id: params.workItemId,
      node_id: params.nodeId,
      action: params.action,
      rollback_reason: params.rollbackReason,
      node_owners: params.nodeOwners,
      node_schedule: params.nodeSchedule,
      schedules: params.schedules,
      fields: params.fields,
      role_assignee: params.roleAssignee,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`节点完成接口调用失败: ${response.status} ${errorText}`);
  }

  return response.json();
}
