# Incident Response + msg2cli

> 本项目包含两个独立但相关的子系统：
> 1. **Slack AI Incident Response Bot** — AI 驱动的事故响应机器人
> 2. **msg2cli** — 从手机 iMessage 发送指令到 AI CLI 的桥接工具

---

## 📁 项目结构

```
incident/
├── src/                         # Slack Bot 主代码 (TypeScript)
├── mcp-servers/                 # MCP 服务器实现
│   ├── slack/                   # Slack MCP Server
│   ├── github/                  # GitHub MCP Server
│   ├── prometheus/              # Prometheus MCP Server
│   ├── file/                    # File MCP Server (本地开发)
│   └── logs/                    # Logs MCP Server (占位)
├── config/                      # YAML 配置
├── data/                        # 运行时数据
├── logs/                        # 日志目录
├── tests/                       # TypeScript 项目测试
│
├── skills/
│   └── msg2cli/                 # iMessage → AI CLI 桥接工具 (Python + Node.js)
│       ├── src/
│       │   ├── input/           # iMessage 输入
│       │   ├── output/          # Qwen 输出注入
│       │   ├── reply/           # iMessage 回复
│       │   ├── mcp/             # MCP Servers
│       │   ├── watcher.py       # 主轮询循环
│       │   └── injector.py      # tmux 注入器
│       ├── config/config.yaml   # msg2cli 配置
│       ├── docs/                # 文档
│       └── tests/               # 测试
│
├── README.md                    # 本文件
├── QUICK-START.md               # Slack Bot 快速开始
├── REQUIREMENTS.md              # 需求规格
├── PLAN.md                      # 实施计划
├── PLAN-MCP-ARCHITECTURE.md     # MCP 架构设计
├── TESTING.md                   # 测试指南
├── COMPLETE.md                  # 完成总结
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 1️⃣ Slack AI Incident Response Bot

### 概述
监控 Slack 频道中的事故讨论，AI 自动分析、调查，生成回复前需人类确认。

### 快速开始

```bash
npm install
npm run dev
```

File 模式（无需 Slack）或 Slack 模式（生产环境）均可使用。

### 详细文档
- [QUICK-START.md](./QUICK-START.md) — 5 分钟上手
- [REQUIREMENTS.md](./REQUIREMENTS.md) — 完整需求
- [PLAN-MCP-ARCHITECTURE.md](./PLAN-MCP-ARCHITECTURE.md) — 架构设计

### 技术栈
| 模块 | 技术 |
|------|------|
| 运行时 | Node.js 20+ / TypeScript |
| MCP | @modelcontextprotocol/sdk |
| AI | Qwen (DashScope) / Claude (Anthropic) |
| 配置 | YAML + dotenv |
| 测试 | Vitest |

---

## 2️⃣ msg2cli — iMessage → AI CLI 桥接

### 概述
从手机发送 iMessage 到电脑 → 自动注入到 AI CLI (Qwen Code) → 执行结果回复回手机。

```
手机 iMessage → watcher.py 轮询 DB → tmux 注入到 Qwen CLI → 捕获输出 → iMessage 回复
```

### 快速开始

```bash
# 1. 配置联系人
# 编辑 skills/msg2cli/config/config.yaml

# 2. 启动 Qwen Code 的 tmux 会话
tmux new-session -d -s qwen
tmux send-keys -t qwen "qwen" Enter

# 3. 启动 Watcher
cd skills/msg2cli
python3 src/watcher.py

# 4. 从手机给 zlhades@icloud.com 发 iMessage，如 "运行 ls -la"
```

### MCP Server 集成
想在 Qwen Code 或 Claude Desktop 中直接读取 iMessage？

```json
// ~/.qwen/settings.json
{
  "mcpServers": {
    "msg2cli": {
      "command": "node",
      "args": ["/Users/benson/Documents/incident/skills/msg2cli/src/mcp/qwen.js"]
    }
  }
}
```

### 详细文档
- [skills/msg2cli/README.md](./skills/msg2cli/README.md) — msg2cli 项目入口
- [skills/msg2cli/docs/USAGE.md](./skills/msg2cli/docs/USAGE.md) — 使用指南

### 技术栈
| 模块 | 技术 |
|------|------|
| 运行时 | Python 3 |
| 数据库 | SQLite (`~/Library/Messages/chat.db`) |
| 终端 | tmux + AppleScript (`osascript`) |
| MCP | Node.js (ESM) |
| 配置 | YAML (pyyaml) |

---

## 🧪 运行测试

```bash
# TypeScript 项目
npm test

# msg2cli (Python)
cd skills/msg2cli
python3 -m pytest tests/ -v
```

---

*最后更新：2026-04-03*
