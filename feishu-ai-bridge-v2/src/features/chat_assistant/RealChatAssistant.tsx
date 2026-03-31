// 真实的聊天助手组件 - 连接本地Claude Code
import React, { useState, useEffect, useRef } from 'react';
import { ClaudeCodeClient, detectClaudeCodePort } from './services/claudeCodeClient';
import { workflowNodeService } from './services/workflowNodeService';
import CurrentNodesPanel from './components/CurrentNodesPanel';
import ImpactPanel from './components/ImpactPanel';
import { useWorkItemContext } from '../../hooks/useContext';
import { MCPClient } from '../../api/mcp';
import { fetchCallFlow, fetchImpactGraph, fetchSymbolContext, getEndpoint } from '../../services/gitnexus';
import { GitNexusCallFlow, GitNexusImpactGraph, GitNexusSymbolContext } from '../../types/gitnexus';
import {
  DetectedImpactTarget,
  extractLatestImplementationSnippet,
  inferImpactTarget,
  ImplementationSnippet,
} from './utils/inferImpactTarget';
import { WorkflowNodeInfo } from './services/workflowNodeService';
import {
  buildMemoryFilePayload,
  MemoryChatMessage,
  syncMemoryFileToFeishu,
} from './services/nodeMemoryService';
import { loadWorkflowSkillConfigs } from '../../utils/workflowSkillStorage';
import {
  appendWorkflowMemoryEntry,
  loadPredecessorNodeMemories,
  operateWorkflowNode,
  WorkflowMemoryEntry,
} from './services/workflowMemoryService';
import './styles/ChatAssistant.css';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: number;
  streaming?: boolean;
}

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  port: number | null;
  host: string;
}

interface ActiveDevelopmentNode {
  id: string;
  name: string;
  skills: string[];
  skillDisplayNames: string[];
}

