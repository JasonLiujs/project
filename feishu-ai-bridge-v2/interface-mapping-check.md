# 前端接口和后端接口映射关系检查

## 🚨 已修正的问题

### **问题1: workObjectId参数被忽略**
**修正前（错误）:**
```typescript
async getWorkflowNodes(spaceId: string, workObjectId: string, activeWorkItemId: string | number) {
  // ❌ 硬编码'story'，忽略了workObjectId参数
  const step1Path = `/open_api/${spaceId}/work_item/story/query`;
}
```

**修正后（正确）:**
```typescript
async getWorkflowNodes(spaceId: string, workObjectId: string, activeWorkItemId: string | number) {
  // ✅ 使用传入的workObjectId参数
  const step1Path = `/open_api/${spaceId}/work_item/${workObjectId}/query`;
}
```

### **问题2: MCP参数名不匹配**
**修正前（错误）:**
```typescript
const step1Result = await this.callTool('work_item_query', {
  space_id: spaceId,
  work_item_type: 'story',  // ❌ 硬编码且参数名错误
  work_item_ids: [workItemId]
});
```

**修正后（正确）:**
```typescript
const step1Result = await this.callTool('work_item_query', {
  space_id: spaceId,
  work_object_id: workObjectId,  // ✅ 使用正确的参数名和动态值
  work_item_ids: [workItemId]
});
```

## ✅ 正确的完整映射关系

### **数据流:**
```
前端JSSDK获取 → 前端函数参数 → MCP服务参数 → 后端API参数
```

### **具体映射:**

#### **Step 1: 前端JSSDK获取**
```typescript
const tabContext = await window.JSSDK.tab.getContext();
const activeContext = await window.JSSDK.Context.load();

// 获取的数据
const spaceId = tabContext.spaceId;              // 例如: '69c1fe2d301d4662fccaf03a'
const workObjectId = tabContext.workObjectId;    // 例如: 'story' 或数字ID
const activeWorkItemId = activeContext.activeWorkItem?.id;  // 例如: 6928175097
```

#### **Step 2: 前端函数调用**
```typescript
const response = await mcpClient.getWorkflowNodes(
  spaceId,        // ✅ 传递真实的空间ID
  workObjectId,   // ✅ 传递真实的工作项类型ID
  workItemIdStr   // ✅ 传递真实的工作项实例ID（字符串格式）
);
```

#### **Step 3: MCP服务调用**
```typescript
// MCP工具调用：work_item_query
const step1Result = await this.callTool('work_item_query', {
  space_id: spaceId,          // ✅ 动态空间ID
  work_object_id: workObjectId, // ✅ 动态工作项类型ID
  work_item_ids: [workItemId]   // ✅ 动态工作项实例ID
});

// MCP工具调用：template_detail_query
const step2Result = await this.callTool('template_detail_query', {
  space_id: spaceId,      // ✅ 动态空间ID
  template_id: templateId // ✅ 从第一步获取的模板ID
});
```

#### **Step 4: 后端API调用（fallback）**
```typescript
// API路径1: 工作项查询
const step1Path = `/open_api/${spaceId}/work_item/${workObjectId}/query`;
// 实际例子: `/open_api/69c1fe2d301d4662fccaf03a/work_item/story/query`

// API路径2: 模板详情查询
const step2Path = `/open_api/${spaceId}/template_detail/${templateId}`;
// 实际例子: `/open_api/69c1fe2d301d4662fccaf03a/template_detail/6965393`
```

## 📊 参数对照表

| 层级 | 参数名 | 类型 | 示例值 | 来源 |
|------|--------|------|--------|------|
| **前端JSSDK** | `spaceId` | string | `'69c1fe2d301d4662fccaf03a'` | `JSSDK.tab.getContext()` |
| **前端JSSDK** | `workObjectId` | string | `'story'` | `JSSDK.tab.getContext()` |
| **前端JSSDK** | `activeWorkItemId` | number | `6928175097` | `JSSDK.Context.load()` |
| **MCP参数** | `space_id` | string | `'69c1fe2d301d4662fccaf03a'` | 直接传递 |
| **MCP参数** | `work_object_id` | string | `'story'` | 直接传递 |
| **MCP参数** | `work_item_ids` | number[] | `[6928175097]` | 数字转换 |
| **后端API** | URL中的spaceId | string | `'69c1fe2d301d4662fccaf03a'` | URL拼接 |
| **后端API** | URL中的workObjectId | string | `'story'` | URL拼接 |
| **后端API** | 请求体中的work_item_ids | number[] | `[6928175097]` | JSON请求体 |

## 🔧 关键修正说明

### **修正1: 参数传递一致性**
- **修正前**: 忽略了`workObjectId`参数，硬编码为`'story'`
- **修正后**: 完全使用动态参数，确保不同工作项类型的兼容性

### **修正2: MCP参数名正确性**
- **修正前**: 使用了`work_item_type`（不匹配）
- **修正后**: 使用`work_object_id`（匹配实际API结构）

### **修正3: 数据流一致性**
确保从JSSDK获取的数据能够完整、正确地传递到最终的API调用，没有中间环节的硬编码干扰。

## ✅ 验证清单

- [x] **前端JSSDK获取**: 正确获取三个关键参数
- [x] **前端函数参数**: 正确传递所有参数
- [x] **MCP服务参数**: 参数名和值都正确映射
- [x] **后端API调用**: URL和请求体格式正确
- [x] **错误处理**: MCP失败时正确fallback到直接API调用
- [x] **数据类型**: 大整数精度问题已处理

## 🚀 测试确认

修正后的代码应该能够：
1. 正确处理不同的工作项类型（不只是'story'）
2. 正确处理不同的项目空间ID
3. 正确处理不同的工作项实例ID
4. 在MCP和直接API调用间保持参数一致性

**总结**: 所有前端接口和后端接口的映射关系已修正，确保参数传递的完整性和正确性。