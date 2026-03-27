/**
 * 统一的跨域配置模块
 * 参照 Java WebMvcConfiguration 实现
 */

// 配置常量
export const CORS_CONFIG = {
  // 允许的来源 - 对应 Java 的 allowedOrigins("*")
  allowedOrigins: ['*'],

  // 允许的方法 - 对应 Java 的 allowedMethods
  allowedMethods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],

  // 允许的请求头 - 对应 Java 的 allowedHeaders("*")
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Plugin-Token',
    'X-User-Key',
    'X-Plugin-Id',
    'X-Plugin-Secret',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ]
};

/**
 * 添加 CORS 头到响应
 * @param {Object} response - 响应对象
 * @param {string} origin - 请求来源
 */
export function addCorsHeaders(response, origin = '*') {
  response.setRequestHeader = response.setRequestHeader || function() {};

  // 设置允许的来源
  if (response.setHeader) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', CORS_CONFIG.allowedMethods.join(', '));
    response.setHeader('Access-Control-Allow-Headers', CORS_CONFIG.allowedHeaders.join(', '));
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Max-Age', '3600'); // 预检请求缓存时间
  }
}

/**
 * 创建支持跨域的 fetch 配置
 * @param {Object} options - 原始配置
 * @returns {Object} 增强的配置
 */
export function createCorsOptions(options = {}) {
  return {
    ...options,
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    }
  };
}

/**
 * 检查是否为预检请求
 * @param {string} method - HTTP 方法
 * @returns {boolean} 是否为预检请求
 */
export function isPreflightRequest(method) {
  return method && method.toUpperCase() === 'OPTIONS';
}

/**
 * 处理预检请求
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
export function handlePreflightRequest(req, res) {
  console.log(`[CORS预检] ${req.method} ${req.url} - 来源: ${req.headers.origin}`);

  addCorsHeaders(res, req.headers.origin || '*');
  res.status(200).end();
}

// Express 中间件形式的跨域处理
export function corsMiddleware(req, res, next) {
  const origin = req.headers.origin || '*';

  // 添加 CORS 头
  addCorsHeaders(res, origin);

  // 处理预检请求
  if (isPreflightRequest(req.method)) {
    return res.status(200).end();
  }

  next();
}

export default {
  CORS_CONFIG,
  addCorsHeaders,
  createCorsOptions,
  isPreflightRequest,
  handlePreflightRequest,
  corsMiddleware
};