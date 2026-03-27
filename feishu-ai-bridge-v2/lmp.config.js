module.exports = {
  devServer: {
    // Java风格的 CORS 支持 - 对应 WebMvcConfiguration
    headers: {
      'Access-Control-Allow-Origin': '*', // allowedOrigins("*")
      'Access-Control-Allow-Methods': 'GET, POST, DELETE', // 严格匹配Java方法
      'Access-Control-Allow-Headers': '*' // allowedHeaders("*")
      // 不设置 credentials，与Java配置保持一致
    },
    // 历史 API 回退
    historyApiFallback: true,
    // 允许外部访问
    allowedHosts: 'all',
    proxy: {
      // 代理 MCP 服务器请求
      '/mcp_server': {
        target: 'https://project.feishu.cn',
        changeOrigin: true,
        secure: true,
        logLevel: 'debug',
        onProxyReq: (proxyReq, req, res) => {
          console.log(`[MCP代理] ${req.method} ${req.url} -> https://project.feishu.cn${req.url}`);
        },
        onProxyRes: (proxyRes, req, res) => {
          console.log(`[MCP代理响应] ${proxyRes.statusCode} ${req.url}`);
          // Java风格的 CORS 响应头
          res.setHeader('Access-Control-Allow-Origin', '*'); // allowedOrigins("*")
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE'); // 严格匹配
          res.setHeader('Access-Control-Allow-Headers', '*'); // allowedHeaders("*")
        },
        onError: (err, req, res) => {
          console.error('[MCP代理错误]:', err);
          res.writeHead(500, {
            'Content-Type': 'text/plain'
          });
          res.end('MCP代理请求失败: ' + err.message);
        }
      },
      // 代理开放 API 请求
      '/open_api': {
        target: 'https://project.feishu.cn',
        changeOrigin: true,
        secure: true,
        logLevel: 'debug',
        onProxyReq: (proxyReq, req, res) => {
          console.log(`[API代理] ${req.method} ${req.url} -> https://project.feishu.cn${req.url}`);
        },
        onProxyRes: (proxyRes, req, res) => {
          console.log(`[API代理响应] ${proxyRes.statusCode} ${req.url}`);
          // Java风格的 CORS 响应头
          res.setHeader('Access-Control-Allow-Origin', '*'); // allowedOrigins("*")
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE'); // 严格匹配
          res.setHeader('Access-Control-Allow-Headers', '*'); // allowedHeaders("*")
        },
        onError: (err, req, res) => {
          console.error('[API代理错误]:', err);
          res.writeHead(500, {
            'Content-Type': 'text/plain'
          });
          res.end('API代理请求失败: ' + err.message);
        }
      }
    }
  }
};