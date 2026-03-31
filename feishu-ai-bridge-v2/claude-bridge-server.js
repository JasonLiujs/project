#!/usr/bin/env node

/**
 * Claude Code HTTP bridge server
 * - Chat: forwards requests to the local Claude Code CLI
 * - Memory file: generates structured markdown, writes backup files,
 *   then returns the artifact metadata for the frontend to sync to Feishu
 */

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');

const PORT = 3001;
const HOST = '127.0.0.1';
const CLAUDE_BINARY =
  process.env.CLAUDE_BINARY ||
  '/Users/bytedance/.vscode/extensions/anthropic.claude-code-2.1.81-darwin-arm64/resources/native-binary/claude';
const DEFAULT_WORKSPACE_ROOT = '/Users/bytedance/project/project/feishu-ai-bridge-v2';
const REQUEST_TIMEOUT_MS = 120000;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sanitizeFileNamePart(value) {
  return String(value || 'unknown')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '')
    .slice(0, 80) || 'unknown';
}

function toCompactTimestamp(input) {
  const date = input ? new Date(input) : new Date();
  if (Number.isNaN(date.getTime())) {
    return toCompactTimestamp();
  }

  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const min = `${date.getMinutes()}`.padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${min}`;
}

function createMemoryFileName(payload) {
  return [
    sanitizeFileNamePart(payload.projectId || payload.projectKey || payload.spaceId),
    sanitizeFileNamePart(payload.node?.name),
    toCompactTimestamp(payload.completedAt),
    '记忆文件.md',
  ].join('-');
}

function buildChatPrompt(message, context = {}) {
  const contextLines = [];
  if (context.nodeId) {
    contextLines.push(`当前节点ID: ${context.nodeId}`);
  }
  if (context.workspaceRoot) {
    contextLines.push(`工作目录: ${context.workspaceRoot}`);
  }
  if (Array.isArray(context.skills) && context.skills.length > 0) {
    contextLines.push(`相关技能: ${context.skills.join(', ')}`);
  }
  if (context.workflowContext) {
    contextLines.push(`工作流上下文: ${JSON.stringify(context.workflowContext, null, 2)}`);
  }
  if (context.skillExecution?.skillName) {
    contextLines.push(`正在执行技能: ${context.skillExecution.skillName}`);
  }

  return [
    '你是飞书项目插件中的 Claude Code 助手。',
    '请直接回答用户问题，使用中文，内容真实、简洁、可执行。',
    contextLines.length > 0 ? `\n上下文:\n${contextLines.join('\n')}` : '',
    '\n用户消息:',
    message,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildMemoryFilePrompt(payload) {
  return [
    '请基于以下 JSON 数据，生成一份标准化 Markdown 记忆文件。',
    '必须满足：',
    '1. 使用中文。',
    '2. 必须包含 5 个一级模块，标题分别是：',
    '   - ## 01-基础信息',
    '   - ## 02-工作详情',
    '   - ## 03-工作成果',
    '   - ## 04-指导思路',
    '   - ## 05-索引与备注',
    '3. 不要省略模块；如果某项缺失，请明确写“暂无”或“无异常”。',
    '4. 内容要忠实于输入数据，避免臆造。',
    '5. 输出只能是 Markdown 正文，不要再包 JSON，不要加额外解释。',
    '',
    '输入数据:',
    JSON.stringify(payload, null, 2),
  ].join('\n');
}

function formatList(items, emptyText = '暂无') {
  if (!Array.isArray(items) || items.length === 0) {
    return `- ${emptyText}`;
  }

  return items
    .filter(Boolean)
    .map((item) => `- ${String(item)}`)
    .join('\n');
}

function createFallbackMemoryMarkdown(payload) {
  const outcomes = Array.isArray(payload.outcomes) ? payload.outcomes : [];
  const predecessorNodes = Array.isArray(payload.predecessorNodes) ? payload.predecessorNodes : [];
  const workDetails = payload.workDetails || {};
  const guidance = payload.guidance || {};

  return [
    '## 01-基础信息',
    `### 节点名称\n- ${payload.node?.name || '暂无'}`,
    `### 所属项目\n- 项目ID: ${payload.projectId || payload.projectKey || payload.spaceId || '暂无'}\n- 空间ID: ${payload.spaceId || '暂无'}`,
    `### 执行主体\n- AI Agent: ${payload.agentName || 'Claude Code'}\n- 协同角色: ${Array.isArray(payload.collaborators) && payload.collaborators.length > 0 ? payload.collaborators.join('，') : '暂无'}`,
    `### 执行时间\n- 启动时间: ${payload.startedAt || '暂无'}\n- 完成时间: ${payload.completedAt || new Date().toISOString()}`,
    `### 前置依赖\n${formatList(predecessorNodes.map((item) => `${item.name || '前置节点'}：${item.output || '暂无产出说明'}`))}`,
    `### 节点目标\n- ${payload.nodeGoal || '完成当前节点工作并沉淀结构化记忆文件。'}`,
    '',
    '## 02-工作详情',
    `### 工作内容\n${formatList(workDetails.workItems, '暂无工作内容')}`,
    `### 执行逻辑\n${formatList(workDetails.executionLogic, '暂无执行逻辑')}`,
    `### 关键操作\n${formatList(workDetails.keyOperations, '暂无关键操作')}`,
    `### 异常处理\n${formatList(workDetails.exceptions, '无异常')}`,
    '',
    '## 03-工作成果',
    `### 成果清单\n${formatList(outcomes.map((item) => `${item.name || '未命名成果'}（${item.format || '未知格式'}）`), '暂无成果')}`,
    `### 存储信息\n${formatList(outcomes.map((item) => item.path || '待写回后补充'), '暂无存储信息')}`,
    `### 成果说明\n${formatList(outcomes.map((item) => item.description || '暂无说明'), '暂无成果说明')}`,
    `### 成果校验\n${formatList(outcomes.map((item) => item.validation || '待校验'), '暂无校验结果')}`,
    '',
    '## 04-指导思路',
    `### 指导人员\n${formatList(guidance.people, '暂无指导人员')}`,
    `### 核心指导思路\n${formatList(guidance.directions, '暂无指导思路')}`,
    `### 指导调整\n${formatList(guidance.adjustments, '暂无指导调整')}`,
    `### 指导总结\n- ${guidance.summary || '优先保证当前节点信息完整、可追溯、可复用。'}`,
    '',
    '## 05-索引与备注',
    `### 关键词索引\n- ${Array.isArray(payload.keywords) && payload.keywords.length > 0 ? payload.keywords.join(', ') : '暂无关键词'}`,
    `### 备注信息\n${formatList(payload.remarks, '暂无备注')}`,
    `### 版本说明\n- ${payload.version || 'V1.0'}`,
    '',
    '> 注：本文件由节点完成动作自动生成；当前环境下 Claude CLI 未返回正文时，已自动使用结构化兜底模板补齐。',
  ].join('\n\n');
}

