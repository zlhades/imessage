# msg2cli - IM → AI CLI 桥接工具

从手机 IM（iMessage）发送消息，直接注入到 AI CLI（Qwen Code）执行，结果自动回复回手机。

## 工作流程

```
📱 手机发送 iMessage 到 zlhades@icloud.com
    ↓
💻 watcher.py 每 3 秒轮询 ~/Library/Messages/chat.db
    ↓
🤖 消息注入到 tmux 中的 Qwen Code 会话
    ↓
📤 执行结果通过 AppleScript 回复到手机 iMessage
```

## 快速开始

### 1. 安装依赖

```bash
# Python 依赖
pip3 install pyyaml pytest

# Node.js 依赖（如需 MCP Server）
npm install
```

### 2. 配置

编辑 `config/config.yaml`：
- `inputs.imessage.contacts` — 监听的联系人
- `outputs.qwen.session` — Qwen Code 的 tmux 会话名
- `reply.imessage.auto_reply_patterns` — 自动回复规则（不注入 AI）

### 3. 启动

```bash
# 先启动 Qwen Code 的 tmux 会话
tmux new-session -d -s ai_cli
tmux send-keys -t ai_cli "qwen" Enter

# 再启动 Watcher
python3 src/watcher.py
```

### 4. 使用

从手机发送 iMessage 到 `zlhades@icloud.com`：
- `运行 ls -la` → 注入到 Qwen 执行 → 结果回复到手机
- `测试` → 自动回复 "✅ 监听器正常工作"（不注入 AI）

## 架构

```
src/
├── input/
│   ├── base.py         # 输入基类
│   └── imessage.py     # iMessage SQLite 读取
├── output/
│   ├── base.py         # 输出基类
│   └── qwen.py         # tmux 注入 + 完成检测
├── reply/
│   ├── base.py         # 回复基类
│   └── imessage.py     # AppleScript 发送
├── injector.py         # tmux 注入器（独立使用）
├── watcher.py          # 主循环（轮询→注入→回复）
├── imessage_db.py      # iMessage 数据库工具
└── mcp/
    └── qwen.js         # MCP Server（5 个工具）
```

## MCP Server 工具

| 工具 | 说明 |
|------|------|
| `msg_read` | 读取联系人的最后一条消息 |
| `msg_search` | 搜索联系人的消息 |
| `msg_auto` | 读取所有监听联系人的最新消息 |
| `msg_execute` | 读取最新消息 + 分析是否包含可执行指令 |
| `msg_status` | 获取 msg2cli 运行状态（日志/统计） |

## 核心特性

- ✅ iMessage SQLite 实时读取
- ✅ tmux 注入 Qwen Code
- ✅ AppleScript 自动回复
- ✅ 自动回复模式（不注入 AI）
- ✅ 防死循环（忽略自动回复消息）
- ✅ 可配置完成/错误标记
- ✅ 执行超时检测（2 分钟）
- ✅ MCP Server 集成

## 运行测试

```bash
cd tests && python3 -m pytest test_all.py -v
```

## 资源占用

- CPU: ~1.5%
- 内存: ~13.5 MB
- 适合 7×24 长期运行
