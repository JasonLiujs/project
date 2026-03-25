# 飞书 AI Agent 自动领任务 — 开发规划

> 创建时间: 2026-03-25
> 项目目标: OpenCode 作为 Agent，通过 gstack 多种角色能力，自动从飞书项目领取开发任务、执行工作、登记完成

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 9 issues, 7 resolved, 2 user-declined |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** 1 review run — Eng Review passed with 9 issues raised, 7 accepted, 2 user-declined.

---

## 已接受的架构决策

1. **Scope Reduction**: 12 组件 → 6 文件（orchestrator 合并 dispatcher+transition；prompts 内联；JSON 替代 SQLite；工具内联）
2. **gstack 分发**: subprocess 调用 gstack CLI
3. **auto 模式**: 半自动 + `--yes` 全自动参数
4. **认证**: 环境变量 + `.env.example`
5. **重写 client**: 用户选择完全重写（非增量增强）
6. **日志**: 标准 logging + 日志文件
7. **测试**: 6 个测试文件随功能实现（80%+ 覆盖率目标）
8. **分页**: 完整遍历所有分页
9. **限流**: 指数退避 + jitter
10. **ngrok/Webhook**: 保留（用户坚持）

---

## 待补充到计划的细节

1. 节点必填字段自动填充策略（AI 判断 vs 模板映射）
2. gstack 角色输出的解析方式（stdout → 结构化结果）
3. 执行报告的 Markdown 模板 → 代码常量内联
4. auto 模式确认超时常量（建议: 60s 超时后自动继续）
5. Ctrl+C 信号处理（SIGINT → 保存状态后退出）

---

## 一、系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                      触发层 (手动触发)                          │
│              /feishu-auto <命令> → OpenCode 接收             │
└────────────────────────┬───────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────┐
│                 Orchestrator (OpenCode)                      │
│  • 轮询/接收任务  • 解析节点类型  • 分发给 gstack 角色     │
│  • 状态机管理     • 结果上报      • 进度登记                 │
└────────┬────────────────┬──────────────────────┬────────────┘
         │                │                      │
    ┌────▼────┐    ┌─────▼─────┐    ┌────────▼────────┐
    │ /review  │    │ /investigate│   │ /qa /ship      │
    │ 代码审查  │    │  调试分析   │    │  测试/发布     │
    └──────────┘    └────────────┘    └────────────────┘
         │                │                      │
         └────────────────▼──────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────┐
