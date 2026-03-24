# 飞书项目 MCP API 知识库

> 生成时间: 2026-03-24
> MCP URL: https://project.feishu.cn/mcp_server/v1
> Project Key: ntv21m
> User Key: 7481325171635240962

---

## 工具总览

| 工具名称 | 功能描述 | 分类 |
|---------|---------|------|
| add_comment | 在工作项添加评论 | 评论 |
| create_fixed_view | 创建固定视图 | 视图 |
| create_workitem | 创建工作项 | 工作项 |
| get_chart_detail | 获取图表详情 | 图表 |
| get_node_detail | 获取节点详情 | 节点 |
| get_transitable_states | 获取可流转状态 | 流程 |
| get_transition_required | 获取流转所需必填信息 | 流程 |
| get_view_detail | 获取视图详情 | 视图 |
| get_workitem_brief | 获取工作项概要 | 工作项 |
| get_workitem_field_meta | 获取创建工作项元信息 | 工作项 |
| get_workitem_man_hour_records | 获取工时记录 | 工作项 |
| get_workitem_op_record | 获取操作记录 | 工作项 |
| list_charts | 列出图表 | 图表 |
| list_node_field_config | 列出节点字段配置 | 节点 |
| list_project_team | 列出项目团队 | 团队 |
| list_related_workitems | 列出关联工作项 | 工作项 |
| list_schedule | 列出排期 | 排期 |
| list_team_members | 列出团队成员 | 团队 |
| list_workitem_comments | 列出工作项评论 | 评论 |
| list_workitem_field_config | 列出工作项字段配置 | 工作项 |
| list_workitem_type_config | 列出工作项类型配置 | 工作项 |
| list_workitems | 列出工作项 | 工作项 |
| search_by_mql | 通过MQL查询 | 查询 |
| update_workitem | 更新工作项 | 工作项 |
| update_workitem_fields | 更新工作项字段 | 工作项 |
| update_workitem_schedule | 更新工作项排期 | 排期 |

---

## 核心工具详解

### 1. 工作项管理

#### create_workitem - 创建工作项

**描述**: 创建工作项实例。必须先使用 list_workitem_field_config 获取字段信息、list_workitem_role_config 获取角色信息。

**输入参数**:
```json
{
  "project_key": "string",      // 工作项类型所属空间projectKey或simpleName
  "work_item_type": "string",   // 工作项类型
  "fields": [
    {
      "field_key": "string",    // 字段key
      "field_value": "any"      // 字段值（格式见下方）
    }
  ]
}
```

**字段值格式说明**:
- **template 模板ID【必传！】**: `145405865`
- **单字段值**: text、multi-pure-text、link、bool、number → `"测试工作项"`
- **单个userkey**: user → `"7509072868295085608"`
- **userkey数组**: multi-user → `["7509072868295085608","7509072868295085608"]`
- **单个枚举值ID**: select、radio、tree-select
  ```json
  {"option_id": "437794", "option_name": "功能需求-主工作流程"}
  ```
- **支持新增选项的多选**: multi-select
  - 复用现有选项: `[{"option_id": "111"}, {"option_id": "222"}]`
  - 新建并使用: `[{"option_name": "新建选项值", "free_add": true, "option_id":"gtxfhratx"}]`
- **关联工作项ID**: workitem_related_select、workitem_related_multi_select
  - 单个: `145405865`
  - 多个: `[145405865, 145405866]`（必须是数字类型）
- **markdown格式**: multi-text
- **毫秒时间戳，天精度**: date
- **时间区隔**: schedule
  ```json
  [1722182400000, 1722355199999]
  ```
- **精确时间**: precise_date
  ```json
  {"start_time": 1722182400000, "end_time": 1722355199999}
  ```
- **角色**: role_owners 字段专用
  ```json
  [
    {"role": "Data", "owners": ["7311891981507100700"]},
    {"role": "Server", "owners": ["7311891981507100700"]}
  ]
  ```

---

#### list_workitems - 列出工作项

