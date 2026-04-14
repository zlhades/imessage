# 🔑 通义千问 API 配置指南

> 配置后 AI 清理功能会自动启用，清理效果更好！

---

## 1. 获取 API Key

1. 访问 **阿里云百炼平台**: https://dashscope.console.aliyun.com/
2. 登录阿里云账号
3. 进入 **API-KEY 管理** 页面
4. 点击 **创建新的 API-KEY**
5. 复制你的 API Key（格式类似 `sk-xxxxxxxxxxxxxxxx`）

> 💡 新用户免费额度：**1,000,000 tokens**（有效期 90 天）

---

## 2. 配置 API Key

### 方法一：命令行设置（推荐）

```bash
# 在启动服务前运行
export DASHSCOPE_API_KEY="你的API Key"

# 然后启动服务
cd /Users/benson/Documents/incident/voice-demo
python3 app-light.py
```

### 方法二：写入 .env 文件

创建 `.env` 文件（已为你准备好模板）：

```bash
# 复制模板
cp .env.example .env

# 编辑 .env 文件，填入你的 API Key
nano .env
# 或
open -e .env
```

然后启动：

```bash
# 加载环境变量并启动
set -a && source .env && set +a && python3 app-light.py
```

### 方法三：直接修改启动脚本

编辑 `run.sh`（我会帮你创建）：

```bash
#!/bin/bash
export DASHSCOPE_API_KEY="你的API Key"
python3 app-light.py
```

然后运行：

```bash
chmod +x run.sh
./run.sh
```

---

## 3. 验证配置

启动服务后，你会看到：

```
✅ API Key: 已配置
```

而不是：

```
⚠️ API Key: 未设置（使用本地清理）
```

在 UI 中清理文本后，标签会显示 **✨ AI 清理** 而不是 **📝 本地清理**。

---

## 4. 使用的模型

| 功能 | 模型 | 说明 |
|------|------|------|
| 文本清理 | qwen-turbo | 去除语气词、添加标点、格式化 |

### 费用参考

| 项目 | 价格 |
|------|------|
| 输入 | ¥0.35 / 百万 tokens |
| 输出 | ¥1.4 / 百万 tokens |
| 每次清理（约 500 tokens） | **约 ¥0.001** |
| 1000 次清理 | **约 ¥1** |

> 新用户免费额度足够完成整个 Demo 测试！

---

## 5. 常见问题

### Q: API Key 不生效？

```bash
# 检查环境变量是否设置成功
echo $DASHSCOPE_API_KEY

# 应该输出你的 API Key，而不是空
```

### Q: 如何切换回本地清理？

```bash
# 取消环境变量
unset DASHSCOPE_API_KEY

# 重新启动
python3 app-light.py
```

### Q: 免费额度用完了怎么办？

1. 切换到本地清理（不设置 API Key）
2. 或在阿里云控制台充值（按量付费，非常便宜）

---

## 快速开始

```bash
# 一行命令搞定
export DASHSCOPE_API_KEY="你的API Key" && cd /Users/benson/Documents/incident/voice-demo && python3 app-light.py
```

然后浏览器访问：http://localhost:8765
