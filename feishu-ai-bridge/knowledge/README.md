# 飞书项目知识库索引

## 概览

本知识库包含飞书项目 MCP API、OpenAPI、后端开发和前端开发的完整文档。

## 文档结构

```
knowledge/
├── README.md                    # 本索引文件
├── api/
│   ├── mcp_tools.md             # MCP 工具完整文档 (26个工具)
│   ├── project_config.md        # 项目配置信息
│   ├── quick_reference.md       # 快速参考卡片
│   ├── backend_api.md           # 后端 OpenAPI 开发文档
│   └── frontend_dev.md          # 前端开发文档
└── docs/                        # 额外文档
    └── (待补充)
```

## 快速导航

### MCP API 使用（推荐）

- [MCP 工具完整文档](./api/mcp_tools.md) - 所有 26 个工具的详细说明
- [快速参考](./api/quick_reference.md) - 常用 API 速查

### 后端开发

- [OpenAPI 开发文档](./api/backend_api.md) - 后端 REST API 开发指南
- 包含：工作项管理、节点流、排期、评论、团队等 API

### 前端开发

- [前端开发文档](./api/frontend_dev.md) - JSSDK、小程序、H5 开发
- 包含：JSSDK API、飞书小程序、消息卡片开发

## 快速开始

### 1. MCP 调用示例

```python
import requests

MCP_URL = "https://project.feishu.cn/mcp_server/v1"
MCP_KEY = "m-7704188c-ef20-451f-89f9-57e4824587a0"
USER_KEY = "7481325171635240962"
PROJECT_KEY = "ntv21m"

def call_mcp(tool_name, arguments):
    url = f"{MCP_URL}?mcpKey={MCP_KEY}&userKey={USER_KEY}"
    return requests.post(url, json={
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments}
    }).json()

# 创建工作项
result = call_mcp("create_workitem", {
    "project_key": PROJECT_KEY,
    "work_item_type": "story",
    "fields": [
        {"field_key": "name", "field_value": "测试需求"},
        {"field_key": "template", "field_value": "2872096"}
    ]
})
```

### 2. 获取字段配置

```python
# 获取 story 工作项的字段配置
result = call_mcp("list_workitem_field_config", {
    "project_key": PROJECT_KEY,
    "work_item_type": "story"
})
```

### 3. 节点流转

```python
# 获取可流转状态
result = call_mcp("get_transitable_states", {
    "project_key": PROJECT_KEY,
    "work_item_id": "6640212074",
    "work_item_type": "story",
    "user_key": USER_KEY
})
```

## 关键配置

| 配置项 | 值 |
|--------|-----|
| MCP URL | `https://project.feishu.cn/mcp_server/v1` |
| MCP Key | `m-7704188c-ef20-451f-89f9-57e4824587a0` |
| User Key | `7481325171635240962` |
| Project Key | `ntv21m` |
| Project Space ID | `67fe1cac42e0d54d282a3b4d` |

## 常用字段 Key

| 字段 | Key | 类型 |
|-----|-----|-----|
| 需求名称 | name | text |
| 需求类型 | template | work_item_template |
| 业务线 | business | business |
| 优先级 | priority | select |
| 排期 | schedule | schedule |
| 需求状态 | work_item_status | _work_item_status |
| 需求文档 | wiki | link |
| 关注人 | watchers | multi-user |

## 状态值参考

### 工作项状态

- `to_be_started` - 未开始
- `started` - 提出
- `doing` - 进行中
- `end` - 已结束
- `closed` - 已终止

### 节点状态

- `not_started` - 未开始
- `doing` - 进行中
- `completed` - 已完成

## 常见问题

### Q: 创建工作项需要哪些必填字段？
A: 根据 `get_workitem_field_meta` 返回，`name`(需求名称)、`template`(需求类型) 是必填的。

### Q: 排期字段如何设置？
A: 使用毫秒时间戳格式：`[start_ms, end_ms]`，如 `[1775404800000, 1777564799999]`

### Q: 如何设置依赖关系？
A: 使用 `field_19320a` 字段，值类型为数字数组，如 `[6640212074, 6640212075]`

## 更新日志

- 2026-03-24: 初始创建知识库，包含 MCP API、后端 OpenAPI、前端开发文档
