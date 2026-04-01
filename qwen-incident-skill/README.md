# Qwen Incident Response Skill

> 基于 Qwen 生态的低频 Incident 响应智能体系统
> 
> **零代码 · 中文原生 · 成本极低**

---

## 🎯 核心目标

构建一个**非驻守型、按需触发**的生产事故（Incident）分析系统：

| 特性 | 说明 |
|------|------|
| **频率** | 低频（每日 1-2 次） |
| **触发** | 人工手动触发（CLI 命令） |
| **核心** | 低成本、高可靠性、中文最佳理解 |

---

## 🚀 快速开始

### 1. 安装依赖

```bash
# 安装 Qwen Code CLI
npm install -g @anthropics/qwen-code-cli

# 配置 API Key
export QWEN_API_KEY=sk-...
```

### 2. 准备上下文

```bash
cd qwen-incident-skill

# 编辑 context.txt，粘贴 Slack 讨论和日志
vim context.txt
```

### 3. 启动智能体

```bash
./run.sh
```

---

## 📁 目录结构

```
qwen-incident-skill/
├── prompt_template.txt  # 核心：标准化的系统提示词
├── context.txt          # 输入：Slack 消息或日志片段
├── run.sh               # 脚本：一键启动命令
└── README.md            # 本文档
```

---

## 💡 使用流程

### 步骤 1: 收集上下文

将 Slack 线程中的关键信息复制到 `context.txt`：

```text
## Slack 讨论记录

[10:01] oncall: 支付服务报错 503，有人知道吗？
[10:05] dev1: 我看看...发现数据库连接池满
[10:08] sre1: 监控显示 CPU 正常，内存 80%

## 错误日志

2026-03-31 10:01:00 ERROR [payment-service] Connection pool exhausted
2026-03-31 10:02:15 ERROR [payment-service] Timeout waiting for connection
```

### 步骤 2: 启动智能体

```bash
./run.sh
```

智能体将：
1. **PM** 评估影响范围
2. **SRE** 分析根因
3. **Dev** 设计修复方案
4. 生成结构化报告

### 步骤 3: 迭代更新（Human-in-the-loop）

如果 Slack 传来新消息：

```bash
# 1. 追加新消息到 context.txt
vim context.txt

# 2. 在对话框中告知智能体
"注意：context.txt 已更新，包含最新状态，请 SRE 和 PM 重新评估"
```

智能体将自动修正之前的分析。

---

## 📋 Prompt 模板详解

### 角色定义

```
你是一个由 PM、SRE 和高级开发工程师组成的精英事故响应团队。
```

### 工作流

1. **独立分析**
   - PM：业务影响
   - SRE：根因分析
   - Dev：修复方案

2. **协作讨论**
   - 交叉验证
   - 信息不足时追问

3. **迭代更新**
   - 支持 context.txt 动态更新
   - 自动重新评估

4. **最终输出**
   - 结构化 Markdown 报告

### 输出格式

```markdown
## 🚨 事故报告

### 摘要
...

### 时间线
| 时间 | 事件 |
|------|------|
| 10:01 | 支付服务报错 503 |
| 10:05 | 发现数据库连接池满 |

### 根因分析
...

### 修复方案
1. 临时措施：重启服务
2. 短期修复：增加连接池大小
3. 长期预防：连接泄漏检测

### 后续行动
- [ ] 添加连接池监控告警
- [ ] Code Review 检查连接释放
```

---

## 🎯 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| **模型** | Qwen-Max / Qwen3-Coder | 中文理解最强 |
| **环境** | Qwen Code CLI | 命令行友好 |
| **编排** | Teammate Mode | 多智能体协作 |
| **技能** | 本地 Prompt 模板 | 零代码开发 |

---

## ✅ 关键优势

### 1. 零代码开发

无需编写 Python 脚本或配置 LangGraph：

```
❌ 之前：几百行 Python + LangGraph 状态机
✅ 现在：一个文本文件定义所有逻辑
```

