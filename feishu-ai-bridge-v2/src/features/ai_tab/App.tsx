import React, { useState, useEffect, useCallback } from 'react';
import { useWorkItemContext } from '../../hooks/useContext';
import { mcpClient, AIInsight } from '../../api/mcp';
import { kimiService } from '../../services/kimi';
import { STATUS_LABELS } from '../../constants';
import './AITab.css';

interface WorkItemBrief {
  work_item_id: string;
  title: string;
  status: string;
  status_name?: string;
  description?: string;
  [key: string]: unknown;
}

interface Comment {
  comment_id: string;
  content: string;
  create_time: number;
  user_key: string;
}

export default function AITab() {
  const { workItemId, workItemType, loading: ctxLoading } = useWorkItemContext();
  const [workItem, setWorkItem] = useState<WorkItemBrief | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  useEffect(() => {
    if (!workItemId || !workItemType || ctxLoading) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [briefResult, commentsResult] = await Promise.all([
          mcpClient.getWorkItemBrief(workItemId, workItemType),
          mcpClient.listWorkItemComments(workItemId),
        ]);

        const item = briefResult?.data as WorkItemBrief | undefined;
        const commentList = (commentsResult?.data as { comments?: Comment[] })?.comments || [];

        setWorkItem(item || null);
        setComments(commentList);

        if (item) {
          await generateInsights(item, commentList);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workItemId, workItemType, ctxLoading]);

  const generateInsights = async (item: WorkItemBrief, commentList: Comment[]) => {
    const newInsights: AIInsight[] = [];
    setLlmError(null);

    const statusLabel = STATUS_LABELS[item.status] || item.status;
    newInsights.push({
      type: 'summary',
      title: '工作项摘要',
      content: `状态: ${statusLabel}，共 ${commentList.length} 条评论。`,
      confidence: 0.95,
    });

    if (commentList.length === 0) {
      newInsights.push({
        type: 'suggestion',
        title: '建议添加评论',
        content: '该工作项暂无评论，建议添加描述或更新进展，以便团队成员了解最新状态。',
        confidence: 0.9,
      });
    }

    const result = await kimiService.generateWorkItemSummary(
      { title: item.title, status: item.status, statusName: item.status_name },
      commentList.length
    );

    if (result.error) {
      setLlmError('AI 分析暂时不可用: ' + result.error);
    } else if (result.content) {
      newInsights.push({
        type: 'summary',
        title: 'AI 智能分析',
        content: result.content,
        confidence: 0.85,
      });
    }

    const lastCommentTime = commentList.length > 0 ? commentList[commentList.length - 1].create_time : undefined;
    const riskResult = await kimiService.detectRisks(
      { title: item.title, status: item.status, updateTime: lastCommentTime },
      commentList.length,
      lastCommentTime
    );

    if (riskResult.content && !riskResult.error) {
      try {
        const parsed = JSON.parse(riskResult.content);
        if (parsed.risks && Array.isArray(parsed.risks)) {
          parsed.risks.forEach((risk: { type: string; level: string; description: string; suggestion: string }) => {
            newInsights.push({
              type: 'risk',
              title: `风险检测: ${risk.type}`,
              content: `${risk.description} 建议: ${risk.suggestion}`,
              confidence: risk.level === 'high' ? 0.9 : risk.level === 'medium' ? 0.7 : 0.5,
            });
          });
        }
      } catch {
        if (commentList.length > 0) {
          const now = Date.now();
          const lastCommentTimeMs = commentList[commentList.length - 1].create_time;
          if (now - lastCommentTimeMs > 7 * 24 * 60 * 60 * 1000) {
            newInsights.push({
              type: 'risk',
              title: '长时间未更新',
              content: '该工作项已超过 7 天没有新评论或更新，可能存在进度延误风险。',
              confidence: 0.8,
            });
          }
        }
      }
    }

    setInsights(newInsights);
  };

  const handleGenerateComment = useCallback(async () => {
    if (!aiPrompt.trim() || !workItemId) return;
    setGenerating(true);
    setAiResponse(null);
    setLlmError(null);

    try {
      const commentTexts = comments.map(c => c.content);
      const result = await kimiService.generateCommentReply(aiPrompt, workItem || { title: '', status: '' }, commentTexts);

      if (result.error) {
        setAiResponse('生成失败: ' + result.error);
      } else {
        setAiResponse(result.content);
      }
    } catch {
      setAiResponse('生成失败，请重试。');
    } finally {
      setGenerating(false);
    }
  }, [aiPrompt, workItemId, workItem, comments]);

  const handlePostComment = useCallback(async () => {
    if (!aiResponse || !workItemId || aiResponse.startsWith('生成失败')) return;
    try {
      await mcpClient.addComment(workItemId, aiResponse);
      setComments(prev => [...prev, {
        comment_id: Date.now().toString(),
        content: aiResponse,
        create_time: Date.now(),
        user_key: 'ai',
      }]);
      setAiResponse(null);
      setAiPrompt('');
    } catch (err) {
      alert('评论发布失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  }, [aiResponse, workItemId]);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'summary': return '📋';
      case 'suggestion': return '💡';
      case 'risk': return '⚠️';
      case 'dependency': return '🔗';
      case 'status': return '🔄';
      default: return '📌';
    }
  };

  const getInsightClass = (type: string) => {
    switch (type) {
      case 'summary': return 'insight-summary';
      case 'suggestion': return 'insight-suggestion';
      case 'risk': return 'insight-risk';
      default: return 'insight-default';
    }
  };

  if (ctxLoading || loading) {
    return (
      <div className="ai-tab-loading">
        <div className="loading-spinner" />
        <span>AI 正在分析工作项...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-tab-error">
        <span>⚠️ {error}</span>
      </div>
    );
  }

  if (!workItem) {
    return (
      <div className="ai-tab-empty">
        <span>🤖 AI 协同自动化</span>
        <p>在详情页打开 AI 协同标签页，获取智能分析。</p>
      </div>
    );
  }

  return (
    <div className="ai-tab">
      <div className="ai-tab-header">
        <h2>🤖 AI 协同分析 <span className="powered-by">Powered by Kimi</span></h2>
        <span className="work-item-name">{workItem.title}</span>
      </div>

      {llmError && (
        <div className="llm-error-banner">
          <span>⚠️ {llmError}</span>
        </div>
      )}

      <div className="insights-section">
        <h3>智能洞察</h3>
        <div className="insights-list">
          {insights.map((insight, idx) => (
            <div key={idx} className={`insight-card ${getInsightClass(insight.type)}`}>
              <div className="insight-header">
                <span className="insight-icon">{getInsightIcon(insight.type)}</span>
                <span className="insight-title">{insight.title}</span>
                <span className="insight-confidence">{Math.round(insight.confidence * 100)}%</span>
              </div>
              <p className="insight-content">{insight.content}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="ai-compose-section">
        <h3>✍️ Kimi 评论助手</h3>
        <div className="compose-box">
          <textarea
            className="ai-prompt-input"
            placeholder="输入你想生成的评论内容提示，例如：'总结当前进度' 或 '提醒负责人注意截止日期'"
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            rows={3}
          />
          <button
            className="btn-generate"
            onClick={handleGenerateComment}
            disabled={!aiPrompt.trim() || generating}
          >
            {generating ? '生成中... 🚀' : '🚀 Kimi 生成'}
          </button>
        </div>

        {aiResponse && (
          <div className="ai-response">
            <div className="response-header">
              <span>✨ Kimi 生成内容</span>
            </div>
            <div className="response-content">{aiResponse}</div>
            <div className="response-actions">
              <button className="btn-post" onClick={handlePostComment}>
                发布评论
              </button>
              <button className="btn-regenerate" onClick={handleGenerateComment}>
                重新生成
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="comments-section">
        <h3>💬 评论历史 ({comments.length})</h3>
        {comments.length === 0 ? (
          <p className="no-comments">暂无评论</p>
        ) : (
          <div className="comments-list">
            {comments.map(comment => (
              <div key={comment.comment_id} className={`comment-item ${comment.user_key === 'ai' ? 'comment-ai' : ''}`}>
                <div className="comment-meta">
                  <span className="comment-user">
                    {comment.user_key === 'ai' ? '🤖 Kimi' : comment.user_key}
                  </span>
                  <span className="comment-time">{new Date(comment.create_time).toLocaleString('zh-CN')}</span>
                </div>
                <div className="comment-text">{comment.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
