# 交互式测试指南

> 亲自体验完整的事件响应流程
> 
> **运行方式**: 手动运行或自动演示

---

## 🎮 方式 1: 手动运行（推荐）

### 步骤

```bash
cd /Users/benson/Documents/incident
node tests/interactive-test.js
```

### 测试流程

测试会提示你输入，你可以：

1. **输入数字** 选择预设选项
2. **输入自定义文本** 模拟真实对话
3. **按 Enter** 使用预设内容

### 完整流程

```
步骤 1: 初始事件报告
  → 你输入事件报告（或按 Enter 使用预设）

步骤 2: AI 追问
  → AI 询问具体服务

步骤 3: 队友回复
  → 你扮演队友回复

步骤 4: AI 调查日志
  → AI 分析日志文件

步骤 5: AI 调查代码
  → AI 分析代码和 Commit

步骤 6: AI 生成报告
  → 你选择确认/修改/取消

步骤 7: 队友追问修复
  → 你追问修复方案

步骤 8: AI 提供修复方案
  → 你选择确认/修改/取消

步骤 9: 队友执行修复
  → 模拟执行修复

步骤 10: 事件解决
  → 你输入"已修复 [CLOSED]"

步骤 11: AI 生成总结
  → AI 生成事件总结

步骤 12: 测试完成
  → 显示测试结果
```

---

## 🎬 方式 2: 自动演示

如果你想看自动演示：

```bash
cd /Users/benson/Documents/incident
node tests/test-full-e2e.js
```

这会自动运行完整的 12 步流程，无需手动输入。

---

## 📊 方式 3: 在 Qwen CLI 中测试

如果你想测试真实的 Qwen CLI 集成：

### 1. 复制 Prompt

```bash
cat prompts/incident-monitor.md
```

复制内容到 Qwen CLI 对话中。

### 2. 开始监控

在 Qwen CLI 中说：

```
请监控 data/messages.jsonl
```

### 3. 交互

```
你：检查新消息

AI: [调用工具检查文件]
    📬 发现 2 条新消息:
    ...
```

---

## 📁 测试输出

测试完成后，查看输出文件：

```bash
# 查看对话记录
cat data/interactive-test/incident-channel.txt

# 查看 AI 回复
cat data/interactive-test/bot-output.txt

# 查看会话状态
cat data/states/interactive-session.json

# 查看日志
cat logs/api-service.log
```

---

## ✅ 测试检查清单

测试完成后，验证：

- [ ] 12 个步骤都完成
- [ ] AI 正确追问澄清
- [ ] AI 分析日志并识别模式
- [ ] AI 分析代码和 Commit
- [ ] AI 生成影响面分析
- [ ] AI 提供详细修复方案
- [ ] 写前确认机制工作
- [ ] 结束标记被检测
- [ ] 事件总结正确生成
- [ ] 状态文件正确保存

---

## 🐛 故障排查

### 问题：找不到工具

```
Error: Cannot find module 'tools/incident-monitor.js'
```

**解决**：确保在项目根目录运行

```bash
cd /Users/benson/Documents/incident
node tests/interactive-test.js
```

### 问题：权限错误

```
Error: EACCES: permission denied
```

**解决**：检查目录权限

```bash
chmod -R 755 data/ logs/
```

### 问题： readline 不工作

**解决**：使用自动演示

```bash
node tests/test-full-e2e.js
```

---

## 🎯 下一步

测试通过后：

1. **查看测试报告**
   ```bash
   cat tests/E2E-TEST-REPORT.md
   ```

2. **在 Qwen CLI 中配置**
   ```bash
   cat prompts/incident-monitor.md
   ```

3. **开始使用**
   - 在 Qwen CLI 中激活工具
   - 开始监控真实文件

---

*交互式测试指南 | 2026-03-31*
