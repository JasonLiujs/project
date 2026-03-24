# 飞书项目 - 后端开发 OpenAPI 知识库

> 生成时间: 2026-03-24
> 状态: MCP API 已测试通过，OpenAPI 文档待补充

---

## MCP API vs OpenAPI

| 类型 | 说明 | 用途 |
|-----|------|-----|
| **MCP API** | 通过 MCP Server 调用的工具 | AI Agent 调用，推荐使用 |
| **OpenAPI** | 直接 REST API 调用 | 后端服务集成 |

---

## MCP API 核心能力（推荐）

### 1. 工作项管理

#### 创建工作项 (create_workitem)

```python
result = call_mcp_tool("create_workitem", {
    "project_key": "ntv21m",
    "work_item_type": "story",
    "fields": [
        {"field_key": "name", "field_value": "需求名称"},
        {"field_key": "template", "field_value": "2872096"},  # Feature产品需求（IR）
        {"field_key": "business", "field_value": "67fe1cbf35da24ec52b63236"},  # C端产品线
        {"field_key": "priority", "field_value": "0"},  # P0-重要紧急
        {"field_key": "schedule", "field_value": [start_ms, end_ms]}  # 排期
    ]
})
```

#### 更新工作项 (update_workitem)

```python
result = call_mcp_tool("update_workitem", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "work_item_type": "story",
    "fields": [
        {"field_key": "name", "field_value": "新名称"},
        {"field_key": "priority", "field_value": "1"}
    ]
})
```

#### 查询工作项列表 (list_workitems)

```python
result = call_mcp_tool("list_workitems", {
    "project_key": "ntv21m",
    "work_item_type": "story",
    "filters": [
        {"field_key": "work_item_status", "operator": "eq", "field_value": "doing"},
        {"field_key": "owner", "operator": "eq", "field_value": "7481325171635240962"}
    ],
    "orders": [{"field_key": "created_at", "order": "desc"}],
    "page_size": 50,
    "page_num": 1
})
```

#### 获取工作项详情 (get_workitem_brief)

```python
result = call_mcp_tool("get_workitem_brief", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "fields": ["name", "work_item_status", "schedule", "owner"]
})
```

---

### 2. 节点流管理

#### 获取节点详情 (get_node_detail)

```python
result = call_mcp_tool("get_node_detail", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "node_id_list": ["_all"],
    "need_sub_task": True,
    "page_num": 1
})
```

**节点响应结构**:
```json
{
  "basic": {
    "node_uuid": "node_started_6640212074",
    "node_key": "started",
    "name": "项目立项",
    "status": "doing|not_started|completed"
  },
  "assignees": {
    "owners": [{"user_key": "...", "name": "..."}],
    "role_assignees": {"role_xxx": [...]},
    "participants": []
  },
  "schedule": {
    "estimate_start_time": 1775404800000,
    "estimate_finish_time": 1777564799999,
    "actual_begin_time": 1767001502638,
    "actual_finish_time": null,
    "is_delayed": false
  },
  "form_items": [
    {
      "form_item_type": "field",
      "field_key": "field_xxx",
      "field_name": "字段名",
      "field_type": "text|link|multi-text|schedule",
      "value": "...",
      "is_required": true
    }
  ]
}
```

#### 获取可流转状态 (get_transitable_states)

```python
result = call_mcp_tool("get_transitable_states", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "work_item_type": "story",
    "user_key": "7481325171635240962"
})
```

#### 获取流转必填信息 (get_transition_required)

```python
result = call_mcp_tool("get_transition_required", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "state_key": "node_key_xxx",
    "mode": "unfinished"
})
```

---

### 3. 字段配置

#### 获取字段配置 (list_workitem_field_config)

```python
result = call_mcp_tool("list_workitem_field_config", {
    "project_key": "ntv21m",
    "work_item_type": "story",
    "field_keys": ["name", "priority", "schedule"],
    "field_types": ["text", "select", "schedule"]
})
```

#### 创建工作项元信息 (get_workitem_field_meta)

```python
result = call_mcp_tool("get_workitem_field_meta", {
    "project_key": "ntv21m",
    "work_item_type": "story"
})
```

