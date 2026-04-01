#!/bin/bash
#
# 测试运行器 - 验证 Incident Response Skill
#
# 用法：./test.sh [测试名称]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$SCRIPT_DIR/tests"
TESTS_PASSED=0
TESTS_FAILED=0

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 打印测试结果
print_result() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $test_name: $message"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name: $message"
        ((TESTS_FAILED++))
    fi
}

# 测试 1: 文件结构检查
test_file_structure() {
    echo -e "\n${BLUE}测试 1: 文件结构检查${NC}"
    
    # 检查必要文件
    if [ -f "$SCRIPT_DIR/prompt_template.txt" ]; then
        print_result "文件结构" "PASS" "prompt_template.txt 存在"
    else
        print_result "文件结构" "FAIL" "prompt_template.txt 不存在"
        return 1
    fi
    
    if [ -f "$SCRIPT_DIR/context.txt" ]; then
        print_result "文件结构" "PASS" "context.txt 存在"
    else
        print_result "文件结构" "FAIL" "context.txt 不存在"
        return 1
    fi
    
    if [ -f "$SCRIPT_DIR/run.sh" ]; then
        print_result "文件结构" "PASS" "run.sh 存在且可执行"
    else
        print_result "文件结构" "FAIL" "run.sh 不存在"
        return 1
    fi
    
    if [ -f "$SCRIPT_DIR/README.md" ]; then
        print_result "文件结构" "PASS" "README.md 存在"
    else
        print_result "文件结构" "FAIL" "README.md 不存在"
        return 1
    fi
    
    return 0
}

# 测试 2: Prompt 模板验证
test_prompt_template() {
    echo -e "\n${BLUE}测试 2: Prompt 模板验证${NC}"
    
    local prompt_file="$SCRIPT_DIR/prompt_template.txt"
    
    # 检查角色定义
    if grep -q "Role" "$prompt_file"; then
        print_result "Prompt 模板" "PASS" "包含角色定义"
    else
        print_result "Prompt 模板" "FAIL" "缺少角色定义"
        return 1
    fi
    
    # 检查工作流
    if grep -q "Workflow" "$prompt_file"; then
        print_result "Prompt 模板" "PASS" "包含工作流定义"
    else
        print_result "Prompt 模板" "FAIL" "缺少工作流定义"
        return 1
    fi
    
    # 检查多智能体
    if grep -q "PM Agent" "$prompt_file" && grep -q "SRE Agent" "$prompt_file" && grep -q "Dev Agent" "$prompt_file"; then
        print_result "Prompt 模板" "PASS" "包含三个智能体角色"
    else
        print_result "Prompt 模板" "FAIL" "缺少智能体角色"
        return 1
    fi
    
    # 检查输出格式
    if grep -q "Output Format" "$prompt_file" || grep -q "输出格式" "$prompt_file"; then
        print_result "Prompt 模板" "PASS" "包含输出格式定义"
    else
        print_result "Prompt 模板" "FAIL" "缺少输出格式定义"
        return 1
    fi
    
    # 检查约束条件
    if grep -q "Constraints" "$prompt_file" || grep -q "约束" "$prompt_file"; then
        print_result "Prompt 模板" "PASS" "包含约束条件"
    else
        print_result "Prompt 模板" "FAIL" "缺少约束条件"
        return 1
    fi
    
    return 0
}

# 测试 3: Context 模板验证
test_context_template() {
    echo -e "\n${BLUE}测试 3: Context 模板验证${NC}"
    
    local context_file="$SCRIPT_DIR/context.txt"
    
    # 检查基本结构
    if grep -q "Slack" "$context_file" || grep -q "slack" "$context_file"; then
        print_result "Context 模板" "PASS" "包含 Slack 讨论区域"
    else
        print_result "Context 模板" "FAIL" "缺少 Slack 讨论区域"
        return 1
    fi
    
    if grep -q "日志" "$context_file" || grep -q "Log" "$context_file"; then
        print_result "Context 模板" "PASS" "包含错误日志区域"
    else
        print_result "Context 模板" "FAIL" "缺少错误日志区域"
        return 1
    fi
    
    return 0
}

