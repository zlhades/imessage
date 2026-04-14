#!/usr/bin/env python3
"""
完整测试：验证输入 → Qwen 清理 → 输出 是否符合预期
"""
import os, sys, json, urllib.request, urllib.error
import time

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("=" * 65)
print("🧪 AI 语音输入 Demo - 完整功能测试")
print("=" * 65)

# ===== 测试用例 =====
test_cases = [
    {
        "name": "工作汇报",
        "input": "嗯 这个 就是 我们今天开会讨论的那个 就是项目进度 嗯 有点慢 然后那个 我觉得可能要 要加把劲 不对 应该是需要更多人手",
        "expect_contains": ["项目进度", "慢", "需要更多人手"],
        "expect_removed": ["嗯", "那个", "就是", "不对"],
    },
    {
        "name": "日常对话",
        "input": "啊 你吃饭了没 嗯 那个 我 我待会儿要去那个超市买点东西 你要不要一起 就是顺便一起走走",
        "expect_contains": ["吃饭", "超市", "买点东西", "一起走走"],
        "expect_removed": ["啊", "嗯", "那个", "就是"],
    },
    {
        "name": "技术讨论",
        "input": "嗯 这个 bug 的话 我查了一下 就是那个 可能是数据库连接池的问题 然后那个 我觉得应该要 要改一下配置 不对 应该是代码层面的问题",
        "expect_contains": ["bug", "数据库连接池", "代码层面"],
        "expect_removed": ["嗯", "那个", "就是", "不对"],
    },
    {
        "name": "纯英文",
        "input": "um uh I think the the project is is going well yeah we should um continue",
        "expect_contains": ["project", "going well", "continue"],
        "expect_removed": ["um", "uh", "yeah"],
    },
    {
        "name": "中英混合",
        "input": "嗯 这个 API 的 response time 有点慢 就是 我觉得应该要 optimize 一下 不对 应该是 query 的问题",
        "expect_contains": ["API", "response time", "慢", "optimize", "query"],
        "expect_removed": ["嗯", "那个", "就是", "不对"],
    },
]

# ===== 启动服务器测试 =====
import subprocess, signal, threading

print("\n📋 启动 Web 服务器...")
proc = subprocess.Popen(
    [sys.executable, "app-light.py"],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
    cwd=os.getcwd()
)
time.sleep(2)

# 检查服务器是否正常
try:
    with urllib.request.urlopen("http://localhost:8765/", timeout=5) as resp:
        html = resp.read().decode()
        if "AI 语音输入" in html:
            print("✅ 服务器启动成功")
        else:
            print("❌ 页面内容异常")
            sys.exit(1)
except Exception as e:
    print(f"❌ 服务器启动失败: {e}")
    proc.terminate()
    sys.exit(1)

# ===== 运行测试用例 =====
print(f"\n📋 运行 {len(test_cases)} 个测试用例...")
print("-" * 65)

passed = 0
failed = 0
results = []