**描述**: 查询工作项列表，支持分页、过滤和排序。

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "work_item_type": "string",         // 工作项类型
  "filters": [
    {
      "field_key": "string",         // 过滤字段key
      "operator": "string",          // 操作符: eq, neq, in, not_in, gt, gte, lt, lte, contains, not_contains, is_empty, is_not_empty
      "field_value": "any"           // 过滤值
    }
  ],
  "orders": [
    {
      "field_key": "string",         // 排序字段
      "order": "asc|desc"            // 升序/降序
    }
  ],
  "page_size": 50,                   // 每页数量，最大200
  "page_num": 1                      // 页码
}
```

---

#### update_workitem - 更新工作项

**描述**: 更新工作项信息。

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "work_item_id": "string",          // 必填，工作项ID
  "work_item_type": "string",       // 工作项类型
  "fields": [
    {
      "field_key": "string",
      "field_value": "any"
    }
  ]
}
```

---

#### update_workitem_fields - 更新工作项字段

**描述**: 批量更新工作项字段值。

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "work_item_id": "string",          // 必填，工作项ID
  "work_item_type": "string",       // 工作项类型
  "fields": [
    {
      "field_key": "string",
      "field_value": "any"
    }
  ]
}
```

---

### 2. 字段配置

#### list_workitem_field_config - 列出工作项字段配置

**描述**: 查询空间下某个工作项类型的字段配置，用于后续的查询和更新。

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "work_item_type": "string",        // 工作项类型
  "field_keys": ["string"],          // 字段key列表，用于精确筛选
  "field_types": ["string"]          // 字段类型: text, multi-pure-text, link, bool, number 等
}
```

**返回字段类型说明**:
| 类型 | 说明 | 示例 |
|-----|------|-----|
| text | 单行文本 | "测试文本" |
| multi-pure-text | 多行文本 | "多行文本内容" |
| number | 数字 | 123 |
| bool | 布尔 | true/false |
| link | 链接 | "https://..." |
| select | 单选枚举 | {"option_id": "123", "option_name": "选项名"} |
| multi-select | 多选枚举 | [{"option_id": "123"}, {"option_id": "456"}] |
| radio | 单选枚举 | {"option_id": "123", "option_name": "选项名"} |
| date | 日期时间 | 毫秒时间戳 |
| schedule | 时间区间 | [开始时间戳, 结束时间戳] |
| precise_date | 精确日期 | {"start_time": 123, "end_time": 456} |
| user | 用户 | "user_key" |
| multi-user | 多用户 | ["user_key1", "user_key2"] |
| workitem_related_select | 关联工作项 | 工作项ID数字 |
| workitem_related_multi_select | 多关联工作项 | [ID1, ID2] |
| template | 模板 | 模板ID |
| role_owners | 角色 | [{"role": "角色名", "owners": ["user_key"]}] |

---

#### list_workitem_type_config - 列出工作项类型配置

**描述**: 获取空间下所有工作项类型配置。

**输入参数**:
```json
{
  "project_key": "string"            // 必填，空间projectKey
}
```

---

#### get_workitem_field_meta - 获取创建工作项元信息

**描述**: 获取创建工作项元信息。

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "work_item_type": "string"         // 工作项类型
}
```

---

### 3. 节点/工作流

#### get_node_detail - 获取节点详情

**描述**: 获取指定节点的关键信息，包括节点信息、子项信息、节点自定义字段信息。

**输入参数**:
```json
{
  "project_key": "string",           // 空间projectKey
  "work_item_id": "string",          // 必填，工作项id或名称
  "node_id_list": ["string"],        // 节点ID列表，传空或_all代表获取所有节点
  "field_key_list": ["string"],      // 节点字段key，传空或_all代表获取节点下的所有字段
  "need_sub_task": boolean,          // 是否需要节点子项（子任务）
  "page_num": 1,                     // 节点信息一次只支持查询20个
  "url": "string"                    // URL信息，可从中提取project_key, work_item_type_key, work_item_id, 视图ID等信息
}
```

---

#### get_transitable_states - 获取可流转状态

**描述**: 获取状态流工作项的可流转状态。

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间
  "work_item_id": "string",          // 必填，状态流工作项id
  "work_item_type": "string",        // 必填，工作项所属工作项类型
  "user_key": "string"               // 必填，用户userKey
}
```

---

#### get_transition_required - 获取流转所需必填信息

