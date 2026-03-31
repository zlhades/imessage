# 测试指南

## 📋 测试架构

### 测试层次

```
┌─────────────────────────────────────────────────────────────┐
│                      E2E 测试 (10%)                          │
│  - 完整事件响应流程                                          │
│  - 发送前双重确认                                            │
│  - 多用户协作场景                                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    集成测试 (20%)                            │
│  - MCP Client 与 Servers 集成                                │
│  - AI Provider 与后端集成                                    │
│  - Approval Gateway 完整流程                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   单元测试 (70%)                             │
│  - AI Provider 分析逻辑                                      │
│  - 意图识别                                                  │
│  - 信息完整性检查                                            │
│  - 状态持久化                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 运行所有测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监视模式（开发时使用）
npm run test:watch
```

### 运行特定类型测试

```bash
# 单元测试
npm run test:unit

# 集成测试
npm run test:integration

# E2E 测试
npm run test:e2e
```

---

## 📁 测试文件组织

```
tests/
├── setup.ts                    # 全局测试设置
├── e2e/
│   ├── utils.ts                # E2E 测试工具
│   ├── incident-flow.test.ts   # 事件响应流程 E2E 测试
│   └── approval-flow.test.ts   # 确认流程 E2E 测试
├── integration/
│   └── .gitkeep
└── unit/
    ├── ai/
    │   └── qwen-provider.test.ts
    ├── analysis/
    │   ├── intent.test.ts
    │   └── completeness.test.ts
    ├── approval/
    │   └── gateway.test.ts
    ├── config/
    │   └── state.test.ts
    └── mcp/
        └── .gitkeep
```

---

## 📊 测试覆盖率

### 覆盖率目标

| 指标 | 目标 | 当前 |
|------|------|------|
| 语句覆盖率 | 70% | - |
| 分支覆盖率 | 60% | - |
| 函数覆盖率 | 70% | - |
| 行覆盖率 | 70% | - |

### 查看覆盖率报告

```bash
npm run test:coverage

# 在浏览器中打开 HTML 报告
open coverage/index.html
```

---

## 🧪 测试用例说明

### 单元测试

#### AI Provider 测试 (`tests/unit/ai/qwen-provider.test.ts`)

测试内容:
- ✅ Provider 初始化
- ✅ 上下文分析功能
- ✅ 回复生成
- ✅ 追问问题生成
- ✅ 健康检查
- ✅ 错误处理

#### 意图识别测试 (`tests/unit/analysis/intent.test.ts`)

测试内容:
- ✅ 问题报告识别（error, down, crash, timeout）
- ✅ 解决方案识别（fixed, resolved, deployed）
- ✅ 询问识别（问句，Can you, What, How）
- ✅ 信息更新识别（update, found, looks like）
- ✅ 严重性判断（P0-P3）
- ✅ 批量意图分类

#### 信息完整性检查测试 (`tests/unit/analysis/completeness.test.ts`)

测试内容:
- ✅ 问题描述缺失检测
- ✅ 受影响服务检测
- ✅ 时间信息检测
- ✅ 影响评估检测
- ✅ 追问问题生成
- ✅ 是否应该追问判断

#### Approval Gateway 测试 (`tests/unit/approval/gateway.test.ts`)

测试内容:
- ✅ 草稿准备
- ✅ 用户确认流程
- ✅ 第二次 Pull 检查
- ✅ 消息发送
- ✅ 草稿修改
- ✅ 本地信息补充
- ✅ 取消操作
- ✅ 用户操作解析

#### 状态持久化测试 (`tests/unit/config/state.test.ts`)

测试内容:
- ✅ 状态加载
- ✅ 状态保存
- ✅ 最后拉取时间更新
- ✅ 消息处理标记
- ✅ 本地输入管理
- ✅ 事件历史记录
- ✅ 定期保存器

### E2E 测试

#### 完整事件响应流程 (`tests/e2e/incident-flow.test.ts`)

测试场景:
1. ✅ 用户报告问题 → AI 分析 → 生成追问
2. ✅ 多用户协作场景
3. ✅ 问题已解决识别
4. ✅ 信息更新处理
5. ✅ 询问类型处理
6. ✅ 边界情况（空消息、长消息、特殊字符）

#### 发送前双重确认 (`tests/e2e/approval-flow.test.ts`)

