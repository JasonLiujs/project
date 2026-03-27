/**
 * 增强的调试日志工具
 * 提供清晰的控制台输出格式
 */

export const DebugLogger = {
  /**
   * API 调用开始
   */
  apiStart(apiUrl, method = 'POST') {
    console.log('%c🚀 ====== API 调用开始 ======', 'color: #00a8ff; font-weight: bold; font-size: 14px;');
    console.log(`%c⏰ 时间: ${new Date().toISOString()}`, 'color: #666;');
    console.log(`%c📍 ${method} ${apiUrl}`, 'color: #0066cc; font-weight: bold;');
  },

  /**
   * 配置信息
   */
  config(config) {
    console.log('%c📋 ====== 配置信息 ======', 'color: #8c7ae6; font-weight: bold;');
    Object.entries(config).forEach(([key, value]) => {
      console.log(`%c  ${key}: %c${value}`, 'color: #8c7ae6;', 'color: #333;');
    });
  },

  /**
   * 认证信息
   */
  auth(authInfo) {
    console.log('%c🔑 ====== 认证信息 ======', 'color: #ffa502; font-weight: bold;');
    Object.entries(authInfo).forEach(([key, value]) => {
      console.log(`%c  ${key}: %c${value}`, 'color: #ffa502;', 'color: #333;');
    });
  },

  /**
   * 请求数据
   */
  request(headers, body) {
    console.log('%c📤 ====== 发送请求 ======', 'color: #2ed573; font-weight: bold;');
    if (headers) {
      console.log('%c📋 请求头:', 'color: #2ed573; font-weight: bold;');
      console.table(headers);
    }
    if (body) {
      console.log('%c📦 请求体:', 'color: #2ed573; font-weight: bold;');
      console.log(JSON.stringify(body, null, 2));
    }
  },

  /**
   * 响应信息
   */
  response(status, headers, data) {
    if (status >= 200 && status < 300) {
      console.log('%c✅ ====== 响应成功 ======', 'color: #2ed573; font-weight: bold; font-size: 14px;');
    } else {
      console.log('%c❌ ====== 响应失败 ======', 'color: #ff4757; font-weight: bold; font-size: 14px;');
    }

    console.log(`%c📊 状态: ${status}`, status >= 200 && status < 300 ? 'color: #2ed573; font-weight: bold;' : 'color: #ff4757; font-weight: bold;');

    if (headers) {
      console.log('%c📋 响应头:', 'color: #3742fa; font-weight: bold;');
      console.table(headers);
    }

    if (data) {
      console.log('%c📄 响应数据:', 'color: #3742fa; font-weight: bold;');
      console.log(JSON.stringify(data, null, 2));
    }
  },

  /**
   * 错误信息
   */
  error(error, context = '') {
    console.log('%c❌ ====== 错误信息 ======', 'color: #ff4757; font-weight: bold; font-size: 14px;');
    if (context) {
      console.log(`%c🔍 上下文: ${context}`, 'color: #ff4757;');
    }
    console.log(`%c🐛 错误类型: ${error.constructor.name}`, 'color: #ff4757; font-weight: bold;');
    console.log(`%c💬 错误信息: ${error.message}`, 'color: #ff4757;');
    console.error('🔍 完整错误:', error);
  },

  /**
   * 成功信息
   */
  success(message, data = null) {
    console.log(`%c✅ ${message}`, 'color: #2ed573; font-weight: bold; font-size: 14px;');
    if (data) {
      console.log('%c📋 数据:', 'color: #2ed573; font-weight: bold;');
      console.log(data);
    }
  },

  /**
   * 警告信息
   */
  warn(message, data = null) {
    console.log(`%c⚠️ ${message}`, 'color: #ffa502; font-weight: bold;');
    if (data) {
      console.log('%c📋 详情:', 'color: #ffa502;');
      console.log(data);
    }
  },

  /**
   * API 调用结束
   */
  apiEnd(success = true) {
    const style = success
      ? 'color: #2ed573; font-weight: bold; font-size: 14px;'
      : 'color: #ff4757; font-weight: bold; font-size: 14px;';
    const message = success ? '🎉 ====== API 调用完成 ======' : '💥 ====== API 调用失败 ======';
    console.log(`%c${message}`, style);
    console.log('\n'); // 添加空行分隔
  },

  /**
   * 分组日志
   */
  group(title, callback) {
    console.group(`%c${title}`, 'color: #3742fa; font-weight: bold;');
    try {
      callback();
    } finally {
      console.groupEnd();
    }
  }
};