# 飞书项目 - Story 工作项字段配置

> 项目: ntv21m (软硬一体DEMO演示)
> 生成时间: 2026-03-24

---

## 基础字段

| 字段Key | 字段名称 | 字段类型 | 必填 | 说明 |
|---------|---------|---------|------|------|
| name | 需求名称 | _name | ✅ | 工作项名称 |
| description | 需求描述 | multi-text | ❌ | 详细描述 |
| wiki | 需求文档 | link | ❌ | 关联飞书文档 |
| owner | 创建者 | user | ❌ | 创建人 |
| start_time | 提出时间 | date | ❌ | 毫秒时间戳 |
| finish_time | 完成日期 | date | ❌ | 毫秒时间戳 |
| watchers | 关注人 | multi-user | ❌ | 关注者可通过bot私信了解进度 |

---

## 业务字段

| 字段Key | 字段名称 | 字段类型 | 必填 | 说明 |
|---------|---------|---------|------|------|
| business | 业务线 | _business | ✅ | 级联选择 |
| priority | 优先级 | select | ❌ | 见下方枚举 |
| template | 需求类型 | _work_item_template | ✅ | 见下方枚举 |
| tags | 需求标签 | multi-select | ❌ | 见下方枚举 |
| work_item_type_key | 工作项类型 | select | ❌ | 自动填充 |
| owned_project | 所属空间 | owned_project | ❌ | 自动填充 |

---

## 优先级枚举 (priority)

| option_id | option_name |
|-----------|-------------|
| 0 | P0-重要紧急 |
| 1 | P1-重要不紧急 |
| 2 | P2-紧急次要 |
| 99 | P3-次要不紧急 |

---

## 需求类型枚举 (template)

| option_id | option_name |
|-----------|-------------|
| 2872096 | Feature产品需求（IR） |
| 2872110 | 产品需求-标准 |
| 2872104 | 产品需求-新1 |
| 2872112 | 技术需求（SR） |
| 2872109 | 技术需求-新 |
| 2876058 | 技术需求-1（SR） |
| 2876064 | 子需求（AR） |
| 6911400 | 软件项目立项与需求分析全流程 |
| 6911404 | 软件项目立项与需求分析全流程_1773912155 |
| 6911408 | 软件项目立项与需求分析全流程_1773912170 |
| 6912106 | 项目需求分析与立项流程_1773913521 |

---

## 需求标签枚举 (tags)

| option_id | option_name |
|-----------|-------------|
| 测试 | 重保需求 |
| 再加一个吧 | 承诺需求 |
| tcxzzyq5q | 定容需求 |

---

## 业务线枚举 (business)

```
C端产品线
├── 录音笔
├── 汽车
├── 扫地机器人
├── 翻译机
├── 耳机
└── 学习机
B端产品线
├── AI解决方案
├── 营销服务
└── 智慧园区
公共研发部
├── 基础平台部
└── 数据分析部
其他
└── 预研组
研发中心
└── 视频感知研发部
    └── IPC产品线
        └── 12系产品线
            └── Project A
```

### 常用业务线 ID

| 业务线 | option_id |
|--------|-----------|
| C端产品线 | 67fe1cbf35da24ec52b63236 |
| 录音笔 | 67fe1cbf35da24ec52b63237 |
| 汽车 | 680761991865d312a0ea00c2 |
| 翻译机 | 67fe1cbf35da24ec52b63238 |
| 耳机 | 68076002285adef07024ef80 |
| 学习机 | 680760f66de39bc58bf09f19 |
| B端产品线 | 67fe1cbf35da24ec52b6323d |
| AI解决方案 | 6807607a48cdd36ac4031e64 |
| 公共研发部 | 67fe1cbf35da24ec52b63247 |
| 基础平台部 | 67fe1cbf35da24ec52b63248 |
| 研发中心 | 682405dbad115180474cfe49 |

---

## 状态枚举 (work_item_status)

| option_id | option_name |
|-----------|-------------|
| to_be_started | 未开始 |
| started | 提出 |
| doing | 待产品评审 |
| linshihong_3331583816152441 | 待技术评审 |
| linshihong_3331583816205424 | 待排期 |
| linshihong_3331583827552071 | 开发中 |
| option_3 | 待技术评审 |
| option_4 | 待排期 |
| option_8 | 待验收 |
| option_9 | 待安全评审 |
| option_10 | 待灰度 |
| option_11 | 待全量发布 |
| option_12 | 全量发布 |
| end | 已结束 |
| sub_stage_1 | 灰度中 |
| GMjt1V9et | 待UI设计 |
| OZg5u0Ykl | 已加入Backlog |
| Ukq0WQhrL | 待确认技术方案 |
| YIej4AW7r | 联调 |
| rtwYuXceP | 待测试 |
| uFWFZYJOJ | 验收中 |
| FIfNP8iq4 | 发布中 |
| t_QJk_teg | 已完成 |
| closed | 已终止 |
| haCje_4L1 | 测试中 |
| Mkl_FA5rZ | 已完成价值评审 |
| M6S1zGP1v | 需求方案设计中 |
| rga85YUcA | 待线内初评 |
| iA5pqMETm | 待需求详评 |
| rySv9ZKQ8 | QA测试中 |
| ckiNv6jEk | 需求评估 |
| Dehuv6JXB | 方案设计 |
| ofv20plDw | 迭代排期/拆分 |
| by29lyFJj | 开发测试 |
| -oNafiY-W | 版本发布 |
| Pb5K4FoXF | 需求阶段 |
| di8vOveBn | 研测阶段 |