测试场景:
1. ✅ 完整双重确认流程（无新消息）
2. ✅ 检测到新消息并重新分析
3. ✅ 用户修改草稿
4. ✅ 用户补充本地信息
5. ✅ 用户取消发送
6. ✅ 用户请求进一步调查
7. ✅ 草稿格式化
8. ✅ 用户操作解析

---

## 🔧 测试工具

### E2E 测试工具 (`tests/e2e/utils.ts`)

提供的工具函数:

```typescript
// 创建 Mock 数据
createSlackMessage(overrides)
createLocalInput(overrides)
createMergedContext(overrides)

// 场景构建器
createScenario()
  .withSlackMessage('text', 'user')
  .withLocalInput('text', 'type')
  .build()

// Mock MCP Client
createMockMCPClient()

// 等待条件
await waitForCondition(() => boolean, timeout)

// 测试报告
createTestReport('scenario name')
```

### 测试设置 (`tests/setup.ts`)

全局配置:
- 环境变量设置
- Console 模拟
- 全局测试工具

---

## 📝 编写新测试

### 单元测试模板

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { yourFunction } from '../../src/your-module.js';

describe('模块名称', () => {
  beforeEach(() => {
    // 每个测试前的设置
  });

  describe('函数名称', () => {
    it('应该做某事', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = yourFunction(input);
      
      // Assert
      expect(result).toBe('expected');
    });

    it('应该处理边界情况', () => {
      // 测试边界情况
    });

    it('应该处理错误情况', () => {
      // 测试错误处理
    });
  });
});
```

### E2E 测试模板

```typescript
import { describe, it, expect } from 'vitest';
import { createScenario, createMockMCPClient } from './utils.js';

describe('E2E: 场景名称', () => {
  it('应该完成完整流程', async () => {
    // 1. 准备场景
    const scenario = createScenario()
      .withSlackMessage('Initial message')
      .build();

    // 2. 执行操作
    const context = mergeContext(...);

    // 3. 验证结果
    expect(context.slackMessages.length).toBeGreaterThan(0);

    // 4. 验证 AI 分析
    const analysis = await aiProvider.analyze(context);
    expect(analysis.intent.type).toBe('problem_report');
  });
});
```

---

## 🐛 调试测试

### 详细输出

```bash
# 显示详细日志
VERBOSE=true npm test

# 只显示失败的测试
npm test -- --reporter=verbose
```

### 运行单个测试文件

```bash
npm test -- tests/unit/ai/qwen-provider.test.ts
```

### 运行匹配的测试

```bash
# 运行名称包含 "analyze" 的测试
npm test -- -t "analyze"
```

---

## 📈 测试最佳实践

### 1. 测试命名

```typescript
// ✅ 好的命名
it('应该识别包含 error 的问题报告', () => {
  // ...
});

// ❌ 不好的命名
it('test 1', () => {
  // ...
});
```

### 2. Arrange-Act-Assert 模式

```typescript
it('应该正确处理输入', () => {
  // Arrange - 准备数据
  const input = 'test';
  
  // Act - 执行操作
  const result = process(input);
  
  // Assert - 验证结果
  expect(result).toBe('expected');
});
```

### 3. 测试隔离

```typescript
// ✅ 每个测试独立
describe('模块', () => {
  beforeEach(() => {
    // 重置状态
    resetState();
  });
  
  it('测试 1', () => { /* ... */ });
  it('测试 2', () => { /* ... */ });
});

// ❌ 测试之间有依赖
it('测试 1', () => {
  state.value = 1;
});
it('测试 2', () => {
  // 依赖测试 1 设置的 state.value
  expect(state.value).toBe(1);
});
```

### 4. 测试覆盖率

```typescript
// ✅ 测试所有分支
it('应该处理成功情况', () => { /* ... */ });
it('应该处理失败情况', () => { /* ... */ });
it('应该处理边界情况', () => { /* ... */ });

// ❌ 只测试主路径
it('应该正常工作', () => { /* ... */ });
```

---

## 🔍 常见问题

### Q: 测试失败 "Cannot find module"

A: 确保运行了 `npm install` 并且导入路径正确。

### Q: Mock 不生效

A: 确保在导入被 mock 的模块之前调用 `vi.mock()`。

### Q: 异步测试超时

A: 增加超时时间或使用 `async/await`：

```typescript
it('应该异步工作', async () => {
  await someAsyncOperation();
}, 10000); // 10 秒超时
```

---

## 📊 测试统计

运行以下命令查看测试统计：

```bash
npm test -- --reporter=verbose
```

---

*最后更新：2026-03-19*
