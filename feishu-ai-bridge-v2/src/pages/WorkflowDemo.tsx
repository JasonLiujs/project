import React, { useState, useEffect } from 'react';
import { FeishuAIBridgeApp, getApp, SystemStatus } from '../app';
import { WorkflowExecution } from '../types/workflow';
import '../utils/debugMonitor'; // 导入调试工具
import '../features/ai_config/Config.css';

/**
 * 工作流系统演示页面
 * 展示完整的 AI 协同自动化系统功能
 */
export default function WorkflowDemo() {
  const [app] = useState<FeishuAIBridgeApp>(() => getApp());
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [activeExecutions, setActiveExecutions] = useState<WorkflowExecution[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [userKey, setUserKey] = useState('7481325171635240962');
  const [manualWorkItemId, setManualWorkItemId] = useState('');

  useEffect(() => {
    // 定期刷新状态
    const interval = setInterval(async () => {
      if (isInitialized) {
        await refreshStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isInitialized]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]); // 保留最近20条
  };

  const refreshStatus = async () => {
    try {
      const status = app.getSystemStatus();
      setSystemStatus(status);

      if (status.initialized) {
        const [executions, statistics] = await Promise.all([
          app.getActiveExecutions(),
          app.getExecutionStats(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
        ]);
        setActiveExecutions(executions);
        setStats(statistics);
      }
    } catch (error) {
      console.error('Failed to refresh status:', error);
    }
  };

  const handleInitialize = async () => {
    setIsInitializing(true);
    addLog('开始初始化 AI 工作流系统...');

    try {
      await app.initialize(userKey);
      setIsInitialized(true);
      addLog('系统初始化成功！');
      await refreshStatus();
    } catch (error) {
      addLog(`初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleStartEventListening = async () => {
    try {
      await app.startEventListening();
      addLog('事件监听已启动');
      await refreshStatus();
    } catch (error) {
      addLog(`启动事件监听失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleStopEventListening = () => {
    try {
      app.stopEventListening();
      addLog('事件监听已停止');
      setTimeout(refreshStatus, 1000);
    } catch (error) {
      addLog(`停止事件监听失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleManualProcess = async () => {
    if (!manualWorkItemId.trim()) {
      addLog('请输入工作项ID');
      return;
    }

    try {
      addLog(`手动处理工作项: ${manualWorkItemId}`);
      const result = await app.processWorkItem(manualWorkItemId, 'story');

      if (result.success) {
        addLog(`工作项处理成功，执行ID: ${result.executionId}`);
      } else {
        addLog(`工作项处理失败: ${result.error}`);
      }

      await refreshStatus();
    } catch (error) {
      addLog(`处理工作项失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleTriggerEventCheck = async () => {
    try {
      addLog('手动触发事件检查...');
      const result = await app.triggerEventCheck();
      addLog(`事件检查完成，耗时: ${result.checkTime}ms`);
      if (result.errors?.length) {
        addLog(`发现错误: ${result.errors.join(', ')}`);
      }
      await refreshStatus();
    } catch (error) {
      addLog(`触发事件检查失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleCleanup = async () => {
    try {
      const cleanedCount = await app.cleanupExpiredExecutions(7);
      addLog(`清理了 ${cleanedCount} 条过期执行记录`);
      await refreshStatus();
    } catch (error) {
      addLog(`清理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getExecutionStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'failed': return 'red';
      case 'analyzing': return 'blue';
      case 'pending': return 'orange';
      default: return 'gray';
    }
  };

  return (
    <div className="config-page">
      <div className="config-header">
        <div>
          <h1>🤖 AI 工作流系统演示</h1>
          <p>完整的飞书项目 AI 协同自动化系统</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-create"
            onClick={refreshStatus}
            disabled={!isInitialized}
          >
            🔄 刷新状态
          </button>
        </div>
      </div>

      {/* 系统初始化部分 */}
      <div className="rule-card" style={{ marginBottom: '20px' }}>
        <div className="rule-main">
          <h3>🚀 系统初始化</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', marginRight: '8px' }}>用户Key:</label>
              <input
                type="text"
                value={userKey}
                onChange={e => setUserKey(e.target.value)}
                style={{ width: '200px', padding: '4px 8px', fontSize: '13px' }}
                disabled={isInitialized}
              />
            </div>
            <button
              onClick={handleInitialize}
              disabled={isInitializing || isInitialized}
              className="btn-create"
              style={{ padding: '6px 12px' }}
            >
              {isInitializing ? '初始化中...' : isInitialized ? '✅ 已初始化' : '初始化系统'}
            </button>
            {isInitialized && (
              <span style={{ color: 'green', fontSize: '13px' }}>
                ✅ 系统运行正常
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 系统状态 */}
      {systemStatus && (
        <div className="rule-card" style={{ marginBottom: '20px' }}>
          <div className="rule-main">
            <h3>📊 系统状态</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
              <div>
                <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>组件状态</h4>
                <div style={{ fontSize: '12px' }}>
                  {Object.entries(systemStatus.components).map(([name, status]) => (
                    <div key={name} style={{ marginBottom: '4px' }}>
                      <span style={{ color: status ? 'green' : 'red' }}>
                        {status ? '✅' : '❌'}
                      </span>
                      <span style={{ marginLeft: '8px' }}>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>事件监听</h4>
                <div style={{ fontSize: '12px' }}>
                  <div>状态: {systemStatus.eventListener.listener.isListening ? '🟢 运行中' : '🔴 已停止'}</div>
                  <div>轮询间隔: {systemStatus.eventListener.listener.pollingInterval / 1000}秒</div>
                  <div>启用规则: {systemStatus.eventListener.rules.enabled}/{systemStatus.eventListener.rules.total}</div>
                  {systemStatus.eventListener.lastCheck.time > 0 && (
                    <div>上次检查: {Math.round(systemStatus.eventListener.lastCheck.ago / 1000)}秒前</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 控制面板 */}
      {isInitialized && (
        <div className="rule-card" style={{ marginBottom: '20px' }}>
          <div className="rule-main">
            <h3>🎛️ 控制面板</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
              <div>
                <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>事件监听控制</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleStartEventListening}
                    disabled={systemStatus?.eventListener.listener.isListening}
                    className="btn-create"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    ▶️ 启动监听
                  </button>
                  <button
                    onClick={handleStopEventListening}
                    disabled={!systemStatus?.eventListener.listener.isListening}
                    className="btn-cancel"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    ⏸️ 停止监听
                  </button>
                  <button
                    onClick={handleTriggerEventCheck}
                    disabled={!systemStatus?.components.eventListener}
                    className="btn-create"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    🔍 手动检查
                  </button>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>手动处理工作项</h4>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="工作项ID"
                    value={manualWorkItemId}
                    onChange={e => setManualWorkItemId(e.target.value)}
                    style={{ flex: 1, padding: '6px 8px', fontSize: '12px' }}
                  />
                  <button
                    onClick={handleManualProcess}
                    className="btn-create"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    🔧 处理
                  </button>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>维护操作</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleCleanup}
                    className="btn-cancel"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    🧹 清理过期记录
                  </button>
                  <button
                    onClick={() => {
                      addLog('开始调试监听功能...');
                      (window as any).testMonitoring?.();
                    }}
                    className="btn-create"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    🔍 调试监听
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 活跃执行 */}
      {isInitialized && (
        <div className="rule-card" style={{ marginBottom: '20px' }}>
          <div className="rule-main">
            <h3>⚡ 活跃执行 ({activeExecutions.length})</h3>
            {activeExecutions.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '13px', margin: '8px 0' }}>暂无活跃的工作流执行</p>
            ) : (
              <div style={{ marginTop: '12px' }}>
                {activeExecutions.map(execution => (
                  <div key={execution.id} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '8px',
                    fontSize: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{execution.id}</strong>
                        <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                          工作项: {execution.workItemId}
                        </span>
                      </div>
                      <span style={{
                        color: getExecutionStatusColor(execution.status),
                        fontWeight: 'bold'
                      }}>
                        {execution.status}
                      </span>
                    </div>
                    <div style={{ marginTop: '4px', color: '#6b7280' }}>
                      规则: {execution.ruleId} | 节点: {execution.nodeKey}
                    </div>
                    <div style={{ marginTop: '4px', color: '#6b7280' }}>
                      开始时间: {formatTime(execution.startTime)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 统计信息 */}
      {stats && (
        <div className="rule-card" style={{ marginBottom: '20px' }}>
          <div className="rule-main">
            <h3>📈 执行统计 (最近24小时)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px', fontSize: '12px' }}>
              <div>
                <div><strong>总执行次数:</strong> {stats.total}</div>
                <div><strong>成功率:</strong> {(stats.successRate * 100).toFixed(1)}%</div>
                <div><strong>平均耗时:</strong> {Math.round(stats.avgExecutionTime / 1000)}秒</div>
              </div>
              <div>
                <strong>按状态分布:</strong>
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <div key={status}>
                    {status}: {count}
                  </div>
                ))}
              </div>
              <div>
                <strong>按规则分布:</strong>
                {Object.entries(stats.byRule).map(([rule, count]) => (
                  <div key={rule}>
                    {rule}: {count}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 系统日志 */}
      <div className="rule-card">
        <div className="rule-main">
          <h3>📋 系统日志</h3>
          <div style={{
            marginTop: '12px',
            maxHeight: '300px',
            overflowY: 'auto',
            background: '#f9fafb',
            padding: '12px',
            borderRadius: '6px',
            fontFamily: 'Monaco, Menlo, Consolas, monospace',
            fontSize: '11px'
          }}>
            {logs.length === 0 ? (
              <div style={{ color: '#6b7280' }}>暂无日志</div>
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