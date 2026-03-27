#!/usr/bin/env node

console.log(`

⚠️  Claude Code CLI连接问题

当前环境检测:
- 您正在一个活跃的Claude Code会话中
- 无法同时启动第二个Claude Code CLI实例
- 这是正常的进程隔离行为

解决方案:
1. 🔗 新开终端窗口运行独立的Claude Code实例
2. 💬 在当前会话中直接提问 (推荐)
3. 🔄 使用Claude Code技能系统

为了获得真正的Claude Code回答，建议您:
- 在当前Claude Code会话中直接提出插件相关问题
- 或者打开新的终端运行 'claude' 命令

`);

process.exit(0);