function deriveNodeNameFromFileName(fileName, projectId) {
  if (!fileName.endsWith('-记忆文件.md')) {
    return '';
  }

  const prefix = `${projectId}-`;
  if (!fileName.startsWith(prefix)) {
    return '';
  }

  const withoutProject = fileName.slice(prefix.length);
  const suffix = '-记忆文件.md';
  const withoutSuffix = withoutProject.slice(0, -suffix.length);
  const lastDashIndex = withoutSuffix.lastIndexOf('-');
  if (lastDashIndex <= 0) {
    return '';
  }

  return withoutSuffix.slice(0, lastDashIndex);
}

async function appendErrorLog(workspaceRoot, error) {
  const logDir = path.join(workspaceRoot || DEFAULT_WORKSPACE_ROOT, 'memory-files');
  const logPath = path.join(logDir, 'memory-file-errors.log');
  await fs.mkdir(logDir, { recursive: true });
  const logEntry = [
    `time=${new Date().toISOString()}`,
    `error=${error instanceof Error ? error.message : String(error)}`,
    '',
  ].join('\n');
  await fs.appendFile(logPath, logEntry, 'utf8');
}

function runClaudePrompt(prompt, options = {}) {
  const workspaceRoot = options.workspaceRoot || DEFAULT_WORKSPACE_ROOT;
  const timeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;
  const args = ['-p', '--output-format', 'text'];

  if (workspaceRoot) {
    args.push('--add-dir', workspaceRoot);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BINARY, args, {
      cwd: workspaceRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killedByTimeout = false;

    const timer = setTimeout(() => {
      killedByTimeout = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killedByTimeout) {
        reject(new Error('Claude Code 执行超时'));
        return;
      }

      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `Claude Code 退出码异常: ${code}`));
        return;
      }

      const content = stdout.trim();
      if (!content) {
        reject(new Error('Claude Code 返回空内容'));
        return;
      }

      resolve(content);
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function parseRequestBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }

  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

async function handleChat(requestData) {
  const message = requestData.message || requestData.content || '';
  if (!message) {
    throw new Error('消息不能为空');
  }

  const prompt = buildChatPrompt(message, requestData);
  const response = await runClaudePrompt(prompt, {
    workspaceRoot: requestData.workspaceRoot || DEFAULT_WORKSPACE_ROOT,
  });

  return {
    response,
    status: 'success',
    metadata: {
      endpoint: '/api/chat',
      timestamp: new Date().toISOString(),
      requestId: Date.now().toString(),
      source: 'real-claude-code',
    },
  };
}