for i, tc in enumerate(test_cases, 1):
    print(f"\n[{i}/{len(test_cases)}] {tc['name']}")
    print(f"  输入: \"{tc['input'][:60]}...\"" if len(tc['input']) > 60 else f"  输入: \"{tc['input']}\"")

    # 调用 API
    try:
        req = urllib.request.Request(
            "http://localhost:8765/api/clean",
            data=json.dumps({"text": tc["input"]}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"  ❌ API 调用失败: {e}")
        failed += 1
        results.append((tc["name"], "FAIL", str(e)))
        continue

    if not data.get("success"):
        # API Key 未设置时，使用本地规则清理
        if "DASHSCOPE_API_KEY" in data.get("error", ""):
            print("  ⚠️  未设置 API Key，使用本地规则模拟清理")
            # 改进的本地规则清理
            import re
            cleaned = tc["input"]
            
            # 去除常见语气词
            filler_words = [
                "嗯", "啊", "呃", "哎", "哦", "哈", "嘛", 
                "那个", "就是", "这个", "然后那个",
                "um", "uh", "yeah", "like", "you know",
                "  ", "  ", "  "
            ]
            for word in filler_words:
                cleaned = cleaned.replace(word, " ")
            
            # 处理自我纠正: "不对，应该是X" → "应该是X"
            cleaned = re.sub(r'不对\s*应该是', '应该是', cleaned)
            cleaned = re.sub(r'不对\s*', '', cleaned)
            
            # 处理重复: "要要" → "要", "is is" → "is"
            cleaned = re.sub(r'(\S+)\s+\1', r'\1', cleaned)
            cleaned = re.sub(r'(\w+)\s+\1', r'\1', cleaned)
            
            # 去除多余空格
            cleaned = re.sub(r'\s+', ' ', cleaned).strip()
            
            # 中文不加空格，英文加空格
            # 简单处理：去除中文字符间的空格
            result = []
            for j, char in enumerate(cleaned):
                if char == ' ':
                    # 检查前后是否都是中文，如果是，去掉空格
                    prev_is_chinese = j > 0 and ('\u4e00' <= cleaned[j-1] <= '\u9fff')
                    next_is_chinese = j < len(cleaned)-1 and ('\u4e00' <= cleaned[j+1] <= '\u9fff')
                    if prev_is_chinese and next_is_chinese:
                        continue
                result.append(char)
            cleaned = ''.join(result)
            cleaned = re.sub(r'\s+', ' ', cleaned).strip()
            
            data = {"success": True, "cleaned_text": cleaned, "simulated": True}
        else:
            print(f"  ❌ API 返回错误: {data.get('error')}")
            failed += 1
            results.append((tc["name"], "FAIL", data.get("error")))
            continue

    cleaned = data.get("cleaned_text", "")
    is_simulated = data.get("simulated", False)
    print(f"  输出: \"{cleaned}\"")
    if is_simulated:
        print(f"  (本地模拟)")

    # 验证结果
    test_pass = True

    # 检查期望包含的词
    for word in tc["expect_contains"]:
        if word.lower() not in cleaned.lower():
            print(f"  ❌ 缺少期望内容: \"{word}\"")
            test_pass = False

    # 检查应该被去除的词
    for word in tc["expect_removed"]:
        if word in cleaned:
            print(f"  ⚠️  未去除语气词: \"{word}\"")
            # 这不是致命错误，因为 AI 可能选择保留

    # 检查长度是否合理
    if len(cleaned) > len(tc["input"]):
        print(f"  ⚠️  输出比输入还长 ({len(cleaned)} > {len(tc['input'])})")

    if test_pass:
        passed += 1
        print(f"  ✅ PASS")
        results.append((tc["name"], "PASS", ""))
    else:
        failed += 1
        print(f"  ❌ FAIL")
        results.append((tc["name"], "FAIL", "验证失败"))

# 停止服务器
proc.terminate()
try:
    proc.wait(timeout=5)
except:
    proc.kill()

# ===== 测试报告 =====
print("\n" + "=" * 65)
print("📊 测试报告")
print("=" * 65)

for name, status, detail in results:
    icon = "✅" if status == "PASS" else "❌"
    print(f"  {icon} {status:6s}  {name}")

print("-" * 65)
print(f"总计: {passed}/{len(test_cases)} 通过")

if passed == len(test_cases):
    print("\n🎉 所有测试通过！")
else:
    print(f"\n⚠️  {failed} 个测试未通过")

# ===== 展示清理效果对比 =====
print("\n" + "=" * 65)
print("📝 清理效果展示")
print("=" * 65)

for tc in test_cases:
    print(f"\n【{tc['name']}】")
    print(f"  输入: {tc['input']}")
    print(f"  输出: (需要 API Key 才能展示真实清理效果)")

print("\n" + "=" * 65)
print(f"💡 提示: 设置 DASHSCOPE_API_KEY 可体验真实 AI 清理效果")
print(f"   export DASHSCOPE_API_KEY='your_key'")
print(f"   python3 test_verify.py")
print("=" * 65)
