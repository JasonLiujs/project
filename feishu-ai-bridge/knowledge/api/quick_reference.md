# 飞书项目 AI 自动化系统 - 快速参考

## 核心 API 速查

### 创建工作项
```python
call_mcp_tool("create_workitem", {
    "project_key": "ntv21m",
    "work_item_type": "story",
    "fields": [
        {"field_key": "title", "field_value": "任务名称"},
        {"field_key": "template", "field_value": "模板ID"}
    ]
})
```

### 更新工作项字段
```python
call_mcp_tool("update_workitem_fields", {
    "project_key": "ntv21m",
    "work_item_id": "工作项ID",
    "work_item_type": "story",
    "fields": [
        {"field_key": "field_19320a", "field_value": [依赖的工作项ID列表]}
    ]
})
```

### 更新排期
```python
call_mcp_tool("update_workitem_schedule", {
    "project_key": "ntv21m",
    "work_item_id": "工作项ID",
    "schedule": "2026-03-02,2026-03-08"
})
```

### 获取可流转状态
```python
call_mcp_tool("get_transitable_states", {
    "project_key": "ntv21m",
    "work_item_id": "工作项ID",
    "work_item_type": "story",
    "user_key": "7481325171635240962"
})
```

### 获取流转必填信息
```python
call_mcp_tool("get_transition_required", {
    "project_key": "ntv21m",
    "work_item_id": "工作项ID",
    "state_key": "节点key"
})
```

### 查询工作项列表
```python
call_mcp_tool("list_workitems", {
    "project_key": "ntv21m",
    "work_item_type": "story",
    "page_size": 50
})
```

### 查询工作项字段配置
```python
call_mcp_tool("list_workitem_field_config", {
    "project_key": "ntv21m",
    "work_item_type": "story"
})
```

### 获取工作项详情
```python
call_mcp_tool("get_workitem_brief", {
    "project_key": "ntv21m",
    "work_item_id": "工作项ID",
    "fields": ["title", "status", "field_19320a"]
})
```

## 字段类型速查

| 类型 | 格式 | 示例 |
|-----|------|-----|
| text | 字符串 | `"测试"` |
| number | 数字 | `123` |
| bool | 布尔 | `true` |
| select | 枚举 | `{"option_id": "123"}` |
| multi-select | 枚举数组 | `[{"option_id": "1"}, {"option_id": "2"}]` |
| user | user_key | `"7481325171635240962"` |
| multi-user | user_key数组 | `["key1", "key2"]` |
| date | 毫秒时间戳 | `1709337600000` |
| schedule | 时间戳数组 | `[start_ms, end_ms]` |
| workitem_related_multi_select | 数字数组 | `[123, 456]` |
| template | 模板ID | `145405865` |

## 字段 Key 速查

| 字段 | Key | 类型 |
|-----|-----|-----|
| 项目周期 | field_6d3a18 | schedule |
| 依赖 | field_19320a | workitem_related_multi_select |
| 标题 | title | text |
| 状态 | status | select |
| 负责人 | field_assigned | user |

## 状态流转速查

1. 调用 `get_transitable_states` 获取可流转状态列表
2. 调用 `get_transition_required` 获取流转所需必填信息
3. 填写必填信息后进行流转

## 排期格式

```python
# 方式1: 使用 schedule 参数
schedule = "2026-03-02,2026-03-08"

# 方式2: 使用时间戳
start_ms = int(datetime(2026, 3, 2).timestamp() * 1000)
end_ms = int(datetime(2026, 3, 8).timestamp() * 1000)
field_value = f"{start_ms},{end_ms}"
```

## MCP URL

```
https://project.feishu.cn/mcp_server/v1?mcpKey=m-7704188c-ef20-451f-89f9-57e4824587a0&userKey=7481325171635240962
```