async function handleMemoryFile(requestData) {
  const payload = requestData.payload;
  if (!payload || typeof payload !== 'object') {
    throw new Error('缺少记忆文件 payload');
  }

  const workspaceRoot = payload.workspaceRoot || DEFAULT_WORKSPACE_ROOT;
  const backupDir = payload.backupDir || path.join(workspaceRoot, 'memory-files');
  const fileName = createMemoryFileName(payload);
  const filePath = path.join(backupDir, fileName);
  const prompt = buildMemoryFilePrompt(payload);

  await fs.mkdir(backupDir, { recursive: true });

  try {
    let content;

    try {
      content = await runClaudePrompt(prompt, { workspaceRoot });
    } catch (error) {
      await appendErrorLog(workspaceRoot, error);
      content = createFallbackMemoryMarkdown(payload);
    }

    await fs.writeFile(filePath, content, 'utf8');

    return {
      status: 'success',
      memoryFile: {
        fileName,
        filePath,
        content,
        completedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    await appendErrorLog(workspaceRoot, error);
    throw error;
  }
}

async function handleMemoryFileSearch(requestData) {
  const projectId = String(requestData.projectId || '').trim();
  if (!projectId) {
    throw new Error('缺少 projectId');
  }

  const workspaceRoot = requestData.workspaceRoot || DEFAULT_WORKSPACE_ROOT;
  const backupDir = requestData.backupDir || path.join(workspaceRoot, 'memory-files');
  const excludeNodeName = String(requestData.excludeNodeName || '').trim();
  const nodeNames = Array.isArray(requestData.nodeNames)
    ? requestData.nodeNames.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const limit = Math.max(1, Math.min(Number(requestData.limit) || 5, 20));

  const fileNames = await fs.readdir(backupDir).catch(() => []);
  const matchedFiles = fileNames
    .filter((fileName) => fileName.startsWith(`${projectId}-`) && fileName.endsWith('-记忆文件.md'))
    .map((fileName) => ({
      fileName,
      nodeName: deriveNodeNameFromFileName(fileName, projectId),
    }))
    .filter((item) => item.nodeName && item.nodeName !== excludeNodeName)
    .filter((item) => nodeNames.length === 0 || nodeNames.includes(item.nodeName))
    .sort((a, b) => b.fileName.localeCompare(a.fileName))
    .slice(0, limit);

  const files = await Promise.all(
    matchedFiles.map(async (item) => {
      const filePath = path.join(backupDir, item.fileName);
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      return {
        fileName: item.fileName,
        filePath,
        nodeName: item.nodeName,
        content,
        updatedAt: stat.mtime.toISOString(),
      };
    })
  );

  return {
    status: 'success',
    files,
  };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method || 'GET';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (method === 'GET' && (pathname === '/' || pathname === '/health' || pathname === '/status')) {
    sendJson(res, 200, {
      status: 'ok',
      service: 'Claude Code Bridge Server',
      version: '2.0.0',
      mode: 'local-cli',
      claude_binary_path: CLAUDE_BINARY,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (
    method === 'POST' &&
    (pathname === '/api/chat' ||
      pathname === '/api/v1/chat' ||
      pathname === '/chat' ||
      pathname === '/api/message' ||
      pathname === '/message')
  ) {
    try {
      const requestData = await parseRequestBody(req);
      const result = await handleChat(requestData);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, {
        status: 'error',
        error: '桥接服务器错误',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (method === 'POST' && pathname === '/api/memory-file') {
    try {
      const requestData = await parseRequestBody(req);
      const result = await handleMemoryFile(requestData);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, {
        status: 'error',
        error: '记忆文件生成失败',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (method === 'POST' && pathname === '/api/memory-files/search') {
    try {
      const requestData = await parseRequestBody(req);
      const result = await handleMemoryFileSearch(requestData);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, {
        status: 'error',
        error: '记忆文件查询失败',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  sendJson(res, 404, {
    status: 'error',
    error: 'Not Found',
    availableEndpoints: [
      'GET /health - 健康检查',
      'POST /api/chat - Claude 对话',
      'POST /api/memory-file - 生成节点记忆文件',
      'POST /api/memory-files/search - 查询节点记忆文件',
    ],
  });
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 0;

server.listen(PORT, HOST, () => {
  console.log('🚀 Claude Code HTTP桥接服务器已启动');
  console.log(`📡 监听地址: http://${HOST}:${PORT}`);
  console.log('🤖 当前模式: local-cli');
  console.log('📋 可用端点: GET /health, POST /api/chat, POST /api/memory-file, POST /api/memory-files/search');
});

process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭 Claude Code 桥接服务器...');
  server.close(() => process.exit(0));
});
