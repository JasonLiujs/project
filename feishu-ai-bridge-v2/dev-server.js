const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 8080;

// 启用 CORS
app.use(cors({
  origin: ['http://localhost:8080', 'https://localhost:8080', 'https://project.feishu.cn'],
  credentials: true
}));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'src')));
app.use(express.static(__dirname));

// API 代理
const proxyOptions = {
  target: 'https://project.feishu.cn',
  changeOrigin: true,
  secure: true,
  logLevel: 'debug'
};

app.use('/open_api', createProxyMiddleware(proxyOptions));
app.use('/mcp_server', createProxyMiddleware(proxyOptions));

// 开发页面路由
app.get('/debug/:feature', (req, res) => {
  const feature = req.params.feature;
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>调试 - ${feature}</title>
  <meta charset="UTF-8">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    // 模拟 JSSDK
    window.JSSDK = {
      shared: {
        setSharedModules: async (modules) => {
          console.log('设置共享模块:', modules);
          return Promise.resolve();
        }
      }
    };

    // 动态加载功能模块
    import('./src/features/${feature}/App.tsx').then(module => {
      const App = module.default;
      ReactDOM.render(React.createElement(App), document.getElementById('root'));
    }).catch(err => {
      document.getElementById('root').innerHTML =
        '<h2>功能模块: ${feature}</h2><p>开发调试页面</p><pre>' + err.message + '</pre>';
    });
  </script>
</body>
</html>
  `);
});

// 主页
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Feishu AI Bridge - 开发环境</title>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .feature {
      background: #f5f5f5;
      padding: 15px;
      margin: 10px 0;
      border-radius: 5px;
      text-decoration: none;
      display: block;
      color: #333;
    }
    .feature:hover { background: #e0e0e0; }
    h1 { color: #1890ff; }
  </style>
</head>
<body>
  <h1>🚀 Feishu AI Bridge 开发环境</h1>
  <p>选择要调试的功能模块：</p>

  <a href="/debug/ai_tab" class="feature">
    <strong>AI Tab</strong><br>
    <small>AI 标签页功能</small>
  </a>

  <a href="/debug/ai_dashboard" class="feature">
    <strong>AI Dashboard</strong><br>
    <small>AI 控制面板</small>
  </a>

  <a href="/debug/ai_config" class="feature">
    <strong>AI Config</strong><br>
    <small>AI 配置页面</small>
  </a>

  <a href="/debug/board" class="feature">
    <strong>Board</strong><br>
    <small>看板功能</small>
  </a>

  <a href="/debug/view" class="feature">
    <strong>View</strong><br>
    <small>视图功能</small>
  </a>

  <a href="/debug/links_dashboard" class="feature">
    <strong>Links Dashboard</strong><br>
    <small>链接控制面板</small>
  </a>

  <hr style="margin: 30px 0;">

  <h3>🔧 测试工具</h3>
  <a href="/test-auth-flow.js" class="feature">
    <strong>认证流程测试</strong><br>
    <small>测试用户认证</small>
  </a>

  <a href="/test-api-simple.js" class="feature">
    <strong>简单 API 测试</strong><br>
    <small>测试基础 API 调用</small>
  </a>

  <h3>📊 服务状态</h3>
  <p>
    <strong>开发服务器:</strong> http://localhost:${PORT}<br>
    <strong>API 代理:</strong> http://localhost:3001<br>
    <strong>健康检查:</strong> <a href="http://localhost:3001/health" target="_blank">代理服务器状态</a>
  </p>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 开发服务器启动成功！`);
  console.log(`📱 访问地址: http://localhost:${PORT}`);
  console.log(`🔧 功能调试: http://localhost:${PORT}/debug/[功能名]`);
  console.log(`📡 API 代理已启用 (目标: https://project.feishu.cn)`);
  console.log('');
  console.log('可用的调试页面:');
  console.log('  - http://localhost:${PORT}/debug/ai_config');
  console.log('  - http://localhost:${PORT}/debug/ai_dashboard');
  console.log('  - http://localhost:${PORT}/debug/ai_tab');
  console.log('  等等...');
});