**描述**: 获取指定节点/状态流流转所必填信息。

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "work_item_id": "string",          // 必填，工作项实例ID
  "state_key": "string",             // 必填，节点流的node_key或状态流的state_key
  "mode": "string",                  // 默认查询所有必填项。传入unfinished仅查询未完成的必填项
  "url": "string"
}
```

---

#### list_node_field_config - 列出节点字段配置

**描述**: 查看空间的节点字段配置。

**输入参数**:
```json
{
  "project_key": "string",           // 目标节点所属空间
  "work_item_type": "string",       // 目标节点的工作项类型
  "query": "string",                 // 搜索关键字
  "field_keys": ["string"],          // 字段key
  "field_types": ["string"]          // 字段类型
}
```

---

### 4. 排期管理

#### update_workitem_schedule - 更新工作项排期

**描述**: 更新工作项的排期时间。

**输入参数**:
```json
{
  "project_key": "string",           // 空间projectKey
  "work_item_id": "string",          // 工作项ID或名称
  "work_item_type": "string",        // 工作项类型
  "schedule": "string",              // 排期，格式: "2026-03-02,2026-03-08"
  "schedule_start": "string",         // 开始时间，格式: "2026-03-02"
  "schedule_end": "string",          // 结束时间，格式: "2026-03-08"
  "url": "string"
}
```

**说明**: 时间格式为毫秒时间戳，逗号分隔 `start_ms,end_ms`
```python
start_ms = int(start_date.timestamp() * 1000)
end_ms = int(end_date.timestamp() * 1000)
field_value = f"{start_ms},{end_ms}"
```

---

#### list_schedule - 列出排期

**描述**: 获取指定空间下指定人员在指定时间范围内的个人排期与工作量明细。

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "user_keys": ["string"],           // 必填，用户userKey列表，最多20个
  "work_item_type_keys": ["string"], // 工作项类型，如: story, issue, _all
  "start_time": "2006-01-01",        // 必填，格式: YYYY-MM-DD
  "end_time": "2006-01-01"           // 必填，最大不超过3个月
}
```

---

### 5. 评论

#### add_comment - 添加评论

**描述**: 在指定实例的评论/备注页添加一条评论，支持简单文本以及markdown格式的输入。

**输入参数**:
```json
{
  "project_key": "string",           // 工作项所属空间projectKey
  "work_item_id": "string",          // 必填，工作项id或名称
  "comment_content": "string",       // 必填，评论内容，支持markdown格式
  "url": "string"                    // 可以从URL中提取project_key, work_item_type, work_item_id, view_id信息
}
```

---

#### list_workitem_comments - 列出工作项评论

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "work_item_id": "string",          // 必填，工作项id或名称
  "page_num": 1,
  "start_time": 1234567890000,       // 毫秒时间戳
  "end_time": 1234567890000
}
```

---

### 6. 团队

#### list_project_team - 列出项目团队

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey或simple name
  "url": "string"
}
```

---

#### list_team_members - 列出团队成员

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "team_id": "string",               // 必填，团队ID
  "page_token": "string"             // 分页token
}
```

---

### 7. 视图

#### create_fixed_view - 创建固定视图

**描述**: 在指定空间和工作项类型下新增一个固定视图。

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "name": "string",                  // 必填，固定视图名称
  "work_item_type": "string",        // 必填，工作项类型key
  "work_item_id_list": [123],        // 必填，需要添加入视图的工作项ID列表，最多200个
  "cooperation_mode": 1,             // 协作模式，默认1: 1-指定人员或团队, 2-全部空间管理员, 3-全部空间成员
  "cooperation_user_keys": ["string"],
  "cooperation_team_ids": [123]
}
```

---

#### get_view_detail - 获取视图详情

**输入参数**:
```json
{
  "project_key": "string",
  "view_id": "string",               // 必填，视图id
  "fields": ["string"],              // 要查询的field_key或field_name
  "page_num": 1,
  "url": "string"
}
```

---

