# 飞书项目 - 前端开发知识库

> 生成时间: 2026-03-24
> 状态: 待补充 JSSDK 文档

---

## 前端开发概述

飞书项目前端开发主要包括以下几个方面：

1. **飞书小程序开发** - 在飞书客户端内运行的应用
2. **H5 页面开发** - 移动端 Web 页面
3. **飞书 JSSDK 集成** - 使用飞书 JSAPI 与客户端交互
4. **前端组件库** - 飞书 UI 组件

---

## 飞书 JSSDK (JSAPI)

### 引入 SDK

```html
<script src="https://lf1-cdn-tos.bytegoofy.com/goofy/lark/oapi-sdk/jsdk/3.1.1/larkjsb.js"></script>
```

### 初始化

```javascript
// 方式1: 使用 ticket 初始化（服务端下发）
lark.defineConfig({
  appId: 'cli_xxxxxxxx',
  ticket: 'your_ticket_from_server'
}).subscribe('init', (e) => {
  console.log('初始化成功', e);
});

// 方式2: 使用 access_token 初始化
lark.defineConfig({
  appId: 'cli_xxxxxxxx',
  appSecret: 'your_app_secret'
}).getToken().then(token => {
  console.log('获取到 token:', token);
});
```

### 常用 API

#### 1. 跳转与路由

```javascript
// 跳转到飞书页面
lark.link.open({
  url: 'https://applink.feishu.cn/client/miniProgram/open?schema=xxx'
});

// 打开指定小程序
lark.miniProgram.open({
  appId: 'cli_xxxxxxxx',
  path: '/pages/index',
  query: { key: 'value' }
});
```

#### 2. 分享

```javascript
// 设置分享内容
lark.share.getShareTicket().then(ticket => {
  console.log('分享 ticket:', ticket);
});

// 分享到会话
lark.message.openConversation({
  conversationType: 1,  // 1=单聊, 2=群聊
  userId: 'ou_xxx',
  callback: () => {}
});
```

#### 3. 媒体能力

```javascript
// 拍照
lark.media.chooseImage({
  count: 1,
  source: ['camera', 'album']
}).then(res => {
  console.log('图片路径:', res.file_path);
});

// 选择文件
lark.media.chooseFile({
  types: ['doc', 'pdf', 'excel']
}).then(res => {
  console.log('文件信息:', res);
});

// 录音
lark.media.chooseAudio().then(res => {
  console.log('音频路径:', res.file_path);
});
```

#### 4. 位置服务

```javascript
// 获取当前位置
lark.location.pickLocation().then(res => {
  console.log('位置信息:', {
    latitude: res.latitude,
    longitude: res.longitude,
    address: res.address
  });
});

// 打开地图选位置
lark.location.openLocation({
  latitude: 39.908823,
  longitude: 116.397470,
  name: '北京',
  address: '北京市朝阳区'
});
```

#### 5. 文件与存储

```javascript
// 打开文件预览
lark.fs.openDocPreview({
  docType: 'docx',
  token: 'docx_token',
  rev: 'version_id'
});

// 保存文件到本地
lark.fs.saveFile({
  url: 'https://example.com/file.pdf',
  name: 'filename.pdf'
});

// 读取本地文件
lark.fs.readFile({
  path: 'local_file_path'
}).then(res => {
  console.log('文件内容:', res.content);
});
```

#### 6. 用户信息

```javascript
// 获取当前用户信息
lark.user.getCurrentUser().then(user => {
  console.log('用户ID:', user.userId);
  console.log('用户名:', user.name);
  console.log('邮箱:', user.email);
});

// 获取用户详细信息
lark.user.getUserInfo({
  userId: 'ou_xxx'
}).then(info => {
  console.log('用户详情:', info);
});
```

#### 7. 扫码

```javascript
// 扫一扫
lark.scan.scan().then(res => {
  console.log('扫码结果:', res.result);
});
```

#### 8. 支付能力

```javascript
// 发起支付
lark.pay.requestPayment({
  orderInfo: {
    order_id: 'xxx',
    amount: 100,
    currency: 'CNY'
  }
}).then(res => {
  console.log('支付成功');
}).catch(err => {
  console.log('支付失败:', err);
});
```

---

## 飞书小程序开发

### 项目结构

```
my-mini-app/
├── app.js              # 应用入口
├── app.json            # 应用配置
├── app.ttml            # 模板
├── app.ttss            # 样式
├── pages/
│   ├── index/
│   │   ├── index.js
│   │   ├── index.ttml
│   │   └── index.ttss
│   └── detail/
│       ├── detail.js
│       ├── detail.ttml
│       └── detail.ttss
└── components/         # 组件
    └── my-component/
```

### app.json 配置