---

## 流程相关字段

| 字段Key | 字段名称 | 类型 | 说明 |
|---------|---------|------|------|
| schedule | 排期 | schedule | `[start_ms, end_ms]` |
| planning_sprint | 规划迭代 | workitem_related_multi_select | 关联的迭代 |
| field_6d3a18 | 项目周期 | schedule | 毫秒时间戳格式 |

---

## 合规与安全字段

| 字段Key | 字段名称 | 类型 | 说明 |
|---------|---------|------|------|
| legal | 需要安全合规评估 | bool | 打开后自动同步到法务平台 |
| enable_sdlc | 需要安全技术评审 | bool | 打开后自动同步到SDLC平台 |
| legal_status | 合规评估结果 | signal | 已通过/未通过/处理中/暂无信息 |
| sdlc_complete | 代码评审结论 | signal | 已通过/未通过/处理中/暂无信息 |
| legal_complete | 合规评估验收结果 | signal | 已通过/未通过/处理中/暂无信息 |
| field_480c1b | 安全合规评估结论 | multi-text | - |
| field_00d503 | 安全合规评审结果 | multi-text | - |
| field_c8d3b7 | 安全评估结论 | select | 通过/不通过 |
| sdlc_pentest_complete | 安全渗透测试结论 | signal | 已通过/未通过/处理中/暂无信息 |
| penetration_test | 是否需要安全渗透测试 | bool | - |

---

## 产品相关字段

| 字段Key | 字段名称 | 类型 | 说明 |
|---------|---------|------|------|
| exp_time | 预期完成时间 | date | - |
| field_4 | UE设计稿 | link | - |
| field_cdffdd | 需求来源 | select | 外部反馈/KA反馈/内部反馈/PM发起/竞品功能 |
| field_b14d23 | 预期开始时间 | date | - |
| field_cdffdd | 需求复杂度分级-技术侧 | select | Lv.1 ~ Lv.5 |
| field_bcb68a | 需求价值 | select | 高于预期/符合预期/低于预期 |

---

## 版本发布字段

| 字段Key | 字段名称 | 类型 | 说明 |
|---------|---------|------|------|
| field_7edbce | 跟客户端版发布 | bool | 指跟随 PC/Android/iOS 版本发布上线 |
| field_ae1375 | 实际上车版本 | workitem_related_select | 关联版本工作项 |

---

## 测试相关字段

| 字段Key | 字段名称 | 类型 | 说明 |
|---------|---------|------|------|
| field_82923e | 需要 QA 测试 | bool | - |
| field_13d54a | 是否需要灰度测试 | bool | - |

---

## 其他字段

| 字段Key | 字段名称 | 类型 | 说明 |
|---------|---------|------|------|
| field_cdc8f6 | 需要翻译 | bool | 需要翻译的需求请添加 UX Writer 角色 |
| field_7b4fa1 | 需要需求效益评估 | bool | - |
| byteio_demand_link | 埋点设计文档 | link | - |
| field_9e3cf5 | 文案内容 | text | - |
| archiving_date | 归档时间 | date | - |
| apps | 覆盖应用 | multi-select | - |
| field_result_display | 结果是否展示 | bool | - |
| field_475974 | 综合评审 | bool | - |
| field_0b427a | 综评投票 | vote-option | 强烈支持/比较赞同/不太赞同但可以尝试/反对 |

---

## 创建 Story 工作项示例

```python
# 创建一个 P0 优先级的 Feature 产品需求
fields = [
    {"field_key": "name", "field_value": "用户登录功能"},
    {"field_key": "template", "field_value": "2872096"},  # Feature产品需求（IR）
    {"field_key": "business", "field_value": "67fe1cbf35da24ec52b63236"},  # C端产品线
    {"field_key": "priority", "field_value": "0"},  # P0-重要紧急
    {"field_key": "schedule", "field_value": [1775404800000, 1777564799999]},  # 排期
    {"field_key": "description", "field_value": "实现用户登录功能，支持手机号和邮箱登录"},
    {"field_key": "field_82923e", "field_value": True}  # 需要 QA 测试
]

result = call_mcp("create_workitem", {
    "project_key": "ntv21m",
    "work_item_type": "story",
    "fields": fields
})
```

---

## 批量创建子需求示例

```python
# 创建一个 AR 子需求，关联父需求
fields = [
    {"field_key": "name", "field_value": "登录页面UI开发"},
    {"field_key": "template", "field_value": "2876064"},  # 子需求（AR）
    {"field_key": "priority", "field_value": "0"},
    {"field_key": "parent_workitem_id", "field_value": "6640212074"}  # 父需求ID
]

result = call_mcp("create_workitem", {
    "project_key": "ntv21m",
    "work_item_type": "story",
    "fields": fields
})
```
