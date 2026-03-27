import React, { useState, useEffect } from 'react';
import { WorkflowRule, WORKFLOW_STORAGE_KEYS, DEFAULT_WORKFLOW_RULES, WorkflowRuleValidator } from '../../types/workflow';
import WorkflowChart from '../../components/WorkflowChart';
import './Config.css';

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

const DEFAULT_NODE_TYPES = [
  'requirement_analysis',
  'design_review',
  'development',
  'testing',
  'deployment',
  'maintenance'
];

interface WorkflowState {
  state_key: string;
  state_name: string;
}

interface WorkflowConnection {
  source_state_key: string;
  target_state_key: string;
}

interface WorkflowNode {
  state_key: string;
  name: string;
  is_milestone: boolean;
  owner_roles: string[];
  visibility_usage_mode: number;
}

interface WorkflowConfigProps {
  workflowStates?: WorkflowState[];
  workflowNodes?: WorkflowNode[];
  workflowConnections?: WorkflowConnection[];
}

interface WorkflowFormData {
  name: string;
  description: string;
  trigger: WorkflowRule['trigger'];
  nodeTypes: string[];
  primarySkill: string;
  secondarySkills: string[];
  autoAssign: boolean;
  maxConcurrentTasks: number;
  commentTemplate: string;
  workItemTypes: string[];
  priority: string[];
}