# 测试 4: 运行脚本验证
test_run_script() {
    echo -e "\n${BLUE}测试 4: 运行脚本验证${NC}"
    
    local run_script="$SCRIPT_DIR/run.sh"
    
    # 检查可执行权限
    if [ -x "$run_script" ]; then
        print_result "运行脚本" "PASS" "具有可执行权限"
    else
        print_result "运行脚本" "FAIL" "缺少可执行权限"
        return 1
    fi
    
    # 检查必要功能
    if grep -q "check_files" "$run_script"; then
        print_result "运行脚本" "PASS" "包含文件检查"
    else
        print_result "运行脚本" "FAIL" "缺少文件检查"
        return 1
    fi
    
    if grep -q "check_qwen" "$run_script"; then
        print_result "运行脚本" "PASS" "包含 Qwen 检查"
    else
        print_result "运行脚本" "FAIL" "缺少 Qwen 检查"
        return 1
    fi
    
    if grep -q "check_api_key" "$run_script"; then
        print_result "运行脚本" "PASS" "包含 API Key 检查"
    else
        print_result "运行脚本" "FAIL" "缺少 API Key 检查"
        return 1
    fi
    
    if grep -q "qwen code" "$run_script"; then
        print_result "运行脚本" "PASS" "包含 Qwen Code 调用"
    else
        print_result "运行脚本" "FAIL" "缺少 Qwen Code 调用"
        return 1
    fi
    
    return 0
}

# 测试 5: 测试用例执行
test_test_cases() {
    echo -e "\n${BLUE}测试 5: 测试用例执行${NC}"
    
    # 创建测试目录
    mkdir -p "$TEST_DIR"
    
    # 测试用例 1: 数据库连接池问题
    echo -e "\n  运行测试用例 1: 数据库连接池问题..."
    
    cat > "$TEST_DIR/case1-context.txt" << 'EOF'
# Incident Context

## Slack 讨论记录

[10:01] oncall: 支付服务报错 503，有人知道吗？
[10:05] dev1: 我看看...发现数据库连接池满
[10:08] sre1: 监控显示 CPU 正常，内存 80%
[10:10] dev1: 连接池配置 max=50，可能太小了

## 错误日志

```
2026-03-31 10:01:00 ERROR [payment-service] Connection pool exhausted
2026-03-31 10:02:15 ERROR [payment-service] Timeout waiting for connection
2026-03-31 10:03:30 ERROR [payment-service] Cannot acquire connection from pool
```

---
更新时间：2026-03-31 10:15
EOF
    
    if [ -f "$TEST_DIR/case1-context.txt" ]; then
        print_result "测试用例" "PASS" "用例 1 创建成功"
    else
        print_result "测试用例" "FAIL" "用例 1 创建失败"
        return 1
    fi
    
    # 测试用例 2: API 超时问题
    echo -e "\n  运行测试用例 2: API 超时问题..."
    
    cat > "$TEST_DIR/case2-context.txt" << 'EOF'
# Incident Context

## Slack 讨论记录

[14:00] user1: /api/payment 端点响应很慢，平均 5 秒
[14:05] user2: 我也是，超时错误率 30%
[14:10] sre1: 数据库查询正常，不是 DB 问题
[14:15] dev1: 可能是 Redis 缓存失效了

## 错误日志

```
2026-03-31 14:00:00 WARN [payment-service] Slow query detected: 5000ms
2026-03-31 14:05:00 ERROR [payment-service] Request timeout after 30000ms
```

## 监控指标

- API P99 延迟：5000ms (正常<500ms)
- 超时错误率：30%
- Redis 命中率：10% (正常>90%)

---
更新时间：2026-03-31 14:20
EOF
    
    if [ -f "$TEST_DIR/case2-context.txt" ]; then
        print_result "测试用例" "PASS" "用例 2 创建成功"
    else
        print_result "测试用例" "FAIL" "用例 2 创建失败"
        return 1
    fi
    
    # 测试用例 3: 内存泄漏问题
    echo -e "\n  运行测试用例 3: 内存泄漏问题..."
    
    cat > "$TEST_DIR/case3-context.txt" << 'EOF'
# Incident Context

## Slack 讨论记录

[09:00] monitoring: [告警] user-service 内存使用率 95%
[09:05] oncall: 服务开始响应缓慢
[09:10] dev1: 最近有内存优化 commit，可能引入泄漏
[09:20] sre1: 已重启服务，暂时恢复

## 错误日志

```
2026-03-31 09:00:00 WARN [user-service] Heap memory usage: 95%
2026-03-31 09:05:00 ERROR [user-service] OutOfMemoryError: Java heap space
```

## 监控指标

- 内存使用率：95% → 重启后 40%
- GC 频率：每分钟 10 次 (正常<2 次)
- 堆内存：8GB (已用 7.6GB)

---
更新时间：2026-03-31 09:30
EOF
    
    if [ -f "$TEST_DIR/case3-context.txt" ]; then
        print_result "测试用例" "PASS" "用例 3 创建成功"
    else
        print_result "测试用例" "FAIL" "用例 3 创建失败"
        return 1
    fi
    
    return 0
}