│               MCP API → 飞书 Project                         │
│  list_workitems → update_workitem → add_comment             │
└────────────────────────────────────────────────────────────┘
```

---

## 二、技术栈

| 组件 | 技术 |
|------|------|
| Agent 框架 | OpenCode + gstack 技能 |
| 任务交互 | 飞书项目 MCP API (26个工具) |
| 兜底 API | 飞书开放平台 API |
| 本地服务 | Python (FastAPI/Flask) |
| 状态持久化 | SQLite |
| 公网暴露 | ngrok |
| 触发方式 | 手动触发 |

---

## 三、现有资产

| 组件 | 状态 | 说明 |
|------|------|------|
| `feishu_project_client.py` | ✅ 已有 | MCP API 封装，需增强 |
| gstack 技能 | ✅ 已装 | 26 种角色 |
| ngrok | 🔧 需配置 | 转发本地端口到公网 |
| 飞书节点流知识 | ✅ 已有 | `knowledge/workflow/node_flow.md` |
| MCP 工具文档 | ✅ 已有 | `knowledge/api/mcp_tools.md` |

---

## 四、gstack 角色映射

| 节点特征 | gstack 角色 | 触发时机 |
|---------|------------|---------|
| 需要分析/PRD | `/office-hours` | 进入「产品定位」等节点 |
| 需要编码/开发 | `/gstack browse` + `/ship` | 进入「需求拆解」等节点 |
| 需要验证/测试 | `/qa` | 进入「可行性评估」等节点 |
| 需要代码审查 | `/review` | 开发完成后 |
| 需要调错/Bug | `/investigate` | 测试发现缺陷时 |
| 需要部署/上线 | `/land-and-deploy` | 测试通过后 |

---

## 五、能力缺口与补充方案

| 缺口能力 | MCP 是否支持 | 补充方案 |
|---------|------------|---------|
| 用户搜索/查找 | ❌ 无 | 飞书通讯录 API (`/contact/v3/users/search`) |
| 节点显式流转 | ❌ 无显式 API | 飞书工作流 API 或 MCP `fill fields → 自动触发` |
| 发送通知消息 | ❌ 只能评论 | 飞书机器人 API (`/im/v1/messages`) |
| Webhook 回调接收 | ❌ 无 | ngrok 暴露本地端口 → 本地 FastAPI 接收 |
| 创建子任务 | ❌ 无 | 飞书任务 API (`/task/v2/tasks`) |
| 批量操作 | ❌ 无 | 循环调用 + 任务队列 |

---

## 六、需要开发的组件（精简版 6 文件）

```
feishu-agent/                   # 根目录
├── feishu_client/             # MCP + 开放平台 API 客户端
│   ├── mcp.py                # MCP 封装（26工具，含分页遍历+重试）
│   └── feishu_api.py         # 飞书开放平台 API（token管理、用户搜索、消息通知）
├── orchestrator.py           # 编排器：任务发现 + 节点流转 + gstack分发 + 报告上报
├── state.py                  # JSON 文件持久化（替代 SQLite）
├── feishu_auto.py            # OpenCode 命令入口（/feishu-auto）
├── config.py                 # 环境变量加载 + .env.example
└── main.py                   # Webhook 服务入口（ngrok + FastAPI）
```

> Prompts 内联为 orchestrator.py 中的常量。ngrok/local_server/comment_reporter 等小工具各自内联到使用者模块。

---

## 七、命令接口

| 命令 | 动作 |
|------|------|
| `/feishu-auto list` | 列出所有待领取任务 |
| `/feishu-auto claim <id>` | 领取指定任务 |
| `/feishu-auto run <id>` | 执行任务（分发到 gstack 角色）|
| `/feishu-auto flow <id>` | 流转到下一节点 |
| `/feishu-auto report <id>` | 生成执行报告并评论 |
| `/feishu-auto auto` | 自动模式：发现 → 领取 → 执行 → 流转 → 上报 |

---

## 八、节点流转引擎核心逻辑

```python
def transition_to_next_node(work_item_id: str) -> bool:
    # 1. 获取当前节点详情
    node_detail = mcp.get_node_detail(work_item_id, "_all")
    
    # 2. 获取可流转状态
    states = mcp.get_transitable_states(work_item_id, user_key)
    
    # 3. 如果没有可流转状态，尝试 API fallback
    if not states:
        flow_states = feishu_api.get_node_transitions(work_item_id)
    
    # 4. 获取目标节点的必填字段
    target_state = states[0]
    required = mcp.get_transition_required(work_item_id, target_state)
    
    # 5. 自动填充必填字段
    fill_required_fields(work_item_id, required)
    
    # 6. 触发流转
    mcp.update_workitem_fields(work_item_id, fields)
    # 流转自动发生
```

---

## 九、执行报告格式

执行报告作为飞书评论发布，供团队成员快速了解任务进展。

```markdown
## Agent 执行报告

