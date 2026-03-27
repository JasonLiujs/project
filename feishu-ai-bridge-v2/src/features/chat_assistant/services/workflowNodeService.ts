// 工作流节点服务
import { MCPClient } from '../../../api/mcp';
import { API_CONFIG } from '../../../constants';

/**
 * 插件Token响应接口 (飞书实际格式)
 */
interface PluginTokenResponse {
  error: {
    code: number;
    msg: string;
    display_msg?: any;
  };
  data?: {
    token: string;
    expire_time: number;
  };
}

export interface WorkflowNodeInfo {
  id: string;               // 节点ID
  name: string;             // 节点名称
  state_key: string;        // 工作项状态key
  status: number;           // 工作流节点状态：1=未开始，2=进行中，3=已完成
  start_time?: number;      // 节点开始时间（时间戳），0表示未开始
  end_time?: number;        // 节点结束时间（时间戳），0表示未结束
  owners?: string[];        // 负责人user_key数组
  workItemId?: string;      // 关联的工作项ID
  workItemName?: string;    // 关联的工作项名称
  gstack_skills?: string[]; // 配置的gstack技能
  description?: string;     // 节点描述
  created_time?: string;    // 创建时间
  updated_time?: string;    // 更新时间
}

/**
 * 工作流节点状态枚举
 */
export const WorkflowNodeStatus = {
  NOT_STARTED: 1,    // 未开始
  IN_PROGRESS: 2,    // 进行中
  COMPLETED: 3       // 已完成
} as const;

/**
 * 获取状态的显示文本
 */
export function getStatusDisplayText(status: number): string {
  switch (status) {
    case WorkflowNodeStatus.NOT_STARTED:
      return '未开始';
    case WorkflowNodeStatus.IN_PROGRESS:
      return '进行中';
    case WorkflowNodeStatus.COMPLETED:
      return '已完成';
    default:
      return '未知状态';
  }
}

/**
 * 获取状态的CSS类名
 */
export function getStatusClassName(status: number): string {
  switch (status) {
    case WorkflowNodeStatus.NOT_STARTED:
      return 'status-not-started';
    case WorkflowNodeStatus.IN_PROGRESS:
      return 'status-in-progress';
    case WorkflowNodeStatus.COMPLETED:
      return 'status-completed';
    default:
      return 'status-unknown';
  }
}

/**
 * 判断节点是否正在进行中
 * 规则：start_time != 0 且 end_time == 0
 */
export function isNodeInProgress(node: WorkflowNodeInfo): boolean {
  const startTime = node.start_time || 0;
  const endTime = node.end_time || 0;

  // start_time不为0，end_time为0，表示正在进行中
  return startTime !== 0 && endTime === 0;
}

/**
 * 根据时间字段获取节点状态
 * 用于兼容原有的status字段显示
 */
export function getNodeStatusByTime(node: WorkflowNodeInfo): number {
  const startTime = node.start_time || 0;
  const endTime = node.end_time || 0;

  if (startTime === 0) {
    return WorkflowNodeStatus.NOT_STARTED; // 未开始
  } else if (endTime === 0) {
    return WorkflowNodeStatus.IN_PROGRESS;  // 进行中
  } else {
    return WorkflowNodeStatus.COMPLETED;    // 已完成
  }
}

export interface WorkflowQueryResponse {
  code: number;
  message: string;
  data: {
    nodes: WorkflowNodeInfo[];
    current_nodes: WorkflowNodeInfo[];
    running_nodes: WorkflowNodeInfo[];
  };
}

/**
 * 工作流节点API服务
 */
export class WorkflowNodeService {
  private mcpClient: MCPClient;

  constructor() {
    this.mcpClient = new MCPClient();
  }

