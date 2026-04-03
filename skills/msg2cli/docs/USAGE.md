# msg2cli - 使用指南

> 从手机 iMessage 发送指令 → 自动注入到 AI CLI (Qwen Code) → 结果回复回手机

## 快速开始

### 1. 配置联系人

编辑 `config/config.yaml`:

```yaml
inputs:
  imessage:
    contacts:
      - "zlhades@icloud.com"
      - "zlhades@hotmail.com"
```

### 2. 启动 Qwen Code 的 tmux 会话

```bash
tmux new-session -d -s qwen
# 在 tmux 中启动 Qwen Code
tmux send-keys -t qwen "qwen" Enter
```

### 3. 启动 Watcher

```bash
cd skills/msg2cli
python3 src/watcher.py
```

### 4. 从手机发送 iMessage

给 `zlhades@icloud.com` 发送消息，如：
- `运行 ls -la`
- `创建文件 /tmp/test.txt，内容是 Hello`

系统会自动：
1. 检测到新消息
2. 注入到 Qwen Code 的 tmux 会话
3. 等待执行完成
4. 通过 iMessage 回复结果

## 配置说明

```yaml
# config/config.yaml
inputs:
  imessage:
    contacts:
      - "your_contact@email.com"  # 监听的联系人
    check_interval: 3              # 轮询间隔（秒）

outputs:
  qwen:
    command: "qwen"                # AI CLI 命令
    session: "qwen"                # tmux 会话名
    prompt_suffix: ""              # 提示符后缀

routing:
  default_output: "qwen"           # 默认输出目标

reply:
  imessage:
    reply_to: ""                   # 回复到哪个联系人
```

## MCP Server 集成

如果想在 Qwen Code 或 Claude Desktop 中直接读取 iMessage，配置 MCP Server：

### Qwen Code

在 `~/.qwen/settings.json` 中添加：

```json
{
  "mcpServers": {
    "msg2cli": {
      "command": "node",
      "args": ["/Users/benson/Documents/incident/skills/msg2cli/src/mcp/qwen.js"]
    }
  }
}
```

### Claude Desktop

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "msg2cli": {
      "command": "node",
      "args": ["/Users/benson/Documents/incident/skills/msg2cli/src/mcp/claude.js"]
    }
  }
}
```

### 可用的 MCP 工具

| 工具 | 说明 |
|------|------|
| `msg_read` | 读取指定联系人的消息 |
| `msg_search` | 搜索联系人消息 |
| `msg_auto` | 自动分析并执行消息中的指令 |
| `msg_execute` | 执行指定联系人的消息 |

## 故障排查

### 权限问题
系统设置 → 隐私与安全性 → 完全磁盘访问权限 → 添加 Terminal

### 找不到 tmux 会话
确认 Qwen Code 已在 tmux 会话中运行：`tmux ls`

### 无法发送 iMessage
确认 Messages 应用已打开，且已授予磁盘访问权限

## 项目结构

```
skills/msg2cli/
├── config/config.yaml           # 配置文件
├── src/
│   ├── input/imessage.py        # iMessage 输入源
│   ├── output/qwen.py           # Qwen 输出注入
│   ├── reply/imessage.py        # iMessage 回复
│   ├── watcher.py               # 主轮询循环
│   ├── injector.py              # tmux 注入器
│   ├── imessage_db.py           # iMessage 数据库工具
│   └── mcp/
│       ├── qwen.js              # Qwen MCP Server
│       └── claude.js            # Claude MCP Server
├── tests/test_all.py            # 测试套件
├── docs/
│   ├── USAGE.md                 # 本文件
│   └── MCP-SERVER-README.md     # MCP Server 说明
└── claude-config.json.example   # Claude 配置示例
```
