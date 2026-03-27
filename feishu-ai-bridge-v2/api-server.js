const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 8888;

// 配置
const CONFIG = {
  feishuDomain: 'https://project.feishu.cn',
  projectKey: '69a00d715adc93d52b944bfa'
};

// 启用CORS - 严格按照Java WebMvcConfiguration标准
app.use(cors({
  origin: '*', // allowedOrigins("*")
  methods: ['GET', 'POST', 'DELETE'], // allowedMethods("GET", "POST", "DELETE")
  allowedHeaders: '*' // allowedHeaders("*")
}));

// 解析JSON请求体
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`\n🌐 [${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log(`📍 来源: ${req.headers.origin || '未知'}`);

  // 记录认证头
  const authHeaders = {};
  ['x-plugin-token', 'x-user-key', 'authorization'].forEach(header => {
    if (req.headers[header]) {
      authHeaders[header] = req.headers[header].substring(0, 20) + '...';
    }
  });

  if (Object.keys(authHeaders).length > 0) {
    console.log(`🔑 认证头:`, authHeaders);
  }

  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📦 请求体:`, JSON.stringify(req.body, null, 2));
  }

  next();
});

/**
 * 工作项查询API
 * POST /api/work-items/query
 */
app.post('/api/work-items/query', async (req, res) => {
  try {
    console.log('\n🚀 [工作项查询] 开始处理请求');

    // 从请求体中获取spaceId和workObjectId，如果没有则使用默认配置
    const spaceId = req.body.space_id || req.query.space_id || CONFIG.projectKey;
    const workObjectId = req.body.work_object_id || req.query.work_object_id || 'story';

    // 构建飞书API URL，使用动态的spaceId和workObjectId
    const feishuApiUrl = `${CONFIG.feishuDomain}/open_api/${spaceId}/work_item/${workObjectId}/query`;
    console.log(`📍 目标URL: ${feishuApiUrl}`);

    // 准备请求头
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'feishu-ai-bridge-v2/1.0.0'
    };

    // 转发认证头
    ['x-plugin-token', 'x-user-key', 'authorization'].forEach(header => {
      if (req.headers[header]) {
        headers[header] = req.headers[header];
      }
    });

    console.log(`🔑 转发的认证头:`, Object.keys(headers).filter(k => k.includes('token') || k.includes('key') || k.includes('auth')));

    // 发送请求到飞书API
    console.log(`📤 发送请求到飞书...`);
    const startTime = Date.now();

    const response = await fetch(feishuApiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(req.body)
    });

    const endTime = Date.now();
    console.log(`⏱️ 请求耗时: ${endTime - startTime}ms`);
    console.log(`📊 飞书响应状态: ${response.status} ${response.statusText}`);

    // 如果响应状态不是2xx，记录详细的请求信息用于调试
    if (!response.ok) {
      console.log(`\n❌ ====== 请求失败详情 ======`);
      console.log(`🔗 请求URL: ${feishuApiUrl}`);
      console.log(`📦 完整请求体:`, JSON.stringify(req.body, null, 2));
      console.log(`🔑 完整认证头:`, JSON.stringify(Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k, typeof v === 'string' && v.length > 20 ? v.substring(0, 20) + '...' : v])
      ), null, 2));
    }

    // 读取响应
    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
      console.log(`✅ 解析JSON成功`);
    } catch (parseError) {
      console.log(`⚠️ 响应不是JSON格式`);
      responseData = {
        error: 'Invalid JSON response',
        rawResponse: responseText.substring(0, 500)
      };
    }

    // 记录详细的响应内容
    console.log(`📄 完整響应内容:`, JSON.stringify(responseData, null, 2));

    // 记录响应数据结构
    if (responseData && typeof responseData === 'object') {
      console.log(`📋 响应结构:`, {
        hasData: !!responseData.data,
        hasItems: !!responseData.data?.items,
        itemsCount: responseData.data?.items?.length || 0,
        topKeys: Object.keys(responseData)
      });

      if (responseData.data?.items?.[0]) {
        console.log(`🎯 第一个工作项预览:`, {
          id: responseData.data.items[0].id,
          name: responseData.data.items[0].name,
          template_id: responseData.data.items[0].template_id,
          status: responseData.data.items[0].status
        });
      }
    }

    // 返回响应给前端
    res.status(response.status).json(responseData);

    console.log(`✅ [工作项查询] 请求处理完成\n`);

  } catch (error) {
    console.error(`\n❌ [工作项查询] 请求处理失败:`);
    console.error(`🐛 错误类型: ${error.constructor.name}`);
    console.error(`💬 错误信息: ${error.message}`);
    console.error(`🔍 完整错误:`, error);

    res.status(500).json({
      error: '服务器内部错误',
      message: error.message,
      type: error.constructor.name
    });

    console.log(`💥 [工作项查询] 错误处理完成\n`);
  }
});

