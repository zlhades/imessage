#!/usr/bin/env python3
"""
Test Utilities for Incident Response Skill

Provides test data generators and validators.

Run with: python3 test_utils.py
"""

import os
import sys
from pathlib import Path
from datetime import datetime


# ============ Test Data Generators ============

def generate_test_case_1():
    """Test Case 1: Database Connection Pool Issue"""
    return """# Incident Context

## Slack 讨论记录

[10:01] oncall: 支付服务报错 503，有人知道吗？
[10:05] dev1: 我看看...发现数据库连接池满
[10:08] sre1: 监控显示 CPU 正常，内存 80%
[10:10] dev1: 连接池配置 max=50，可能太小了
[10:15] oncall: 影响多大？
[10:18] dev1: 大概 30% 的请求失败

## 错误日志

```
2026-03-31 10:01:00 ERROR [payment-service] Connection pool exhausted
2026-03-31 10:02:15 ERROR [payment-service] Timeout waiting for connection
2026-03-31 10:03:30 ERROR [payment-service] Cannot acquire connection from pool
2026-03-31 10:04:45 ERROR [payment-service] HTTP 503 Service Unavailable
```

## 监控指标

- 服务：payment-service
- 错误率：30%
- 响应时间：P99=5000ms (正常<500ms)
- 连接池：50/50 (100% 使用)
- 数据库：CPU 40%, 连接数 200

---
更新时间：2026-03-31 10:20
"""


def generate_test_case_2():
    """Test Case 2: API Timeout Issue"""
    return """# Incident Context

## Slack 讨论记录

[14:00] user1: /api/payment 端点响应很慢，平均 5 秒
[14:05] user2: 我也是，超时错误率 30%
[14:10] sre1: 数据库查询正常，不是 DB 问题
[14:15] dev1: 可能是 Redis 缓存失效了
[14:20] sre1: 确认了，Redis 命中率从 95% 掉到 10%
[14:25] dev1: 找到原因了，缓存 key 过期策略有问题

## 错误日志

```
2026-03-31 14:00:00 WARN [payment-service] Slow query detected: 5000ms
2026-03-31 14:05:00 ERROR [payment-service] Request timeout after 30000ms
2026-03-31 14:10:00 WARN [cache] Cache miss rate: 90%
```

## 监控指标

- API P99 延迟：5000ms (正常<500ms)
- 超时错误率：30%
- Redis 命中率：10% (正常>90%)
- Redis 内存：2GB/8GB

---
更新时间：2026-03-31 14:30
"""


def generate_test_case_3():
    """Test Case 3: Memory Leak"""
    return """# Incident Context

## Slack 讨论记录

[09:00] monitoring: [告警] user-service 内存使用率 95%
[09:05] oncall: 服务开始响应缓慢
[09:10] dev1: 最近有内存优化 commit，可能引入泄漏
[09:15] sre1: GC 频率异常，每分钟 10 次
[09:20] sre1: 已重启服务，暂时恢复
[09:25] dev1: 回滚了最近的 commit，观察中

## 错误日志

```
2026-03-31 09:00:00 WARN [user-service] Heap memory usage: 95%
2026-03-31 09:05:00 ERROR [user-service] OutOfMemoryError: Java heap space
2026-03-31 09:10:00 WARN [user-service] GC overhead limit exceeded
```

## 监控指标

- 内存使用率：95% → 重启后 40%
- GC 频率：每分钟 10 次 (正常<2 次)
- 堆内存：8GB (已用 7.6GB)
- 服务重启次数：2 次

---
更新时间：2026-03-31 09:35
"""


def generate_test_case_4():
    """Test Case 4: Deployment Failure"""
    return """# Incident Context

## Slack 讨论记录

[16:00] ci-bot: 部署失败：payment-service v2.3.0
[16:02] dev1: 健康检查失败，容器不断重启
[16:05] sre1: 回滚到 v2.2.9
[16:10] dev1: 找到问题了，配置文件路径错误
[16:15] dev1: 修复了，重新部署 v2.3.1

## 错误日志

```
2026-03-31 16:00:00 ERROR [k8s] Pod payment-service-xxx failed health check
2026-03-31 16:02:00 ERROR [payment-service] Configuration file not found: /etc/config/db.yaml
2026-03-31 16:05:00 INFO [k8s] Rolling back to v2.2.9
```

## 部署信息

- 版本：v2.3.0 → v2.2.9 (回滚) → v2.3.1 (修复)
- 影响时间：15 分钟
- 影响范围：支付服务不可用

---
更新时间：2026-03-31 16:20
"""