**返回示例**:
```json
{
  "FieldConfList": [
    {"field_key": "name", "field_name": "需求名称", "field_type_key": "text", "is_required": 1},
    {"field_key": "template", "field_name": "需求类型", "field_type_key": "work_item_template", "is_required": 1},
    {"field_key": "business", "field_name": "业务线", "field_type_key": "business", "is_required": 1}
  ]
}
```

---

### 4. 排期管理

#### 更新排期 (update_workitem_schedule)

```python
result = call_mcp_tool("update_workitem_schedule", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "schedule": "2026-03-02,2026-03-08"
})
```

#### 获取个人排期 (list_schedule)

```python
result = call_mcp_tool("list_schedule", {
    "project_key": "ntv21m",
    "user_keys": ["7481325171635240962"],
    "work_item_type_keys": ["story", "task"],
    "start_time": "2026-03-01",
    "end_time": "2026-03-31"
})
```

---

### 5. 评论

#### 添加评论 (add_comment)

```python
result = call_mcp_tool("add_comment", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "comment_content": "**开发完成**，代码已提交并通过测试。\n\nMR: https://github.com/xxx/pull/123"
})
```

#### 获取评论列表 (list_workitem_comments)

```python
result = call_mcp_tool("list_workitem_comments", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "page_num": 1,
    "start_time": 1709251200000,
    "end_time": 1709337600000
})
```

---

### 6. 团队管理

#### 列出项目团队 (list_project_team)

```python
result = call_mcp_tool("list_project_team", {
    "project_key": "ntv21m"
})
```

#### 列出团队成员 (list_team_members)

```python
result = call_mcp_tool("list_team_members", {
    "project_key": "ntv21m",
    "team_id": "team_xxx",
    "page_token": None
})
```

---

### 7. 视图管理

#### 创建固定视图 (create_fixed_view)

```python
result = call_mcp_tool("create_fixed_view", {
    "project_key": "ntv21m",
    "name": "今日待办",
    "work_item_type": "story",
    "work_item_id_list": [6640212074, 6640212075],
    "cooperation_mode": 3  # 3-全部空间成员可见
})
```

#### 获取视图详情 (get_view_detail)

```python
result = call_mcp_tool("get_view_detail", {
    "project_key": "ntv21m",
    "view_id": "view_xxx",
    "fields": ["name", "work_item_status", "owner"],
    "page_num": 1
})
```

---

### 8. 操作记录

#### 获取操作记录 (get_workitem_op_record)

```python
result = call_mcp_tool("get_workitem_op_record", {
    "project_key": "ntv21m",
    "work_item_id": ["6640212074"],
    "operation_type": ["create", "modify", "complete"],
    "op_record_module": ["work_item_mod", "node_mod"],
    "operator_type": ["user", "plugin"],
    "start": 1709251200000,
    "end": 1709337600000
})
```

---

## 字段类型说明

| 字段类型 | 格式 | 示例 |
|---------|------|-----|
| text | 字符串 | `"测试文本"` |
| multi-text | 字符串 | `"多行文本\n支持换行"` |
| number | 数字 | `123` |
| bool | 布尔 | `true` / `false` |
| select | 枚举 | `{"option_id": "0", "option_name": "P0-重要紧急"}` |
| multi-select | 枚举数组 | `[{"option_id": "opt1"}, {"option_id": "opt2"}]` |
| user | user_key | `"7481325171635240962"` |
| multi-user | user_key数组 | `["key1", "key2"]` |
| date | 毫秒时间戳 | `1709337600000` |
| schedule | 时间戳数组 | `[start_ms, end_ms]` |
| workitem_related_select | 数字 | `6640212074` |
| workitem_related_multi_select | 数字数组 | `[6640212074, 6640212075]` |
| link | URL字符串 | `"https://example.com"` |
| multi-file | JSON数组 | `[{"file_token": "xxx"}]` |
| vote-option | 枚举 | `{"option_id": "jq33q7d8h", "option_name": "强烈支持"}` |

---

## 过滤操作符

