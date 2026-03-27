import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../../constants';
import { MCPClient } from '../../api/mcp';
import WorkflowChart from '../../components/WorkflowChart';
import { setupProxy, checkProxyHealth } from '../../utils/proxy';
import './Config.css';

// 飞书 JSSDK 类型声明
declare global {
  interface Window {
    JSSDK?: {
      Context: {
        load: () => Promise<{
          activeWorkItem?: {
            id: number;  // 实例ID
          };
        }>;
      };
      tab: {
        getContext: () => Promise<{
          spaceId: string;        // 空间ID
          workObjectId: string;   // 工作项类型ID
          workItemId?: string;    // 这个字段可能不需要了
        }>;
      };
    };
  }
}

interface WorkflowState {
  state_key: string;
  state_name: string;
}

interface WorkflowNode {
  state_key: string;
  name: string;
  is_milestone: boolean;
  owner_roles: string[];
  visibility_usage_mode: number;
}

interface WorkflowConnection {
  source_state_key: string;
  target_state_key: string;
}

const DEFAULT_GSTACK_SKILLS = [
  'plan-eng-review',
  'plan-ceo-review',
  'plan-design-review',
  'investigate',
  'review',
  'qa',
  'qa-only',
  'ship',
  'land-and-deploy',
  'codex',
  'design-review',
  'office-hours'
];

// 技能图标映射
const SKILL_ICONS: Record<string, string> = {
  'plan-eng-review': '🔧',
  'plan-ceo-review': '👔',
  'plan-design-review': '🎨',
  'investigate': '🔍',
  'review': '📝',
  'qa': '✅',
  'qa-only': '🧪',
  'ship': '🚢',
  'land-and-deploy': '🚀',
  'codex': '💻',
  'design-review': '🖼️',
  'office-hours': '💼'
};

interface NodeSkillConfig {
  nodeId: string;
  skill: string;
}