  /**
   * 获取插件访问Token（通过8888代理服务器）
   */
  private async getPluginToken(): Promise<string> {
    const response = await fetch(`${API_CONFIG.proxyUrl}/api/auth/plugin-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plugin_id: API_CONFIG.pluginId,
        plugin_secret: API_CONFIG.pluginSecret,
        type: 0
      })
    });

    if (!response.ok) {
      throw new Error(`Token获取失败: ${response.status} ${response.statusText}`);
    }

    const result: PluginTokenResponse = await response.json();
    if (result.error.code === 0 && result.data) {
      return result.data.token;
    } else {
      throw new Error(`Token获取失败: ${result.error.msg || '未知错误'}`);
    }
  }


  /**
   * 获取当前进行中的工作流节点
   */
  async getCurrentRunningNodes(
    spaceId: string,
    workObjectId: string,
    activeWorkItemId: string
  ): Promise<WorkflowNodeInfo[]> {
    try {
      // 尝试通过MCP查询工作流节点
      try {
        const mcpResult = await this.mcpClient.getWorkflowNodes(spaceId, workObjectId, activeWorkItemId);
        if (mcpResult && mcpResult.data) {
          const allNodes = mcpResult.data.workflow_nodes || mcpResult.data.running_nodes || mcpResult.data.current_nodes || [];
          if (allNodes.length > 0) {
            const formattedNodes: WorkflowNodeInfo[] = allNodes.map(node => ({
              id: node.id,
              name: node.name,
              state_key: node.state_key,
              status: node.status,
              start_time: (node as any).start_time || 0,
              end_time: (node as any).end_time || 0,
              description: node.description,
              gstack_skills: (node as any).gstack_skills || [],
              created_time: (node as any).created_time,
              updated_time: (node as any).updated_time
            }));
            return formattedNodes;
          }
        }
      } catch (mcpError) {
        // MCP查询失败，继续尝试API服务器
      }

      // 通过API服务器查询
      const pluginToken = await this.getPluginToken();
      const requestBody = {
        space_id: spaceId,
        work_object_id: workObjectId,
        work_item_ids: [parseInt(activeWorkItemId)]
      };

      const response = await fetch(`${API_CONFIG.proxyUrl}/api/work-items/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-plugin-token': pluginToken,
          'x-user-key': API_CONFIG.defaultUserKey,
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const result: any = await response.json();

      if (result.err_code === 0 && result.data) {
        const workItems = result.data || [];
        let allNodes: any[] = [];

        for (const workItem of workItems) {
          if (workItem.current_nodes && workItem.current_nodes.length > 0) {
            const nodesWithContext = workItem.current_nodes.map((node: any) => {
              const timeInfo = workItem.state_times?.find((time: any) =>
                time.state_key === node.id || time.name === node.name
              );

              const startTime = timeInfo?.start_time || 0;
              const endTime = timeInfo?.end_time || 0;
              const calculatedStatus = getNodeStatusByTime({ start_time: startTime, end_time: endTime } as WorkflowNodeInfo);

              return {
                id: node.id,
                name: node.name,
                state_key: node.id,
                status: calculatedStatus,
                start_time: startTime,
                end_time: endTime,
                owners: node.owners || [],
                milestone: node.milestone || false,
                workItemId: workItem.id,
                workItemName: workItem.name,
                gstack_skills: [],
                description: `节点: ${node.name}`,
                created_time: new Date().toISOString(),
                updated_time: new Date().toISOString()
              };
            });
            allNodes.push(...nodesWithContext);
          }
        }
        return allNodes;
      }
      return [];
    } catch (error) {
      return [];
    }
  }


  /**
   * 获取节点配置的gstack技能列表
   */
  async getNodeGstackSkills(nodeId: string): Promise<string[]> {
    try {
      const skillConfigs = this.getStoredSkillConfigs();
      const nodeConfig = skillConfigs.find(config => config.nodeId === nodeId);
      return nodeConfig ? nodeConfig.skills : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * 检查节点是否配置了特定技能
   */
  async hasGstackSkill(nodeId: string, skillName: string): Promise<boolean> {
    const skills = await this.getNodeGstackSkills(nodeId);
    return skills.includes(skillName);
  }

  /**
   * 从localStorage获取技能配置
   */
  private getStoredSkillConfigs(): Array<{nodeId: string, skills: string[]}> {
    try {
      const stored = localStorage.getItem('workflow-skill-configs');
      if (stored) {
        const configs = JSON.parse(stored);
        return configs.map((config: any) => ({
          nodeId: config.nodeId,
          skills: config.skill ? [config.skill] : []
        }));
      }
    } catch (error) {
      // 忽略错误，返回空数组
    }
    return [];
  }

  /**
   * 触发节点配置的gstack技能
   */
  async triggerNodeSkills(
    nodeId: string,
    executeSkillCallback: (skillName: string) => Promise<void>
  ): Promise<void> {
    try {
      const skills = await this.getNodeGstackSkills(nodeId);
      if (skills.length === 0) {
        return;
      }

      for (const skill of skills) {
        try {
          await executeSkillCallback(skill);
        } catch (error) {
          // 忽略技能执行错误，继续执行其他技能
        }
      }
    } catch (error) {
      // 忽略错误
    }
  }
}

export const workflowNodeService = new WorkflowNodeService();