| 操作符 | 说明 | 示例 |
|-------|------|-----|
| eq | 等于 | `{"operator": "eq", "field_value": "doing"}` |
| neq | 不等于 | `{"operator": "neq", "field_value": "closed"}` |
| in | 包含 | `{"operator": "in", "field_value": ["A", "B"]}` |
| not_in | 不包含 | `{"operator": "not_in", "field_value": ["X"]}` |
| gt / gte | 大于 / 大于等于 | `{"operator": "gt", "field_value": 100}` |
| lt / lte | 小于 / 小于等于 | `{"operator": "lt", "field_value": 50}` |
| contains | 包含子串 | `{"operator": "contains", "field_value": "关键词"}` |
| not_contains | 不包含子串 | `{"operator": "not_contains", "field_value": "忽略"}` |
| is_empty | 为空 | `{"operator": "is_empty"}` |
| is_not_empty | 不为空 | `{"operator": "is_not_empty"}` |

---

## 状态流转

### 节点状态

| 状态值 | 说明 |
|-------|------|
| `not_started` | 未开始 |
| `doing` | 进行中 |
| `completed` | 已完成 |

### 工作项状态（story）

| 状态ID | 状态名称 |
|--------|---------|
| `to_be_started` | 未开始 |
| `started` | 提出 |
| `doing` | 待产品评审 |
| `linshihong_3331583816152441` | 待技术评审 |
| `linshihong_3331583816205424` | 待排期 |
| `linshihong_3331583827552071` | 开发中 |
| `option_3` | 待技术评审 |
| `option_8` | 待验收 |
| `end` | 已结束 |
| `closed` | 已终止 |

---

## 节点流工作项模板

| 模板ID | 模板名称 | 版本 |
|--------|---------|------|
| 2872096 | Feature产品需求（IR） | - |
| 2872110 | 产品需求-标准 | - |
| 2872112 | 技术需求（SR） | - |
| 2876058 | 技术需求-1（SR） | - |
| 2876064 | 子需求（AR） | - |
| 6911400 | 软件项目立项与需求分析全流程 | - |
| 2872113 | 软硬结合项目流程 | 6 |

---

## 业务线枚举

| 业务线ID | 业务线名称 |
|---------|----------|
| `67fe1cbf35da24ec52b63236` | C端产品线 |
| `67fe1cbf35da24ec52b63237` | - 录音笔 |
| `67fe1cbf35da24ec52b63238` | - 翻译机 |
| `67fe1cbf35da24ec52b6323d` | B端产品线 |
| `67fe1cbf35da24ec52b63247` | 公共研发部 |
| `682405dbad115180474cfe49` | 研发中心 |

---

## OpenAPI 直接调用（待补充）

> 注意: 飞书项目 OpenAPI 文档正在收集中，以下为预留占位

### 认证

```
POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
```

### 工作项 API

```
GET  /open-apis/project/v1/projects/{project_key}/workitems
POST /open-apis/project/v1/projects/{project_key}/workitems
GET  /open-apis/project/v1/projects/{project_key}/workitems/{work_item_id}
PUT  /open-apis/project/v1/projects/{project_key}/workitems/{work_item_id}
```

### 节点 API

```
GET  /open-apis/project/v1/projects/{project_key}/workitems/{work_item_id}/nodes
POST /open-apis/project/v1/projects/{project_key}/workitems/{work_item_id}/nodes/{node_id}/complete
```

---

## Python SDK 示例

```python
# 使用 MCP 封装
from feishu_project_client import FeishuProjectClient

client = FeishuProjectClient()

# 创建需求
result = client.create_workitem(
    work_item_type="story",
    fields=[
        {"field_key": "name", "field_value": "用户登录功能"},
        {"field_key": "template", "field_value": "2872110"},
        {"field_key": "priority", "field_value": "0"}
    ]
)

# 获取详情
detail = client.get_workitem_brief(
    work_item_id="6640212074",
    fields=["name", "work_item_status", "schedule"]
)

# 更新状态
client.update_workitem(
    work_item_id="6640212074",
    fields=[{"field_key": "work_item_status", "field_value": "doing"}]
)
```
