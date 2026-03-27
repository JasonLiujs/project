// 节点流程监听Hook

import { useState, useEffect, useCallback, useRef } from 'react';
import { MCPClient } from '../../../api/mcp';
import { NodeFlowState, WorkflowNode, NodeSkillConfig, WorkflowContext } from '../types/multiAIChat';

/**
 * 节点流程Hook
 * 管理工作流节点状态，监听节点变化，提供节点导航功能
 */
export function useNodeFlow() {
  const [flowState, setFlowState] = useState<NodeFlowState>({
    currentNode: null,
    previousNodes: [],
    nextNodes: [],
    configuredSkills: [],
    isLoading: true,
    error: null,
    lastUpdated: 0
  });

  const mcpClient = useRef<MCPClient>(new MCPClient());
  const nodeChangeCallbacks = useRef<Array<(node: WorkflowNode | null) => void>>([]);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  /**
   * 加载工作流节点数据
   */
  const loadWorkflowData = useCallback(async (): Promise<void> => {
    setFlowState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 获取JSSDK上下文
      const context = await window.JSSDK.Context.load();
      const tabContext = await window.JSSDK.tab.getContext();

      if (!context.activeWorkItem?.id || !tabContext.spaceId || !tabContext.workObjectId) {
        throw new Error('缺少必要的工作项上下文信息');
      }

      const workItemId = context.activeWorkItem.id.toString();

      // 获取工作流节点数据
      const workflowResponse = await mcpClient.current.getWorkflowNodes(
        tabContext.spaceId,
        tabContext.workObjectId,
        workItemId
      );

      if (!workflowResponse?.data?.workflow_confs) {
        throw new Error('无法获取工作流节点数据');
      }

      const allNodes: WorkflowNode[] = workflowResponse.data.workflow_confs.map((conf: any) => ({
        state_key: conf.state_key,
        name: conf.name,
        is_milestone: conf.is_milestone || false,
        owner_roles: conf.owner_roles || [],
        visibility_usage_mode: conf.visibility_usage_mode || 1,
        status: 'pending' // 默认状态，后续可以通过其他API获取实际状态
      }));

      const connections = workflowResponse.data.connections || [];

      // 找到当前节点（这里简化处理，实际应该通过工作项状态确定）
      const currentNode = allNodes[0] || null; // 临时处理，取第一个节点作为当前节点

      // 分析前后节点关系
      const { previousNodes, nextNodes } = analyzeNodeRelations(
        currentNode,
        allNodes,
        connections
      );

      // 加载技能配置
      const configuredSkills = loadNodeSkillConfigs();

      // 过滤当前节点相关的技能配置
      const currentNodeSkills = configuredSkills.filter(
        config => config.nodeId === currentNode?.state_key
      );

      setFlowState({
        currentNode,
        previousNodes,
        nextNodes,
        configuredSkills: currentNodeSkills,
        isLoading: false,
        error: null,
        lastUpdated: Date.now()
      });

    } catch (error) {
      console.error('[useNodeFlow] Failed to load workflow data:', error);
      setFlowState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }, []);

  /**
   * 分析节点前后关系
   */
  const analyzeNodeRelations = useCallback((
    currentNode: WorkflowNode | null,
    allNodes: WorkflowNode[],
    connections: Array<{ source_state_key: string; target_state_key: string }>
  ) => {
    if (!currentNode) {
      return { previousNodes: [], nextNodes: [] };
    }

    const currentStateKey = currentNode.state_key;

    // 找到指向当前节点的连接（前置节点）
    const incomingConnections = connections.filter(
      conn => conn.target_state_key === currentStateKey
    );
    const previousNodeKeys = incomingConnections.map(conn => conn.source_state_key);
    const previousNodes = allNodes.filter(node =>
      previousNodeKeys.includes(node.state_key)
    );

    // 找到从当前节点出发的连接（后续节点）
    const outgoingConnections = connections.filter(
      conn => conn.source_state_key === currentStateKey
    );
    const nextNodeKeys = outgoingConnections.map(conn => conn.target_state_key);
    const nextNodes = allNodes.filter(node =>
      nextNodeKeys.includes(node.state_key)
    );

    return { previousNodes, nextNodes };
  }, []);

  /**
   * 加载节点技能配置
   */
  const loadNodeSkillConfigs = useCallback((): NodeSkillConfig[] => {
    try {
      const savedConfigs = localStorage.getItem('workflow-skill-configs');
      return savedConfigs ? JSON.parse(savedConfigs) : [];
    } catch (error) {
      console.warn('[useNodeFlow] Failed to load skill configs:', error);
      return [];
    }
  }, []);

  /**
   * 刷新流程数据
   */
  const refreshFlow = useCallback(async (): Promise<void> => {
    await loadWorkflowData();
  }, [loadWorkflowData]);

  /**
   * 导航到指定节点
   */
  const navigateToNode = useCallback(async (nodeId: string): Promise<void> => {
    try {
      setFlowState(prev => ({ ...prev, isLoading: true }));

      // 这里应该调用实际的节点转移API
      // 暂时模拟节点切换
      const { previousNodes, nextNodes, configuredSkills } = flowState;
      const allRelatedNodes = [
        flowState.currentNode,
        ...previousNodes,
        ...nextNodes
      ].filter((node): node is WorkflowNode => node !== null);

      const targetNode = allRelatedNodes.find(node => node.state_key === nodeId);

      if (!targetNode) {
        throw new Error(`节点 ${nodeId} 不存在或不可访问`);
      }

      // 更新当前节点
      const newCurrentNode = { ...targetNode, status: 'active' as const };

      // 重新计算前后节点关系
      // 这里简化处理，实际应该重新调用API获取完整数据
      const newConfiguredSkills = configuredSkills.filter(
        config => config.nodeId === nodeId
      );

      setFlowState(prev => ({
        ...prev,
        currentNode: newCurrentNode,
        configuredSkills: newConfiguredSkills,
        isLoading: false,
        lastUpdated: Date.now()
      }));

      // 通知监听器
      nodeChangeCallbacks.current.forEach(callback => {
        try {
          callback(newCurrentNode);
        } catch (error) {
          console.error('[useNodeFlow] Error in node change callback:', error);
        }
      });

      console.log(`[useNodeFlow] Navigated to node: ${targetNode.name}`);

    } catch (error) {
      console.error('[useNodeFlow] Failed to navigate to node:', error);
      setFlowState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }, [flowState]);

  /**
   * 注册节点变化监听器
   */
  const onNodeChange = useCallback((callback: (node: WorkflowNode | null) => void): void => {
    nodeChangeCallbacks.current.push(callback);

    // 返回取消注册的函数
    return () => {
      const index = nodeChangeCallbacks.current.indexOf(callback);
      if (index > -1) {
        nodeChangeCallbacks.current.splice(index, 1);
      }
    };
  }, []);

  /**
   * 获取工作流上下文
   */
  const getWorkflowContext = useCallback(async (): Promise<WorkflowContext | null> => {
    if (!flowState.currentNode) {
      return null;
    }

    try {
      const context = await window.JSSDK.Context.load();
      const tabContext = await window.JSSDK.tab.getContext();

      if (!context.activeWorkItem || !tabContext.spaceId || !tabContext.workObjectId) {
        return null;
      }

      const workflowContext: WorkflowContext = {
        nodeId: flowState.currentNode.state_key,
        nodeName: flowState.currentNode.name,
        workItemId: context.activeWorkItem.id.toString(),
        workItemType: 'story', // 默认类型，实际应从context获取
        workItemTitle: context.activeWorkItem.title || '',
        configuredSkills: flowState.configuredSkills.map(config => config.skill),
        nodeStatus: 'active',
        previousNodes: flowState.previousNodes.map(node => node.state_key),
        nextNodes: flowState.nextNodes.map(node => node.state_key),
        spaceId: tabContext.spaceId,
        workObjectId: tabContext.workObjectId
      };

      return workflowContext;
    } catch (error) {
      console.error('[useNodeFlow] Failed to get workflow context:', error);
      return null;
    }
  }, [flowState]);

  /**
   * 开始轮询节点状态变化
   */
  const startPolling = useCallback((intervalMs: number = 30000): void => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }

    pollingInterval.current = setInterval(() => {
      loadWorkflowData().catch(error => {
        console.error('[useNodeFlow] Polling failed:', error);
      });
    }, intervalMs);
  }, [loadWorkflowData]);

  /**
   * 停止轮询
   */
  const stopPolling = useCallback((): void => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, []);

  // 初始化：加载数据和开始轮询
  useEffect(() => {
    loadWorkflowData();
    startPolling();

    return () => {
      stopPolling();
    };
  }, [loadWorkflowData, startPolling, stopPolling]);

  // 清理：停止轮询
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    flowState,
    refreshFlow,
    navigateToNode,
    onNodeChange,
    getWorkflowContext,
    startPolling,
    stopPolling
  };
}