# ============ Validators ============

def validate_context_file(filepath: str) -> dict:
    """Validate context file structure"""
    result = {
        "valid": True,
        "errors": [],
        "warnings": [],
        "stats": {}
    }
    
    if not os.path.exists(filepath):
        result["valid"] = False
        result["errors"].append(f"File not found: {filepath}")
        return result
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Statistics
    result["stats"]["lines"] = len(content.split('\n'))
    result["stats"]["characters"] = len(content)
    result["stats"]["has_slack"] = "Slack" in content or "slack" in content
    result["stats"]["has_logs"] = "日志" in content or "Log" in content
    result["stats"]["has_metrics"] = "监控" in content or "指标" in content
    
    # Validation
    if result["stats"]["lines"] < 5:
        result["warnings"].append("Context file is too short (< 5 lines)")
    
    if not result["stats"]["has_slack"]:
        result["warnings"].append("Missing Slack discussion section")
    
    if not result["stats"]["has_logs"]:
        result["warnings"].append("Missing error logs section")
    
    return result


def validate_prompt_file(filepath: str) -> dict:
    """Validate prompt template structure"""
    result = {
        "valid": True,
        "errors": [],
        "warnings": [],
        "stats": {}
    }
    
    if not os.path.exists(filepath):
        result["valid"] = False
        result["errors"].append(f"File not found: {filepath}")
        return result
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Statistics
    result["stats"]["lines"] = len(content.split('\n'))
    result["stats"]["characters"] = len(content)
    
    # Required sections
    required_sections = [
        "Role",
        "Workflow",
        "PM",
        "SRE",
        "Dev",
        "Constraints"
    ]
    
    for section in required_sections:
        if section in content:
            result["stats"][f"has_{section.lower()}"] = True
        else:
            result["stats"][f"has_{section.lower()}"] = False
            result["warnings"].append(f"Missing section: {section}")
    
    # Check line count
    if result["stats"]["lines"] < 50:
        result["warnings"].append("Prompt template might be too short (< 50 lines)")
    
    return result


def print_validation_result(result: dict, title: str):
    """Print validation result"""
    print(f"\n{'='*60}")
    print(f"📋 {title}")
    print(f"{'='*60}")
    
    if result["valid"]:
        print("✅ Valid")
    else:
        print("❌ Invalid")
    
    for error in result["errors"]:
        print(f"  ❌ {error}")
    
    for warning in result["warnings"]:
        print(f"  ⚠️  {warning}")
    
    print("\n📊 Statistics:")
    for key, value in result["stats"].items():
        print(f"  {key}: {value}")


# ============ Main ============

def main():
    """Main test function"""
    print("\n🧪 Incident Response Skill - Test Utilities\n")
    
    script_dir = Path(__file__).parent
    tests_dir = script_dir / "tests"
    tests_dir.mkdir(exist_ok=True)
    
    # Generate test cases
    print("📝 Generating test cases...")
    
    test_cases = [
        ("case1-connection-pool.txt", generate_test_case_1()),
        ("case2-api-timeout.txt", generate_test_case_2()),
        ("case3-memory-leak.txt", generate_test_case_3()),
        ("case4-deployment-failure.txt", generate_test_case_4()),
    ]
    
    for filename, content in test_cases:
        filepath = tests_dir / filename
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✓ Created {filename}")
    
    # Validate files
    print("\n🔍 Validating files...")
    
    # Validate prompt template
    prompt_result = validate_prompt_file(str(script_dir / "prompt_template.txt"))
    print_validation_result(prompt_result, "Prompt Template")
    
    # Validate context template
    context_result = validate_context_file(str(script_dir / "context.txt"))
    print_validation_result(context_result, "Context Template")
    
    # Validate test cases
    for filename, _ in test_cases:
        filepath = tests_dir / filename
        result = validate_context_file(str(filepath))
        print_validation_result(result, f"Test Case: {filename}")
    
    print("\n✅ Test utilities completed!\n")


if __name__ == "__main__":
    main()