#### list_charts - 列出图表

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "view_id": "string",               // 必填，视图ID
  "page_num": 1,
  "page_size": 50
}
```

---

### 8. 关联工作项

#### list_related_workitems - 列出关联工作项

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "work_item_id": 123,               // 必填，源工作项实例的id
  "work_item_type": "string",        // 必填，源工作项的工作项类型
  "relation_key": "string",          // 必填，关联关系key
  "relation_work_item_type_key": "string", // 必填，关联的工作项类型
  "relation_type": 0,                // 关联关系的类型: 0-关联字段ID; 1-关联字段对接标识
  "page_num": 1,
  "page_size": 50
}
```

---

### 9. 操作记录

#### get_workitem_op_record - 获取操作记录

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间ID
  "work_item_id": ["string"],        // 必填，工作项ID列表，最大50
  "operation_type": ["string"],       // 操作动作类型: modify, create, delete, terminate, restore, complete, rollback, add, remove
  "source_type": ["string"],         // 操作渠道类型: auto, plugin
  "op_record_module": ["string"],    // 操作记录模块: work_item_mod, node_mod, sub_task_mod, field_mod, role_and_user_mod, baseline_mod
  "operator_type": ["string"],       // 操作者类型: user, auto, system, calc_field, plugin, others
  "operator": ["string"],            // 操作者: user_key或自动化规则ID
  "source": ["string"],              // 操作渠道值
  "start": 1234567890000,            // 毫秒时间戳
  "end": 1234567890000,
  "start_from": "string",
  "url": "string"
}
```

---

### 10. 查询

#### search_by_mql - 通过MQL查询

**描述**: 使用 MQL (Meego Query Language) 进行高级查询。

**输入参数**:
```json
{
  "project_key": "string",           // 必填，空间projectKey
  "mql": "string",                   // 必填，MQL查询语句
  "page_size": 50,
  "page_num": 1
}
```

**MQL 示例**:
```sql
SELECT * FROM story WHERE status = "open" AND assignee IN ("user_key1", "user_key2")
```

---

## 常用字段 Key 参考

| 字段名称 | 字段 Key | 类型 | 说明 |
|---------|---------|------|-----|
| 项目周期 | field_6d3a18 | schedule | 毫秒时间戳，格式: start_ms,end_ms |
| 依赖 | field_19320a | workitem_related_multi_select | 依赖的工作项ID数组 |
| 负责人 | field_assigned | user | 用户user_key |
| 状态 | status | select | 枚举值 |
| 迭代 | field_iteration | select | 迭代关联 |

---

## API 调用示例

### Python 调用 MCP

```python
import requests
import json

MCP_URL = "https://project.feishu.cn/mcp_server/v1"
MCP_KEY = "m-7704188c-ef20-451f-89f9-57e4824587a0"
USER_KEY = "7481325171635240962"
PROJECT_KEY = "ntv21m"

def call_mcp_tool(tool_name: str, arguments: dict) -> dict:
    url = f"{MCP_URL}?mcpKey={MCP_KEY}&userKey={USER_KEY}"
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    }
    response = requests.post(url, json=payload)
    return response.json()

# 示例：创建工作项
result = call_mcp_tool("create_workitem", {
    "project_key": PROJECT_KEY,
    "work_item_type": "story",
    "fields": [
        {"field_key": "title", "field_value": "测试工作项"},
        {"field_key": "template", "field_value": "145405865"}
    ]
})

# 示例：更新排期
result = call_mcp_tool("update_workitem_schedule", {
    "project_key": PROJECT_KEY,
    "work_item_id": "6640212074",
    "schedule": "2026-03-02,2026-03-08"
})

# 示例：获取可流转状态
result = call_mcp_tool("get_transitable_states", {
    "project_key": PROJECT_KEY,
    "work_item_id": "6640212074",
    "work_item_type": "story",
    "user_key": USER_KEY
})
```

---

## 注意事项

1. **字段匹配**: 务必严格匹配，避免出现用户想要创建[硬件缺陷]字段，但是确传入了[关联缺陷]字段的key的情况
2. **模板ID**: 创建工作项时 template 是必填的
3. **时间格式**: schedule 类型使用毫秒时间戳，格式为 `start_ms,end_ms`
4. **关联字段**: workitem_related_multi_select 类型的值必须是数字数组，不能是字符串数组
5. **URL 提取**: 大多数工具支持从 URL 中自动提取 project_key、work_item_type、work_item_id 等信息
