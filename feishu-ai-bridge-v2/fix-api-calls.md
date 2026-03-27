# 🔧 API调用问题修复方案

## 问题分析

1. **跨域配置**：✅ 完全正常
2. **代理服务器**：✅ 工作正常
3. **API路径**：❌ POST `/work_item/story/query` 返回404
4. **正确路径**：✅ GET `/work_item/list` 返回200

## 解决方案

### 1. 修改 API 调用方法

原始代码问题：
```javascript
// ❌ 错误的API调用
POST /open_api/xxx/work_item/story/query
Content-Type: application/json
{}
```

正确的API调用：
```javascript
// ✅ 正确的API调用
GET /open_api/xxx/work_item/list
X-Plugin-Token: {real_token}
X-User-Key: {real_user_key}
```

### 2. 需要真实的认证信息

模拟认证无效，需要从插件环境获取真实的：
- `X-Plugin-Token`
- `X-User-Key`

### 3. 修复代码位置

文件：`src/features/ai_config/App.tsx:443-449`

需要修改：
1. 请求方法：POST → GET
2. API路径：`/work_item/story/query` → `/work_item/list`
3. 添加认证头：`X-Plugin-Token`, `X-User-Key`
4. 移除请求体（GET请求）

### 4. 立即修复

修改 App.tsx 中的API调用：

```diff
- const response = await fetch(apiUrl, {
-   method: 'POST',
-   headers: {
-     'Content-Type': 'application/json'
-   },
-   body: JSON.stringify(step1Body)
- });

+ // 获取真实认证信息
+ const auth = await window.JSSDK?.getPluginAuth?.() || {};
+
+ const response = await fetch(apiUrl.replace('/query', '/list'), {
+   method: 'GET',
+   headers: {
+     'Content-Type': 'application/json',
+     'X-Plugin-Token': auth.token || '',
+     'X-User-Key': auth.userKey || ''
+   }
+ });
```

## 结论

404 问题已确认原因：
1. ✅ **跨域配置完全正确**
2. ✅ **代理服务器工作正常**
3. ❌ **API调用方法错误** - 需要用GET而不是POST
4. ❌ **缺少真实认证信息** - 需要从插件环境获取

修复后，API调用应该能正常工作！