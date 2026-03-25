import React, { useState, useEffect, useCallback } from 'react';
import { useWorkItemContext } from '../../hooks/useContext';
import { mcpClient, AIInsight } from '../../api/mcp';
import { STATUS_LABELS } from '../../constants';
import './AITab.css';

interface WorkItemBrief {
  work_item_id: string;
  title: string;
  status: string;
  status_name?: string;
  [key: string]: unknown;
}

interface Comment {
  comment_id: string;
  content: string;
  create_time: number;
  user_key: string;
}

const generateSummary = (item: WorkItemBrief, comments: Comment[]): AIInsight => {
  const statusLabel = STATUS_LABELS[item.status] || item.status;
  const commentCount = comments.length;
  const latestComment = commentCount > 0 ? comments[commentCount - 1].content.slice(0, 100) : null;
  
  return {
    type: 'summary',
    title: '工作项摘要',
    content: `当前状态: ${statusLabel}。共 ${commentCount} 条评论。${latestComment ? `最新评论: "${latestComment}..."` : '暂无评论。'}`,
    confidence: 0.95,
  };
};

const generateSuggestions = (item: WorkItemBrief, comments: Comment[]): AIInsight[] => {
  const suggestions: AIInsight[] = [];
  
  if (comments.length === 0) {
    suggestions.push({
      type: 'suggestion',
      title: '建议添加评论',
      content: '该工作项暂无评论，建议添加描述或更新进展，以便团队成员了解最新状态。',
      confidence: 0.9,
    });
  }

  if (item.status === 'to_be_started') {
    suggestions.push({
      type: 'suggestion',
      title: '建议启动工作项',
      content: '该工作项状态为"未开始"，建议确认是否已开始处理，或更新状态为"进行中"。',
      confidence: 0.85,
    });
  }

  return suggestions;
};

const detectRisks = (item: WorkItemBrief, comments: Comment[]): AIInsight[] => {
  const risks: AIInsight[] = [];
  
  const now = Date.now();
  const staleThreshold = 7 * 24 * 60 * 60 * 1000;
  if (comments.length > 0) {
    const lastCommentTime = comments[comments.length - 1].create_time;
    if (now - lastCommentTime > staleThreshold) {
      risks.push({
        type: 'risk',
        title: '长时间未更新',
        content: `该工作项已超过 7 天没有新评论或更新，可能存在进度延误风险。`,
        confidence: 0.8,
      });
    }
  }

  return risks;
};

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
          const summary = generateSummary(item, commentList);
          const suggestions = generateSuggestions(item, commentList);
          const risks = detectRisks(item, commentList);
          setInsights([summary, ...suggestions, ...risks]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workItemId, workItemType, ctxLoading]);

  const handleGenerateComment = useCallback(async () => {
    if (!aiPrompt.trim() || !workItemId) return;
    setGenerating(true);
    setAiResponse(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const response = generateAIReply(aiPrompt, workItem);
      setAiResponse(response);
    } catch (err) {
      setAiResponse('生成失败，请重试。');
    } finally {
      setGenerating(false);
    }
  }, [aiPrompt, workItemId, workItem]);

  const handlePostComment = useCallback(async () => {
    if (!aiResponse || !workItemId) return;
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
        <h2>🤖 AI 协同分析</h2>
        <span className="work-item-name">{workItem.title}</span>
      </div>

      <div className="insights-section">
        <h3>智能洞察</h3>
        <div className="insights-list">
          {insights.map((insight, idx) => (
            <div key={idx} className={`insight-card ${getInsightClass(insight.type)}`}>
              <div className="insight-header">
                <span className="insight-icon">{getInsightIcon(insight.type)}</span>
                <span className="insight-title">{insight.title}</span>
                <span className="insight-confidence">{Math.round(insight.confidence * 100)}% 置信</span>
              </div>
              <p className="insight-content">{insight.content}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="ai-compose-section">
        <h3>✍️ AI 评论助手</h3>
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
            {generating ? '生成中...' : '生成评论'}
          </button>
        </div>

        {aiResponse && (
          <div className="ai-response">
            <div className="response-header">
              <span>✨ AI 生成内容</span>
            </div>
            <p className="response-content">{aiResponse}</p>
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
              <div key={comment.comment_id} className="comment-item">
                <div className="comment-meta">
                  <span className="comment-user">{comment.user_key === 'ai' ? '🤖 AI' : comment.user_key}</span>
                  <span className="comment-time">{new Date(comment.create_time).toLocaleString('zh-CN')}</span>
                </div>
                <p className="comment-text">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function generateAIReply(prompt: string, workItem: WorkItemBrief | null): string {
  const statusLabel = STATUS_LABELS[workItem?.status || ''] || '进行中';
  
  if (prompt.includes('总结') || prompt.includes('进度')) {
    return `## 📊 工作进展更新\n\n当前状态：**${statusLabel}**\n\n该工作项目前进展顺利，团队正在按计划推进。\n\n---\n*由 AI 自动生成*`;
  }
  
  if (prompt.includes('提醒') || prompt.includes('截止')) {
    return `## ⏰ 提醒通知\n\n> 请关注此工作项的处理进度，确保按期完成。如有阻塞问题，请及时在评论中说明。\n\n---\n*由 AI 自动生成*`;
  }

  return `## 💭 补充说明\n\n感谢更新！该工作项（${workItem?.title || '当前工作项'}）状态为 **${statusLabel}**，如有新进展请及时同步。\n\n---\n*由 AI 自动生成*`;
}