**工作项**: [#6640212074](链接)
**当前节点**: 项目立项
**执行时间**: 2026-03-25 17:30
**执行状态**: ✅ 成功

---

### 执行摘要
分析了项目背景和目标，生成了技术方案初稿。

### 完成内容
- [x] 分析了项目背景和目标
- [x] 生成了技术方案初稿

### 执行数据
| 指标 | 值 |
|------|-----|
| 消耗 Token | 12,500 |
| 执行耗时 | 3 分钟 |
| 代码行数 | 320 行 |
| 分阶段 | 2 |

### 产物
| 类型 | 链接 |
|------|------|
| PRD 文档 | [飞书文档链接] |
| 代码仓 | [Git commit URL] |

### 风险项
- 🔴 阻塞：依赖外部 API 暂未对接
- 🟡 注意：需要补充性能测试

### 决策记录
- 选择 `/office-hours` 而非直接开发 → 节点特征为「PRD 分析」
- 跳过 `field_assigned` 填充 → 该字段非当前节点必填

### 下一步
> 流转到「初始评估」节点
```

**报告状态定义**:
- ✅ 成功：所有分阶段完成
- ⚠️ 部分：部分完成，有失败项
- ❌ 完全失败：执行失败
- ⏳ 超时：执行超时
- 🔄 被中断：人工中断

**产物类型枚举**:
```python
ARTIFACT_TYPES = {
    "prd": "feishu_doc",    # 飞书文档链接
    "code": "github_commit", # Git commit URL
    "doc": "file_path",      # 内部文件路径
}
```

---

## 十，开发顺序（精简版）

### 第一阶段（1-2天）基础连通
1. feishu_client 双栈客户端（MCP + API，含重试+分页）
2. 飞书 API 授权配置（App ID / Secret，token 自动刷新）
3. ngrok 自动管理
4. 本地 Webhook 服务（FastAPI）

### 第二阶段（2-3天）核心自动化
5. orchestrator 编排器（任务发现 + 节点流转 + gstack 分发）
6. state.py JSON 持久化
7. 执行报告生成器（Markdown 评论）

### 第三阶段（1-2天）闭环能力
8. feishu_auto.py 命令入口 + 标准 logging
9. config.py 环境变量 + .env.example
10. 单元测试（6 个测试文件，80%+ 覆盖率）

### 第四阶段（持续）节点模板
11. 针对实际节点流定制 Prompt 常量
12. 联调测试 + Bug 修复

---

## 十一、飞书开放平台需要配置

| 配置项 | 说明 |
|-------|------|
| App ID / App Secret | 用于获取 `tenant_access_token` |
| 机器人 | 用于 `im.v1.messages` 发送消息通知 |
| Webhook 事件订阅 | 订阅工作项更新事件 → 推送到 ngrok URL |
| 通讯录权限 | `contact:user.search:readonly` 搜索用户 |

---

## 十二、MCP API 配置

| 配置 | 值 |
|------|-----|
| MCP URL | `https://project.feishu.cn/mcp_server/v1` |
| MCP Key | `m-7704188c-ef20-451f-89f9-57e4824587a0` |
| User Key | `7481325171635240962` |
| Project Key | `67fe1cac42e0d54d282a3b4d` |
| Project Simple Name | `ntv21m` |

**API 实际发现**:
- `list_workitems` 不存在，用 `search_by_mql` 替代（MQL 语法: `SELECT name FROM ntv21m.story LIMIT N`）
- `update_workitem_fields` 不存在，用 `update_field` 替代
- `get_transitable_states` 仅适用于状态流工作项，节点流工作项用 `get_node_detail` → `transition_node`
- MCP 响应格式: `{"content": [{"type": "text", "text": "..."}], "isError": bool}`
- 项目现有 34 条工作项（截至 2026-03-26）

---

## 十三、飞书节点流参考

标准流程: 立项 → 初始评估 → 产品定义 → 评审(TR1/CDCP/TR2) → 需求拆解 → 评估 → 可行性评估 → ID → 产品细化

常用节点 Key: `started`, `state_0` ~ `state_20`

常用角色:
- `role_5b8b81`: 产品经理
- `role_456890`: 研发代表
- `role_f6fea7`: 软件代表
- `role_3baacd`: 硬件代表

常用字段 Key:
- `field_assigned`: 负责人
- `field_6d3a18`: 项目周期
- `field_19320a`: 依赖

详见: `feishu-ai-bridge/knowledge/workflow/node_flow.md`
