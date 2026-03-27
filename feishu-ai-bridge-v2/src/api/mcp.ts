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
  private userToken: string | null = null;

  constructor(userKey?: string) {
    this.userKey = userKey || API_CONFIG.defaultUserKey;
  }

  setUserKey(userKey: string) {
    this.userKey = userKey;
  }

  /**
   * 获取用户访问令牌
   * 调用飞书认证API获取真正的user_token
   */
  async getUserToken(): Promise<string> {
    if (this.userToken) {
      return this.userToken;
    }

    try {
      console.log('[认证] 开始获取用户访问令牌...');

      // 通过后端代理调用认证API获取token
      const authUrl = `${API_CONFIG.proxyUrl}/api/auth/plugin-token`;
      const authBody = {
        plugin_id: API_CONFIG.pluginId,
        plugin_secret: API_CONFIG.pluginSecret,
        type: 0
      };

      console.log('[认证] 调用认证API:', authUrl);
      console.log('[认证] 认证参数:', {
        plugin_id: API_CONFIG.pluginId,
        user_key: this.userKey,
        plugin_secret: '***'
      });

      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(authBody)
      });

      console.log('[认证] API响应状态:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[认证] API错误响应:', errorText);

        // 如果认证API失败，回退到直接使用pluginSecret
        console.warn('[认证] 认证API失败，使用pluginSecret作为fallback');
        this.userToken = API_CONFIG.pluginSecret;
        return this.userToken;
      }

      const authData = await response.json();
      console.log('[认证] 认证响应:', authData);

      if (authData.data?.token || authData.access_token || authData.token || authData.user_token) {
        this.userToken = authData.data?.token || authData.access_token || authData.token || authData.user_token;
        console.log('[认证] ✅ 获取用户token成功:', this.userToken.substring(0, 20) + '...');
        return this.userToken;
      } else {
        throw new Error('认证响应中未找到token');
      }

    } catch (error) {
      console.error('[认证] 获取用户token失败:', error);

      // 错误处理：使用pluginSecret作为fallback
      console.warn('[认证] 使用pluginSecret作为fallback token');
      this.userToken = API_CONFIG.pluginSecret;
      return this.userToken;
    }
  }

  /**
   * 获取API请求的认证头
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const userToken = await this.getUserToken();
    return {
      'x-plugin-token': userToken,      // 使用小写，匹配API服务器期望的格式
      'x-user-key': this.userKey,       // 使用小写，匹配API服务器期望的格式
      'Content-Type': 'application/json'
    };
  }

  async callTool<T = unknown>(toolName: string, arguments_: Record<string, unknown>): Promise<T> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: arguments_,
      },
    };

    console.log(`[MCP] 调用工具: ${toolName}`);
    console.log(`[MCP] 请求参数:`, arguments_);
    console.log(`[MCP] 完整请求:`, request);

    try {
      // 使用API服务器代理MCP请求
      const proxyUrl = `${API_CONFIG.proxyUrl}/api/mcp/proxy`;
      const proxyRequestBody = {
        mcpUrl: API_CONFIG.mcpUrl,
        mcpKey: API_CONFIG.mcpKey,
        userKey: this.userKey,
        mcpRequest: request
      };

      console.log(`[MCP] 通过代理服务器调用: ${proxyUrl}`);
      console.log(`[MCP] 代理请求体:`, proxyRequestBody);

      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proxyRequestBody),
      });

      console.log(`[MCP] HTTP 状态码: ${response.status}`);
      console.log(`[MCP] 响应头:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MCP] HTTP 错误响应:`, errorText);
        throw new Error(`MCP API error: ${response.status} - ${errorText}`);
      }

      const data: MCPResponse = await response.json();
      console.log(`[MCP] 响应数据:`, data);

      if (data.error) {
        console.error(`[MCP] API 返回错误:`, data.error);
        throw new Error(`MCP Error: ${data.error.code} - ${data.error.message}`);
      }

      if (data.result?.content?.[0]?.text) {
        const parsedResult = JSON.parse(data.result.content[0].text) as T;
        console.log(`[MCP] 解析后的结果:`, parsedResult);
        return parsedResult;
      }

      console.warn(`[MCP] 响应中没有找到预期的内容结构:`, data);
      return {} as T;

    } catch (error) {
      console.error(`[MCP] 调用失败:`, error);
      if (error instanceof Error) {
        console.error(`[MCP] 错误详情:`, {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      throw error;
    }
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

  /**
   * 通过MCP查询工作流节点信息
   */
  async getWorkflowNodes(spaceId: string, workObjectId: string, workItemId: string) {
    return this.callTool<{
      code?: number;
      message?: string;
      data?: {
        workflow_nodes?: Array<{
          id: string;
          name: string;
          state_key: string;
          status: number;
          description?: string;
          gstack_skills?: string[];
          created_time?: string;
          updated_time?: string;
        }>;
        current_nodes?: Array<{
          id: string;
          name: string;
          state_key: string;
          status: number;
          description?: string;
        }>;
        running_nodes?: Array<{
          id: string;
          name: string;
          state_key: string;
          status: number;
          description?: string;
        }>;
      };
    }>('query_workflow_nodes', {
      project_key: API_CONFIG.projectKey,
      space_id: spaceId,
      work_object_id: workObjectId,
      work_item_id: workItemId,
      query_type: 'running_nodes',
      include_skills: true
    });
  }

  /**
   * 获取工作流节点信息
   * 分两步调用：1. 查询工作项获取模板ID  2. 查询模板详情获取节点
   */
  async getWorkflowNodes(spaceId: string, workObjectId: string, activeWorkItemId: string | number) {
    console.log('[工作流查询] 开始两步查询流程');
    console.log('[工作流查询] 参数:', {
      spaceId: spaceId,                    // 空间ID
      workObjectId: workObjectId,          // 工作项类型ID
      activeWorkItemId: activeWorkItemId   // 实例ID
    });

    try {
      // 确保获取有效的用户token
      await this.getUserToken();
      console.log('[工作流查询] 已获取用户token');

      // 第一步：查询工作项获取模板ID
      console.log('[步骤1] 查询工作项信息获取模板ID');

      // 使用完整URL：基础域名 + API路径
      const step1Path = `https://${API_CONFIG.siteDomain}/open_api/${spaceId}/work_item/${workObjectId}/query`;

      // 处理大整数精度问题：保持字符串格式到最后一刻
      let workItemId: number;
      if (typeof activeWorkItemId === 'string') {
        // 确保字符串转数字时没有精度丢失
        workItemId = parseInt(activeWorkItemId);
        console.log('[步骤1] ID转换检查:', {
          原始字符串: activeWorkItemId,
          转换后数字: workItemId,
          转换正确: workItemId.toString() === activeWorkItemId
        });
      } else {
        workItemId = activeWorkItemId;
      }

      const step1Body = {
        "work_item_ids": [workItemId],
        "space_id": spaceId,  // 添加动态的spaceId
        "work_object_id": workObjectId  // 添加工作项类型ID
      };

      console.log('[步骤1] 接口路径:', step1Path);
      console.log('[步骤1] 请求体:', step1Body);

      // 尝试通过 MCP 调用第一步
      let templateId: number | undefined;
      try {
        const step1Result = await this.callTool<{
          data?: {
            items?: Array<{
              template_id?: number;
              [key: string]: any;
            }>;
          };
        }>('work_item_query', {
          space_id: spaceId,  // 使用动态spaceId
          work_object_id: workObjectId,  // 使用传入的工作项类型ID
          work_item_ids: [workItemId]  // 使用处理过的workItemId
        });

        console.log('[步骤1] MCP 响应:', step1Result);

        templateId = step1Result?.data?.items?.[0]?.template_id;
        if (!templateId) {
          console.warn('[步骤1] 未从 MCP 响应中获取到 template_id');
        }

      } catch (mcpError) {
        console.warn('[步骤1] MCP 调用失败，尝试直接调用 API:', mcpError);

        // 通过认证的直接 API 调用
        try {
          // 使用后端代理服务器而非直接调用飞书API
          const apiUrl = `${API_CONFIG.proxyUrl}/api/work-items/query`;
          console.log('[步骤1] 通过后端代理服务器调用API:', apiUrl);

          // 获取认证头
          const authHeaders = await this.getAuthHeaders();
          console.log('[步骤1] 使用认证头:', Object.keys(authHeaders));

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(step1Body)
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[步骤1] API 错误响应:', errorText);
            console.error('[步骤1] 请求详情:', {
              path: step1Path,
              body: step1Body,
              headers: {
                'Content-Type': 'application/json'
              }
            });
            throw new Error(`Step1 API error: ${response.status} - ${errorText}`);
          }

          const step1Data = await response.json();
          console.log('[步骤1] API 响应数据:', step1Data);

          // 从API响应中提取template_id，数据结构是 data[0].template_id
          templateId = step1Data?.data?.[0]?.template_id;
        } catch (apiError) {
          console.error('[步骤1] 直接 API 调用失败:', apiError);
          throw new Error('无法获取工作项信息');
        }
      }

      if (!templateId) {
        console.error('[步骤1] 未获取到模板ID');
        return { data: { nodes: [] } };
      }

      console.log('[步骤1] 成功获取模板ID:', templateId);

      // 第二步：查询模板详情获取节点
      console.log('[步骤2] 查询模板详情获取节点信息');

      const step2Path = `https://${API_CONFIG.siteDomain}/open_api/${spaceId}/template_detail/${templateId}`;
      console.log('[步骤2] 接口路径:', step2Path);

      // 尝试通过 MCP 调用第二步
      try {
        const step2Result = await this.callTool<{
          data?: {
            nodes?: Array<{
              node_id: string;
              node_name: string;
              node_type?: string;
              status?: string;
              [key: string]: any;
            }>;
          };
        }>('template_detail_query', {
          space_id: spaceId,  // 使用动态spaceId
          template_id: templateId
        });

        console.log('[步骤2] MCP 响应:', step2Result);

        // 检查 MCP 响应是否包含 workflow_confs
        if (step2Result?.data?.workflow_confs) {
          const nodes = step2Result.data.workflow_confs.map((conf: any) => ({
            node_id: conf.state_key,
            node_name: conf.name,
            node_type: conf.is_milestone ? 'milestone' : 'normal',
            owner_roles: conf.owner_roles || []
          }));
          console.log('[步骤2] MCP 转换后的节点数据:', nodes);

          return {
            data: {
              nodes, // 向后兼容的格式
              // 完整的原始数据
              workflow_confs: step2Result.data.workflow_confs || [],
              connections: step2Result.data.connections || [],
              template_id: step2Result.data.template_id,
              template_name: step2Result.data.template_name
            }
          };
        }

      } catch (mcpError) {
        console.warn('[步骤2] MCP 调用失败，尝试直接调用 API:', mcpError);
      }

      // 通过认证的直接调用第二步 API
      try {
        // 使用后端代理服务器调用模板详情API，传递spaceId
        const step2ApiUrl = `${API_CONFIG.proxyUrl}/api/template/${templateId}?space_id=${encodeURIComponent(spaceId)}`;
        console.log('[步骤2] 通过后端代理服务器调用模板API:', step2ApiUrl);

        // 获取认证头
        const authHeaders = await this.getAuthHeaders();
        console.log('[步骤2] 使用认证头:', Object.keys(authHeaders));

        const response = await fetch(step2ApiUrl, {
          method: 'GET',
          headers: authHeaders
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[步骤2] API 错误响应:', errorText);
          console.error('[步骤2] 请求详情:', {
            path: step2Path,
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          throw new Error(`Step2 API error: ${response.status} - ${errorText}`);
        }

        const step2Data = await response.json();
        console.log('[步骤2] API 响应数据:', step2Data);

        // 返回完整的模板数据（包括 workflow_confs 和 connections）
        if (step2Data?.data) {
          // 同时提供转换后的 nodes 格式（向后兼容）和完整的原始数据
          const nodes = step2Data.data.workflow_confs?.map((conf: any) => ({
            node_id: conf.state_key,
            node_name: conf.name,
            node_type: conf.is_milestone ? 'milestone' : 'normal',
            owner_roles: conf.owner_roles || []
          })) || [];

          console.log('[步骤2] 转换后的节点数据:', nodes);
          console.log('[步骤2] 完整模板数据:', {
            workflow_confs: step2Data.data.workflow_confs?.length || 0,
            connections: step2Data.data.connections?.length || 0
          });

          return {
            data: {
              nodes, // 向后兼容的格式
              // 完整的原始数据
              workflow_confs: step2Data.data.workflow_confs || [],
              connections: step2Data.data.connections || [],
              template_id: step2Data.data.template_id,
              template_name: step2Data.data.template_name
            }
          };
        }

        return { data: { nodes: [], workflow_confs: [], connections: [] } };

      } catch (apiError) {
        console.error('[步骤2] 直接 API 调用失败:', apiError);
        return { data: { nodes: [] } };
      }

    } catch (error) {
      console.error('[工作流查询] 整体流程失败:', error);
      return { data: { nodes: [] } };
    }
  }


  /**
   * 连接客户端（工作流系统需要）
   */
  async connect(): Promise<void> {
    // MCP 客户端不需要显式连接，这里只是为了满足接口需求
    console.log('[MCPClient] Connection established');
  }

  /**
   * 断开连接（工作流系统需要）
   */
  async disconnect(): Promise<void> {
    // MCP 客户端不需要显式断开，这里只是为了满足接口需求
    console.log('[MCPClient] Connection closed');
  }
}

export const mcpClient = new MCPClient();
