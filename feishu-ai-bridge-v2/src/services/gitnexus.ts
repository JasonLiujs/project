import {
  GitNexusCallFlow,
  GitNexusImpactGraph,
  GitNexusImpactRequest,
  GitNexusSymbolContext,
  GitNexusTarget,
} from '../types/gitnexus';

const DEFAULT_ENDPOINT = 'http://localhost:8890';

export function getEndpoint(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_ENDPOINT;
  }
  const stored = localStorage.getItem('gitnexus.endpoint');
  if (!stored) {
    return DEFAULT_ENDPOINT;
  }
  if (
    stored.includes('localhost:7700') ||
    stored.includes('127.0.0.1:7700') ||
    stored.includes('localhost:8888') ||
    stored.includes('127.0.0.1:8888')
  ) {
    localStorage.setItem('gitnexus.endpoint', DEFAULT_ENDPOINT);
    return DEFAULT_ENDPOINT;
  }
  return stored;
}

export async function checkGitNexusHealth(): Promise<{ ok: boolean; endpoint: string; message?: string }> {
  const endpoint = getEndpoint();
  try {
    const resp = await fetch(`${endpoint}/health`, { method: 'GET' });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { ok: true, endpoint, message: data?.status || 'ok' };
    }
    return { ok: false, endpoint, message: `HTTP ${resp.status}` };
  } catch (error) {
    return { ok: false, endpoint, message: error instanceof Error ? error.message : 'unreachable' };
  }
}

export async function fetchImpactGraph(request: GitNexusImpactRequest): Promise<GitNexusImpactGraph> {
  const endpoint = getEndpoint();
  const payload = {
    file: request.filePath,
    symbol: request.symbol,
    depth: request.depth ?? 2,
    direction: request.direction ?? 'both',
  };

  try {
    const response = await fetch(`${endpoint}/api/impact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`GitNexus impact API ${response.status}`);
    }

    const data = await response.json();
    return {
      target: { filePath: request.filePath, symbol: request.symbol },
      outbound: data.outbound || [],
      inbound: data.inbound || [],
      filesAffected: data.filesAffected || [],
      notes: data.notes || [],
      generatedAt: Date.now(),
      source: 'gitnexus',
    };
  } catch (error) {
    console.warn('[GitNexus] impact query failed, fallback to mock data:', error);
    return buildMockImpact(request);
  }
}

export async function fetchSymbolContext(request: GitNexusTarget): Promise<GitNexusSymbolContext> {
  const endpoint = getEndpoint();
  const payload = {
    file: request.filePath,
    symbol: request.symbol,
  };

  try {
    const resp = await fetch(`${endpoint}/api/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`GitNexus context API ${resp.status}`);
    }
    const data = await resp.json();
    return {
      filePath: request.filePath,
      symbol: request.symbol,
      code: data.code || '',
      language: data.language,
      startLine: data.startLine,
      endLine: data.endLine,
      source: 'gitnexus',
    };
  } catch (error) {
    console.warn('[GitNexus] context query failed, fallback to mock data:', error);
    return buildMockContext(request);
  }
}

export async function fetchCallFlow(request: GitNexusImpactRequest): Promise<GitNexusCallFlow> {
  const endpoint = getEndpoint();
  const payload = {
    file: request.filePath,
    symbol: request.symbol,
    depth: request.depth ?? 2,
    direction: request.direction ?? 'both',
  };

  try {
    const resp = await fetch(`${endpoint}/api/flow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`GitNexus flow API ${resp.status}`);
    }
    const data = await resp.json();
    return {
      filePath: request.filePath,
      symbol: request.symbol,
      inbound: data.inbound || [],
      outbound: data.outbound || [],
      source: 'gitnexus',
    };
  } catch (error) {
    console.warn('[GitNexus] flow query failed, fallback to mock data:', error);
    return buildMockFlow(request);
  }
}

function buildMockImpact(request: GitNexusTarget): GitNexusImpactGraph {
  const now = Date.now();
  const baseFile = request.filePath || 'src/app.ts';
  return {
    target: request,
    outbound: [
      { name: 'useNodeFlow', file: 'src/features/chat_assistant/hooks/useNodeFlow.ts', type: 'function', impact: 'high' },
      { name: 'WorkflowStateManager', file: 'src/services/workflowState.ts', type: 'class', impact: 'medium' },
    ],
    inbound: [
      { name: 'ChatAssistant', file: 'src/features/chat_assistant/App.tsx', type: 'component', impact: 'medium' },
      { name: 'AIAssistantPanel', file: 'src/features/chat_assistant/components/AIAssistantPanel.tsx', type: 'component', impact: 'low' },
    ],
    filesAffected: [baseFile, 'src/features/chat_assistant/App.tsx', 'src/services/workflowState.ts'],
    notes: [
      '显示的是本地 mock 数据。启动 GitNexus 服务并在 localStorage 设置 gitnexus.endpoint 后可获取真实图谱。',
    ],
    generatedAt: now,
    source: 'mock',
  };
}

function buildMockContext(request: GitNexusTarget): GitNexusSymbolContext {
  return {
    filePath: request.filePath,
    symbol: request.symbol,
    code: [
      `// mock context for ${request.symbol || 'selection'}`,
      `function demo() {`,
      `  console.log('GitNexus mock context');`,
      `}`,
    ].join('\n'),
    language: 'typescript',
    startLine: 1,
    endLine: 4,
    source: 'mock',
  };
}

function buildMockFlow(request: GitNexusTarget): GitNexusCallFlow {
  return {
    filePath: request.filePath,
    symbol: request.symbol,
    inbound: [
      { from: 'ServiceA.handler', to: request.symbol || request.filePath, label: 'calls', impact: 'medium' },
      { from: 'JobRunner.run', to: request.symbol || request.filePath, label: 'schedules', impact: 'low' },
    ],
    outbound: [
      { from: request.symbol || request.filePath, to: 'dbClient.query', label: 'queries', impact: 'high' },
      { from: request.symbol || request.filePath, to: 'logger.info', label: 'logs', impact: 'low' },
    ],
    source: 'mock',
  };
}
