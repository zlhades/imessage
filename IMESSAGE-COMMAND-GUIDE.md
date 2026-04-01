# iMessage Command Guide

通过 iMessage 语音输入高效地向 Qwen Code 发送命令。

---

## 🎯 第一阶段：当前实现

### 核心功能

1. ✅ 用手机语音输入发送 iMessage 到电脑
2. ✅ 在终端用命令行读取消息
3. ✅ 在 Qwen Code 中执行命令

### 使用方法

#### 方式 1: 读取最新消息 (推荐)

```bash
# 读取最新的 iMessage 命令
python3 imessage_command.py

# 或简写为
./imessage_command.py
```

#### 方式 2: 读取特定联系人的消息

```bash
# 按邮箱搜索
python3 imessage_command.py --contact hotmail

# 按电话搜索
python3 imessage_command.py --contact 1234567890

# 按昵称搜索
python3 imessage_command.py --contact "张三"
```

#### 方式 3: 读取最近多条消息

```bash
# 读取最近 5 条
python3 imessage_command.py --limit 5

# 读取最近 10 条
python3 imessage_command.py --limit 10
```

#### 方式 4: 查看原始内容

```bash
# 显示原始文本 (用于调试乱码)
python3 imessage_command.py --raw
```

### 参数说明

| 参数 | 简写 | 说明 |
|------|------|------|
| `--contact` | `-c` | 联系人 (邮箱/电话/昵称) |
| `--limit` | `-l` | 返回消息数量 (默认 1) |
| `--raw` | `-r` | 显示原始内容 |
| `--all` | `-a` | 包含自己发送的消息 |
| `--help` | `-h` | 显示帮助 |

### 输出示例

```
======================================================================
📱 iMessage Command
======================================================================
📅 时间：2026-04-01 07:50:42
👤 发送者：对方
📞 联系人：zlhades@icloud.com
💬 消息内容:
   我是想做这样的事情，第一阶段我想做的就是：
   1. 发一个 iMessage 到电脑
   2. 在千问里面用一个命令行去读这个信息
   3. 在千问里面执行
   ...

🎯 提取的命令/指令:
   [自动识别并显示可执行的命令]
======================================================================
```

---

## 🔧 权限设置

首次使用需要授予终端"完全磁盘访问权限":

1. 打开 **系统设置 > 隐私与安全性 > 完全磁盘访问权限**
2. 添加您的终端应用 (Terminal/iTerm2)
3. 重启终端后重试

---

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `imessage_command.py` | 主命令行工具 (推荐) |
| `imessage_first.py` | 读取单条消息 (简化版) |
| `imessage_reader.py` | 交互式搜索工具 |

---

## 🚀 未来更好的方案

### 方案 1: Qwen Code 内置命令 (推荐) ⭐⭐⭐⭐⭐

**优势**: 直接在 Qwen Code 对话中读取，无需切换终端

```bash
# 在 Qwen Code 中直接执行
/imessage read
/imessage search <联系人>
```

**实现方式**:
- 创建 MCP Server 读取 iMessage
- 在 Qwen Code 中注册为工具

---

### 方案 2: 快捷键触发 (推荐) ⭐⭐⭐⭐

**优势**: 一键读取并自动执行

```bash
# 创建 Automator 快捷操作
# 或使用 Raycast/Alfred 插件

# 示例：Raycast 命令
imessage-command --latest --execute
```

**实现方式**:
- 创建 Raycast/Alfred 扩展
- 绑定全局快捷键 (如 ⌘+Shift+M)

---

### 方案 3: 自动监听新消息 (高级) ⭐⭐⭐⭐

**优势**: 新消息到达时自动通知 Qwen Code

```python
# 后台监听进程
# 检测到新命令时自动触发

import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
```

**实现方式**:
- 使用 FSEvents 监听数据库变化
- 后台进程轮询新消息
- WebSocket 推送通知

---

### 方案 4: 专用 iOS 快捷指令 ⭐⭐⭐

**优势**: 一键发送格式化命令

```
[快捷指令]
1. 语音输入 → 文本
2. 添加时间戳和命令前缀
3. 发送到指定联系人
```

**格式示例**:
```
[CMD] 2026-04-01 08:00:00
执行以下操作：
1. ...
2. ...
```

---

### 方案 5: 集成 Siri ⭐⭐⭐

**优势**: 完全语音控制

```
"Hey Siri, tell Qwen to check the latest logs"
```

**实现方式**:
- 创建 Siri Shortcuts
- 调用 iOS 快捷指令
- 通过 iCloud 同步到 Mac

---

## 📊 方案对比

| 方案 | 效率 | 实现难度 | 推荐度 |
|------|------|----------|--------|
| 当前 CLI 工具 | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ |
| Qwen Code 内置 | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| 快捷键触发 | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| 自动监听 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| iOS 快捷指令 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Siri 集成 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 🎯 下一步建议

**立即可做**:
1. ✅ 当前 CLI 工具已完成
2. 创建 Raycast/Alfred 快捷命令
3. 设置全局快捷键

**未来优化**:
1. 创建 MCP iMessage Server
2. 在 Qwen Code 中直接调用
3. 添加自动执行功能

---

## 📝 使用示例

### 示例 1: 快速读取并执行

```bash
# 1. 读取命令
python3 imessage_command.py

# 2. 复制命令内容

# 3. 在 Qwen Code 中粘贴执行
```

### 示例 2: 搜索特定联系人

```bash
# 搜索包含 "工作" 的联系人
python3 imessage_command.py --contact 工作 --limit 3
```

### 示例 3: 查看最近的命令历史

```bash
# 查看最近 10 条消息，回顾之前的命令
python3 imessage_command.py --limit 10
```

---

*最后更新：2026-04-01*
