# 飞书项目 - 工作流/节点流知识库

> 生成时间: 2026-03-24
> 数据来源: 工作项 #6640212074 (AI Agent模型项目)

---

## 节点流概述

飞书项目支持两种工作项模式：
1. **状态流** - 简单的状态流转（如待办 → 进行中 → 已完成）
2. **节点流** - 复杂的多阶段流程，包含节点、角色、子任务等

### 节点结构

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
    "points": null,
    "actual_work_time": null,
    "actual_begin_time": 1767001502638,
    "actual_finish_time": null,
    "is_delayed": false
  },
  "form_items": [
    {
      "form_item_type": "field|node_field|role",
      "field_key": "field_xxx",
      "field_name": "字段名",
      "field_type": "text|link|multi-text|schedule|number|bool",
      "value": "...",
      "is_required": true
    }
  ]
}
```

---

## 节点状态

| 状态值 | 说明 | 颜色 |
|-------|------|------|
| `not_started` | 未开始 | 灰色 |
| `doing` | 进行中 | 蓝色/黄色 |
| `completed` | 已完成 | 绿色 |

---

## 节点字段类型

| form_item_type | 说明 | 示例字段 |
|----------------|------|---------|
| `field` | 自定义字段 | 产品构想、URL链接等 |
| `node_field` | 节点固有字段 | 排期、估分、实际工时 |
| `role` | 角色分配 | 产品经理、研发代表等 |

### 节点固有字段 (node_field)

| field_key | 字段名称 | 类型 |
|-----------|---------|------|
| schedule | 排期 | schedule |
| point | 估分 | number |
| actual_work_time | 实际工时 | number |

---

## 节点流转 API

### 1. 获取节点详情

```python
result = call_mcp("get_node_detail", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "node_id_list": ["_all"],
    "need_sub_task": True,
    "page_num": 1
})
```

### 2. 获取可流转状态

```python
result = call_mcp("get_transitable_states", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "work_item_type": "story",
    "user_key": "7481325171635240962"
})
```

### 3. 获取流转必填信息

```python
result = call_mcp("get_transition_required", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "state_key": "state_1",  # 目标节点 key
    "mode": "unfinished"
})
```

### 4. 完成节点

> 注意: 需要通过 `get_transition_required` 获取必填字段后，填写完成再流转

```python
# 填写节点表单字段后流转
result = call_mcp("update_workitem_fields", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "work_item_type": "story",
    "fields": [
        {"field_key": "field_xxx", "field_value": "..."}
    ]
})
```

---

## 角色系统

### 角色分配结构

```json
{
  "role_assignees": {
    "role_a6fc96": [
      {"user_key": "7206217422561443843", "name": "路一手"}
    ]
  }
}
```

### 节点角色分配模式 (node_owner_mode)

| 值 | 说明 |
|---|------|
| 1 | 指定人员或团队 |
| 2 | 全部空间管理员 |
| 3 | 全部空间成员 |

### 常用角色 Key

| role_key | 角色名称 |
|----------|---------|
| role_5b8b81 | 产品经理 |
| role_a6fc96 | PDT经理 |
| role_121a41 | 产品管理代表 |
| role_456890 | 研发代表 |
| role_3baacd | 硬件代表 |
| role_f6fea7 | 软件代表 |
| role_abbc46 | ID工程师 |
| role_59f215 | 结构代表 |
| role_67fe1cac42e0d54d282a3b4d_64754c3647c65740efc88740_role_5b8b81 | 产品经理（正式项目） |

---

## 节点配置 API

### 获取节点字段配置

```python
result = call_mcp("list_node_field_config", {
    "project_key": "ntv21m",
    "work_item_type": "story",
    "query": "排期"
})
```

---

## 常见节点流程模板

### 软硬结合项目流程 (模板ID: 2872113, 版本6)

#### 阶段1: 项目立项

| 节点 | 节点Key | 状态 |
|------|---------|------|
| 项目立项 | started | doing |

#### 阶段2: 初始评估

| 节点 | 节点Key | 说明 |
|------|---------|------|
| 接受项目任务书 | state_0 | - |
| 确定小Team | state_3 | 需要角色: 研发代表 |
| 项目裁剪 | state_1 | 需要填写 TR1~PDCP 裁剪选项 |
| 预研 | state_2 | 需要预研评审结论 |

#### 阶段3: 产品定义

| 节点 | 节点Key | 说明 |
|------|---------|------|
| 产品定位 | state_4 | 需要产品定位链接、PCB设计稿 |
| 平台选型 | state_13 | 需要平台选型报告 |
| 售卖人群 | state_12 | 需要竞品分析 |
| 产品卖点 | state_14 | 需要卖点功能文本 |

#### 阶段4: 评审节点

| 节点 | 节点Key | 说明 |
|------|---------|------|
| ⭕️TR1评审 | state_6 | - |
| ⭕️CDCP评审 | state_7 | - |
| ⭕️TR2评审通过 | state_17 | - |

#### 阶段5: 需求拆解

| 节点 | 节点Key | 说明 |
|------|---------|------|
| 各领域需求拆解 | state_15 | - |

#### 阶段6: 评估

| 节点 | 节点Key | 说明 |
|------|---------|------|
| 粗略排期评估 | state_9 | - |
| 粗略成品评估 | state_10 | - |

#### 阶段7: 可行性评估

| 节点 | 节点Key | 说明 |
|------|---------|------|
| 软件可行性评估 | state_19 | 需要可行性分析报告 |
| 硬件可行性评估 | state_18 | 需要可行性分析报告 |
| 软硬件风险 | state_20 | 需要风险分析清单 |

#### 阶段8: ID

| 节点 | 节点Key | 说明 |
|------|---------|------|
| ID确认 | state_8 | 需要ID设计图 |

#### 阶段9: 产品细化

| 节点 | 节点Key | 说明 |
|------|---------|------|
| 细化产品定位 | state_11 | - |

---

## 子任务 (Sub Task)

### 获取子任务

```python
result = call_mcp("get_node_detail", {
    "project_key": "ntv21m",
    "work_item_id": "6640212074",
    "node_id_list": ["node_state_1_6640212074"],
    "need_sub_task": True
})
```

### 子任务结构

```json
{
  "sub_tasks": [
    {
      "task_id": "xxx",
      "name": "子任务名称",
      "assignee": {"user_key": "...", "name": "..."},
      "status": "todo|doing|done",
      "due_date": 1709337600000,
      "estimated_hours": 8
    }
  ]
}
```

---

## 节点排期计算

### 获取个人排期

```python
result = call_mcp("list_schedule", {
    "project_key": "ntv21m",
    "user_keys": ["7481325171635240962"],
    "work_item_type_keys": ["story", "sub_task"],
    "start_time": "2026-03-01",
    "end_time": "2026-03-31"
})
```

### 返回数据结构

```json
{
  "user_workload_list": [
    {
      "user": {"user_key": "...", "name": "..."},
      "task_list": [
        {
          "work_item_id": "xxx",
          "work_item_name": "任务名",
          "node_name": "开发中",
          "schedule": {
            "start_time": 1775404800000,
            "end_time": 1777564799999
          },
          "estimated_hours": 40,
          "completed_hours": 20
        }
      ],
      "total": {
        "estimated_hours": 80,
        "completed_hours": 40,
        "todo_count": 5,
        "overload": false
      }
    }
  ]
}
```

---

## 节点流转自动化建议

### 1. 自动完成节点条件

```python
# 检查节点是否可以流转
def can_transition(work_item_id, node_key):
    # 获取节点详情
    node_detail = call_mcp("get_node_detail", {...})
    
    # 检查必填字段是否都已填写
    required_fields = get_required_fields(node_detail)
    for field in required_fields:
        if not field['value']:
            return False, f"缺少必填字段: {field['field_name']}"
    
    return True, "可以流转"
```

### 2. 节点完成回调

```python
# 监听工作项状态变化
def on_node_completed(work_item_id, node_key):
    # 1. 更新子任务状态
    # 2. 发送通知
    # 3. 触发下一个节点
    # 4. 记录操作日志
    pass
```

### 3. 节点超时提醒

```python
# 检查节点是否超时
def check_node_timeout(node):
    schedule = node['schedule']
    estimate_end = schedule.get('estimate_finish_time')
    
    if estimate_end and estimate_end < current_timestamp_ms():
        # 节点超时
        return True, {
            "node_name": node['basic']['name'],
            "delay_hours": (current_timestamp_ms() - estimate_end) / 3600000
        }
    return False, None
```

---

## 最佳实践

### 1. 节点命名规范

- 使用明确的动作词：如「需求评审」「代码开发」
- 包含状态标识：如「⭕️TR1评审」表示评审节点
- 保持命名一致性

### 2. 节点配置建议

- 每个节点控制在 3-7 个表单字段
- 必填字段尽量少
- 使用清晰的字段名称和说明

### 3. 流转自动化

- 建议在所有必填字段填写后才自动流转
- 保留人工确认环节
- 记录流转日志便于追溯
