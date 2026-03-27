/**
 * 开发环境代理配置
 * 自动将项目API请求重定向到本地代理服务器
 */

import { API_CONFIG } from '../constants';

const PROXY_SERVER_URL = 'http://localhost:3001';

// 检查是否为开发环境
const isDevelopment = () => {
  return window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1' ||
         window.location.hostname.includes('ngrok');
};

// 原始 fetch 函数
const originalFetch = window.fetch;

/**
 * 代理 fetch 函数，自动重定向跨域请求
 */
const proxyFetch: typeof fetch = async (input, init) => {
  let url: string;

  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = input.url;
  }

  // 如果是开发环境且请求的是项目API域名
  if (isDevelopment() && url.includes(API_CONFIG.siteDomain)) {
    // 替换为本地代理服务器
    const proxyUrl = url.replace(`https://${API_CONFIG.siteDomain}`, PROXY_SERVER_URL);
    console.log(`[代理重定向] ${url} -> ${proxyUrl}`);

    return originalFetch(proxyUrl, init);
  }

  // 如果是开发环境且是相对路径的 API 调用
  if (isDevelopment() && (url.startsWith('/open_api') || url.startsWith('/mcp_server'))) {
    const proxyUrl = `${PROXY_SERVER_URL}${url}`;
    console.log(`[代理重定向] ${url} -> ${proxyUrl}`);

    return originalFetch(proxyUrl, init);
  }

  // 其他请求直接调用原始 fetch
  return originalFetch(input, init);
};

/**
 * 初始化代理配置
 */
export const setupProxy = () => {
  if (isDevelopment()) {
    console.log('[代理设置] 开发环境已启用代理模式');
    console.log(`[代理设置] 代理服务器: ${PROXY_SERVER_URL}`);

    // 替换全局 fetch 函数
    window.fetch = proxyFetch;
  } else {
    console.log('[代理设置] 生产环境，跳过代理设置');
  }
};

/**
 * 检查代理服务器状态
 */
export const checkProxyHealth = async (): Promise<boolean> => {
  if (!isDevelopment()) {
    return true; // 生产环境不需要代理
  }

  try {
    const response = await originalFetch(`${PROXY_SERVER_URL}/health`);
    const result = await response.json();
    console.log('[代理健康检查]', result);
    return response.ok && result.status === 'ok';
  } catch (error) {
    console.error('[代理健康检查] 失败:', error);
    return false;
  }
};