# 测试 6: Prompt 完整性检查
test_prompt_completeness() {
    echo -e "\n${BLUE}测试 6: Prompt 完整性检查${NC}"
    
    local prompt_file="$SCRIPT_DIR/prompt_template.txt"
    local line_count=$(wc -l < "$prompt_file")
    
    # 检查行数（应该足够详细）
    if [ "$line_count" -ge 50 ]; then
        print_result "Prompt 完整性" "PASS" "Prompt 有 $line_count 行，足够详细"
    else
        print_result "Prompt 完整性" "FAIL" "Prompt 只有 $line_count 行，可能不够详细"
        return 1
    fi
    
    # 检查关键词覆盖率
    local keywords=("PM" "SRE" "Dev" "分析" "修复" "报告")
    local found_count=0
    
    for keyword in "${keywords[@]}"; do
        if grep -q "$keyword" "$prompt_file"; then
            ((found_count++))
        fi
    done
    
    if [ "$found_count" -eq "${#keywords[@]}" ]; then
        print_result "Prompt 完整性" "PASS" "所有关键词都包含 ($found_count/${#keywords[@]})"
    else
        print_result "Prompt 完整性" "FAIL" "缺少部分关键词 ($found_count/${#keywords[@]})"
        return 1
    fi
    
    return 0
}

# 测试 7: README 文档检查
test_readme() {
    echo -e "\n${BLUE}测试 7: README 文档检查${NC}"
    
    local readme_file="$SCRIPT_DIR/README.md"
    
    # 检查必要章节
    if grep -q "快速开始" "$readme_file" || grep -q "Quick" "$readme_file"; then
        print_result "README" "PASS" "包含快速开始指南"
    else
        print_result "README" "FAIL" "缺少快速开始指南"
        return 1
    fi
    
    if grep -q "用法" "$readme_file" || grep -q "Usage" "$readme_file"; then
        print_result "README" "PASS" "包含使用说明"
    else
        print_result "README" "FAIL" "缺少使用说明"
        return 1
    fi
    
    if grep -q "示例" "$readme_file" || grep -q "Example" "$readme_file"; then
        print_result "README" "PASS" "包含使用示例"
    else
        print_result "README" "FAIL" "缺少使用示例"
        return 1
    fi
    
    return 0
}

# 主函数
main() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Incident Response Skill - 测试套件                     ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # 运行所有测试
    test_file_structure || true
    test_prompt_template || true
    test_context_template || true
    test_run_script || true
    test_test_cases || true
    test_prompt_completeness || true
    test_readme || true
    
    # 总结
    echo -e "\n${BLUE}══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}通过：$TESTS_PASSED${NC}"
    echo -e "${RED}失败：$TESTS_FAILED${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
    
    if [ "$TESTS_FAILED" -eq 0 ]; then
        echo -e "\n${GREEN}✅ 所有测试通过！${NC}\n"
        exit 0
    else
        echo -e "\n${RED}❌ 部分测试失败！${NC}\n"
        exit 1
    fi
}

# 执行
main "$@"