export default function WorkflowConfig({
  workflowStates = [],
  workflowNodes = [],
  workflowConnections = []
}: WorkflowConfigProps) {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);
  const [formData, setFormData] = useState<WorkflowFormData>({
    name: '',
    description: '',
    trigger: 'on_create',
    nodeTypes: [],
    primarySkill: 'plan-eng-review',
    secondarySkills: [],
    autoAssign: true,
    maxConcurrentTasks: 3,
    commentTemplate: '',
    workItemTypes: ['story'],
    priority: ['high', 'urgent']
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(WORKFLOW_STORAGE_KEYS.RULES);
    if (saved) {
      try {
        setRules(JSON.parse(saved));
      } catch {
        setRules(DEFAULT_WORKFLOW_RULES);
      }
    } else {
      setRules(DEFAULT_WORKFLOW_RULES);
    }
    setLoading(false);
  }, []);

  const saveRules = (newRules: WorkflowRule[]) => {
    setRules(newRules);
    localStorage.setItem(WORKFLOW_STORAGE_KEYS.RULES, JSON.stringify(newRules));
  };

  const toggleRule = (id: string) => {
    saveRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteRule = (id: string) => {
    if (confirm('确定删除此工作流规则？')) {
      saveRules(rules.filter(r => r.id !== id));
    }
  };

  const openCreateModal = () => {
    setEditingRule(null);
    const availableNodeTypes = getAvailableNodeTypes();
    setFormData({
      name: '',
      description: '',
      trigger: 'on_create',
      nodeTypes: availableNodeTypes.length > 0 ? [availableNodeTypes[0]] : ['requirement_analysis'],
      primarySkill: 'plan-eng-review',
      secondarySkills: [],
      autoAssign: true,
      maxConcurrentTasks: 3,
      commentTemplate: `## 🤖 AI 工作流分析报告

### 📋 分析摘要
{summary}

### 🏗️ 架构建议
{architecture_recommendations}

### ⚠️ 风险评估
{risk_assessment}

### 🔧 技术方案
{technical_approach}

### 📝 下一步行动
{next_steps}

---
*由 AI 自动分析生成 | 生成时间: {timestamp}*`,
      workItemTypes: ['story'],
      priority: ['high', 'urgent']
    });
    setValidationErrors([]);
    setShowModal(true);
  };

  const openEditModal = (rule: WorkflowRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description,
      trigger: rule.trigger,
      nodeTypes: rule.nodeTypes,
      primarySkill: rule.gstackSkills.primary,
      secondarySkills: rule.gstackSkills.secondary || [],
      autoAssign: rule.claimingCriteria.autoAssign || false,
      maxConcurrentTasks: rule.claimingCriteria.maxConcurrentTasks || 3,
      commentTemplate: rule.resultMapping.commentTemplate,
      workItemTypes: rule.claimingCriteria.workItemTypes || ['story'],
      priority: rule.claimingCriteria.priority || []
    });
    setValidationErrors([]);
    setShowModal(true);
  };

  const handleSave = () => {
    // 构建工作流规则对象
    const workflowRule: WorkflowRule = {
      id: editingRule?.id || `workflow-${Date.now()}`,
      name: formData.name,
      description: formData.description,
      enabled: editingRule?.enabled ?? true,
      trigger: formData.trigger,
      actions: [formData.primarySkill], // 兼容 AIRule 接口
      nodeTypes: formData.nodeTypes,
      claimingCriteria: {
        priority: formData.priority,
        workItemTypes: formData.workItemTypes,
        autoAssign: formData.autoAssign,
        maxConcurrentTasks: formData.maxConcurrentTasks
      },
      gstackSkills: {
        primary: formData.primarySkill,
        secondary: formData.secondarySkills.length > 0 ? formData.secondarySkills : undefined,
        timeout: 300000 // 5分钟默认超时
      },
      resultMapping: {
        commentTemplate: formData.commentTemplate,
        fieldUpdates: [
          {
            fieldKey: 'ai_analysis_status',
            valueExpression: 'completed',
            transform: 'string'
          }
        ]
      }
    };

    // 验证规则
    const validation = WorkflowRuleValidator.validate(workflowRule);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    if (editingRule) {
      saveRules(rules.map(r => r.id === editingRule.id ? workflowRule : r));
    } else {
      saveRules([...rules, workflowRule]);
    }
    setShowModal(false);
  };

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case 'on_create': return '创建时';
      case 'on_update': return '更新时';
      case 'on_comment': return '评论时';
      case 'on_schedule': return '定时执行';
      default: return trigger;
    }
  };

  const getNodeTypeLabel = (nodeType: string) => {
    // 首先尝试从真实工作流状态中查找
    const realNode = workflowStates.find(ws => ws.state_key === nodeType);
    if (realNode) {
      return realNode.state_name;
    }

    // 回退到硬编码的映射
    switch (nodeType) {
      case 'requirement_analysis': return '需求分析';
      case 'design_review': return '设计评审';
      case 'development': return '开发';
      case 'testing': return '测试';
      case 'deployment': return '部署';
      case 'maintenance': return '维护';
      default: return nodeType;
    }
  };

  // 获取可用的节点类型：优先使用真实数据，回退到默认数据
  const getAvailableNodeTypes = () => {
    if (workflowStates.length > 0) {
      return workflowStates.map(ws => ws.state_key);
    }
    return DEFAULT_NODE_TYPES;
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
      <div className="config-header">
        <div>
          <h1>🤖 工作流规则配置</h1>
          <p>管理 AI 驱动的工作流自动化规则</p>
        </div>
        <button className="btn-create" onClick={openCreateModal}>
          + 新建工作流规则
        </button>
      </div>

      <div className="rules-list">
        {rules.length === 0 ? (
          <div className="empty-state">
            <span>暂无工作流规则</span>
            <p>创建第一条 AI 工作流自动化规则</p>
          </div>
        ) : (
          rules.map(rule => (
            <div key={rule.id} className={`rule-card workflow-rule ${rule.enabled ? '' : 'rule-disabled'}`}>
              <div className="rule-main">
                <div className="rule-header">
                  <h3>{rule.name}</h3>
                  <div className="rule-tags">
                    <span className="rule-trigger">{getTriggerLabel(rule.trigger)}</span>
                    <span className="gstack-skill">{rule.gstackSkills.primary}</span>
                    {rule.claimingCriteria.autoAssign && (
                      <span className="auto-assign">自动领取</span>
                    )}
                  </div>
                </div>
                <p className="rule-description">{rule.description}</p>
                <div className="workflow-details">
                  <div className="detail-section">
                    <label>节点类型:</label>
                    <div className="node-types">
                      {rule.nodeTypes.map(nodeType => (
                        <span key={nodeType} className="node-type-tag">
                          {getNodeTypeLabel(nodeType)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {rule.gstackSkills.secondary && rule.gstackSkills.secondary.length > 0 && (
                    <div className="detail-section">
                      <label>辅助技能:</label>
                      <div className="secondary-skills">
                        {rule.gstackSkills.secondary.map(skill => (
                          <span key={skill} className="skill-tag secondary">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="detail-section">
                    <label>领取条件:</label>
                    <div className="claiming-criteria">
                      <span>工作项类型: {rule.claimingCriteria.workItemTypes?.join(', ') || 'all'}</span>
                      {rule.claimingCriteria.priority && rule.claimingCriteria.priority.length > 0 && (
                        <span>优先级: {rule.claimingCriteria.priority.join(', ')}</span>
                      )}
                      <span>最大并发: {rule.claimingCriteria.maxConcurrentTasks || 'unlimited'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rule-controls">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleRule(rule.id)}
                  />
                  <span className="toggle-slider" />
                </label>
                <button className="btn-icon" onClick={() => openEditModal(rule)} title="编辑">✏️</button>
                <button className="btn-icon btn-danger" onClick={() => deleteRule(rule.id)} title="删除">🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal workflow-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingRule ? '编辑工作流规则' : '新建工作流规则'}</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {validationErrors.length > 0 && (
                <div className="validation-errors">
                  {validationErrors.map((error, index) => (
                    <div key={index} className="error-message">❌ {error}</div>
                  ))}
                </div>
              )}

              <div className="form-section">
                <h4>基本信息</h4>
                <div className="form-group">
                  <label>规则名称</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：需求分析自动化"
                  />
                </div>
                <div className="form-group">
                  <label>描述</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="规则的功能说明..."
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label>触发条件</label>
                  <select
                    value={formData.trigger}
                    onChange={e => setFormData({ ...formData, trigger: e.target.value as WorkflowRule['trigger'] })}
                  >
                    <option value="on_create">创建时</option>
                    <option value="on_update">更新时</option>
                    <option value="on_comment">评论时</option>
                    <option value="on_schedule">定时执行</option>
                  </select>
                </div>
              </div>

              <div className="form-section">
                <h4>节点配置</h4>
                <div className="form-group">
                  <label>适用节点类型</label>
                  {workflowNodes.length === 0 ? (
                    <div className="no-nodes-warning">
                      ⚠️ 无法获取工作流节点，请确保在正确的工作项页面中使用此插件
                    </div>
                  ) : (
                    <div className="workflow-chart-section">
                      <WorkflowChart
                        nodes={workflowNodes}
                        connections={workflowConnections}
                        selectedNodes={formData.nodeTypes}
                        onNodeSelect={(selectedNodeIds) => {
                          setFormData({ ...formData, nodeTypes: selectedNodeIds });
                        }}
                        selectable={true}
                      />
                      <div className="selected-nodes-summary">
                        已选择 {formData.nodeTypes.length} 个节点:
                        {formData.nodeTypes.length > 0 && (
                          <div className="selected-nodes-list">
                            {formData.nodeTypes.map(nodeId => {
                              const node = workflowNodes.find(n => n.state_key === nodeId);
                              return (
                                <span key={nodeId} className="selected-node-tag">
                                  {node?.name || nodeId}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {workflowNodes.length > 0 && (
                    <div className="nodes-info">
                      ✅ 已加载 {workflowNodes.length} 个真实工作流节点和 {workflowConnections.length} 个连接
                    </div>
                  )}
                </div>
              </div>

              <div className="form-section">
                <h4>gstack 技能配置</h4>
                <div className="form-group">
                  <label>主要技能</label>
                  <select
                    value={formData.primarySkill}
                    onChange={e => setFormData({ ...formData, primarySkill: e.target.value })}
                  >
                    {DEFAULT_GSTACK_SKILLS.map(skill => (
                      <option key={skill} value={skill}>{skill}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>辅助技能 (可选)</label>
                  <div className="checkbox-group">
                    {DEFAULT_GSTACK_SKILLS.filter(skill => skill !== formData.primarySkill).map(skill => (
                      <label key={skill} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.secondarySkills.includes(skill)}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({ ...formData, secondarySkills: [...formData.secondarySkills, skill] });
                            } else {
                              setFormData({ ...formData, secondarySkills: formData.secondarySkills.filter(s => s !== skill) });
                            }
                          }}
                        />
                        {skill}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>任务领取配置</h4>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.autoAssign}
                      onChange={e => setFormData({ ...formData, autoAssign: e.target.checked })}
                    />
                    自动分配给当前用户
                  </label>
                </div>
                <div className="form-group">
                  <label>工作项类型过滤</label>
                  <div className="checkbox-group">
                    {['story', 'task', 'issue'].map(type => (
                      <label key={type} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.workItemTypes.includes(type)}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({ ...formData, workItemTypes: [...formData.workItemTypes, type] });
                            } else {
                              setFormData({ ...formData, workItemTypes: formData.workItemTypes.filter(t => t !== type) });
                            }
                          }}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>优先级过滤</label>
                  <div className="checkbox-group">
                    {['urgent', 'high', 'medium', 'low'].map(priority => (
                      <label key={priority} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.priority.includes(priority)}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({ ...formData, priority: [...formData.priority, priority] });
                            } else {
                              setFormData({ ...formData, priority: formData.priority.filter(p => p !== priority) });
                            }
                          }}
                        />
                        {priority}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>最大并发任务数</label>
                  <input
                    type="number"
                    value={formData.maxConcurrentTasks}
                    onChange={e => setFormData({ ...formData, maxConcurrentTasks: parseInt(e.target.value) || 1 })}
                    min="1"
                    max="20"
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>结果输出模板</h4>
                <div className="form-group">
                  <label>评论模板</label>
                  <textarea
                    value={formData.commentTemplate}
                    onChange={e => setFormData({ ...formData, commentTemplate: e.target.value })}
                    placeholder="支持变量: {summary}, {architecture_recommendations}, {risk_assessment}, {technical_approach}, {next_steps}, {timestamp}"
                    rows={8}
                    className="template-textarea"
                  />
                  <div className="template-help">
                    <strong>可用变量:</strong> {'{summary}'}, {'{architecture_recommendations}'}, {'{risk_assessment}'}, {'{technical_approach}'}, {'{next_steps}'}, {'{timestamp}'}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn-save" onClick={handleSave} disabled={!formData.name.trim() || formData.nodeTypes.length === 0}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}