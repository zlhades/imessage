# iMessage Reader Skill

读取 iMessage 消息的 Qwen Code Skill。

## 功能

- 搜索特定联系人的消息
- 获取最新/最后一条消息
- 查看所有联系人列表
- 导出消息为 JSON

## 使用方法

在 Qwen Code 中调用：
```
/imessage search +18336801616
/imessage last +18336801616
/imessage contacts
/imessage export +18336801616
```

## 权限要求

需要授予终端 **完全磁盘访问权限**：
1. 系统设置 > 隐私与安全性 > 完全磁盘访问权限
2. 添加终端应用
3. 重启终端

## 数据库位置

`~/Library/Messages/chat.db`
