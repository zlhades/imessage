# 🔄 iMessage 闭环自动回复功能

## 🎯 功能概述

现在你的 iMessage 系统已经形成了完整的闭环：

```
📱 你发送 iMessage 指令
    ↓
💻 系统读取并分析
    ↓
🤖 自动执行指令
    ↓
📤 自动发送 Summary 回复给你
    ↓
✅ 闭环完成！
```

---

## 📁 新增文件

| 文件 | 功能 |
|------|------|
| `imessage-reply.py` | 自动回复模块（核心） |
| `imessage-run.py` | 执行引擎（已更新） |
| `imessage-auto-exec.py` | 自动监听器（已更新） |

---

## 🚀 使用方法

### 方法 1: 手动执行（带自动回复）

```bash
python3 imessage-run.py "zlhades@icloud.com"
```

**流程：**
1. 读取联系人的最后一条消息
2. 发送"📥 收到指令，正在处理..."回复
3. 调用 Qwen 分析并执行
4. 发送详细 Summary 回复（包含执行结果、耗时等）

---

### 方法 2: 自动监听（带自动回复）

```bash
python3 imessage-auto-exec.py
```

**流程：**
1. 后台持续监听 iMessage 数据库
2. 检测到新消息时自动识别指令
3. 发送"📥 收到指令，正在执行..."回复
4. 执行简单命令（运行/执行/create/创建文件）
5. 发送 Summary 回复

---

## 📤 自动回复类型

### 1️⃣ 快速回复（立即发送）

当收到指令时立即回复：
```
📥 收到指令，正在处理...
```

---

### 2️⃣ 简洁 Summary（执行完成）

```
✅ 指令已执行
📥 收到：帮我创建一个文件 /tmp/test.txt
📤 结果：文件已创建：/tmp/test.txt，内容：Hello World
```

---

### 3️⃣ 详细 Summary（分多条消息）

**消息 1 - 执行状态：**
```
╔═══════════════════════════╗
║   🤖 iMessage 执行完成     ║
╚═══════════════════════════╝
⏰ 时间：19:45:32
⏱️  耗时：2.5 秒
```

**消息 2 - 原始指令：**
```
📥 原始指令:
运行 ls -la 命令，查看当前目录的所有文件
```

**消息 3 - 执行结果：**
```
📤 执行结果:
total 48
drwxr-xr-x  1 user  staff   32 Jan  1 12:00 .
drwxr-xr-x  1 user  staff   32 Jan  1 12:00 ..
```

**消息 4 - 分析信息：**
```
🔍 分析:
• 类型：command_execution
• 状态：成功
```

---

### 4️⃣ 错误通知

```
❌ 执行失败
📥 收到：运行一个不存在的命令
⚠️ 错误：/bin/sh: command not found
```

---

### 5️⃣ 超时通知

```
⏰ 执行超时
📥 收到：运行一个很耗时的命令...
⚠️ 命令执行时间超过限制，已终止
```

---

## 🧪 测试示例

### 示例 1: 创建文件

**发送：**
```
帮我创建一个文件，路径是 /tmp/hello.txt，内容是 Hello World
```

**收到回复：**
```
📥 收到指令，正在处理...

✅ 指令已执行
📥 收到：帮我创建一个文件，路径是 /tmp/hello.txt...
📤 结果：文件已创建：/tmp/hello.txt
```

---

### 示例 2: 运行命令

**发送：**
```
运行 ls -la 命令
```

**收到回复：**
```
📥 收到指令，正在执行...

✅ 指令已执行
📥 收到：运行 ls -la 命令
📤 结果：total 48\ndrwxr-xr-x  1 user  staff...
```

---

### 示例 3: 测试回复模块

```bash
python3 imessage-reply.py "zlhades@icloud.com"
```

会自动发送 4 条测试消息到指定联系人。

---

## 🔧 API 参考

### `send_imessage(contact, message)`

发送单条 iMessage。

```python
from imessage-reply import send_imessage

send_imessage("zlhades@icloud.com", "Hello World!")
```

---

### `send_summary(contact, original_message, execution_result, success=True)`

发送简洁 Summary。

