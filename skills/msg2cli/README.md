# msg2cli - IM → AI CLI 桥接工具

从手机 IM（iMessage/Slack/微信等）发送消息，直接注入到 AI CLI（Qwen/CodeX/CloudCode）并行执行。

## 📁 项目结构

```
msg2cli/
├── src/
│   ├── input/              # 输入源
│   │   ├── base.py         # 输入基类
│   │   ├── imessage.py     # iMessage 输入
│   │   └── slack.py        # Slack 输入（预留）
│   ├── output/             # 输出目标（AI CLI）
│   │   ├── base.py         # 输出基类
│   │   ├── qwen.py         # 通义千问
│   │   ├── codex.py        # CodeX（预留）
│   │   └── cloudcode.py    # CloudCode（预留）
│   ├── reply/              # 回复输出
│   │   ├── base.py         # 回复基类
│   │   └── imessage.py     # iMessage 回复
│   ├── mcp/                # MCP 服务器
│   │   ├── qwen.js         # Qwen Code
│   │   └── claude.js       # Claude Desktop
│   ├── watcher.py          # 监听器（input → output → reply）
│   └── injector.py         # tmux 注入器
├── config/
│   └── config.yaml         # YAML 配置
├── tests/
│   └── test_all.py         # 完整测试套件
├── docs/                   # 文档
├── claude-config.json.example
├── package.json
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
pip3 install pyyaml pytest
```

### 2. 编辑配置
```bash
cp config/config.yaml config/config.local.yaml
# 编辑 config.local.yaml 修改你的联系人和路径
```

### 3. 启动监听器
```bash
python3 src/watcher.py
```

### 4. 运行测试
```bash
cd tests && python3 -m pytest test_all.py -v
```

## 🔄 工作流程

```
📱 手机发送 IM 消息（iMessage/Slack）
    ↓
💻 本地消息数据库更新
    ↓
🔍 watcher.py 轮询检测新消息
    ↓
🤖 注入到 AI CLI（Qwen/CodeX/CloudCode）
    ↓
📤 回复结果到 IM
```

## ⚙️ 配置

编辑 `config/config.yaml`：
- `inputs`: 输入源（iMessage/Slack）
- `outputs`: 输出目标（Qwen/CodeX/CloudCode）
- `routing`: 路由规则（哪个输入 → 哪个输出）
- `reply`: 回复配置

## 📊 资源占用

- CPU: ~1.5%
- 内存: ~13.5 MB
- 适合 7×24 长期运行

## 📖 详细文档

查看 `docs/` 文件夹获取完整的使用指南、架构说明和测试报告。