/**
 * 模板详情查询API
 * GET /api/template/:templateId
 */
app.get('/api/template/:templateId', async (req, res) => {
  try {
    console.log('\n🚀 [模板查询] 开始处理请求');

    const templateId = req.params.templateId;
    // 从查询参数中获取spaceId，如果没有则使用默认配置
    const spaceId = req.query.space_id || CONFIG.projectKey;

    const feishuApiUrl = `${CONFIG.feishuDomain}/open_api/${spaceId}/template_detail/${templateId}`;

    console.log(`📍 模板ID: ${templateId}`);
    console.log(`📍 目标URL: ${feishuApiUrl}`);

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'feishu-ai-bridge-v2/1.0.0'
    };

    // 转发认证头
    ['x-plugin-token', 'x-user-key', 'authorization'].forEach(header => {
      if (req.headers[header]) {
        headers[header] = req.headers[header];
      }
    });

    const response = await fetch(feishuApiUrl, {
      method: 'GET',
      headers: headers
    });

    console.log(`📊 飞书响应状态: ${response.status} ${response.statusText}`);

    // 读取响应
    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
      console.log(`✅ 解析JSON成功`);
    } catch (parseError) {
      console.log(`⚠️ 响应不是JSON格式`);
      responseData = {
        error: 'Invalid JSON response',
        rawResponse: responseText.substring(0, 500)
      };
    }

    // 记录详细的响应内容
    console.log(`📄 完整模板响应内容:`, JSON.stringify(responseData, null, 2));

    // 记录响应数据结构
    if (responseData && typeof responseData === 'object') {
      console.log(`📋 模板响应结构:`, {
        hasData: !!responseData.data,
        hasNodes: !!responseData.data?.nodes,
        nodesCount: responseData.data?.nodes?.length || 0,
        topKeys: Object.keys(responseData)
      });

      if (responseData.data?.nodes?.[0]) {
        console.log(`🎯 第一个节点预览:`, {
          node_id: responseData.data.nodes[0].node_id,
          node_name: responseData.data.nodes[0].node_name,
          node_type: responseData.data.nodes[0].node_type
        });
      }
    }

    res.status(response.status).json(responseData);

    console.log(`✅ [模板查询] 请求处理完成\n`);

  } catch (error) {
    console.error(`\n❌ [模板查询] 请求处理失败:`, error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error.message
    });
  }
});

/**
 * 工作流查询API
 * POST /api/workflow/query
 */
