import { KIMI_CONFIG, LLM_CONFIG_KEY } from '../config/llm';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
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
    if (!this.apiKey) {
      return { content: '', error: '请先配置 API Key' };
    }
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
      return { content: data.choices?.[0]?.message?.content || '' };
    } catch (err) {
      return { content: '', error: err instanceof Error ? err.message : 'Network error' };
    }
  }
}

export const kimiService = new KimiService();
