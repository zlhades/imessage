# RFC: iMessage Reader MCP Server

**状态**: 已实现  
**版本**: 1.0.0  
**创建日期**: 2026-04-01  
**作者**: iMessage Skill Team

---

## 摘要

本文档描述了 **iMessage Reader MCP Server** 的规范和实现。该服务允许通过 MCP (Model Context Protocol) 协议读取 macOS iMessage 数据库中的消息数据。

## 1. 概述

### 1.1 目标

提供一个标准化的接口，使 AI 助手能够安全地访问用户的 iMessage 数据（需用户授权）。

### 1.2 使用场景

- 查询特定联系人的消息
- 获取最新/最后一条消息
- 导出消息历史记录
- 消息内容分析和总结

### 1.3 系统要求

- macOS 操作系统
- Python 3.8+
- 终端完全磁盘访问权限
- MCP 兼容的 AI 系统

---

## 2. 架构

### 2.1 组件图

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   AI 客户端      │────▶│   MCP 服务器      │────▶│  iMessage 数据库 │
│  (Qwen/Claude)  │◀────│  (imessage_skill) │◀────│   (chat.db)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### 2.2 数据流

1. AI 客户端发送 MCP 请求
2. MCP 服务器解析请求
3. 查询 SQLite 数据库
4. 返回 JSON 格式结果

---

## 3. MCP 服务器配置

### 3.1 配置文件位置

```json
// ~/.qwen/settings.json 或 MCP 客户端配置
{
  "mcp": {
    "servers": {
      "imessage": {
        "command": "python3",
        "args": ["/path/to/imessage_skill.py"],
        "description": "读取 iMessage 消息"
      }
    }
  }
}
```

### 3.2 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `CHAT_DB_PATH` | 自定义数据库路径 | `~/Library/Messages/chat.db` |

---

## 4. API 规范

### 4.1 工具/方法列表

iMessage MCP Server 暴露以下工具：

#### 4.1.1 `imessage_last`

获取指定联系人的最后一条消息。

**参数**:
```typescript
{
  contact: string  // 联系人姓名、电话或邮箱
}
```

**返回**:
```typescript
{
  id: number
  text: string
  date: string       // 格式化日期 "YYYY-MM-DD HH:MM:SS"
  timestamp: number  // iMessage 时间戳
  is_from_me: boolean
  handle: string
  display_name: string | null
} | null
```

**示例**:
```json
// 请求
{
  "tool": "imessage_last",
  "arguments": {
    "contact": "+18336801616"
  }
}

// 响应
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

---

#### 4.1.2 `imessage_search`

搜索指定联系人的消息。

**参数**:
```typescript
{
  contact: string    // 联系人姓名、电话或邮箱
  limit?: number     // 返回数量限制，默认 20
}
```

**返回**:
```typescript
Message[]  // 消息数组
```

**示例**:
```json
// 请求
{
  "tool": "imessage_search",
  "arguments": {
    "contact": "+18336801616",
    "limit": 5
  }
}

// 响应
[
  {
    "id": 828,
    "text": "Your T&T order 002082922 has been delivered.",
    "date": "2026-02-15 19:07:02",
    "is_from_me": false,
    "handle": "+18336801616"
  }
]
```

---

#### 4.1.3 `imessage_contacts`

获取所有联系人列表。

**参数**: 无

**返回**:
```typescript
{
  handle: string
  display_name: string | null
}[]
```

**示例**:
```json
// 响应
[
  {"handle": "+18336801616", "display_name": ""},
  {"handle": "jamesjmzhang@icloud.com", "display_name": "James"}
]
```

---

#### 4.1.4 `imessage_export`

导出联系人消息为 JSON 文件。

**参数**:
```typescript
{
  contact: string
  output_file?: string  // 输出文件路径，默认 "messages.json"
}
```

**返回**:
```typescript
{
  file: string  // 导出文件的绝对路径
}
```

---

## 5. 命令行接口 (CLI)

### 5.1 使用方式

```bash
python3 imessage_skill.py <command> [arguments]
```

### 5.2 命令

| 命令 | 参数 | 说明 |
|------|------|------|
| `last` | `<contact>` | 获取最后一条消息 |
| `search` | `<contact> [limit]` | 搜索消息 |
| `contacts` | - | 查看所有联系人 |
| `export` | `<contact> [output]` | 导出消息 |

### 5.3 示例

```bash
# 获取最后一条消息
python3 imessage_skill.py last "+18336801616"

# 搜索 5 条消息
python3 imessage_skill.py search "+18336801616" 5

# 查看联系人
python3 imessage_skill.py contacts