app.post('/api/workflow/query', async (req, res) => {
  try {
    console.log('\n🚀 [工作流查询] 开始处理请求');

    // 从请求体中获取必要参数
    const { spaceId, workObjectId, activeWorkItemId, query_type, include_skills } = req.body;

    if (!spaceId || !workObjectId || !activeWorkItemId) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '需要提供 spaceId, workObjectId 和 activeWorkItemId',
        required: ['spaceId', 'workObjectId', 'activeWorkItemId']
      });
    }

    // 构建飞书工作流查询API URL
    const feishuApiUrl = `${CONFIG.feishuDomain}/open_api/${spaceId}/work_item/${workObjectId}/${activeWorkItemId}/workflow/query`;
    console.log(`📍 目标URL: ${feishuApiUrl}`);

    // 准备请求头
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'feishu-ai-bridge-v2/1.0.0'
    };

    // 转发认证头
    ['x-plugin-token', 'x-user-key', 'authorization'].forEach(header => {
      if (req.headers[header]) {
        headers[header] = req.headers[header];
      }
    });

    console.log(`🔑 转发的认证头:`, Object.keys(headers).filter(k => k.includes('token') || k.includes('key') || k.includes('auth')));

    // 准备发送给飞书API的请求体
    const workflowRequestBody = {
      query_type: query_type || 'running_nodes',
      include_skills: include_skills !== false
    };

    console.log(`📦 工作流请求体:`, JSON.stringify(workflowRequestBody, null, 2));

    // 发送请求到飞书工作流API
    console.log(`📤 发送工作流请求到飞书...`);
    const startTime = Date.now();

    const response = await fetch(feishuApiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(workflowRequestBody)
    });

    const endTime = Date.now();
    console.log(`⏱️ 请求耗时: ${endTime - startTime}ms`);
    console.log(`📊 飞书工作流响应状态: ${response.status} ${response.statusText}`);

    // 如果响应状态不是2xx，记录详细的请求信息用于调试
    if (!response.ok) {
      console.log(`\n❌ ====== 工作流请求失败详情 ======`);
      console.log(`🔗 请求URL: ${feishuApiUrl}`);
      console.log(`📦 完整请求体:`, JSON.stringify(workflowRequestBody, null, 2));
      console.log(`🔑 完整认证头:`, JSON.stringify(Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k, typeof v === 'string' && v.length > 20 ? v.substring(0, 20) + '...' : v])
      ), null, 2));
    }

    // 读取响应
    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
      console.log(`✅ 解析JSON成功`);
    } catch (parseError) {
      console.log(`⚠️ 响应不是JSON格式`);
      responseData = {
        error: 'Invalid JSON response',
        rawResponse: responseText.substring(0, 500)
      };
    }

    // 记录详细的响应内容
    console.log(`📄 完整工作流响应内容:`, JSON.stringify(responseData, null, 2));

    // 记录响应数据结构
    if (responseData && typeof responseData === 'object') {
      console.log(`📋 工作流响应结构:`, {
        hasData: !!responseData.data,
        hasNodes: !!responseData.data?.nodes,
        hasCurrentNodes: !!responseData.data?.current_nodes,
        hasRunningNodes: !!responseData.data?.running_nodes,
        nodesCount: responseData.data?.nodes?.length || 0,
        currentNodesCount: responseData.data?.current_nodes?.length || 0,
        runningNodesCount: responseData.data?.running_nodes?.length || 0,
        topKeys: Object.keys(responseData)
      });

      // 显示运行中节点的预览
      if (responseData.data?.running_nodes?.[0]) {
        console.log(`🎯 第一个运行中节点预览:`, {
          id: responseData.data.running_nodes[0].id,
          name: responseData.data.running_nodes[0].name,
          state_key: responseData.data.running_nodes[0].state_key,
          status: responseData.data.running_nodes[0].status
        });
      }
    }

    // 转换飞书API数据格式以匹配前端期望的结构
    if (responseData && responseData.data && responseData.data.workflow_nodes) {
      console.log(`🔄 转换数据格式: workflow_nodes -> running_nodes`);

      // 从workflow_nodes中提取所有节点
      const allNodes = responseData.data.workflow_nodes;

      // 过滤出进行中的节点（status=2）
      const runningNodes = allNodes.filter(node => node.status === 2);

      console.log(`📊 节点统计: 总共 ${allNodes.length} 个节点，进行中 ${runningNodes.length} 个节点`);

      // 构造前端期望的数据格式
      const transformedData = {
        ...responseData,
        data: {
          ...responseData.data,
          nodes: allNodes,
          current_nodes: runningNodes,  // 当前节点
          running_nodes: runningNodes   // 进行中节点
        }
      };

      // 返回转换后的响应给前端
      res.status(response.status).json(transformedData);
    } else {
      // 返回原始响应给前端
      res.status(response.status).json(responseData);
    }

    console.log(`✅ [工作流查询] 请求处理完成\n`);

  } catch (error) {
    console.error(`\n❌ [工作流查询] 请求处理失败:`);
    console.error(`🐛 错误类型: ${error.constructor.name}`);
    console.error(`💬 错误信息: ${error.message}`);
    console.error(`🔍 完整错误:`, error);

    res.status(500).json({
      error: '服务器内部错误',
      message: error.message,
      type: error.constructor.name
    });

    console.log(`💥 [工作流查询] 错误处理完成\n`);
  }
});

/**
 * 插件认证API
 * POST /api/auth/plugin-token
 */
app.post('/api/auth/plugin-token', async (req, res) => {
  try {
    console.log('\n🚀 [插件认证] 开始处理请求');

    const feishuAuthUrl = `${CONFIG.feishuDomain}/open_api/authen/plugin_token`;
    console.log(`📍 目标URL: ${feishuAuthUrl}`);

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'feishu-ai-bridge-v2/1.0.0'
    };

    console.log(`📦 请求体:`, JSON.stringify(req.body, null, 2));

    const response = await fetch(feishuAuthUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(req.body)
    });

    console.log(`📊 飞书响应状态: ${response.status} ${response.statusText}`);

    const responseData = await response.json();
    res.status(response.status).json(responseData);

    console.log(`✅ [插件认证] 请求处理完成\n`);

  } catch (error) {
    console.error(`\n❌ [插件认证] 请求处理失败:`, error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error.message
    });
  }
});

/**
 * MCP代理API
 * POST /api/mcp/proxy
 */
