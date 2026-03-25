import { API_CONFIG } from '../constants';

export interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: 'tools/call';
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: {
    content: Array<{
      type: 'text';
      text: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface WorkItem {
  id: string;
  name: string;
  type: string;
  status?: string;
  priority?: string;
  assignee?: string;
  description?: string;
  schedule?: [number, number];
}

export interface AIInsight {
  type: 'summary' | 'suggestion' | 'risk' | 'dependency' | 'status';
  title: string;
  content: string;
  confidence: number;
  action?: {
    label: string;
    handler: () => void;
  };
}

export interface AIRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: 'on_create' | 'on_update' | 'on_comment' | 'on_schedule';
  actions: string[];
}

export class MCPClient {
  private userKey: string;

  constructor(userKey?: string) {
    this.userKey = userKey || API_CONFIG.defaultUserKey;
  }

  setUserKey(userKey: string) {
    this.userKey = userKey;
  }

  async callTool<T = unknown>(toolName: string, arguments_: Record<string, unknown>): Promise<T> {
    const url = `${API_CONFIG.mcpUrl}?mcpKey=${API_CONFIG.mcpKey}&userKey=${this.userKey}`;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: arguments_,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`MCP API error: ${response.status}`);
    }

    const data: MCPResponse = await response.json();
    if (data.error) {
      throw new Error(`MCP Error: ${data.error.message}`);
    }

    if (data.result?.content?.[0]?.text) {
      return JSON.parse(data.result.content[0].text) as T;
    }

    return {} as T;
  }

  async getWorkItemBrief(workItemId: string, workItemType: string) {
    return this.callTool<{
      data?: {
        work_item_id: string;
        title: string;
        status: string;
        [key: string]: unknown;
      };
    }>('get_workitem_brief', {
      project_key: API_CONFIG.projectKey,
      work_item_id: workItemId,
      work_item_type: workItemType,
    });
  }

  async listWorkItems(workItemType: string, filters?: Array<{ field_key: string; operator: string; field_value: unknown }>, pageSize = 20) {
    return this.callTool<{
      data?: {
        items: Array<{
          work_item_id: string;
          title: string;
          status: string;
          [key: string]: unknown;
        }>;
        total: number;
      };
    }>('list_workitems', {
      project_key: API_CONFIG.projectKey,
      work_item_type: workItemType,
      filters: filters || [],
      page_size: pageSize,
      page_num: 1,
    });
  }

  async getTransitableStates(workItemId: string, workItemType: string) {
    return this.callTool<{
      data?: {
        states: Array<{
          state_key: string;
          state_name: string;
        }>;
      };
    }>('get_transitable_states', {
      project_key: API_CONFIG.projectKey,
      work_item_id: workItemId,
      work_item_type: workItemType,
      user_key: this.userKey,
    });
  }

  async listWorkItemComments(workItemId: string) {
    return this.callTool<{
      data?: {
        comments: Array<{
          comment_id: string;
          content: string;
          create_time: number;
          user_key: string;
        }>;
      };
    }>('list_workitem_comments', {
      project_key: API_CONFIG.projectKey,
      work_item_id: workItemId,
      page_num: 1,
    });
  }

  async addComment(workItemId: string, content: string) {
    return this.callTool('add_comment', {
      project_key: API_CONFIG.projectKey,
      work_item_id: workItemId,
      comment_content: content,
    });
  }

  async listRelatedWorkItems(workItemId: string, workItemType: string, relationKey: string) {
    return this.callTool<{
      data?: {
        items: Array<{
          work_item_id: string;
          title: string;
        }>;
      };
    }>('list_related_workitems', {
      project_key: API_CONFIG.projectKey,
      work_item_id: workItemId,
      work_item_type: workItemType,
      relation_key: relationKey,
      relation_work_item_type_key: workItemType,
      relation_type: 1,
    });
  }

  async getWorkItemOpRecord(workItemId: string) {
    return this.callTool<{
      data?: {
        records: Array<{
          operation_type: string;
          operator: string;
          create_time: number;
          detail: string;
        }>;
      };
    }>('get_workitem_op_record', {
      project_key: API_CONFIG.projectKey,
      work_item_id: [workItemId],
      page_num: 1,
    });
  }

  async listTeamMembers() {
    return this.callTool<{
      data?: {
        members: Array<{
          user_key: string;
          name: string;
          avatar?: string;
        }>;
      };
    }>('list_team_members', {
      project_key: API_CONFIG.projectKey,
      team_id: '',
    });
  }

  async updateWorkItemFields(workItemId: string, workItemType: string, fields: Array<{ field_key: string; field_value: unknown }>) {
    return this.callTool('update_workitem_fields', {
      project_key: API_CONFIG.projectKey,
      work_item_id: workItemId,
      work_item_type: workItemType,
      fields,
    });
  }
}

export const mcpClient = new MCPClient();