# 导出消息
python3 imessage_skill.py export "+18336801616" /tmp/messages.json
```

---

## 6. 数据模型

### 6.1 Message

```typescript
interface Message {
  id: number           // 消息唯一 ID
  text: string         // 消息内容
  date: string         // 格式化日期
  timestamp: number    // 原始时间戳 (纳秒，2001 纪元)
  is_from_me: boolean  // 是否为我发送
  handle: string       // 联系人标识 (电话/邮箱)
  display_name: string | null  // 显示名称
}
```

### 6.2 Contact

```typescript
interface Contact {
  handle: string       // 联系人标识
  display_name: string | null  // 显示名称
}
```

---

## 7. 错误处理

### 7.1 错误码

| 错误码 | 说明 |
|--------|------|
| `NOT_FOUND` | 未找到消息或联系人 |
| `PERMISSION_DENIED` | 权限不足 |
| `DATABASE_ERROR` | 数据库错误 |
| `INVALID_ARGUMENT` | 参数无效 |

### 7.2 错误响应格式

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "请授予终端完全磁盘访问权限"
  }
}
```

---

## 8. 安全与隐私

### 8.1 权限要求

- **完全磁盘访问权限**: 访问 `~/Library/Messages/chat.db`

### 8.2 数据保护

- 所有数据本地处理，不上传到外部服务器
- 仅支持访问当前用户的消息数据
- 不支持修改或删除消息

### 8.3 用户同意

使用前必须获得用户明确同意。

---

## 9. 实现参考

### 9.1 核心代码结构

```python
# imessage_skill.py

import sqlite3
import json
from datetime import datetime, timedelta

CHAT_DB_PATH = "~/Library/Messages/chat.db"

def search_contact_messages(contact: str, limit: int = 20) -> list:
    """搜索联系人消息"""
    conn = sqlite3.connect(CHAT_DB_PATH)
    cursor = conn.cursor()
    
    query = """
    SELECT m.text, m.date, m.is_from_me, h.id as handle_id
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.rowid
    WHERE h.id LIKE ?
    ORDER BY m.date DESC
    LIMIT ?
    """
    
    cursor.execute(query, (f"%{contact}%", limit))
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return results
```

### 9.2 时间戳转换

```python
def format_timestamp(timestamp: int) -> str:
    """iMessage 时间戳转人类可读格式"""
    epoch = datetime(2001, 1, 1)
    seconds = timestamp / 1_000_000_000
    message_date = epoch + timedelta(seconds=seconds)
    return message_date.strftime("%Y-%m-%d %H:%M:%S")
```

---

## 10. 测试

### 10.1 测试脚本

```bash
# 运行完整测试
./test.sh

# 单项测试
python3 imessage_skill.py last "+18336801616"
python3 imessage_skill.py search "+18336801616" 5
python3 imessage_skill.py contacts
python3 imessage_skill.py export "+18336801616" test.json
```

### 10.2 测试用例

| ID | 测试项 | 预期结果 |
|----|--------|----------|
| T001 | 获取最后一条消息 | 返回 Message 对象 |
| T002 | 搜索不存在联系人 | 返回空数组 |
| T003 | 获取联系人列表 | 返回 Contact 数组 |
| T004 | 导出消息 | 创建 JSON 文件 |

---

## 11. 故障排除

### 11.1 常见问题

**Q: 找不到数据库？**
```
错误：找不到 iMessage 数据库
```
**A**: 确保在 macOS 系统上运行，数据库路径为 `~/Library/Messages/chat.db`

**Q: 权限错误？**
```
权限错误：无法访问数据库
```
**A**: 授予终端完全磁盘访问权限（系统设置 > 隐私与安全性）

**Q: 消息内容为空？**
```
text: "[无内容]"
```
**A**: 可能是表情回应、媒体文件或已撤回的消息

---

## 12. 参考资料

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- macOS iMessage 数据库结构分析

---

## 13. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-04-01 | 初始版本 |

---

## 14. 附录

### A. 数据库表结构

```sql
-- 主要表
message          -- 消息表
handle           -- 联系人表
chat             -- 聊天表
chat_handle_join -- 聊天 - 联系人关联表
chat_message_join -- 聊天 - 消息关联表
```

### B. 完整配置示例

```json
{
  "mcp": {
    "servers": {
      "imessage": {
        "command": "python3",
        "args": ["/Users/username/Documents/project/skills/imessage/imessage_skill.py"],
        "description": "读取 iMessage 消息",
        "env": {
          "CHAT_DB_PATH": "/Users/username/Library/Messages/chat.db"
        }
      }
    }
  }
}
```

---

**文档结束**
