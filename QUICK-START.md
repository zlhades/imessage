# Quick Start — 快速开始

## 🚀 Slack AI Incident Response Bot

### File 模式（推荐，无需 Slack Token）

```bash
# 1. 安装依赖
npm install

# 2. 构建 File MCP Server
cd mcp-servers/file && npm install && npm run build && cd ../..

# 3. 创建示例消息
node dist/file-mode.js --create-sample

# 4. 运行
npm run dev
```

### Slack 模式（生产环境）

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 SLACK_BOT_TOKEN 等

# 2. 构建 Slack MCP Server
cd mcp-servers/slack && npm install && npm run build && cd ../..

# 3. 修改 config/mcp.yaml：启用 slack，禁用 file

# 4. 运行
npm run dev
```

### 运行测试

```bash
npm test
```

---

## 🚀 msg2cli — iMessage → AI CLI

```bash
# 1. 配置联系人
# 编辑 skills/msg2cli/config/config.yaml

# 2. 启动 Qwen Code 的 tmux 会话
tmux new-session -d -s qwen
tmux send-keys -t qwen "qwen" Enter

# 3. 启动 Watcher
cd skills/msg2cli
python3 src/watcher.py

# 4. 从手机给 zlhades@icloud.com 发 iMessage
#    例如："运行 ls -la"
```

### 运行测试

```bash
cd skills/msg2cli
python3 -m pytest tests/ -v
```

---

## 📖 下一步

| 文档 | 说明 |
|------|------|
| [README.md](./README.md) | 项目入口 + 结构导航 |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | 完整需求规格 |
| [PLAN-MCP-ARCHITECTURE.md](./PLAN-MCP-ARCHITECTURE.md) | MCP 架构设计 |
| [skills/msg2cli/README.md](./skills/msg2cli/README.md) | msg2cli 项目入口 |
| [skills/msg2cli/docs/USAGE.md](./skills/msg2cli/docs/USAGE.md) | msg2cli 使用指南 |

---

*最后更新：2026-04-03*
