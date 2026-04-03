# iMessage → AI 自动执行与回复系统

通过 iMessage 发送指令到 Mac，AI（Qwen Code / Claude）自动执行并回复结果。

## 📁 项目结构

```
imessage/
├── src/                          # 核心源代码
│   ├── imessage_db.py            # 数据库模块（读取/查询 iMessage）
│   ├── imessage_reply.py         # 回复模块（AppleScript 发送 iMessage）
│   ├── imessage_auto_exec.py     # 自动监听器（轮询 DB → 执行命令 → 回复）
│   ├── watch_and_inject.py       # tmux 注入监听器（注入消息到 AI 终端）
│   ├── mcp_server_qwen.js        # Qwen Code MCP Server
│   ├── mcp_server_claude.js      # Claude Desktop MCP Server
│   └── send_imessage.py          # 命令行发送工具
├── docs/                         # 文档
├── claude-config.json            # Claude Desktop MCP 配置
└── package.json                  # Node.js 依赖
```

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 选择使用方式

#### 方式 A: 自动监听器（无需 AI 客户端）
```bash
python3 src/imessage_auto_exec.py
```
检测到 "运行 xxx" / "执行 xxx" / "run xxx" 格式的消息时自动执行并回复。

#### 方式 B: Qwen Code + MCP
1. 在 `~/.qwen/settings.json` 中添加：
```json
{
  "mcp": {
    "servers": {
      "imessage": {
        "command": "node",
        "args": ["/PATH/TO/imessage/src/mcp_server_qwen.js"],
        "cwd": "/PATH/TO/imessage"
      }
    }
  }
}
```
2. 重启 Qwen Code，在对话中说 "读取 zlhades@icloud.com 的最后一条消息"

#### 方式 C: Claude Desktop + MCP
1. 编辑 `claude-config.json`，替换路径为你的实际路径
2. 将配置添加到 Claude Desktop 的 MCP 设置中
3. 在对话中让 Claude 读取 iMessage

#### 方式 D: tmux 注入（完整闭环）
```bash
# 1. 创建 tmux 会话并启动 AI
tmux new-session -d -s qwen_imsg
tmux send-keys -t qwen_imsg "qwen" Enter   # 或 claude

# 2. 启动监听器
python3 src/watch_and_inject.py
```
新消息自动注入到 AI 终端执行，结果自动回复到 iMessage。

### 3. 命令行工具
```bash
# 发送消息
python3 src/send_imessage.py zlhades@icloud.com "Hello"

# 读取消息
python3 src/imessage_db.py last zlhades@icloud.com

# 搜索消息
python3 src/imessage_db.py search zlhades@icloud.com 10

# 查看联系人
python3 src/imessage_db.py contacts
```

## 🔄 工作流程

```
📱 iPhone 发送 iMessage
    ↓
💻 macOS chat.db 数据库更新
    ↓
🔍 监听器轮询检测新消息（2-3秒间隔）
    ↓
🤖 AI（Qwen/Claude）执行指令
    ↓
📤 AppleScript 发送 iMessage 回复
```

## ⚙️ 配置

编辑 `src/` 中各文件顶部的配置变量：
- `CONTACT_FILTERS`: 监听的联系人列表
- `REPLY_TO`: 统一回复到的联系人
- `CHECK_INTERVAL`: 轮询间隔（秒）

## 📊 资源占用

- CPU: ~1.5%
- 内存: ~13.5 MB
- 适合 7×24 长期运行

## 📖 详细文档

查看 `docs/` 文件夹获取完整的使用指南、架构说明和测试报告。
