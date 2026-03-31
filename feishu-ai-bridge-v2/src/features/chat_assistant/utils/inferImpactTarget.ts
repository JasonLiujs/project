import { GitNexusTarget } from '../../../types/gitnexus';

export interface DetectedImpactTarget extends GitNexusTarget {
  confidence: number;
  source: 'assistant' | 'user';
  reason: string;
}

export interface ImplementationSnippet {
  language?: string;
  code: string;
  isComplete: boolean;
}

interface InferImpactTargetOptions {
  assistantText?: string;
  userText?: string;
  fallbackTarget?: GitNexusTarget | null;
}

const FILE_PATTERN = /(?:src|app|lib|packages|components|features|services|hooks|pages|utils|tests|scripts)\/[A-Za-z0-9_./-]+\.(?:tsx?|jsx?|py|java|go|rs|cpp|c|h|json|css|md)/g;
const FILE_WITH_SYMBOL_PATTERN = /((?:src|app|lib|packages|components|features|services|hooks|pages|utils|tests|scripts)\/[A-Za-z0-9_./-]+\.(?:tsx?|jsx?|py|java|go|rs|cpp|c|h|json|css|md))(?:#([A-Za-z_$][\w$]*))?/g;
const ACTION_SYMBOL_PATTERNS = [
  /(?:修改|更新|重构|实现|修复|新增|编辑|调整|优化|正在修改|准备修改|会修改)\s*`?([A-Za-z_$][\w$]*)`?\s*(?:函数|方法|组件|hook|类)?/gi,
  /(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g,
  /`([A-Za-z_$][\w$]*)`\s*(?:函数|方法|组件|hook|类)/gi,
];

function collectMatches(pattern: RegExp, text: string): string[] {
  const matches = text.match(pattern);
  return matches ? matches.filter(Boolean) : [];
}

function extractSymbolFromWindow(text: string): string | undefined {
  for (const pattern of ACTION_SYMBOL_PATTERNS) {
    const match = pattern.exec(text);
    pattern.lastIndex = 0;
    if (match?.[1]) {
      return match[1];
    }
  }
  return undefined;
}

export function inferImpactTarget(options: InferImpactTargetOptions): DetectedImpactTarget | null {
  const assistantText = options.assistantText || '';
  const userText = options.userText || '';
  const combinedText = `${assistantText}\n${userText}`;

  let filePath: string | undefined;
  let symbol: string | undefined;
  let confidence = 0;
  let source: 'assistant' | 'user' = assistantText ? 'assistant' : 'user';
  let reason = '从上下文推断修改目标';

  let fileWithSymbolMatch: RegExpExecArray | null = null;
  let lastMatch: RegExpExecArray | null = null;
  while ((lastMatch = FILE_WITH_SYMBOL_PATTERN.exec(combinedText)) !== null) {
    fileWithSymbolMatch = lastMatch;
  }
  FILE_WITH_SYMBOL_PATTERN.lastIndex = 0;

  if (fileWithSymbolMatch) {
    filePath = fileWithSymbolMatch[1];
    symbol = fileWithSymbolMatch[2];
    confidence = symbol ? 0.96 : 0.82;
    reason = symbol ? '识别到文件与符号路径' : '识别到明确文件路径';
    source = assistantText.includes(filePath) ? 'assistant' : 'user';
  }

  if (!filePath) {
    const fileMatches = collectMatches(FILE_PATTERN, combinedText);
    if (fileMatches.length > 0) {
      filePath = fileMatches[fileMatches.length - 1];
      confidence = 0.78;
      reason = '识别到候选文件路径';
      source = assistantText.includes(filePath) ? 'assistant' : 'user';
    }
  }

  if (!symbol && filePath) {
    const anchor = combinedText.lastIndexOf(filePath);
    const contextWindow = anchor >= 0
      ? combinedText.slice(Math.max(0, anchor - 140), Math.min(combinedText.length, anchor + filePath.length + 180))
      : combinedText;
    symbol = extractSymbolFromWindow(contextWindow);
    if (symbol) {
      confidence = Math.max(confidence, 0.9);
      reason = '结合上下文识别到文件附近的函数/符号';
    }
  }

  if (!symbol) {
    symbol = extractSymbolFromWindow(assistantText) || extractSymbolFromWindow(userText);
    if (symbol && options.fallbackTarget?.filePath) {
      filePath = options.fallbackTarget.filePath;
      confidence = Math.max(confidence, 0.7);
      reason = '结合当前文件上下文推断函数/符号';
    }
  }

  if (!filePath && options.fallbackTarget?.filePath) {
    const fallbackSymbol = extractSymbolFromWindow(assistantText) || extractSymbolFromWindow(userText) || options.fallbackTarget.symbol;
    if (fallbackSymbol) {
      filePath = options.fallbackTarget.filePath;
      symbol = fallbackSymbol;
      confidence = 0.64;
      reason = '沿用上一个目标文件并更新函数/符号';
      source = assistantText ? 'assistant' : 'user';
    }
  }

  if (!filePath) {
    return null;
  }

  return {
    filePath,
    symbol,
    confidence,
    source,
    reason,
  };
}

export function extractLatestImplementationSnippet(text: string): ImplementationSnippet | null {
  const blockPattern = /```([A-Za-z0-9_+#.-]*)?\n([\s\S]*?)(```|$)/g;
  let match: RegExpExecArray | null = null;
  let lastBlock: RegExpExecArray | null = null;

  while ((match = blockPattern.exec(text)) !== null) {
    lastBlock = match;
  }

  if (!lastBlock) {
    return null;
  }

  const language = lastBlock[1]?.trim() || undefined;
  const code = lastBlock[2]?.trim();
  if (!code) {
    return null;
  }

  return {
    language,
    code: code.slice(0, 2400),
    isComplete: lastBlock[3] === '```',
  };
}
