import React, { useState, useEffect } from 'react';
import { kimiService } from '../../services/kimi';
import { KIMI_CONFIG } from '../../config/llm';

export default function LLMConfigPage() {
  const [provider, setProvider] = useState<'kimi' | 'custom'>('kimi');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(KIMI_CONFIG.baseUrl);
  const [model, setModel] = useState(KIMI_CONFIG.model);
  const [temperature, setTemperature] = useState(KIMI_CONFIG.temperature);
  const [maxTokens, setMaxTokens] = useState(KIMI_CONFIG.maxTokens);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('feishu-ai-bridge-llm-config');
    if (saved) {
      try {
        const cfg = JSON.parse(saved);
        setApiKey(cfg.apiKey || '');
        setBaseUrl(cfg.baseUrl || KIMI_CONFIG.baseUrl);
        setModel(cfg.model || KIMI_CONFIG.model);
        setTemperature(cfg.temperature ?? KIMI_CONFIG.temperature);
        setMaxTokens(cfg.maxTokens ?? KIMI_CONFIG.maxTokens);
        if (cfg.baseUrl && cfg.baseUrl !== KIMI_CONFIG.baseUrl) setProvider('custom');
      } catch { /* ignore */ }
    }
  }, []);

  const handleSave = () => {
    setSaving(true);
    setMessage(null);
    try {
      kimiService.updateConfig({ apiKey, baseUrl, model, temperature, maxTokens });
      setMessage({ type: 'success', text: 'LLM 配置已保存' });
    } catch {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setMessage(null);
    try {
      const saved = { apiKey, baseUrl, model, temperature, maxTokens };
      kimiService.updateConfig(saved);
      const result = await kimiService.chat([
        { role: 'user', content: 'Hello, please respond with just "OK" to confirm the connection is working.' }
      ]);
      if (result.error) {
        setTestResult({ success: false, message: result.error });
      } else {
        setTestResult({ success: true, message: '连接成功！Kimi API 正常工作。' });
      }
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : '测试失败' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>🤖 AI / LLM 配置</h1>
          <p>配置 Kimi (Moonshot) 或其他兼容 API 以启用 AI 功能</p>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.text}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>🔗 连接设置</h2>
        </div>
        <div className="card-body">
          <div className="provider-tabs">
            <button
              className={`provider-tab ${provider === 'kimi' ? 'active' : ''}`}
              onClick={() => { setProvider('kimi'); setBaseUrl(KIMI_CONFIG.baseUrl); }}
            >
              🌙 Kimi (Moonshot)
            </button>
            <button
              className={`provider-tab ${provider === 'custom' ? 'active' : ''}`}
              onClick={() => setProvider('custom')}
            >
              ⚙️ 自定义 API
            </button>
          </div>

          <div className="form-group">
            <label>API Key</label>
            <input
              type="password"
              className="input input-bordered w-full"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxx"
            />
            <p className="form-hint">API Key 将安全存储在浏览器本地 localStorage 中</p>
          </div>

          {provider === 'custom' && (
            <div className="form-group">
              <label>API Base URL</label>
              <input
                type="url"
                className="input input-bordered w-full"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>模型</label>
              <select
                className="select select-bordered w-full"
                value={model}
                onChange={e => setModel(e.target.value)}
              >
                <option value="moonshot-v1-8k">moonshot-v1-8k (8K)</option>
                <option value="moonshot-v1-32k">moonshot-v1-32k (32K)</option>
                <option value="moonshot-v1-128k">moonshot-v1-128k (128K)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Temperature ({temperature})</label>
              <input
                type="range"
                min="0" max="1" step="0.1"
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="range range-primary"
              />
              <div className="range-labels">
                <span>精确</span>
                <span>创意</span>
              </div>
            </div>

            <div className="form-group">
              <label>最大 Token ({maxTokens})</label>
              <input
                type="range"
                min="256" max="4096" step="128"
                value={maxTokens}
                onChange={e => setMaxTokens(parseInt(e.target.value))}
                className="range range-primary"
              />
              <div className="range-labels">
                <span>256</span>
                <span>4096</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card-footer">
          <button
            className={`btn btn-outline ${testing ? 'loading' : ''}`}
            onClick={handleTest}
            disabled={testing || !apiKey}
          >
            {testing ? '' : '🔍'} {testing ? '测试中...' : '测试连接'}
          </button>
          <button
            className={`btn btn-primary ${saving ? 'loading' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '' : '💾'} {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`card mt-4 ${testResult.success ? 'border-success' : 'border-error'}`}>
          <div className="card-body">
            <div className={`alert ${testResult.success ? 'alert-success' : 'alert-error'}`}>
              {testResult.success ? '✅' : '❌'} {testResult.message}
            </div>
          </div>
        </div>
      )}

      <div className="card mt-4">
        <div className="card-header">
          <h2>📖 模型说明</h2>
        </div>
        <div className="card-body">
          <table className="table-compact table w-full">
            <thead>
              <tr>
                <th>模型</th>
                <th>上下文</th>
                <th>适用场景</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>moonshot-v1-8k</td>
                <td>8K tokens</td>
                <td>快速响应，短文本生成</td>
              </tr>
              <tr>
                <td>moonshot-v1-32k</td>
                <td>32K tokens</td>
                <td>中等长度对话和总结</td>
              </tr>
              <tr>
                <td>moonshot-v1-128k</td>
                <td>128K tokens</td>
                <td>长文档分析，多轮对话</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
