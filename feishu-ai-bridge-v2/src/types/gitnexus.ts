// GitNexus 影响分析类型定义

export interface GitNexusTarget {
  filePath: string;
  symbol?: string;
}

export interface GitNexusEdgeNode {
  name: string;
  file: string;
  line?: number;
  type?: 'function' | 'class' | 'method' | 'module' | 'file';
  impact?: 'high' | 'medium' | 'low';
}

export interface GitNexusImpactGraph {
  target: GitNexusTarget;
  outbound: GitNexusEdgeNode[]; // 被依赖/被调用方
  inbound: GitNexusEdgeNode[];  // 依赖/调用方
  filesAffected: string[];
  notes?: string[];
  generatedAt?: number;
  source?: 'gitnexus' | 'mock';
}

export interface GitNexusImpactRequest extends GitNexusTarget {
  depth?: number;
  direction?: 'both' | 'inbound' | 'outbound';
}

export interface GitNexusSymbolContext {
  filePath: string;
  symbol?: string;
  code: string;
  language?: string;
  startLine?: number;
  endLine?: number;
  source?: 'gitnexus' | 'mock';
}

export interface GitNexusCallFlowEdge {
  from: string;
  to: string;
  label?: string;
  impact?: 'high' | 'medium' | 'low';
}

export interface GitNexusCallFlow {
  filePath: string;
  symbol?: string;
  inbound: GitNexusCallFlowEdge[];
  outbound: GitNexusCallFlowEdge[];
  source?: 'gitnexus' | 'mock';
}