```python
send_summary(
    contact="zlhades@icloud.com",
    original_message="运行 ls -la",
    execution_result="total 48\ndrwxr-xr-x...",
    success=True
)
```

---

### `send_detailed_summary(contact, original_message, analysis, execution_result, duration=0)`

发送详细 Summary（分多条消息）。

```python
send_detailed_summary(
    contact="zlhades@icloud.com",
    original_message="运行 ls -la 命令",
    analysis={"type": "command_execution", "status": "成功"},
    execution_result="total 48\ndrwxr-xr-x...",
    duration=2.5
)
```

---

### `send_quick_reply(contact, message)`

发送快速回复。

```python
send_quick_reply("zlhades@icloud.com", "📥 收到指令，正在处理...")
```

---

### `send_error_notification(contact, error_message, original_message=None)`

发送错误通知。

```python
send_error_notification(
    contact="zlhades@icloud.com",
    error_message="Command not found",
    original_message="运行不存在的命令"
)
```

---

## 📊 完整工作流

```
┌─────────────────────────────────────────────────────────┐
│  1. 📱 你发送 iMessage 指令到 zlhades@icloud.com         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  2. 💻 监听器检测到新消息 (每 3 秒检查一次)                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  3. 📤 立即发送快速回复："📥 收到指令，正在处理..."        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  4. 🤖 分析消息内容，识别指令类型                         │
│     - 运行/执行 xxx → 执行 shell 命令                      │
│     - 创建文件 xxx → 创建文件                           │
│     - 其他 → 调用 Qwen 分析                               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  5. ⚡ 执行指令                                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  6. 📤 发送 Summary 回复                                 │
│     - 成功：✅ 指令已执行 + 结果                         │
│     - 失败：❌ 执行失败 + 错误信息                       │
│     - 超时：⏰ 执行超时 + 提示                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  7. ✅ 闭环完成！你在 iMessage 中看到执行结果              │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ 配置选项

### 监听联系人过滤

编辑 `imessage-auto-exec.py`：

```python
CONTACT_FILTERS = ["zlhades@icloud.com", "zlhades@hotmail.com"]
```

---

### 检查间隔

```python
CHECK_INTERVAL = 3  # 每 3 秒检查一次
```

---

### 执行超时

```python
# 简洁模式（自动监听器）
timeout=30  # 30 秒超时

# 详细模式（手动执行）
timeout=120  # 120 秒超时
```

---

## ⚠️ 注意事项

1. **权限要求**：需要授予终端/应用完全磁盘访问权限
2. **iMessage 服务**：需要登录 iMessage
3. **联系人匹配**：确保发送者邮箱/手机号在监听列表中
4. **消息长度**：长消息会自动截断（简洁版 100 字符，详细版 200 字符）

---

## 🎉 使用场景

### 场景 1: 远程执行命令

**你在外面，突然需要运行一个命令：**

1. 手机发送：`运行 cd /var/log && ls -la`
2. 电脑自动执行
3. 手机收到执行结果

---

### 场景 2: 快速创建文件

**需要临时创建一个文件：**

1. 手机发送：`创建文件 /tmp/notes.txt，内容是 Meeting at 3pm`
2. 电脑自动创建
3. 手机收到确认回复

---

### 场景 3: 自动化工作流

**配合快捷指令使用：**

1. iOS 快捷指令触发 → 发送 iMessage
2. 电脑自动执行
3. 结果推送回手机

---

## 📝 日志查看

```bash
# 实时查看执行日志
tail -f /tmp/imessage-auto-exec.log
```

日志会记录：
- 收到的消息
- 执行的命令
- 发送的回复
- 错误信息

---

## 🔄 重启监听器

```bash
# 停止旧进程
pkill -f imessage-auto-exec.py

# 启动新进程
python3 /Users/benson/Documents/incident/skills/imessage/imessage-auto-exec.py &
```

---

## ✅ 闭环完成！

现在你的 iMessage 系统已经完全自动化：

**发送指令 → 自动执行 → 收到 Summary**

随时随地，用手机控制你的电脑！📱💻

---

*最后更新：2026-04-01*
