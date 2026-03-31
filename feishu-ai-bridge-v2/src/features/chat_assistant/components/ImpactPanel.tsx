import React, { useEffect, useRef, useState } from 'react';
import { GitNexusCallFlow, GitNexusImpactGraph, GitNexusSymbolContext } from '../../../types/gitnexus';
import ImpactGraph from './ImpactGraph';
import { DetectedImpactTarget, ImplementationSnippet } from '../utils/inferImpactTarget';
import { LiveEditChangeSummary } from '../../../types/liveEdit';

interface ImpactPanelProps {
  loading: boolean;
  error: string | null;
  impact: GitNexusImpactGraph | null;
  onRefresh: () => void;
  detectedTarget?: DetectedImpactTarget | null;
  implementationSnippet?: ImplementationSnippet | null;
  activeChangeSummary?: LiveEditChangeSummary | null;
  isTracking?: boolean;
  symbolContext?: GitNexusSymbolContext | null;
  callFlow?: GitNexusCallFlow | null;
  targetOptions?: DetectedImpactTarget[];
  activeTarget?: DetectedImpactTarget | null;
  onTargetSelect?: (target: DetectedImpactTarget) => void;
  graphEmbedUrl?: string;
  gitnexusEndpoint?: string;
}

const ImpactPanel: React.FC<ImpactPanelProps> = ({
  loading,
  error,
  impact,
  onRefresh,
  detectedTarget,
  implementationSnippet,
  activeChangeSummary,
  isTracking = false,
  symbolContext,
  callFlow,
  targetOptions = [],
  activeTarget,
  onTargetSelect,
  graphEmbedUrl = 'gitnexus/index.html',
  gitnexusEndpoint,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showGraphEmbed, setShowGraphEmbed] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === panelRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isExpanded) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  const handleToggleFullscreen = async () => {
    if (!panelRef.current) {
      return;
    }

    try {
      if (document.fullscreenElement === panelRef.current) {
        await document.exitFullscreen();
        setIsExpanded(false);
      } else if (document.fullscreenEnabled) {
        await panelRef.current.requestFullscreen();
        setIsExpanded(true);
      } else {
        setIsExpanded(prev => !prev);
      }
    } catch (fullscreenError) {
      console.warn('[ImpactPanel] fullscreen toggle failed:', fullscreenError);
      setIsExpanded(prev => !prev);
    }
  };

  const handleOpenGraphEmbed = () => {
    setEmbedError(null);
    setShowGraphEmbed(true);
  };

  const handleOpenGraphInNewWindow = () => {
    window.open(embedSrc, '_blank', 'noopener,noreferrer');
  };

  const isImmersive = isFullscreen || isExpanded;
  const searchTerm = activeTarget?.symbol || activeTarget?.filePath || '';
  const serverParam = gitnexusEndpoint || 'http://localhost:8890';
  const trimmedEndpoint = serverParam.replace(/\/$/, '');
  const embedVersion = '20260329-embed-fix-2';
  const embedBase =
    graphEmbedUrl.startsWith('http')
      ? graphEmbedUrl
      : `${trimmedEndpoint}/${graphEmbedUrl.replace(/^\//, '')}`;
  const embedSrc = `${embedBase}?embed=1&v=${encodeURIComponent(embedVersion)}&server=${encodeURIComponent(serverParam)}&view=graph&highlight=community&ranker=rrf&search=${encodeURIComponent(searchTerm)}#target=${encodeURIComponent(activeTarget?.filePath || '')}&symbol=${encodeURIComponent(activeTarget?.symbol || '')}`;

  useEffect(() => {
    if (!showGraphEmbed || !iframeRef.current || !activeTarget) return;
    const payload = {
      type: 'gitnexus-focus',
      target: {
        filePath: activeTarget.filePath,
        symbol: activeTarget.symbol,
      },
      options: {
        view: 'graph',
        highlight: 'community',
        ranker: 'rrf',
        search: activeTarget.symbol || activeTarget.filePath,
      }
    };
    const frame = iframeRef.current;
    const send = () => frame.contentWindow?.postMessage(payload, '*');
    const timer = window.setTimeout(send, 400);
    send(); // try immediately once
    return () => window.clearTimeout(timer);
  }, [showGraphEmbed, activeTarget]);

  const renderList = (title: string, items: { name: string; file: string; impact?: string; line?: number; type?: string }[]) => {
    if (!items || items.length === 0) return <div className="impact-empty">无数据</div>;
    return (
      <ul className="impact-list">
        {items.map((item, idx) => (
          <li key={`${item.file}-${item.name}-${idx}`}>
            <div className="impact-name">{item.name}</div>
            <div className="impact-meta">
              <span className="impact-file">{item.file}</span>
              {item.line && <span className="impact-line">L{item.line}</span>}
              {item.type && <span className="impact-type">{item.type}</span>}
              {item.impact && <span className={`impact-pill impact-${item.impact}`}>{item.impact}</span>}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div ref={panelRef} className={`impact-panel ${isImmersive ? 'is-fullscreen is-expanded' : ''}`}>
      <div className="impact-header">
        <div>
          <div className="impact-title">GitNexus 影响分析</div>
          <div className="impact-subtitle">查看变更在工程中的依赖与被依赖关系</div>
        </div>
        <div className="impact-header-actions">
          <button className="impact-graph-embed" onClick={handleOpenGraphEmbed} type="button">
            🛰️ 打开全量图谱
          </button>
          <button className="impact-fullscreen" onClick={handleToggleFullscreen} type="button">
            {isImmersive ? '🗗 退出全屏' : '⛶ 全屏查看'}
          </button>
          <button className="impact-refresh" onClick={onRefresh} disabled={loading}>
            {loading ? '刷新中...' : '🔄 刷新'}
          </button>
        </div>
      </div>

      {error && <div className="impact-error">⚠️ {error}</div>}

      {impact && (
        <div className="impact-content">
          {detectedTarget && (
            <div className="impact-live-banner">
              <div className={`impact-live-dot ${isTracking ? 'active' : ''}`} />
              <div className="impact-live-main">
                <div className="impact-live-title">
                  {isTracking ? 'Claude Code 修改目标跟踪中' : '最近识别到的修改目标'}
                </div>
                <div className="impact-live-value">
                  {detectedTarget.filePath}
                  {detectedTarget.symbol ? `#${detectedTarget.symbol}` : ''}
                </div>
                <div className="impact-live-meta">
                  来源: {detectedTarget.source === 'assistant' ? 'Claude Code 回复' : '用户需求'}
                  {' · '}
                  置信度: {Math.round(detectedTarget.confidence * 100)}%
                  {' · '}
                  {detectedTarget.reason}
                </div>
              </div>
            </div>
          )}

          {((activeChangeSummary && activeChangeSummary.fileCount > 0) || targetOptions.length > 1) && (
            <div className="impact-section">
              <div className="section-title">Claude Code 本轮真实修改文件 / 选择目标</div>
              <div className="impact-tracked-files">
                {(targetOptions.length ? targetOptions : activeChangeSummary?.files?.map(f => ({
                  filePath: f.filePath,
                  symbol: f.symbol,
                  confidence: 1,
                  source: 'assistant' as const,
                  reason: '来自真实改动',
                })) || []).map((file, idx) => {
                  const key = `${file.filePath}-${file.symbol || idx}`;
                  const isActive = activeTarget && file.filePath === activeTarget.filePath && file.symbol === activeTarget.symbol;
                  return (
                    <button
                      key={key}
                      className={`impact-tracked-file ${isActive ? 'is-active' : ''}`}
                      onClick={() => onTargetSelect?.(file as DetectedImpactTarget)}
                      type="button"
                    >
                      <div className="impact-tracked-path">{file.filePath}</div>
                      <div className="impact-tracked-meta">
                        {file.symbol ? <span>{file.symbol}</span> : <span>未识别符号</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <ImpactGraph impact={impact} />

          <div className="impact-target">
            <div className="label">目标</div>
            <div className="value">{impact.target.filePath}{impact.target.symbol ? `#${impact.target.symbol}` : ''}</div>
            <div className="meta">数据源: {impact.source === 'gitnexus' ? 'GitNexus 实时' : '本地 mock'}</div>
          </div>

          {symbolContext && (
            <div className="impact-section">
              <div className="section-title">GitNexus 符号上下文</div>
              <div className="impact-code-meta">
                {symbolContext.language ? `语言: ${symbolContext.language}` : '未知语言'}
                {symbolContext.startLine ? ` · 行: ${symbolContext.startLine}-${symbolContext.endLine || ''}` : ''}
                {symbolContext.source === 'mock' ? ' · Mock 数据' : ''}
              </div>
              <pre className="impact-code-block">
                <code>{symbolContext.code}</code>
              </pre>
            </div>
          )}

          {implementationSnippet && (
            <div className="impact-section">
              <div className="section-title">Claude Code 当前实现片段</div>
              <div className="impact-code-meta">
                {implementationSnippet.language ? `语言: ${implementationSnippet.language}` : '未标注语言'}
                {' · '}
                {implementationSnippet.isComplete ? '代码块已闭合' : '代码块输出中'}
              </div>
              <pre className="impact-code-block">
                <code>{implementationSnippet.code}</code>
              </pre>
            </div>
          )}

          <div className="impact-section">
            <div className="section-title">上游（谁依赖它）</div>
            {renderList('Inbound', impact.inbound)}
          </div>

          <div className="impact-section">
            <div className="section-title">下游（它依赖谁）</div>
            {renderList('Outbound', impact.outbound)}
          </div>

          <div className="impact-section">
            <div className="section-title">受影响文件</div>
            {impact.filesAffected?.length ? (
              <div className="file-chips">
                {impact.filesAffected.map(file => (
                  <span key={file} className="file-chip">{file}</span>
                ))}
              </div>
            ) : (
              <div className="impact-empty">无</div>
            )}
          </div>

          {callFlow && (
            <div className="impact-section">
              <div className="section-title">执行流 / 调用链</div>
              <div className="impact-flow">
                <div className="flow-column">
                  <div className="flow-title">上游流入</div>
                  {callFlow.inbound?.length ? (
                    <ul className="impact-list">
                      {callFlow.inbound.map((edge, idx) => (
                        <li key={`flow-in-${idx}`}>
                          <div className="impact-name">{edge.from}</div>
                          <div className="impact-meta">
                            <span className="impact-file">→ {edge.to}</span>
                            {edge.label && <span className="impact-type">{edge.label}</span>}
                            {edge.impact && <span className={`impact-pill impact-${edge.impact}`}>{edge.impact}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <div className="impact-empty">无</div>}
                </div>
                <div className="flow-column">
                  <div className="flow-title">下游流出</div>
                  {callFlow.outbound?.length ? (
                    <ul className="impact-list">
                      {callFlow.outbound.map((edge, idx) => (
                        <li key={`flow-out-${idx}`}>
                          <div className="impact-name">{edge.from}</div>
                          <div className="impact-meta">
                            <span className="impact-file">→ {edge.to}</span>
                            {edge.label && <span className="impact-type">{edge.label}</span>}
                            {edge.impact && <span className={`impact-pill impact-${edge.impact}`}>{edge.impact}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <div className="impact-empty">无</div>}
                </div>
              </div>
            </div>
          )}

          {impact.notes && impact.notes.length > 0 && (
            <div className="impact-section">
              <div className="section-title">备注</div>
              <ul className="impact-notes">
                {impact.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!impact && !loading && !error && (
        <div className="impact-awaiting">
          <div className="impact-awaiting-title">等待影响数据</div>
          <div className="impact-awaiting-text">发送代码修改需求、让 Claude Code 修改本地文件，或手动输入路径后查询，图结构会显示在这里。</div>
        </div>
      )}

      {showGraphEmbed && (
        <div className="impact-embed-overlay">
          <div className="impact-embed-header">
            <div className="impact-embed-title">GitNexus 全量图谱</div>
            <div className="impact-embed-actions">
              <button className="impact-embed-open-new" onClick={handleOpenGraphInNewWindow} type="button">
                ↗ 新窗口打开
              </button>
              <button className="impact-embed-close" onClick={() => setShowGraphEmbed(false)} type="button">✕</button>
            </div>
          </div>
          {embedError && (
            <div className="impact-embed-error">
              {embedError}
            </div>
          )}
          <iframe
            src={embedSrc}
            ref={iframeRef}
            className="impact-embed-frame"
            title="GitNexus Graph"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            onLoad={() => setEmbedError(null)}
            onError={() => setEmbedError('图谱内嵌加载失败，可尝试使用“新窗口打开”。')}
          />
        </div>
      )}
    </div>
  );
};

export default ImpactPanel;
