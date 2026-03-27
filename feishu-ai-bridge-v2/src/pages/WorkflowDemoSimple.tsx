import React, { useState, useEffect } from 'react';
import '../features/ai_config/Config.css';
import { API_CONFIG } from '../constants';

/**
 * 简化版工作流系统演示页面
 * 避免复杂的imports，专注于监听逻辑演示
 */
export default function WorkflowDemoSimple() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [executionCount, setExecutionCount] = useState(0);
  const [mockWorkItems, setMockWorkItems] = useState<any[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]); // 保留最近20条
  };

  const initializeSystem = () => {
    addLog('🚀 开始初始化 AI 工作流系统...');

    setTimeout(() => addLog('✅ MCP 客户端初始化成功'), 500);
    setTimeout(() => addLog('✅ gstack 桥接服务初始化成功'), 1000);
    setTimeout(() => addLog('✅ 任务处理器初始化成功'), 1500);
    setTimeout(() => {
      addLog('✅ 工作流状态管理器初始化成功');
      addLog('🎉 系统初始化完成！');
      addLog('📋 加载了 1 条默认工作流规则：需求分析自动化');
      setIsInitialized(true);

      // 创建模拟工作项
      const mockItems = [
        {
          work_item_id: 'story_001',
          title: '用户登录功能需求分析',
          type: 'story',
          created_time: Date.now() - 30 * 60 * 1000, // 30分钟前
        },
        {
          work_item_id: 'story_002',
          title: '数据库设计优化',
          type: 'story',
          created_time: Date.now() - 10 * 60 * 1000, // 10分钟前
        }
      ];
      setMockWorkItems(mockItems);
      addLog(`📦 加载了 ${mockItems.length} 个历史工作项`);
    }, 2000);
  };

  const startListening = () => {
    if (!isInitialized) return;

    addLog('🎧 启动事件监听...');
    setIsListening(true);
    addLog('✅ 事件监听已启动 (30秒轮询间隔)');
    addLog('💡 提示：点击"模拟工作项创建"测试监听功能');
  };

  const stopListening = () => {
    addLog('⏸️ 停止事件监听...');
    setIsListening(false);
    addLog('✅ 事件监听已停止');
  };

  const simulateWorkItemCreation = () => {
    addLog('🧪 模拟在飞书项目中创建新工作项...');

    const newItem = {
      work_item_id: `mock_${Date.now()}`,
      title: `测试需求 - ${new Date().toLocaleTimeString()}`,
      type: 'story',
      created_time: Date.now(),
    };

    setMockWorkItems(prev => [...prev, newItem]);
    addLog(`📝 创建了工作项: ${newItem.work_item_id} - ${newItem.title}`);

    if (isListening) {
      setTimeout(() => {
        addLog('🔄 监听器检测到新工作项（模拟30秒轮询）');
        addLog('🎯 规则匹配：需求分析自动化 - 触发条件: on_create');
        addLog('✅ 规则匹配成功，开始执行工作流...');
        processWorkItem(newItem.work_item_id, newItem.title);
      }, 2000);
    } else {
      addLog('⚠️ 监听未启动，工作项不会被自动处理');
    }
  };

  const processWorkItem = (workItemId: string, title: string) => {
    const execCount = executionCount + 1;
    setExecutionCount(execCount);
    const executionId = `exec_${execCount}_${Date.now()}`;

    addLog(`▶️ 开始执行工作流: ${executionId}`);
    addLog(`📋 工作项: ${workItemId} - ${title}`);
    addLog(`🔧 使用规则: 需求分析自动化`);
    addLog(`🏷️ 自动分配给当前用户`);

    setTimeout(() => {
      addLog(`🤖 [${executionId}] 执行 gstack 技能: plan-eng-review`);
      addLog(`⚙️ [${executionId}] 分析工作项需求和技术方案...`);
    }, 1000);

    setTimeout(() => {
      addLog(`✅ [${executionId}] AI 分析完成，生成技术评审报告`);
      addLog(`📄 [${executionId}] 发布结构化评论到飞书工作项`);
      addLog(`🏷️ [${executionId}] 更新工作项字段: ai_analysis_status = completed`);
      addLog(`📋 [${executionId}] 创建 2 个后续任务：数据库设计、API开发`);
    }, 3000);

    setTimeout(() => {
      addLog(`🎉 [${executionId}] 工作流执行完成！`);
      addLog(`⏱️ [${executionId}] 执行耗时: 2.5秒`);
      addLog(`📊 [${executionId}] 分析质量评分: 85/100`);
      addLog('─'.repeat(60));
    }, 4000);
  };

  const manualProcess = () => {
    if (!isInitialized) {
      addLog('❌ 系统未初始化，请先初始化系统');
      return;
    }

    const workItemId = `manual_${Date.now()}`;
    addLog(`🔧 手动处理工作项: ${workItemId}`);
    processWorkItem(workItemId, '手动触发的测试工作项');
  };

  const testApiConnection = () => {
    addLog('🔍 测试飞书 MCP API 连接...');

    setTimeout(() => {
      addLog('✅ MCP API 连接成功');
      addLog('📊 项目信息: ntv21m');
      addLog('👤 当前用户: 7481325171635240962');
      addLog(`🔗 API 端点: https://${API_CONFIG.siteDomain}/mcp_server/v1`);
    }, 1000);

    setTimeout(() => {
      addLog('📋 获取工作项列表...');
      addLog('✅ 成功获取 5 个活跃工作项');
      addLog('🔍 检查最近创建的工作项...');
      addLog('📈 监听功能就绪，可以开始监听事件');
    }, 2000);
  };

  return (
    <div className="config-page">
      <div className="config-header">
        <div>
          <h1>🤖 AI 工作流系统演示</h1>
          <p>飞书项目 AI 协同自动化系统 - 简化版演示</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-create"
            onClick={() => setLogs([])}
          >
            🧹 清空日志
          </button>
        </div>
      </div>

      {/* 系统状态 */}
      <div className="rule-card" style={{ marginBottom: '20px' }}>
        <div className="rule-main">
          <h3>📊 系统状态</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
            <div>
              <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>初始化状态</h4>
              <div style={{ fontSize: '13px', color: isInitialized ? 'green' : 'orange' }}>
                {isInitialized ? '✅ 已初始化' : '⏳ 未初始化'}
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>监听状态</h4>
              <div style={{ fontSize: '13px', color: isListening ? 'green' : 'red' }}>
                {isListening ? '🟢 监听中' : '🔴 已停止'}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
            <div>工作项数量: {mockWorkItems.length}</div>
            <div>执行次数: {executionCount}</div>
          </div>
        </div>
      </div>

      {/* 控制面板 */}
      <div className="rule-card" style={{ marginBottom: '20px' }}>
        <div className="rule-main">
          <h3>🎛️ 控制面板</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>

            <div>
              <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>系统控制</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={initializeSystem}
                  disabled={isInitialized}
                  className="btn-create"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  {isInitialized ? '✅ 已初始化' : '🚀 初始化系统'}
                </button>
                <button
                  onClick={testApiConnection}
                  disabled={!isInitialized}
                  className="btn-create"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  🔍 测试API
                </button>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>监听控制</h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={startListening}
                  disabled={!isInitialized || isListening}
                  className="btn-create"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  ▶️ 启动监听
                </button>
                <button
                  onClick={stopListening}
                  disabled={!isListening}
                  className="btn-cancel"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  ⏸️ 停止监听
                </button>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>测试功能</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={simulateWorkItemCreation}
                  disabled={!isInitialized}
                  className="btn-create"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  🧪 模拟创建工作项
                </button>
                <button
                  onClick={manualProcess}
                  disabled={!isInitialized}
                  className="btn-create"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  🔧 手动处理
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="rule-card" style={{ marginBottom: '20px' }}>
        <div className="rule-main">
          <h3>📖 使用说明</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#6b7280' }}>
            <p><strong>测试流程：</strong></p>
            <ol style={{ marginLeft: '20px', marginTop: '8px' }}>
              <li>首先点击 "🚀 初始化系统" 初始化所有组件</li>
              <li>点击 "🔍 测试API" 验证飞书连接</li>
              <li>点击 "▶️ 启动监听" 开始监听飞书事件</li>
              <li>点击 "🧪 模拟创建工作项" 测试自动监听和处理功能</li>
              <li>观察右下方的系统日志，查看完整的执行过程</li>
            </ol>
            <p style={{ marginTop: '12px' }}>
              <strong>⚠️ 注意：</strong>这是演示版本，使用模拟数据。真实环境需要配置实际的gstack服务。
            </p>
          </div>
        </div>
      </div>

      {/* 系统日志 */}
      <div className="rule-card">
        <div className="rule-main">
          <h3>📋 系统日志 ({logs.length}/20)</h3>
          <div style={{
            marginTop: '12px',
            minHeight: '200px',
            maxHeight: '400px',
            overflowY: 'auto',
            background: '#1f2937',
            color: '#e5e7eb',
            padding: '12px',
            borderRadius: '6px',
            fontFamily: 'Monaco, Menlo, Consolas, monospace',
            fontSize: '11px',
            lineHeight: '1.4'
          }}>
            {logs.length === 0 ? (
              <div style={{ color: '#9ca3af' }}>系统准备就绪，请开始测试...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} style={{ marginBottom: '2px' }}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}