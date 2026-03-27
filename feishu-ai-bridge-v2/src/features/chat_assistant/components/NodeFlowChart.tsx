// 节点流程图组件

import React, { useMemo } from 'react';
import WorkflowChart from '../../../components/WorkflowChart';
import { WorkflowNode, NodeSkillConfig } from '../types/multiAIChat';

interface WorkflowConnection {
  source_state_key: string;
  target_state_key: string;
}

interface NodeFlowChartProps {
  currentNode: WorkflowNode | null;
  previousNodes: WorkflowNode[];
  nextNodes: WorkflowNode[];
  configuredSkills: NodeSkillConfig[];
  onNodeNavigate: (nodeId: string) => Promise<void>;
  className?: string;
}

// 技能图标映射（复用ai_config中的配置）
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

const NodeFlowChart: React.FC<NodeFlowChartProps> = ({
  currentNode,
  previousNodes,
  nextNodes,
  configuredSkills,
  onNodeNavigate,
  className = ''
}) => {
  /**
   * 构建聚焦显示的节点列表
   * 包含前置节点 -> 当前节点 -> 后续节点
   */
  const focusedNodes = useMemo(() => {
    const nodes = [];

    // 添加前置节点
    previousNodes.forEach(node => {
      nodes.push({
        ...node,
        state_key: node.state_key,
        name: node.name,
        is_milestone: node.is_milestone,
        owner_roles: node.owner_roles,
        visibility_usage_mode: node.visibility_usage_mode
      });
    });

    // 添加当前节点
    if (currentNode) {
      nodes.push({
        ...currentNode,
        state_key: currentNode.state_key,
        name: currentNode.name,
        is_milestone: currentNode.is_milestone,
        owner_roles: currentNode.owner_roles,
        visibility_usage_mode: currentNode.visibility_usage_mode
      });
    }

    // 添加后续节点
    nextNodes.forEach(node => {
      nodes.push({
        ...node,
        state_key: node.state_key,
        name: node.name,
        is_milestone: node.is_milestone,
        owner_roles: node.owner_roles,
        visibility_usage_mode: node.visibility_usage_mode
      });
    });

    return nodes;
  }, [currentNode, previousNodes, nextNodes]);

  /**
   * 构建节点连接关系
   */
  const nodeConnections = useMemo((): WorkflowConnection[] => {
    const connections: WorkflowConnection[] = [];

    if (!currentNode) return connections;

    // 前置节点到当前节点的连接
    previousNodes.forEach(prevNode => {
      connections.push({
        source_state_key: prevNode.state_key,
        target_state_key: currentNode.state_key
      });
    });

    // 当前节点到后续节点的连接
    nextNodes.forEach(nextNode => {
      connections.push({
        source_state_key: currentNode.state_key,
        target_state_key: nextNode.state_key
      });
    });

    return connections;
  }, [currentNode, previousNodes, nextNodes]);

  /**
   * 处理节点点击导航
   */
  const handleNodeSelect = async (nodeIds: string[]): Promise<void> => {
    if (nodeIds.length > 0 && onNodeNavigate) {
      try {
        await onNodeNavigate(nodeIds[0]);
      } catch (error) {
        console.error('[NodeFlowChart] Failed to navigate to node:', error);
      }
    }
  };

  /**
   * 获取当前选中的节点
   */
  const selectedNodes = useMemo(() => {
    return currentNode ? [currentNode.state_key] : [];
  }, [currentNode]);

  /**
   * 空状态显示
   */
  if (!currentNode) {
    return (
      <div className={`node-flow-chart-container ${className}`}>
        <div className="flow-header">
          <h3>🔄 工作流程状态</h3>
          <span className="current-position">当前位置: 未知</span>
        </div>
        <div className="chart-empty-state">
          <div className="empty-icon">📋</div>
          <p>无法获取工作流节点信息</p>
          <small>请确保在正确的工作项页面中使用此功能</small>
        </div>
      </div>
    );
  }

  return (
    <div className={`node-flow-chart-container ${className}`}>
      {/* 流程图标题栏 */}
      <div className="flow-header">
        <div className="header-main">
          <h3>🔄 工作流程状态</h3>
          <div className="current-position">
            <span className="position-label">当前位置:</span>
            <span className="position-value">{currentNode.name}</span>
            {currentNode.is_milestone && <span className="milestone-badge">⭐ 里程碑</span>}
          </div>
        </div>

        {/* 节点统计信息 */}
        <div className="flow-stats">
          <div className="stat-item">
            <span className="stat-label">前置节点</span>
            <span className="stat-value">{previousNodes.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">后续节点</span>
            <span className="stat-value">{nextNodes.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">配置技能</span>
            <span className="stat-value">{configuredSkills.length}</span>
          </div>
        </div>
      </div>

      {/* 配置的技能显示 */}
      {configuredSkills.length > 0 && (
        <div className="configured-skills-bar">
          <span className="skills-label">🛠️ 活跃技能:</span>
          <div className="skills-list">
            {configuredSkills.map(config => (
              <div key={config.nodeId + config.skill} className="skill-chip">
                <span className="skill-icon">{SKILL_ICONS[config.skill] || '⚙️'}</span>
                <span className="skill-name">{config.skill}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 工作流程图 */}
      <div className="workflow-chart-wrapper">
        <WorkflowChart
          nodes={focusedNodes}
          connections={nodeConnections}
          selectedNodes={selectedNodes}
          onNodeSelect={handleNodeSelect}
          selectable={true}
          nodeSkillConfigs={configuredSkills}
          skillIcons={SKILL_ICONS}
        />
      </div>

      {/* 导航提示 */}
      <div className="flow-navigation-hint">
        <span className="hint-icon">💡</span>
        <span className="hint-text">
          点击节点可以切换到该工作流状态
          {nextNodes.length > 0 && ` • 可前往: ${nextNodes.map(n => n.name).join(', ')}`}
        </span>
      </div>
    </div>
  );
};

export default NodeFlowChart;