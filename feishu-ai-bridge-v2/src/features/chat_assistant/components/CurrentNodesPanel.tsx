// 当前进行中节点面板组件
import React, { useState, useEffect } from 'react';
import {
  WorkflowNodeInfo,
  workflowNodeService,
  getStatusDisplayText,
  getStatusClassName
} from '../services/workflowNodeService';
import { useWorkItemContext } from '../../../hooks/useContext';
import './CurrentNodesPanel.css';

interface CurrentNodesPanelProps {
  onSkillTrigger: (skillName: string, nodeId: string) => Promise<void>;
  refreshInterval?: number;
}

interface NodeDisplayInfo extends WorkflowNodeInfo {
  skills: string[];
  skillDisplayNames: string[];
}

export default function CurrentNodesPanel({
  onSkillTrigger,
  refreshInterval = 30000 // 30秒刷新一次
}: CurrentNodesPanelProps) {
  const [nodes, setNodes] = useState<NodeDisplayInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const { spaceId, workItemType, workItemId, loading: contextLoading } = useWorkItemContext();

  /**
   * 获取技能的显示名称
   */
  const getSkillDisplayName = (skillName: string): string => {
    const skillDisplayMap: Record<string, string> = {
      'plan-eng-review': '🔧 工程审查',
      'investigate': '🔍 调查分析',
      'review': '📝 代码审查',
      'qa': '✅ 质量检查',
      'ship': '🚀 发布部署',
      'design-review': '🎨 设计审查',
      'security': '🔒 安全检查',
      'simplify': '⚡ 代码简化',
      'document': '📖 文档生成'
    };

    return skillDisplayMap[skillName] || `⚙️ ${skillName}`;
  };

  /**
   * 加载当前进行中的节点
   */
  const loadCurrentNodes = async () => {
    try {
      if (contextLoading) {
        return;
      }

      let finalSpaceId = spaceId;
      let finalWorkItemType = workItemType;
      let finalWorkItemId = workItemId;

      // 获取飞书实时上下文
      try {
        const context = await window.JSSDK.Context.load();
        if (context && context.activeWorkItem && context.activeWorkItem.id) {
          finalWorkItemId = context.activeWorkItem.id.toString();
        }
      } catch (contextError) {
        // 忽略上下文获取错误
      }

      // 使用默认值
      if (!finalSpaceId || !finalWorkItemType || !finalWorkItemId) {
        finalSpaceId = finalSpaceId || "69a00d715adc93d52b944bfa";
        finalWorkItemType = finalWorkItemType || "story";
        finalWorkItemId = finalWorkItemId || "301228001";
      }

      setLoading(true);
      setError(null);

      const runningNodes = await workflowNodeService.getCurrentRunningNodes(
        finalSpaceId,
        finalWorkItemType,
        finalWorkItemId
      );

      // 为每个节点获取技能配置
      const nodesWithSkills: NodeDisplayInfo[] = await Promise.all(
        runningNodes.map(async (node) => {
          try {
            const skills = await workflowNodeService.getNodeGstackSkills(node.id);
            const skillDisplayNames = skills.map(getSkillDisplayName);

            return {
              ...node,
              skills,
              skillDisplayNames
            };
          } catch (skillError) {
            return {
              ...node,
              skills: [],
              skillDisplayNames: []
            };
          }
        })
      );

      setNodes(nodesWithSkills);
      setLastRefresh(new Date());
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '加载失败';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理技能触发
   */
  const handleSkillTrigger = async (skillName: string, nodeId: string, nodeName: string) => {
    try {
      await onSkillTrigger(skillName, nodeId);
    } catch (error) {
      // 忽略错误
    }
  };

  /**
   * 格式化时间
   */
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  /**
   * 自动刷新
   */
  useEffect(() => {
    loadCurrentNodes();

    const timer = setInterval(loadCurrentNodes, refreshInterval);
    return () => clearInterval(timer);
  }, [spaceId, workItemType, workItemId, contextLoading, refreshInterval]);

  // 上下文加载中
  if (contextLoading) {
    return (
      <div className="current-nodes-panel loading">
        <div className="panel-header">
          <h4>🔄 当前节点</h4>
        </div>
        <div className="loading-state">
          <span>加载工作项上下文中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="current-nodes-panel">
      <div className="panel-header">
        <h4>🎯 当前进行中节点</h4>
        <div className="panel-controls">
          <button
            className="refresh-btn"
            onClick={loadCurrentNodes}
            disabled={loading}
            title="刷新节点状态"
          >
            {loading ? '🔄' : '↻'}
          </button>
          {lastRefresh && (
            <small className="last-refresh">
              更新: {formatTime(lastRefresh)}
            </small>
          )}
        </div>
      </div>

      <div className="nodes-container">
        {loading && nodes.length === 0 ? (
          <div className="loading-state">
            <span>正在加载节点信息...</span>
          </div>
        ) : error ? (
          <div className="error-state">
            <span>❌ 加载失败: {error}</span>
            <button onClick={loadCurrentNodes} className="retry-btn">重试</button>
          </div>
        ) : nodes.length === 0 ? (
          <div className="empty-state">
            <span>📋 当前没有进行中的节点</span>
          </div>
        ) : (
          <div className="nodes-list">
            {nodes.map((node) => (
              <div key={node.id} className="node-card">
                <div className="node-info">
                  <div className="node-name">{node.name}</div>
                  <div className={`node-status ${getStatusClassName(node.status)}`}>
                    {getStatusDisplayText(node.status)}
                  </div>
                </div>

                {node.skills.length > 0 && (
                  <div className="node-skills">
                    <div className="skills-label">配置的技能:</div>
                    <div className="skills-buttons">
                      {node.skills.map((skill, index) => (
                        <button
                          key={skill}
                          className="skill-btn"
                          onClick={() => handleSkillTrigger(skill, node.id, node.name)}
                          title={`触发技能: ${skill}`}
                        >
                          {node.skillDisplayNames[index]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {node.skills.length === 0 && (
                  <div className="no-skills">
                    <small className="no-skills-text">未配置gstack技能</small>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}