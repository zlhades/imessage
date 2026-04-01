# 🚀 iMessage 闭环系统 - 快速参考卡

## 📋 一分钟上手

### 启动自动监听器
```bash
python3 imessage-auto-exec.py &
```

### 发送指令（从手机）
发送 iMessage 到 `zlhades@icloud.com`：
- `运行 ls -la`
- `创建文件 /tmp/test.txt，内容是 Hello`

### 收到回复
1. 📥 收到指令，正在执行...
2. ✅ 指令已执行 + 结果

---

## 🔧 常用命令

```bash
# 启动监听器
python3 imessage-auto-exec.py &

# 查看日志
tail -f /tmp/imessage-auto-exec.log

# 手动执行一次
python3 imessage-run.py "zlhades@icloud.com"

# 测试回复模块
python3 imessage-reply.py "zlhades@icloud.com"

# 停止监听器
pkill -f imessage-auto-exec.py
```

---

## 📤 回复类型

| 类型 | 触发条件 | 示例 |
|------|---------|------|
| 📥 快速回复 | 收到指令 | "收到指令，正在处理..." |
| ✅ 简洁 Summary | 执行成功 | "指令已执行 + 结果" |
| 📊 详细 Summary | 手动执行 | 4 条消息（状态/指令/结果/分析） |
| ❌ 错误通知 | 执行失败 | "执行失败 + 错误信息" |
| ⏰ 超时通知 | 超过时限 | "执行超时（30 秒）" |

---

## 🎯 支持的指令

### 自动识别（监听器）
- `运行 <命令>` - 执行 shell 命令
- `执行 <命令>` - 执行 shell 命令
- `run <command>` - 执行 shell 命令
- `创建文件 <路径>` - 创建文件
- `create file <path>` - 创建文件

### Qwen 分析（手动执行）
任何自然语言指令，如：
- `帮我创建一个 Python 项目`
- `搜索所有的日志文件`
- `整理这个目录的文件`

---

## ⚙️ 配置位置

```bash
# 监听联系人
imessage-auto-exec.py → CONTACT_FILTERS

# 检查间隔
imessage-auto-exec.py → CHECK_INTERVAL

# MCP 配置
~/.qwen/settings.json
```

---

## 📁 核心文件

| 文件 | 作用 |
|------|------|
| `imessage-reply.py` | 回复模块（核心 API） |
| `imessage-auto-exec.py` | 自动监听器 |
| `imessage-run.py` | 手动执行引擎 |
| `imessage-loop.py` | 快速启动 |

---

## 🐛 故障排查

### 无法发送 iMessage
```bash
# 检查 Messages 应用是否运行
osascript -e 'tell application "Messages" to get service 1'
```

### 权限问题
系统设置 → 隐私与安全性 → 完全磁盘访问权限 → 添加 Terminal

### 监听器无响应
```bash
# 重启监听器
pkill -f imessage-auto-exec.py
python3 imessage-auto-exec.py &
```

---

## 📖 完整文档

- `AUTO-REPLY-CLOSED-LOOP.md` - 闭环功能详解
- `COMPLETE-GUIDE.md` - 完整使用指南
- `CLOSED-LOOP-SUMMARY.md` - 功能总结

---

*快速参考 - 2026-04-01*
