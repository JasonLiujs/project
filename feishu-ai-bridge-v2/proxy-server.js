const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 9999;

// 启用 CORS - 严格按照 Java WebMvcConfiguration 标准
app.use(cors({
  origin: '*', // 直接使用 * 匹配 Java 的 allowedOrigins("*")
  methods: ['GET', 'POST', 'DELETE'], // 严格匹配 Java 的 allowedMethods
  allowCredentials: false, // Java配置中没有credentials，设为false避免冲突
  allowedHeaders: '*', // 匹配 Java 的 allowedHeaders("*")
  optionsSuccessStatus: 200 // 支持预检请求
}));

// Java风格的CORS中间件 - registry.addMapping("/**") 的等价实现
app.use((req, res, next) => {
  // 对应 Java 的 addMapping("/**")
  res.header('Access-Control-Allow-Origin', '*'); // allowedOrigins("*")
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE'); // allowedMethods("GET", "POST", "DELETE")
  res.header('Access-Control-Allow-Headers', '*'); // allowedHeaders("*")

  // 详细的请求日志
  console.log(`\n🌐 [${new Date().toISOString()}] 收到请求:`);
  console.log(`📍 方法: ${req.method}`);
  console.log(`📍 URL: ${req.url}`);
  console.log(`📍 来源: ${req.headers.origin || '未知'}`);
  console.log(`📍 User-Agent: ${req.headers['user-agent'] || '未知'}`);

  // 记录认证相关头部
  const authHeaders = ['x-plugin-token', 'x-user-key', 'authorization'];
  const foundAuthHeaders = {};
  authHeaders.forEach(header => {
    if (req.headers[header]) {
      foundAuthHeaders[header] = req.headers[header].substring(0, 20) + '...'; // 只显示前20个字符
    }
  });

  if (Object.keys(foundAuthHeaders).length > 0) {
    console.log(`🔑 认证头部:`, foundAuthHeaders);
  } else {
    console.log(`⚠️  未发现认证头部`);
  }

  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    console.log(`✅ [CORS预检] 预检请求处理完成`);
    res.sendStatus(200);
    return;
  }

  next();
});

// 代理中间件配置
const proxyOptions = {
  target: 'https://project.feishu.cn',
  changeOrigin: true,
  secure: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`\n🚀 [代理请求] 开始转发:`);
    console.log(`📤 目标: https://project.feishu.cn${req.url}`);

    // 记录请求体（如果有）
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (body) {
        console.log(`📦 请求体:`, JSON.stringify(JSON.parse(body), null, 2));
      }
    });

    // 确保认证头被正确转发
    const authHeaders = ['X-Plugin-Token', 'X-User-Key', 'Authorization'];
    const forwardedHeaders = {};
    authHeaders.forEach(header => {
      const value = req.headers[header.toLowerCase()];
      if (value) {
        forwardedHeaders[header] = value.substring(0, 20) + '...';
        proxyReq.setHeader(header, value);
      }
    });

    if (Object.keys(forwardedHeaders).length > 0) {
      console.log(`✅ 转发认证头:`, forwardedHeaders);
    } else {
      console.log(`⚠️  无认证头转发`);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`\n📥 [代理响应] 收到响应:`);
    console.log(`📊 状态码: ${proxyRes.statusCode} ${proxyRes.statusMessage}`);
    console.log(`📍 请求: ${req.method} ${req.url}`);

    // 记录重要的响应头
    const importantHeaders = ['content-type', 'content-length', 'set-cookie'];
    const responseHeaders = {};
    importantHeaders.forEach(header => {
      if (proxyRes.headers[header]) {
        responseHeaders[header] = proxyRes.headers[header];
      }
    });

    if (Object.keys(responseHeaders).length > 0) {
      console.log(`📋 响应头:`, responseHeaders);
    }

    // 记录响应体（对于小的响应）
    let body = '';
    const originalWrite = res.write;
    const originalEnd = res.end;

    res.write = function(chunk) {
      if (chunk) {
        body += chunk;
      }
      originalWrite.apply(res, arguments);
    };

    res.end = function(chunk) {
      if (chunk) {
        body += chunk;
      }

      // 如果响应较小，记录内容
      if (body.length > 0 && body.length < 2000) {
        try {
          const jsonBody = JSON.parse(body);
          console.log(`📄 响应内容:`, JSON.stringify(jsonBody, null, 2));
        } catch (e) {
          console.log(`📄 响应内容 (非JSON):`, body.substring(0, 500));
        }
      } else if (body.length >= 2000) {
        console.log(`📄 响应内容: [内容过大，已省略] (${body.length} 字符)`);
      }

      originalEnd.apply(res, arguments);
    };

    // 为代理响应添加严格的Java风格 CORS 头
    res.header('Access-Control-Allow-Origin', '*'); // allowedOrigins("*")
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE'); // 严格匹配Java配置
    res.header('Access-Control-Allow-Headers', '*'); // allowedHeaders("*")

    console.log(`✅ 代理响应处理完成\n`);
  },
  onError: (err, req, res) => {
    console.error('[代理错误]:', err);
    res.status(500).json({ error: '代理请求失败', message: err.message });
  }
};

// 设置代理路由 - 拦截所有 /open_api 和 /mcp_server 请求
app.use('/open_api', createProxyMiddleware(proxyOptions));
app.use('/mcp_server', createProxyMiddleware(proxyOptions));

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '代理服务器运行正常' });
});

app.listen(PORT, () => {
  console.log(`🚀 代理服务器已启动：http://localhost:${PORT}`);
  console.log(`📡 代理目标：https://project.feishu.cn`);
  console.log(`🔗 测试地址：http://localhost:${PORT}/health`);
  console.log('');
  console.log('使用示例：');
  console.log(`  原始: https://project.feishu.cn/open_api/xxx/work_item/story/query`);
  console.log(`  代理: http://localhost:${PORT}/open_api/xxx/work_item/story/query`);
});