export default function AIConfig() {
  const [loading, setLoading] = useState(true);
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([]);
  const [workflowConnections, setWorkflowConnections] = useState<WorkflowConnection[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string>('plan-eng-review');
  const [nodeSkillConfigs, setNodeSkillConfigs] = useState<NodeSkillConfig[]>([]);
  const [mcpClient] = useState(() => new MCPClient());

  useEffect(() => {
    const initializeData = async () => {
      try {
        // 初始化代理设置
        setupProxy();

        // 检查代理健康状态
        const isProxyHealthy = await checkProxyHealth();
        if (!isProxyHealthy) {
          console.warn('[初始化] 代理服务器检查失败，请确保代理服务器正在运行');
        }

        // 加载工作流数据
        await loadWorkflowNodes();

        // 加载保存的技能配置
        const savedConfigs = localStorage.getItem('workflow-skill-configs');
        if (savedConfigs) {
          try {
            setNodeSkillConfigs(JSON.parse(savedConfigs));
          } catch (error) {
            console.warn('Failed to load saved skill configs:', error);
          }
        }
      } catch (error) {
        console.error('Failed to initialize data:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  const loadWorkflowNodes = async (): Promise<void> => {
    try {
      console.log('开始加载工作流节点...');

      // 检查 JSSDK 是否可用
      if (typeof window === 'undefined') {
        console.log('window 对象不存在，可能在服务端环境');
        return;
      }

      console.log('检查 JSSDK 可用性:', {
        hasWindow: typeof window !== 'undefined',
        hasJSSDK: !!window.JSSDK,
        hasContext: !!window.JSSDK?.Context,
        hasTab: !!window.JSSDK?.tab,
        hasContextLoad: !!window.JSSDK?.Context?.load,
        hasGetContext: !!window.JSSDK?.tab?.getContext
      });

      if (!window.JSSDK?.Context || !window.JSSDK?.tab) {
        console.warn('JSSDK 不完整，缺少必要的模块');
        return;
      }

      // 第一步：获取活动的工作项信息（实例 ID）
      console.log('第一步：获取 Context 信息...');
      const context = await window.JSSDK.Context.load();
      console.log('获取到的 Context:', context);

      const activeWorkItemId = context.activeWorkItem?.id;
      if (!activeWorkItemId) {
        console.warn('Context 中没有活动的工作项 ID');
        return;
      }

      console.log('实例 ID:', activeWorkItemId);

      // 第二步：获取 tab 上下文信息（空间 ID 和工作项类型 ID）
      console.log('第二步：获取 tab 上下文...');
      const tabContext = await window.JSSDK.tab.getContext();
      console.log('获取到的 tab 上下文:', tabContext);

      const { spaceId, workObjectId } = tabContext;

      if (!spaceId || !workObjectId) {
        console.warn('tab 上下文中缺少必要信息:', { spaceId, workObjectId });
        return;
      }

      console.log('准备调用接口的参数:', {
        spaceId,           // 空间 ID
        workObjectId,      // 工作项类型 ID
        activeWorkItemId   // 实例 ID
      });

      // 第三步：调用后端接口获取工作流节点
      try {
        // 注意：activeWorkItemId可能是大整数，需要作为字符串处理以避免精度丢失
        const workItemIdStr = activeWorkItemId.toString();
        console.log('工作项ID字符串:', workItemIdStr);

        const response = await mcpClient.getWorkflowNodes(spaceId, workObjectId, workItemIdStr);
        console.log('工作流节点响应:', response);

        if (!response?.data?.nodes || response.data.nodes.length === 0) {
          console.warn('没有获取到工作流节点数据');
          return;
        }

        console.log(`成功获取到 ${response.data.nodes.length} 个节点:`, response.data.nodes);

        // 存储完整的工作流数据
        if (response.data.workflow_confs) {
          console.log('设置完整工作流数据:', {
            nodes: response.data.workflow_confs.length,
            connections: response.data.connections?.length || 0
          });

          // 转换 workflow_confs 为流程图组件需要的格式
          const chartNodes = response.data.workflow_confs.map((conf: any) => ({
            state_key: conf.state_key,
            name: conf.name,
            is_milestone: conf.is_milestone || false,
            owner_roles: conf.owner_roles || [],
            visibility_usage_mode: conf.visibility_usage_mode || 1
          }));

          setWorkflowNodes(chartNodes);
          setWorkflowConnections(response.data.connections || []);
        }

      } catch (apiError) {
        console.error('工作流接口调用失败:', apiError);
      }

    } catch (error) {
      console.error('加载工作流节点时发生未预期错误:', error);
    }
  };

  // 处理节点选择
  const handleNodeSelect = (nodeIds: string[]) => {
    setSelectedNodes(nodeIds);
  };

  if (loading) {
    return (
      <div className="config-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="config-page">
      <div className="config-content">

      {/* 工作流程图 */}
      <div style={{ marginBottom: '24px' }}>
        {workflowNodes.length === 0 ? (
          <div className="no-nodes-warning">
            ⚠️ 无法获取工作流节点，请确保在正确的工作项页面中使用此插件
          </div>
        ) : (
          <WorkflowChart
            nodes={workflowNodes}
            connections={workflowConnections}
            selectedNodes={selectedNodes}
            onNodeSelect={handleNodeSelect}
            selectable={true}
            nodeSkillConfigs={nodeSkillConfigs}
            skillIcons={SKILL_ICONS}
          />
        )}
      </div>

      {/* gstack 技能选择 */}
      <div className="gstack-config-section">
        <h3>🛠️ 选择 gstack 技能</h3>
        <div className="skill-selection">
          <div className="form-group">
            <label>选择要应用的技能:</label>
            <select
              value={selectedSkill}
              onChange={e => setSelectedSkill(e.target.value)}
            >
              {DEFAULT_GSTACK_SKILLS.map(skill => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 选择状态显示 */}
        {selectedNodes.length > 0 && (
          <div className="selection-summary">
            <h4>✅ 已选择配置</h4>
            <div className="selection-info">
              <div><strong>选择的节点:</strong> {selectedNodes.length} 个</div>
              <div className="selected-nodes-list">
                {selectedNodes.map(nodeId => {
                  const node = workflowNodes.find(n => n.state_key === nodeId);
                  return (
                    <span key={nodeId} className="selected-node-tag">
                      {node?.name || nodeId}
                    </span>
                  );
                })}
              </div>
              <div><strong>应用技能:</strong> <span className="skill-tag">{selectedSkill}</span></div>
            </div>

            <button
              className="btn-apply"
              onClick={() => {
                // 应用配置：为选中的节点设置技能
                const newConfigs = [...nodeSkillConfigs];

                selectedNodes.forEach(nodeId => {
                  // 移除该节点的旧配置
                  const filteredConfigs = newConfigs.filter(config => config.nodeId !== nodeId);
                  // 添加新配置
                  filteredConfigs.push({ nodeId, skill: selectedSkill });
                  newConfigs.splice(0, newConfigs.length, ...filteredConfigs);
                });

                setNodeSkillConfigs(newConfigs);

                // 保存到localStorage
                localStorage.setItem('workflow-skill-configs', JSON.stringify(newConfigs));

                setSelectedNodes([]); // 清空选择

                console.log('配置已应用:', { nodes: selectedNodes, skill: selectedSkill });
                alert(`配置已应用！\n节点: ${selectedNodes.length}个\n技能: ${selectedSkill}\n\n节点上已显示技能图标 ${SKILL_ICONS[selectedSkill] || '⚙️'}`);
              }}
            >
              应用配置
            </button>
          </div>
        )}

        {/* 已配置节点显示 */}
        {nodeSkillConfigs.length > 0 && (
          <div className="configured-nodes-summary">
            <h4>🎯 已配置的节点</h4>
            <div className="configured-nodes-list">
              {nodeSkillConfigs.map(config => {
                const node = workflowNodes.find(n => n.state_key === config.nodeId);
                return (
                  <div key={config.nodeId} className="configured-node-item">
                    <span className="node-name">{node?.name || config.nodeId}</span>
                    <span className="configured-skill">
                      {SKILL_ICONS[config.skill] || '⚙️'} {config.skill}
                    </span>
                    <button
                      className="btn-remove-config"
                      onClick={() => {
                        const newConfigs = nodeSkillConfigs.filter(c => c.nodeId !== config.nodeId);
                        setNodeSkillConfigs(newConfigs);
                        localStorage.setItem('workflow-skill-configs', JSON.stringify(newConfigs));
                      }}
                      title="移除配置"
                    >
                      ❌
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
