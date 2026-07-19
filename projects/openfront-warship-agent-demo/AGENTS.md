# OpenFront 战舰缺陷演示工程

本文件只约束 `projects/openfront-warship-agent-demo/`。这是多项目仓库中的独立
Node.js 工程；不要修改或读取仓库内其他项目。

## 工程命令

- 安装：`npm run inst`
- 缺陷复现：`npm run demo:test`
- 战舰回归：`npx vitest tests/Warship.test.ts --run`
- 构建：`npm run build-dev`
- 预览：`npm run demo:start`

## 修复边界

- 根据用户现象、失败测试和生产代码自主定位，不访问历史 PR 或上游修复。
- 不修改 `tests/WarshipDiagonalChaseRegression.test.ts`。
- 不修改 `src/client/WarshipDemoOverlay.ts`。
- 不修改包含 `WarshipDiagonalChaseDemoExecution` 的演示脚手架。
- 不通过关闭检测、强制清零计数或只改渲染来隐藏问题。
- 只提交本工程中与修复直接相关的文件，不提交依赖、构建产物、日志或截图。

Git 工作树根目录通过 `git rev-parse --show-toplevel` 获取；npm 命令在本目录执行，
分支、提交和 diff 使用 Git 工作树根目录。
