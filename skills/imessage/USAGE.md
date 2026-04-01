# iMessage Reader - Qwen Code Skill

读取 iMessage 消息的完整解决方案。

## ✅ 测试结果

所有功能测试通过：
- ✅ 获取最后一条消息
- ✅ 搜索联系人消息
- ✅ 获取联系人列表
- ✅ 导出消息为 JSON

## 📁 文件结构

```
skills/imessage/
├── imessage_skill.py    # 主程序
├── mcp-config.json      # MCP 配置
├── README.md            # 简单说明
├── USAGE.md             # 详细使用文档
└── test.sh              # 测试脚本
```

## 🚀 使用方法

### 方法 1: 命令行直接调用

```bash
# 获取某联系人的最后一条消息
python3 skills/imessage/imessage_skill.py last "+18336801616"

# 搜索消息（最新 N 条）
python3 skills/imessage/imessage_skill.py search "+18336801616" 10

# 查看所有联系人
python3 skills/imessage/imessage_skill.py contacts

# 导出消息为 JSON 文件
python3 skills/imessage/imessage_skill.py export "+18336801616" messages.json
```

### 方法 2: 使用测试脚本

```bash
./skills/imessage/test.sh
```

### 方法 3: MCP 集成（推荐）

已在 `~/.qwen/settings.json` 中配置 MCP 服务器。

重启 Qwen Code 后，可以直接在对话中使用。

## 📋 API 响应格式

### last 命令
```json
{
  "id": 828,
  "text": "Your T&T order 002082922 has been delivered.",
  "date": "2026-02-15 19:07:02",
  "timestamp": 792875222598263040,
  "is_from_me": false,
  "handle": "+18336801616",
  "display_name": ""
}
```

### search 命令
```json
[
  {
    "id": 828,
    "text": "消息内容",
    "date": "2026-02-15 19:07:02",
    "is_from_me": false,
    "handle": "+18336801616"
  }
]
```

### contacts 命令
```json
[
  {"handle": "+18336801616", "display_name": ""},
  {"handle": "jamesjmzhang@icloud.com", "display_name": ""}
]
```

### export 命令
```json
{"file": "/path/to/messages.json"}
```

## ⚠️ 权限要求

需要授予终端 **完全磁盘访问权限**：

1. 打开 **系统设置 > 隐私与安全性 > 完全磁盘访问权限**
2. 添加您的终端应用（如 Terminal、iTerm2）
3. 重启终端后重试

## 📍 数据库位置

macOS iMessage 数据库路径：
```
~/Library/Messages/chat.db
```

## 🔧 故障排除

### 问题 1: 找不到数据库
```
错误：找不到 iMessage 数据库
```
**解决**: 确保在 macOS 系统上运行，且数据库文件存在。

### 问题 2: 权限错误
```
权限错误：无法访问 ~/Library/Messages/chat.db
```
**解决**: 授予终端完全磁盘访问权限（见上文）。

### 问题 3: 消息内容为特殊字符
某些消息可能显示为 `[无内容]` 或特殊字符，这是因为：
- 消息是表情回应（Tapback）
- 消息包含图片或视频
- 消息已被撤回

## 📝 示例

### 示例 1: 查看最近收到的快递通知
```bash
python3 skills/imessage/imessage_skill.py search "T&T" 5
```

### 示例 2: 查找某个邮箱的消息
```bash
python3 skills/imessage/imessage_skill.py search "jamesjmzhang@icloud.com" 10
```

### 示例 3: 导出所有消息备份
```bash
# 需要先获取联系人列表，然后逐个导出
python3 skills/imessage/imessage_skill.py contacts > contacts.json
```

## 🛡️ 隐私声明

- 本工具仅用于访问**您自己的**iMessage 数据
- 所有数据本地处理，不会上传到任何服务器
- 请遵守当地法律法规，不要用于侵犯他人隐私