export default function RealChatAssistant() {
  const DEFAULT_CHAT_SPLIT = 0.62;
  const MIN_CHAT_SPLIT = 0.32;
  const MAX_CHAT_SPLIT = 0.78;
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: '🤖 正在检测本地Claude Code连接...',
      timestamp: Date.now()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    connected: false,
    connecting: true,
    error: null,
    port: null,
    host: '127.0.0.1'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStreamingId, setCurrentStreamingId] = useState<string | null>(null);
  const [autoSkillsTriggered, setAutoSkillsTriggered] = useState(new Set<string>());
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [impact, setImpact] = useState<GitNexusImpactGraph | null>(null);
  const [symbolContext, setSymbolContext] = useState<GitNexusSymbolContext | null>(null);
  const [callFlow, setCallFlow] = useState<GitNexusCallFlow | null>(null);
  const [detectedTarget, setDetectedTarget] = useState<DetectedImpactTarget | null>(null);
  const [activeTarget, setActiveTarget] = useState<DetectedImpactTarget | null>(null);
  const [targetOptions, setTargetOptions] = useState<DetectedImpactTarget[]>([]);
  const [implementationSnippet, setImplementationSnippet] = useState<ImplementationSnippet | null>(null);
  const [activeDevelopmentNode, setActiveDevelopmentNode] = useState<ActiveDevelopmentNode | null>(null);
  const [predecessorMemories, setPredecessorMemories] = useState<WorkflowMemoryEntry[]>([]);
  const [chatSplitRatio, setChatSplitRatio] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_CHAT_SPLIT;
    }

    const saved = Number(window.localStorage.getItem('feishu-ai-bridge-chat-split'));
    if (Number.isFinite(saved) && saved >= MIN_CHAT_SPLIT && saved <= MAX_CHAT_SPLIT) {
      return saved;
    }

    return DEFAULT_CHAT_SPLIT;
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);

  const claudeCodeClientRef = useRef<ClaudeCodeClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestImpactRequestRef = useRef(0);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // 获取工作项上下文
  const { spaceId, workItemType, workItemId, projectKey } = useWorkItemContext();

  const retryAsync = async <T,>(task: () => Promise<T>, retries = 2): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await task();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('操作失败');
  };

  const fetchPredecessorMemories = async (node: WorkflowNodeInfo): Promise<WorkflowMemoryEntry[]> => {
    if (!spaceId || !workItemType || !workItemId) {
      return [];
    }
    return loadPredecessorNodeMemories({
      spaceId,
      workObjectId: workItemType,
      workItemId,
      currentNode: node,
    });
  };

  const createMemorySummary = (files: WorkflowMemoryEntry[]) => {
    if (files.length === 0) {
      return '暂无前序节点记忆文件。';
    }

    return files
      .map((file) => {
        const compact = file.memoryFile.replace(/\s+/g, ' ').slice(0, 180);
        return `- ${file.nodeName}：${compact}${file.memoryFile.length > 180 ? '...' : ''}`;
      })
      .join('\n');
  };

  const sendAssistantPrompt = async (prompt: string, context?: Record<string, unknown>) => {
    if (!claudeCodeClientRef.current || !connectionState.connected) {
      throw new Error('Claude Code 未连接');
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    const assistantMessageId = `${Date.now() + 1}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      type: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
      streaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsProcessing(true);
    setCurrentStreamingId(assistantMessageId);

    try {
      const response = await claudeCodeClientRef.current.sendMessage(prompt, context);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: response || '收到空响应', streaming: false }
            : msg
        )
      );

      await updateImpactFromConversation(response || '', prompt);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== assistantMessageId);
        return [
          ...filtered,
          {
            id: `${Date.now()}`,
            type: 'error',
            content: `❌ 自动加载节点上下文失败: ${errorMsg}`,
            timestamp: Date.now(),
          },
        ];
      });
      throw error;
    } finally {
      setIsProcessing(false);
      setCurrentStreamingId(null);
    }
  };

  // 初始化检测Claude Code
  useEffect(() => {
    initializeClaudeCodeConnection();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('feishu-ai-bridge-chat-split', String(chatSplitRatio));
  }, [chatSplitRatio]);

  useEffect(() => {
    if (!isDraggingSplitter) {
      return undefined;
    }

    const updateRatio = (clientX: number) => {
      const container = splitContainerRef.current;
      if (!container) {
        return;
      }

      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0) {
        return;
      }

      const rawRatio = (clientX - bounds.left) / bounds.width;
      const nextRatio = Math.min(MAX_CHAT_SPLIT, Math.max(MIN_CHAT_SPLIT, rawRatio));
      setChatSplitRatio(nextRatio);
    };

    const handleMouseMove = (event: MouseEvent) => {
      updateRatio(event.clientX);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches[0]) {
        updateRatio(event.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      setIsDraggingSplitter(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDraggingSplitter]);

  /**
   * 初始化Claude Code连接
   */
  const initializeClaudeCodeConnection = async () => {
    try {
      setConnectionState(prev => ({ ...prev, connecting: true, error: null }));

      addSystemMessage('🔍 正在检测Claude Code端口...');
      addSystemMessage('📝 检测中: 3000, 8080, 8000, 8081, 3001, 5000');

      // 检测Claude Code运行端口
      const detectedPort = await detectClaudeCodePort();

      if (!detectedPort) {
        throw new Error('未检测到Claude Code运行实例。请确保Claude Code正在运行。');
      }

      addSystemMessage(`✅ 检测到Claude Code运行在端口 ${detectedPort}`);

      // 创建客户端
      claudeCodeClientRef.current = new ClaudeCodeClient({
        host: connectionState.host,
        port: detectedPort
      });

      // 测试连接
      const isHealthy = await claudeCodeClientRef.current.isRunning();

      if (!isHealthy) {
        throw new Error(`端口 ${detectedPort} 上的服务无法响应健康检查`);
      }

      setConnectionState({
        connected: true,
        connecting: false,
        error: null,
        port: detectedPort,
        host: connectionState.host
      });

      addSystemMessage(`🎉 Claude Code连接成功！可以开始对话了。`);

      // 发送欢迎消息
      setTimeout(() => {
        addSystemMessage(`💡 提示: 你可以向Claude Code发送任何消息，包括代码问题、工作流指令等。`);
      }, 1000);

      // 自动触发当前节点配置的技能
      setTimeout(() => {
        autoTriggerNodeSkills();
      }, 2000);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setConnectionState({
        connected: false,
        connecting: false,
        error: errorMsg,
        port: null,
        host: connectionState.host
      });

      addSystemMessage(`❌ 连接失败: ${errorMsg}`);

      // 提供更详细的帮助信息
      addSystemMessage(`💡 解决方案:`);
      addSystemMessage(`1. 确保 Claude Code 正在运行`);
      addSystemMessage(`2. 常见启动方式: 在终端运行 "claude-code" 或 "npx claude-code"`);
      addSystemMessage(`3. Claude Code 通常在以下端口启动: 3000, 8080, 8000`);
      addSystemMessage(`4. 检查防火墙设置是否阻止了连接`);
      addSystemMessage(`🔧 解决方案: 请启动Claude Code并确保它在默认端口(8080、3000等)运行`);
    }
  };

  /**
   * 添加系统消息
   */
  const addSystemMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, message]);
  };

  const mergeTargetOption = (target: DetectedImpactTarget) => {
    setTargetOptions((prev) => {
      const next = [target, ...prev.filter((item) => !(item.filePath === target.filePath && item.symbol === target.symbol))];
      return next.slice(0, 8);
    });
  };

  const loadImpactForTarget = async (target: DetectedImpactTarget) => {
    const requestId = Date.now();
    latestImpactRequestRef.current = requestId;
    setImpactLoading(true);
    setImpactError(null);
    setDetectedTarget(target);
    setActiveTarget(target);
    mergeTargetOption(target);

    try {
      const [impactResult, contextResult, flowResult] = await Promise.all([
        fetchImpactGraph({ filePath: target.filePath, symbol: target.symbol, depth: 2, direction: 'both' }),
        fetchSymbolContext({ filePath: target.filePath, symbol: target.symbol }),
        fetchCallFlow({ filePath: target.filePath, symbol: target.symbol, depth: 2, direction: 'both' }),
      ]);

      if (latestImpactRequestRef.current !== requestId) {
        return;
      }

      setImpact(impactResult);
      setSymbolContext(contextResult);
      setCallFlow(flowResult);
    } catch (error) {
      if (latestImpactRequestRef.current !== requestId) {
        return;
      }
      setImpactError(error instanceof Error ? error.message : '影响分析失败');
    } finally {
      if (latestImpactRequestRef.current === requestId) {
        setImpactLoading(false);
      }
    }
  };

  const updateImpactFromConversation = async (assistantText?: string, userText?: string) => {
    const inferredTarget = inferImpactTarget({
      assistantText,
      userText,
      fallbackTarget: activeTarget,
    });

    setImplementationSnippet(assistantText ? extractLatestImplementationSnippet(assistantText) : null);

    if (!inferredTarget) {
      return;
    }

    await loadImpactForTarget(inferredTarget);
  };

  /**
   * 重新连接
   */
  const reconnect = async () => {
    await initializeClaudeCodeConnection();
  };

  /**
   * 发送消息
   */
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !connectionState.connected || isProcessing) {
      return;
    }

    const messageContent = inputMessage.trim();
    setInputMessage('');

    try {
      await sendAssistantPrompt(messageContent, {
        nodeId: activeDevelopmentNode?.id || 'current',
        timestamp: Date.now(),
        skills: activeDevelopmentNode?.skills || [],
        workflowContext: {
          activeNode: activeDevelopmentNode,
          predecessorMemoryFiles: predecessorMemories.map((item) => ({
            nodeName: item.nodeName,
            fileName: item.fileName,
            filePath: item.filePath,
          })),
        },
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'error',
          content: `❌ 发送失败: ${errorMsg}`,
          timestamp: Date.now()
        }
      ]);

      // 如果是连接错误，更新连接状态
      if (errorMsg.includes('连接') || errorMsg.includes('网络')) {
        setConnectionState(prev => ({
          ...prev,
          connected: false,
          error: errorMsg
        }));
      }
    } finally {
      setInputMessage('');
    }
  };

  /**
   * 处理节点技能触发 (从节点面板触发)
   */
  const handleNodeSkillTrigger = async (skillName: string, nodeId: string) => {
    if (!connectionState.connected || !claudeCodeClientRef.current) {
      addSystemMessage(`❌ 无法执行节点技能 ${skillName}: 未连接到Claude Code`);
      return;
    }

    addSystemMessage(`🎯 节点技能触发: ${skillName} (节点ID: ${nodeId})`);

    try {
      const result = await claudeCodeClientRef.current.executeSkill(skillName, {
        timestamp: Date.now(),
        interface: 'feishu-plugin',
        nodeId: nodeId,
        autoTriggered: true
      });

      addSystemMessage(`✅ 节点技能 ${skillName} 执行完成`);

      // 添加技能执行结果
      const resultMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `**节点技能执行结果 (${skillName}):**\n\n${result}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, resultMessage]);
      await updateImpactFromConversation(result, `执行节点技能 ${skillName}`);

      // 标记该节点的技能已触发，避免重复自动触发
      setAutoSkillsTriggered(prev => new Set(prev).add(`${nodeId}-${skillName}`));

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addSystemMessage(`❌ 节点技能 ${skillName} 执行失败: ${errorMsg}`);
    }
  };

  const handleNodeActivate = async (
    node: WorkflowNodeInfo & { skills: string[]; skillDisplayNames: string[] }
  ) => {
    const scopedConfigs = loadWorkflowSkillConfigs({
      spaceId,
      workObjectId: workItemType,
      workItemId,
    });
    const matchedConfig = scopedConfigs.find((config) => config.nodeId === node.id || config.nodeId === node.state_key);
    const configuredSkills = node.skills.length > 0
      ? node.skills
      : matchedConfig?.skill
        ? [matchedConfig.skill]
        : [];
    const configuredSkillDisplayNames = node.skillDisplayNames.length > 0
      ? node.skillDisplayNames
      : configuredSkills;

    setActiveDevelopmentNode({
      id: node.id,
      name: node.name,
      skills: configuredSkills,
      skillDisplayNames: configuredSkillDisplayNames,
    });

    let memoryFiles: MemoryReferenceFile[] = [];
    try {
      memoryFiles = await fetchPredecessorMemories(node);
      setPredecessorMemories(memoryFiles);
    } catch (error) {
      console.error('[RealChatAssistant] Failed to load predecessor memories:', error);
      setPredecessorMemories([]);
    }

    const summary = createMemorySummary(memoryFiles);
    addSystemMessage(
      `🧭 已切换到节点「${node.name}」，当前Agent: ${configuredSkillDisplayNames.join('、') || 'Claude Code'}。`
    );

    if (!connectionState.connected) {
      addSystemMessage('⚠️ Claude Code 当前未连接，已仅加载节点上下文。');
      return;
    }

    const kickoffPrompt = [
      `请开始处理当前工作流节点「${node.name}」。`,
      configuredSkillDisplayNames.length > 0
        ? `当前节点选用的Agent/技能: ${configuredSkillDisplayNames.join('、')}`
        : '当前节点未显式配置技能，请按 Claude Code 默认开发方式推进。',
      '请优先参考以下前序节点记忆文件摘要，再继续当前节点开发：',
      summary,
      '先给出你对当前节点开发任务的理解、准备执行的步骤，以及接下来要修改的重点。',
    ].join('\n\n');

    try {
      await sendAssistantPrompt(kickoffPrompt, {
        nodeId: node.id,
        timestamp: Date.now(),
        skills: configuredSkills,
        workflowContext: {
          activeNode: {
            id: node.id,
            name: node.name,
            status: node.status,
          },
          predecessorMemories: memoryFiles.map((file) => ({
            nodeName: file.nodeName,
            nodeId: file.nodeId,
            content: file.memoryFile,
          })),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addSystemMessage(`❌ 节点「${node.name}」上下文已加载，但 Claude 自动启动失败: ${errorMessage}`);
    }
  };

  /**
   * 自动触发当前节点配置的技能
   */
  const autoTriggerNodeSkills = async () => {
    if (!spaceId || !workItemType || !workItemId || !connectionState.connected) {
      return;
    }

    try {
      // 获取当前进行中的节点
      const runningNodes = await workflowNodeService.getCurrentRunningNodes(
        spaceId,
        workItemType,
        workItemId
      );

      for (const node of runningNodes) {
        // 触发该节点配置的gstack技能
        await workflowNodeService.triggerNodeSkills(node.id, async (skillName) => {
          const triggerKey = `${node.id}-${skillName}`;

          // 避免重复触发同一个节点的同一个技能
          if (!autoSkillsTriggered.has(triggerKey)) {
            console.log(`[RealChatAssistant] 自动触发节点技能: ${skillName} (节点: ${node.name})`);

            addSystemMessage(`🤖 自动触发节点技能: ${skillName} (节点: ${node.name})`);
            await handleNodeSkillTrigger(skillName, node.id);
          }
        });
      }
    } catch (error) {
      console.error('[RealChatAssistant] 自动触发节点技能失败:', error);
    }
  };

  /**
   * 执行技能
   */
  const executeSkill = async (skillName: string) => {
    if (!connectionState.connected || !claudeCodeClientRef.current) {
      addSystemMessage(`❌ 无法执行技能 ${skillName}: 未连接到Claude Code`);
      return;
    }

    addSystemMessage(`⚡ 正在执行技能: ${skillName}...`);

    try {
      const result = await claudeCodeClientRef.current.executeSkill(skillName, {
        timestamp: Date.now(),
        interface: 'feishu-plugin'
      });

      addSystemMessage(`✅ 技能 ${skillName} 执行完成`);

      // 添加技能执行结果
      const resultMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `**技能执行结果 (${skillName}):**\n\n${result}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, resultMessage]);
      await updateImpactFromConversation(result, `执行技能 ${skillName}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addSystemMessage(`❌ 技能 ${skillName} 执行失败: ${errorMsg}`);
    }
  };

  /**
   * 格式化时间
   */
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * 清空聊天历史
   */
  const clearHistory = () => {
    setMessages([{
      id: Date.now().toString(),
      type: 'system',
      content: '聊天历史已清空',
      timestamp: Date.now()
    }]);
  };

  const handleNodeComplete = async (node: WorkflowNodeInfo) => {
    if (!spaceId || !workItemType || !workItemId) {
      addSystemMessage('❌ 当前工作项上下文不完整，无法生成记忆文件。');
      return;
    }

    if (!claudeCodeClientRef.current || !connectionState.connected) {
      addSystemMessage('❌ Claude Code 未连接，无法生成节点记忆文件。');
      return;
    }

    addSystemMessage(`🧠 开始为节点「${node.name}」生成记忆文件...`);

    let failedStage = '初始化节点记忆流程';

    try {
      failedStage = '构建记忆文件上下文';
      const memoryPayload = await buildMemoryFilePayload({
        spaceId,
        workItemType,
        workItemId,
        projectKey,
        node,
        messages: messages.map<MemoryChatMessage>((message) => ({
          type: message.type,
          content: message.content,
          timestamp: message.timestamp,
        })),
        workspaceRoot: '/Users/bytedance/project/project/feishu-ai-bridge-v2',
        detectedFilePath: activeTarget?.filePath,
        implementationSnippet: implementationSnippet?.code || null,
      });

      failedStage = '生成 Markdown 记忆文件';
      const memoryFile = await retryAsync(
        () => claudeCodeClientRef.current!.generateMemoryFile(memoryPayload),
        2
      );

      let syncResult: { fieldSynced: boolean; commentPublished: boolean; fieldKey: string } = {
        fieldSynced: false,
        commentPublished: false,
        fieldKey: '记忆文件',
      };

      let workflowMemoryResult: { fieldKey: string; entryCount: number } | null = null;
      if (spaceId && workItemType && workItemId) {
        failedStage = '写入流程记忆复合字段并上传 Markdown 附件';
        workflowMemoryResult = await retryAsync(
          () =>
            appendWorkflowMemoryEntry({
              spaceId,
              workObjectId: workItemType,
              workItemId,
              entry: {
                nodeId: node.id,
                nodeName: node.name,
                memoryFile: memoryFile.content,
              },
              attachmentFile: {
                fileName: memoryFile.fileName,
                content: memoryFile.content,
              },
            }),
          2
        );
      }

      failedStage = '同步记忆文件字段与评论';
      syncResult = await retryAsync(
        () => syncMemoryFileToFeishu({
          workItemId,
          workItemType,
          file: memoryFile,
          nodeName: node.name,
          projectKey: spaceId,
        }),
        2
      );

      let operateResult: any = null;
      if (spaceId && workItemType && workItemId) {
        failedStage = '触发节点完成接口';
        operateResult = await retryAsync(
          () =>
            operateWorkflowNode({
              projectKey: spaceId,
              workItemTypeKey: workItemType,
              workItemId,
              nodeId: node.id,
              action: 'confirm',
              rollbackReason: '完成节点',
              nodeOwners: Array.isArray(node.owners) ? node.owners : [],
            }),
          2
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          type: 'assistant',
          content: [
            `**节点记忆文件生成完成**`,
            '',
            `- 节点: ${node.name}`,
            `- 文件名: ${memoryFile.fileName}`,
            `- 备份路径: ${memoryFile.filePath}`,
            `- 字段写回: ${syncResult.fieldSynced ? '成功' : `失败（字段: ${syncResult.fieldKey}）`}`,
            `- 流程记忆: ${workflowMemoryResult ? `已写入 ${workflowMemoryResult.fieldKey}${workflowMemoryResult.uploadedAsAttachment ? '（附件已上传）' : ''}` : '未写入'}`,
            `- 节点完成接口: ${operateResult ? '已触发' : '未触发'}`,
          ].join('\n'),
          timestamp: Date.now(),
        },
      ]);

      if (syncResult.fieldSynced) {
        addSystemMessage(`✅ 节点「${node.name}」记忆文件已生成，已写回字段并同步到流程记忆，节点完成接口已触发。`);
      } else {
        addSystemMessage(`⚠️ 节点「${node.name}」记忆文件已生成，并已同步到流程记忆；工作项字段写回失败，备份文件已保留在本地。`);
      }

      setActiveDevelopmentNode(null);
      setPredecessorMemories([]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      try {
        const mcpClient = new MCPClient();
        await mcpClient.addComment(
          workItemId,
          '当前AI Agent节点记忆文件生成失败，请检查技能配置及存储路径',
          spaceId
        );
      } catch (commentError) {
        console.error('[RealChatAssistant] Failed to publish memory file error comment:', commentError);
      }

      addSystemMessage(`❌ 节点「${node.name}」执行失败（阶段: ${failedStage}）: ${errorMessage}`);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          type: 'error',
          content: `当前AI Agent节点执行失败（阶段: ${failedStage}），请检查技能配置、字段权限和存储路径`,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  return (
    <div className="chat-assistant-container">
      {/* 页面标题 */}
      <div className="assistant-header">
        <div className="header-title">
          <h1>🔷 Claude Code 聊天</h1>
          <p>与本地Claude Code实例进行实时对话</p>
        </div>

        {/* 连接状态 */}
        <div className="status-overview">
          <div className="status-item">
            <span className="status-label">连接状态:</span>
            <span className={`status-value ${connectionState.connected ? 'connected' : 'disconnected'}`}>
              {connectionState.connecting ? '🟡 连接中...' :
               connectionState.connected ? '🟢 已连接' : '🔴 未连接'}
            </span>
          </div>
          {connectionState.port && (
            <div className="status-item">
              <span className="status-label">端口:</span>
              <span className="status-value">{connectionState.host}:{connectionState.port}</span>
            </div>
          )}
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="assistant-main-content">
        {/* 当前节点面板 */}
        <CurrentNodesPanel
          onSkillTrigger={handleNodeSkillTrigger}
          onNodeComplete={handleNodeComplete}
          onNodeActivate={handleNodeActivate}
          activeNodeId={activeDevelopmentNode?.id || null}
          refreshInterval={30000}
        />

        <div
          ref={splitContainerRef}
          className={`ai-chat-section ${isDraggingSplitter ? 'is-dragging' : ''}`}
        >
          <div
            className="chat-primary-column"
            style={{ flexBasis: `${chatSplitRatio * 100}%` }}
          >
            <div className="chat-window-wrapper">
              <div className="chat-window">
              {/* 聊天窗口标题栏 */}
              <div className="chat-header">
                <div className="header-main">
                  <h3>💬 Claude Code 对话</h3>
                  {activeDevelopmentNode && (
                    <div className="active-node-context">
                      <span className="active-node-context-label">当前开发节点</span>
                      <span className="active-node-context-name">{activeDevelopmentNode.name}</span>
                      <span className="active-node-context-agent">
                        Agent: {activeDevelopmentNode.skillDisplayNames.join('、') || 'Claude Code'}
                      </span>
                      <span className="active-node-context-memory">
                        已加载前序记忆: {predecessorMemories.length} 份
                      </span>
                    </div>
                  )}
                </div>

                <div className="header-controls">
                  {/* 连接控制 */}
                  {!connectionState.connected && (
                    <>
                      <button
                        className="footer-btn"
                        onClick={reconnect}
                        disabled={connectionState.connecting}
                        title="重新连接Claude Code"
                      >
                        {connectionState.connecting ? '连接中...' : '🔄 重连'}
                      </button>

                      <button
                        className="footer-btn"
                        onClick={() => {
                          const port = prompt('输入Claude Code端口号 (如: 3000, 8080, 或其他):', '3000');
                          if (port && port.trim()) {
                            const portNum = parseInt(port.trim(), 10);
                            if (!isNaN(portNum) && portNum > 0 && portNum < 65536) {
                              claudeCodeClientRef.current = new ClaudeCodeClient({
                                host: connectionState.host,
                                port: portNum
                              });
                              addSystemMessage(`🔧 尝试连接到手动指定端口: ${portNum}`);
                              reconnect();
                            } else {
                              addSystemMessage(`❌ 无效端口号: ${port}`);
                            }
                          }
                        }}
                        title="手动设置Claude Code端口"
                      >
                        🔧 手动设置
                      </button>
                    </>
                  )}

                  {/* 清理历史按钮 */}
                  <button
                    className="clear-history-btn"
                    onClick={clearHistory}
                    title="清空聊天历史"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* 消息列表 */}
              <div className="messages-container">
                <div className="messages-list">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`message-item message-${message.type}`}
                    >
                      <div className="message-header">
                        <span className="message-sender">
                          {message.type === 'user' ? '👤 您' :
                           message.type === 'system' ? '🤖 系统' :
                           message.type === 'error' ? '❌ 错误' :
                           '🔷 Claude Code'}
                        </span>
                        <span className="message-time">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>

                      <div className="message-body">
                        <div className="message-content-text">
                          {message.content.split('\n').map((line, index) => (
                            <div key={index}>{line}</div>
                          ))}
                          {message.streaming && (
                            <span className="streaming-indicator">▋</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* 处理指示器 */}
                  {isProcessing && (
                    <div className="processing-indicator">
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span className="processing-text">Claude Code 正在思考...</span>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </div>

              {/* 快速建议 */}
              <div className="quick-suggestions">
                {[
                  '你好，Claude Code',
                  '帮我分析一下当前项目',
                  '执行代码检查',
                  '生成项目摘要'
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    className="suggestion-chip"
                    onClick={() => setInputMessage(suggestion)}
                    disabled={!connectionState.connected || isProcessing}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {/* 技能按钮 */}
              <div className="quick-suggestions">
                {[
                  { name: 'plan-eng-review', label: '🔧 工程审查', icon: '🔧' },
                  { name: 'investigate', label: '🔍 调查分析', icon: '🔍' },
                  { name: 'review', label: '📝 代码审查', icon: '📝' },
                  { name: 'qa', label: '✅ 质量检查', icon: '✅' }
                ].map((skill) => (
                  <button
                    key={skill.name}
                    className="suggestion-chip"
                    onClick={() => executeSkill(skill.name)}
                    disabled={!connectionState.connected || isProcessing}
                    title={`执行 ${skill.name} 技能`}
                  >
                    {skill.icon} {skill.label}
                  </button>
                ))}
              </div>

              {/* 消息输入区 */}
              <div className="message-input-area">
                {/* 工具栏 */}
                <div className="input-toolbar">
                  <span className="input-hint">
                    {connectionState.connected
                      ? `与Claude Code对话 (${connectionState.host}:${connectionState.port})`
                      : "请先连接Claude Code"}
                  </span>
                </div>

                {/* 输入框区域 */}
                <div className="input-container">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={
                      connectionState.connected
                        ? "输入消息... (Enter发送，Shift+Enter换行)"
                        : "请先连接Claude Code..."
                    }
                    disabled={!connectionState.connected || isProcessing}
                    rows={3}
                    className="message-input"
                  />

                  <button
                    className="send-button"
                    onClick={handleSendMessage}
                    disabled={!connectionState.connected || !inputMessage.trim() || isProcessing}
                    title="发送消息"
                  >
                    {isProcessing ? '发送中...' : '📤'}
                  </button>
                </div>
              </div>
              </div>
            </div>
          </div>

          <div
            className="chat-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="调整聊天窗口和GitNexus窗口宽度"
            tabIndex={0}
            onMouseDown={() => setIsDraggingSplitter(true)}
            onTouchStart={() => setIsDraggingSplitter(true)}
            onDoubleClick={() => setChatSplitRatio(DEFAULT_CHAT_SPLIT)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setChatSplitRatio((prev) => Math.max(MIN_CHAT_SPLIT, prev - 0.02));
              } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                setChatSplitRatio((prev) => Math.min(MAX_CHAT_SPLIT, prev + 0.02));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                setChatSplitRatio(DEFAULT_CHAT_SPLIT);
              }
            }}
          >
            <span className="chat-resizer-handle" />
          </div>

          <div
            className="chat-impact-column"
            style={{ flexBasis: `${(1 - chatSplitRatio) * 100}%` }}
          >
            <ImpactPanel
              loading={impactLoading}
              error={impactError}
              impact={impact}
              onRefresh={() => {
                if (activeTarget) {
                  void loadImpactForTarget(activeTarget);
                }
              }}
              detectedTarget={detectedTarget}
              implementationSnippet={implementationSnippet}
              symbolContext={symbolContext}
              callFlow={callFlow}
              targetOptions={targetOptions}
              activeTarget={activeTarget}
              onTargetSelect={(target) => {
                void loadImpactForTarget(target);
              }}
              gitnexusEndpoint={getEndpoint()}
            />
          </div>
        </div>
      </div>

      {/* 底部工具栏 */}
      <div className="assistant-footer">
        <div className="footer-actions">
          <button
            className="footer-btn"
            onClick={reconnect}
            disabled={connectionState.connecting}
          >
            🔄 {connectionState.connecting ? '连接中' : '重连'}
          </button>

          <button
            className="footer-btn"
            onClick={() => executeSkill('investigate')}
            disabled={!connectionState.connected || isProcessing}
          >
            🔍 项目分析
          </button>

          <button
            className="footer-btn"
            onClick={() => executeSkill('review')}
            disabled={!connectionState.connected || isProcessing}
          >
            📝 代码审查
          </button>
        </div>

        <div className="footer-info">
          <span className="info-text">
            Claude Code 聊天 v1.0 |
            {connectionState.connected
              ? ` 连接到 ${connectionState.host}:${connectionState.port}`
              : ' 未连接 - 请启动Claude Code或使用手动设置'}
          </span>
        </div>
      </div>
    </div>
  );
}
