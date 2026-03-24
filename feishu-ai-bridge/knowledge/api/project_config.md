# 飞书项目配置信息

> 记录时间: 2026-03-24

---

## 认证配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| MCP URL | `https://project.feishu.cn/mcp_server/v1` | MCP 服务地址 |
| MCP Key | `m-7704188c-ef20-451f-89f9-57e4824587a0` | MCP 认证密钥 |
| User Key | `7481325171635240962` | 用户唯一标识 |
| Plugin ID | `MII_68C1113184964013` | 飞书项目插件ID |
| Plugin Secret | `E44F922D93A3EC7CDA8129403895CA7C` | 飞书项目插件密钥 |

---

## 项目空间配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| Project Key | `ntv21m` | 项目空间短名 |
| Project Space ID | `67fe1cac42e0d54d282a3b4d` | 项目空间ID |
| 工作项类型 | story, issue 等 | 支持多种工作项类型 |

---

## 常用字段配置

### 排期字段 (field_6d3a18)

- **字段名称**: 项目周期
- **类型**: schedule
- **格式**: 毫秒时间戳，逗号分隔 `start_ms,end_ms`

```python
# 时间格式转换
start_ms = int(start_date.timestamp() * 1000)
end_ms = int(end_date.timestamp() * 1000)
field_value = f"{start_ms},{end_ms}"

# 简化方式（使用 update_workitem_schedule）
schedule = "2026-03-02,2026-03-08"
```

### 依赖字段 (field_19320a)

- **类型**: workitem_related_multi_select
- **格式**: 数字数组 `[12345, 12346]`

```json
{
  "field_key": "field_19320a",
  "field_value": [12345, 12346]
}
```

---

## 工作项类型

常见工作项类型:
- `story` - 需求/故事
- `issue` - 问题
- `task` - 任务
- `bug` - 缺陷
- `sub_task` - 子任务

---

## 状态流转

### 获取可流转状态

```python
result = call_mcp_tool("get_transitable_states", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "work_item_type": "story",
    "user_key": "7481325171635240962"
})
```

### 获取流转必填信息

```python
result = call_mcp_tool("get_transition_required", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "state_key": "node_key_xxx",  # 目标节点或状态的key
    "mode": "unfinished"  # 仅获取未完成的必填项
})
```

---

## 枚举值查询

使用 `list_workitem_field_config` 获取字段的枚举值:

```python
result = call_mcp_tool("list_workitem_field_config", {
    "project_key": "ntv21m",
    "work_item_type": "story",
    "field_keys": ["status"]  # 查询状态字段的枚举值
})
```

---

## 模板 ID

创建工作项时需要的模板ID可以通过 `list_workitem_field_config` 获取:

```python
result = call_mcp_tool("list_workitem_field_config", {
    "project_key": "ntv21m",
    "work_item_type": "story",
    "field_keys": ["template"]
})
```

---

## 测试记录

### 1. MCP 连接测试
```
状态: ✅ 成功
结果: 26个工具可用
```

### 2. 查询工作项 #6640212074
```
状态: ✅ 成功
工作项名称: AI Agent模型项目
工作项类型: 正式项目
当前状态: 概念阶段
```

### 3. 更新排期
```
状态: ✅ 成功
排期: 2026-03-02 至 2026-03-08
更新时间: 2026-02-25T10:55:10+08:00
更新人: 刘智慧
```

---

## 常见问题

### Q: 返回 "User No Exist"
A: 之前使用 `pdm` 返回此错误，实际应该使用项目空间短名 `ntv21m`

### Q: 模板 ID 如何获取
A: 使用 `list_workitem_field_config` 工具，传入 `field_keys=["template"]` 获取所有模板的枚举值

### Q: 时间格式
A: schedule 类型使用毫秒时间戳，用逗号分隔开始和结束时间