app.post('/api/mcp/proxy', async (req, res) => {
  try {
    console.log('\n🚀 [MCP代理] 开始处理请求');

    // 从请求体中获取MCP请求参数
    const { mcpUrl, mcpKey, userKey, mcpRequest } = req.body;

    if (!mcpUrl || !mcpKey || !userKey || !mcpRequest) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '需要提供 mcpUrl, mcpKey, userKey 和 mcpRequest',
        required: ['mcpUrl', 'mcpKey', 'userKey', 'mcpRequest']
      });
    }

    // 构建MCP服务器URL
    let fullMcpUrl;
    if (mcpUrl.startsWith('http')) {
      fullMcpUrl = mcpUrl;
    } else {
      // CONFIG.feishuDomain 已经包含 https://，直接拼接
      fullMcpUrl = `${CONFIG.feishuDomain}${mcpUrl}`;
    }

    const mcpServiceUrl = `${fullMcpUrl}?mcpKey=${mcpKey}&userKey=${userKey}`;

    console.log(`📍 目标MCP URL: ${mcpServiceUrl}`);

    // 准备请求头
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'feishu-ai-bridge-v2/1.0.0'
    };

    console.log(`🔑 转发MCP请求:`, JSON.stringify(mcpRequest, null, 2));

    // 发送请求到MCP服务器
    console.log(`📤 发送MCP请求...`);
    const startTime = Date.now();

    const response = await fetch(mcpServiceUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(mcpRequest)
    });

    const endTime = Date.now();
    console.log(`⏱️ MCP请求耗时: ${endTime - startTime}ms`);
    console.log(`📊 MCP响应状态: ${response.status} ${response.statusText}`);

    // 如果响应状态不是2xx，记录详细的请求信息用于调试
    if (!response.ok) {
      console.log(`\n❌ ====== MCP请求失败详情 ======`);
      console.log(`🔗 请求URL: ${mcpServiceUrl}`);
      console.log(`📦 完整请求体:`, JSON.stringify(mcpRequest, null, 2));
    }

    // 读取响应
    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
      console.log(`✅ 解析JSON成功`);
    } catch (parseError) {
      console.log(`⚠️ 响应不是JSON格式`);
      responseData = {
        error: 'Invalid JSON response',
        rawResponse: responseText.substring(0, 500)
      };
    }

    // 记录详细的响应内容
    console.log(`📄 完整MCP响应内容:`, JSON.stringify(responseData, null, 2));

    // 返回响应给前端
    res.status(response.status).json(responseData);

    console.log(`✅ [MCP代理] 请求处理完成\n`);

  } catch (error) {
    console.error(`\n❌ [MCP代理] 请求处理失败:`);
    console.error(`🐛 错误类型: ${error.constructor.name}`);
    console.error(`💬 错误信息: ${error.message}`);
    console.error(`🔍 完整错误:`, error);

    res.status(500).json({
      error: '服务器内部错误',
      message: error.message,
      type: error.constructor.name
    });

    console.log(`💥 [MCP代理] 错误处理完成\n`);
  }
});

/**
 * 健康检查API
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Feishu AI Bridge API 服务器运行正常',
    timestamp: new Date().toISOString(),
    config: {
      feishuDomain: CONFIG.feishuDomain,
      projectKey: CONFIG.projectKey
    }
  });
});

/**
 * API信息
 * GET /api/info
 */
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Feishu AI Bridge API Server',
    version: '1.0.0',
    endpoints: [
      {
        method: 'POST',
        path: '/api/work-items/query',
        description: '查询工作项列表',
        example: {
          body: {
            work_item_ids: [],
            page_size: 10,
            page_num: 1
          }
        }
      },
      {
        method: 'POST',
        path: '/api/workflow/query',
        description: '查询工作流节点状态',
        example: {
          body: {
            spaceId: '676e6839bd3a3bcba14xxxx',
            workObjectId: 'story',
            activeWorkItemId: '126941xxx',
            query_type: 'running_nodes',
            include_skills: true
          }
        }
      },
      {
        method: 'GET',
        path: '/api/template/:templateId',
        description: '获取模板详情',
        example: '/api/template/6965393'
      },
      {
        method: 'GET',
        path: '/health',
        description: '健康检查'
      }
    ]
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Feishu AI Bridge API 服务器已启动!`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🔗 健康检查: http://localhost:${PORT}/health`);
  console.log(`📋 API信息: http://localhost:${PORT}/api/info`);
  console.log(`📡 代理目标: ${CONFIG.feishuDomain}`);
  console.log(`📂 项目ID: ${CONFIG.projectKey}`);
  console.log('');
  console.log('📋 可用的API端点:');
  console.log('  POST /api/work-items/query - 查询工作项');
  console.log('  POST /api/workflow/query - 查询工作流节点');
  console.log('  GET  /api/template/:id - 获取模板详情');
  console.log('  GET  /health - 健康检查');
  console.log('  GET  /api/info - API信息');
  console.log('');
  console.log('⚙️ CORS配置: 允许所有来源 (Java WebMvcConfiguration标准)');
  console.log('');
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('💥 未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未处理的Promise拒绝:', reason);
});