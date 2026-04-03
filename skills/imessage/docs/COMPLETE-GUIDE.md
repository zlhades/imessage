# 🚀 iMessage 读取并执行 - 完整指南

## ✅ 已完成功能

你现在可以在 **Qwen Code** 中直接说：

```
执行 zlhades@icloud.com 的最后一条消息
```

Qwen 会：
1. 📱 自动读取 iMessage
2. 🔍 分析消息中的指令
3. 🤖 自动执行指令
4. 📤 **自动发送 Summary 回复到 iMessage（闭环）**

---

## 🔄 闭环功能

**完整工作流：**

```
📱 手机语音输入
    ↓
💬 发送 iMessage 到电脑
    ↓
🤖 Qwen 读取消息
    ↓
🔍 分析指令
    ↓
⚡ 自动执行
    ↓
📤 自动发送 Summary 回复到手机
    ↓
✅ 闭环完成！
```

## 📋 使用方法

### 方法 1: Qwen Code 对话（推荐）

在 Qwen Code 中输入：

```
执行 zlhades@icloud.com 的最后一条消息
```

或

```
读取并执行 zlhades@icloud.com 的消息
```

### 方法 2: 命令行

```bash
# 一键读取并执行
./skills/imessage/imessage-run.py "zlhades@icloud.com"

# 或简写
./skills/imessage/msg "zlhades@icloud.com"
```

### 方法 3: MCP 工具

```bash
# 读取消息
python3 skills/imessage/imessage-mcp-server.py read "zlhades@icloud.com"

# 执行消息
python3 skills/imessage/imessage-mcp-server.py execute "zlhades@icloud.com"
```

---

## 🎯 完整工作流程

```
📱 手机语音输入
    ↓
💬 发送 iMessage 到电脑
    ↓
🤖 Qwen 读取消息
    ↓
🔍 分析指令
    ↓
⚡ 自动执行
```

---

## 📁 已创建的文件

| 文件 | 功能 |
|------|------|
| `imessage-mcp-server.py` | MCP 服务器（读取 + 执行） |
| `imessage-run.py` | 完整执行引擎（带自动回复） |
| `imessage_skill_v2.py` | 消息读取（支持中文） |
| `imessage-reply.py` | 自动回复模块（核心） |
| `imessage-auto-exec.py` | 后台监听器（带自动回复） |
| `imessage-loop.py` | 快速启动脚本 |
| `msg` | 快速查看消息 |
| `send-message` | 发送 iMessage |
| `auto-execute` | 自动执行系统 |

---

## 🧪 测试示例

### 示例 1: 创建文件

**手机发送：**
```
帮我创建一个文件，路径是 /tmp/hello.txt，内容是 Hello World
```

**电脑上运行：**
```bash
./skills/imessage/imessage-run.py "zlhades@icloud.com"
```

**执行结果：**
```
✅ 文件已创建：/tmp/hello.txt
✅ 内容：Hello World
```

---

### 示例 2: 运行命令

**手机发送：**
```
运行 ls -la 命令
```

**电脑上运行：**
```bash
./skills/imessage/imessage-run.py "zlhades@icloud.com"
```

**执行结果：**
```
✅ 命令已执行
✅ 输出：[文件列表]
```

---

### 示例 3: 在 Qwen Code 中

**直接说：**
```
执行 zlhades@icloud.com 的最后一条消息
```

**Qwen 自动：**
1. 调用 MCP 工具读取消息
2. 分析指令
3. 执行任务
4. 返回结果

---

## ⚙️ 配置

### MCP 配置（已完成）

`~/.qwen/settings.json`:

```json
{
  "mcp": {
    "servers": {
      "imessage": {
        "command": "python3",
        "args": ["/Users/benson/Documents/incident/skills/imessage/imessage-mcp-server.py"],
        "description": "iMessage 读取与执行"
      }
    }
  }
}
```

---

## 🎯 未来优化方案

### 方案 1: 快捷指令 + 本地服务器 ⭐⭐⭐⭐⭐

**优点：**
- 快速，无需数据库权限
- 跨设备同步
- 可自定义格式

**实现：**
```python
# 本地服务器
from flask import Flask, request
app = Flask(__name__)

@app.route('/command', methods=['POST'])
def receive_command():
    command = request.json['command']
    # 直接执行
    subprocess.run(command, shell=True)
```

---

### 方案 2: 自动监听新消息 ⭐⭐⭐⭐

**优点：**
- 实时推送
- 无需手动运行命令

**实现：**
```python
# 监听数据库变化
import time

last_message_id = get_last_message_id()
while True:
    current_id = get_last_message_id()
    if current_id != last_message_id:
        execute_new_message()
        last_message_id = current_id
    time.sleep(2)
```

---

### 方案 3: iOS 快捷指令 ⭐⭐⭐⭐

**优点：**
- 原生集成
- 语音触发

**实现：**
- 创建快捷指令
- 发送 HTTP 请求到本地服务器
- 自动执行

---

### 方案 4: Siri 集成 ⭐⭐⭐

**优点：**
- 完全语音控制
- 无需动手

---

## 📖 使用技巧

### 1. 明确指令

**好的指令：**
```
创建一个文件 /tmp/test.txt，内容是 Hello
运行 ls -la 命令
搜索项目中所有的 Python 文件
```

**模糊指令：**
```
帮我做点事情
这个怎么办
```

### 2. 指定联系人

```bash
# 指定特定联系人
./skills/imessage/imessage-run.py "+18336801616"
./skills/imessage/imessage-run.py "james@example.com"
```

### 3. 查看历史消息

```bash
# 查看最近 5 条
python3 skills/imessage/imessage-mcp-server.py search "zlhades@icloud.com" 5
```

---

## ⚠️ 注意事项

1. **权限**：需要授予终端完全磁盘访问权限
2. **数据库**：`~/Library/Messages/chat.db`
3. **仅 macOS**：此功能仅在 macOS 上可用
4. **安全**：谨慎执行来自 iMessage 的指令

---

## 🎉 第一阶段完成！

你的 **iMessage → Qwen 执行** 工作流已经完全打通！

**手机语音输入** → **iMessage** → **Qwen 读取** → **自动执行**

---

*最后更新：2026-04-01*