```json
{
  "pages": [
    "pages/index/index",
    "pages/detail/detail"
  ],
  "window": {
    "navigationBarTitleText": "我的应用",
    "navigationBarBackgroundColor": "#ffffff"
  },
  "networkTimeout": {
    "request": 10000,
    "downloadFile": 30000
  },
  "lark": {
    "appId": "cli_xxxxxxxx",
    "versionType": "develop"
  }
}
```

### 页面生命周期

```javascript
// pages/index/index.js
Page({
  data: {
    title: '',
    list: []
  },
  
  onLoad(options) {
    console.log('页面加载', options);
    this.fetchData();
  },
  
  onShow() {
    console.log('页面显示');
  },
  
  onReady() {
    console.log('页面渲染完成');
  },
  
  onHide() {
    console.log('页面隐藏');
  },
  
  onUnload() {
    console.log('页面卸载');
  },
  
  onPullDownRefresh() {
    console.log('下拉刷新');
    this.fetchData().finally(() => {
      tt.stopPullDownRefresh();
    });
  },
  
  onReachBottom() {
    console.log('上拉加载');
    this.loadMore();
  },
  
  methods: {
    fetchData() {
      return tt.request({
        url: 'https://api.example.com/data',
        method: 'GET'
      }).then(res => {
        this.setData({ list: res.data });
      });
    }
  }
});
```

### 组件开发

```javascript
// components/my-component/my-component.js
Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    items: {
      type: Array,
      value: []
    }
  },
  
  data: {
    count: 0
  },
  
  lifetimes: {
    created() {
      console.log('组件创建');
    },
    attached() {
      console.log('组件挂载');
    },
    ready() {
      console.log('组件渲染完成');
    },
    detached() {
      console.log('组件卸载');
    }
  },
  
  methods: {
    handleClick() {
      this.triggerEvent('customevent', { id: 1 });
    }
  }
});
```

---

## 飞书项目嵌入开发

### 使用 iframe 嵌入

```html
<iframe
  src="https://project.feishu.cn/project/{project_key}/workitems/{work_item_id}"
  style="width: 100%; height: 100vh; border: none;"
/>
```

### 消息卡片开发

```javascript
// 创建卡片消息
const card = {
  config: {
    wide_screen_mode: true
  },
  header: {
    title: {
      tag: 'plain_text',
      content: '任务通知'
    },
    template: 'blue'
  },
  elements: [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: '**任务名称**: 开发登录功能\n**负责人**: 张三\n**截止时间**: 2026-03-25'
      }
    },
    {
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: '查看详情'
          },
          type: 'primary',
          value: { taskId: '123' }
        }
      ]
    }
  ]
};
```

### 机器人消息

```javascript
// 发送消息到群
tt.request({
  url: 'https://open.feishu.cn/open-apis/im/v1/messages',
  method: 'POST',
  header: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  data: {
    receive_id: 'oc_xxx',
    msg_type: 'text',
    content: JSON.stringify({
      text: '任务已更新，请查看'
    })
  }
});
```

---

## 前端权限与安全

### 权限申请

```json
{
  "permissions": [
    "contact:user.employee_id:readonly",
    "im:message:send_as_bot",
    "docx:document:readonly",
    "drive:file:readonly"
  ]
}
```

### 安全注意

1. **敏感信息**: 不要在前端代码中硬编码 appSecret
2. **接口调用**: 所有 API 调用应通过后端代理
3. **用户授权**: 使用 OAuth2.0 进行用户授权
4. **数据校验**: 前端所有输入都需要后端二次校验

---

## 常用工具函数

```javascript
// 时间格式化
function formatDate(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second);
}

// 金额格式化
function formatMoney(amount, decimals = 2) {
  return (amount / 100).toFixed(decimals);
}

// 防抖
function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// 节流
function throttle(fn, delay = 300) {
  let last = 0;
  return function(...args) {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn.apply(this, args);
    }
  };
}
```

---

## 开发调试

### 开发者工具

1. **飞书开发者工具** - 调试飞书小程序
2. **Chrome DevTools** - 调试 H5 页面
3. **Charles/Fiddler** - 抓包调试

### 常见问题

#### 1. JSSDK 引入失败
```html
<!-- 确保使用 HTTPS -->
<script src="https://lf1-cdn-tos.bytegoofy.com/goofy/lark/oapi-sdk/jsdk/3.1.1/larkjsb.js"></script>
```

#### 2. 签名失败
- 检查 `timestamp` 和 `nonce` 是否正确
- 确保 `signature` 计算正确
- 确认 URL 与后端签名时使用的 URL 一致

#### 3. 跨域问题
- 使用后端代理转发请求
- 配置正确的 CORS 头

---

## 相关资源

- [飞书开放平台](https://open.feishu.cn/)
- [飞书小程序文档](https://open.feishu.cn/document/home/develop-a-mini-app/document)
- [JSSDK 文档](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/jsapi-sdk/overview)
- [消息卡片搭建](https://open.feishu.cn/document/ukTMukTMukTM/im-v1/message-cards/overview)