### 2. 中文原生支持

Qwen 对中国技术栈理解更深刻：

- 阿里云、钉钉、自研中间件
- 中文技术术语准确理解
- 符合中国公司工作流程

### 3. 成本极低

| 方案 | 成本 |
|------|------|
| 常驻服务 | $50-100/月 |
| 本方案 | ~$0.01/次 |

### 4. 灵活迭代

通过文件更新解决"上下文动态变化"：

```bash
# 简单追加即可
cat >> context.txt << 'EOF'
[10:15] oncall: 运维重启了服务，暂时恢复
EOF

# 告知智能体重新评估
```

---

## 🆚 与之前方案对比

| 特性 | Python+LangGraph | Qwen Prompt Skill |
|------|-----------------|-------------------|
| **开发成本** | 高（几百行代码） | 零（文本模板） |
| **部署复杂度** | 高（依赖管理） | 低（一个脚本） |
| **运行成本** | 中（常驻服务） | 极低（按需触发） |
| **中文支持** | 一般 | 最优 |
| **灵活性** | 低（需改代码） | 高（改文本即可） |
| **适用场景** | 高频自动化 | 低频专家咨询 |

---

## 📝 使用示例

### 示例 1: 数据库连接池问题

**context.txt**:
```
[10:01] oncall: 支付服务 503 错误
[10:05] dev1: 日志显示 Connection pool exhausted
[10:08] sre1: 连接池配置 max=50
```

**运行**:
```bash
./run.sh
```

**输出**:
```markdown
## 🚨 事故报告

### 摘要
支付服务因数据库连接池耗尽返回 503 错误，持续约 10 分钟。

### 根因分析
数据库连接池配置过小（max=50），高峰期连接请求超过阈值。

### 修复方案
1. 临时：重启服务释放连接
2. 短期：增加连接池大小到 100
3. 长期：添加连接泄漏检测

### 后续行动
- [ ] 修改 config/database.js pool.max = 100
- [ ] 添加连接池使用率监控
```

### 示例 2: 迭代更新

**初始 context.txt**:
```
[10:01] 支付服务报错
```

**智能体分析后**...

**追加新消息**:
```
[10:15] 运维重启了服务，暂时恢复
```

**告知智能体**:
```
"注意：context.txt 已更新，请 SRE 重新评估"
```

**智能体更新报告**:
```markdown
### 状态更新
重启后服务暂时恢复，但根本原因未解决。
建议尽快实施短期修复方案。
```

---

## 🔧 高级用法

### 自定义 Prompt

编辑 `prompt_template.txt` 可调整：

- 角色定义（添加安全专家等）
- 输出格式（添加 Jira 模板等）
- 约束条件（添加公司规范等）

### 批量处理

```bash
# 处理多个 incident
for dir in incidents/*/; do
  cd "$dir"
  ../../run.sh
  cd -
done
```

### 集成 Slack

```bash
# 导出 Slack 线程
slack-export --channel #incidents --output context.txt

# 启动智能体
./run.sh
```

---

## ❓ 常见问题

### Q: 如何保存对话历史？

A: Qwen Code 会自动保存会话，可在 `~/.qwen/sessions/` 查看。

### Q: 如何切换模型？

A: 修改环境变量：
```bash
export QWEN_MODEL=qwen-max  # 或 qwen3-coder
```

### Q: 如何添加自定义工具？

A: 在 `prompt_template.txt` 中定义工具使用规则：
```
# Tools
你可以使用以下工具：
- read_file: 读取文件
- search_logs: 搜索日志
```

---

## 📚 相关资源

| 资源 | 链接 |
|------|------|
| Qwen Code CLI | https://github.com/anthropics/qwen-code |
| 阿里云百炼 | https://bailian.console.aliyun.com/ |
| Qwen API 文档 | https://help.aliyun.com/zh/dashscope/ |

---

*Qwen Incident Response Skill | 2026-03-31*
