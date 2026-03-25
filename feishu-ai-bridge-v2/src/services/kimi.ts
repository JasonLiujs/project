import { KIMI_CONFIG, LLM_CONFIG_KEY } from '../config/llm';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export class KimiService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor() {
    const saved = localStorage.getItem(LLM_CONFIG_KEY);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        this.apiKey = config.apiKey || KIMI_CONFIG.apiKey;
        this.baseUrl = config.baseUrl || KIMI_CONFIG.baseUrl;
        this.model = config.model || KIMI_CONFIG.model;
        this.temperature = config.temperature ?? KIMI_CONFIG.temperature;
        this.maxTokens = config.maxTokens ?? KIMI_CONFIG.maxTokens;
      } catch {
        this.applyDefaults();
      }
    } else {
      this.applyDefaults();
    }
  }

  private applyDefaults() {
    this.apiKey = KIMI_CONFIG.apiKey;
    this.baseUrl = KIMI_CONFIG.baseUrl;
    this.model = KIMI_CONFIG.model;
    this.temperature = KIMI_CONFIG.temperature;
    this.maxTokens = KIMI_CONFIG.maxTokens;
  }

  updateConfig(config: Partial<typeof KIMI_CONFIG>) {
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    if (config.baseUrl !== undefined) this.baseUrl = config.baseUrl;
    if (config.model !== undefined) this.model = config.model;
    if (config.temperature !== undefined) this.temperature = config.temperature;
    if (config.maxTokens !== undefined) this.maxTokens = config.maxTokens;
    localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    }));
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { content: '', error: err.error?.message || `API error: ${response.status}` };
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (err) {
      return { content: '', error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  async generateWorkItemSummary(workItem: { title: string; status: string; statusName?: string }, commentCount: number): Promise<LLMResponse> {
    const statusLabels: Record<string, string> = {
      to_be_started: '未开始', started: '已提出', doing: '进行中',
      end: '已结束', closed: '已终止', not_started: '未开始',
    };
    const statusText = statusLabels[workItem.status] || workItem.status;
    
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '你是一个专业的飞书项目助手，擅长分析工作项并给出简洁的中文总结。请用简洁的中文回复，长度控制在100字以内。',
      },
      {
        role: 'user',
        content: `请分析以下飞书项目工作项：\n标题：${workItem.title}\n状态：${statusText}\n评论数：${commentCount}条\n\n请生成一个简洁的工作项摘要，包含：当前状态概览、活跃度评估、建议行动。`,
      },
    ];
    return this.chat(messages);
  }

  async generateCommentReply(prompt: string, workItem: { title: string; status: string; description?: string }, comments: string[]): Promise<LLMResponse> {
    const statusLabels: Record<string, string> = {
      to_be_started: '未开始', started: '已提出', doing: '进行中',
      end: '已结束', closed: '已终止', not_started: '未开始',
    };
    const statusText = statusLabels[workItem.status] || workItem.status;
    const commentHistory = comments.length > 0 ? comments.map((c, i) => `${i + 1}. ${c}`).join('\n') : '暂无';
    
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '你是一个专业的飞书项目助手，擅长撰写工作项评论。支持 Markdown 格式。请根据用户需求生成合适的评论内容，专业、简洁、有帮助。',
      },
      {
        role: 'user',
        content: `上下文信息：
- 工作项：${workItem.title}
- 当前状态：${statusText}
- 描述：${workItem.description || '无'}

历史评论：
${commentHistory}

用户需求：${prompt}

请生成一条合适的评论，Markdown 格式，长度控制在200字以内。`,
      },
    ];
    return this.chat(messages);
  }

  async detectRisks(workItem: { title: string; status: string; updateTime?: number; schedule?: [number, number] }, commentCount: number, lastCommentTime?: number): Promise<LLMResponse> {
    const now = Date.now();
    const daysSinceUpdate = lastCommentTime ? Math.floor((now - lastCommentTime) / (1000 * 60 * 60 * 24)) : null;
    const daysUntilDeadline = workItem.schedule ? Math.floor((workItem.schedule[1] - now) / (1000 * 60 * 60 * 24)) : null;
    
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '你是一个专业的飞书项目风险分析助手。请分析工作项是否存在风险，用 JSON 格式回复。风险类型包括：进度延误风险、长期无更新风险、截止日期临近风险、无评论无进展风险。返回格式：{"risks": [{"type": "风险类型", "level": "high/medium/low", "description": "风险描述", "suggestion": "建议措施"}]}。如无风险返回 {"risks": []}。',
      },
      {
        role: 'user',
        content: `工作项信息：
- 标题：${workItem.title}
- 状态：${workItem.status}
- 评论数：${commentCount}
- 距最后更新：${daysSinceUpdate !== null ? daysSinceUpdate + '天' : '未知'}
- 距截止日期：${daysUntilDeadline !== null ? daysUntilDeadline + '天' : '未知'}`,
      },
    ];
    return this.chat(messages);
  }

  async suggestStatusTransition(workItem: { title: string; status: string; description?: string }): Promise<LLMResponse> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '你是一个专业的飞书项目工作流顾问。请根据工作项状态给出状态流转建议。返回 JSON 格式：{"suggestion": "建议的新状态", "reason": "建议理由", "confidence": 0.85}。',
      },
      {
        role: 'user',
        content: `工作项：${workItem.title}\n当前状态：${workItem.status}\n描述：${workItem.description || '无'}\n\n请判断当前最合适的状态流转建议。`,
      },
    ];
    return this.chat(messages);
  }
}

export const kimiService = new KimiService();
