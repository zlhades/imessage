# iMessage → Qwen Code 自动执行与回复系统

通过 iMessage 发送指令到 Mac，Qwen Code 自动执行并回复结果。

## 📁 项目结构

```
imessage/
├── src/              # 核心源代码
│   ├── imessage-auto-exec.py      # 自动监听器（主程序）
│   ├── imessage-mcp-server.js     # MCP 服务器（Node.js）
│   ├── imessage-mcp-server.py     # MCP 工具实现（Python）
│   ├── imessage-reply.py          # iMessage 回复模块
│   └── watch_and_inject_v14.py    # tmux 注入监听器
├── docs/             # 完整文档
├── scripts/          # 辅助脚本和工具
├── legacy/           # 历史版本（开发过程）
└── package.json      # Node.js 依赖
```

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动监听器
```bash
python3 src/imessage-auto-exec.py
```

### 3. 在 Qwen Code 中使用
配置 MCP 服务器后，在对话中说：
- "读取 zlhades@icloud.com 的最后一条消息"
- "执行 zlhades@icloud.com 的最后一条消息"

## 📖 详细文档

查看 `docs/` 文件夹：
- `docs/COMPLETE-GUIDE.md` - 完整使用指南
- `docs/MCP-SERVER-README.md` - MCP 服务器配置
- `docs/QUICK-REFERENCE.md` - 快速参考

## ⚙️ 工作原理

```
📱 iPhone 发送 iMessage
    ↓
💻 macOS chat.db 数据库更新
    ↓
🔍 监听器轮询检测新消息（3秒间隔）
    ↓
🤖 Qwen Code 执行指令
    ↓
📤 AppleScript 发送 iMessage 回复
```

## 📊 资源占用

- CPU: ~1.5%
- 内存: ~13.5 MB
- 适合 7×24 长期运行
