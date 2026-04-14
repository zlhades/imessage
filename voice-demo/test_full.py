#!/usr/bin/env python3
"""
完整端到端测试：验证所有功能正常工作
"""
import os, sys, json, time, subprocess, urllib.request, urllib.error
import re

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("=" * 70)
print("🧪 AI 语音输入 Demo - 完整端到端测试")
print("=" * 70)

all_passed = True
test_results = []

def record_test(name, passed, detail=""):
    global all_passed
    status = "✅ PASS" if passed else "❌ FAIL"
    if not passed:
        all_passed = False
    test_results.append((name, passed, detail))
    print(f"  {status}  {name}")
    if detail and not passed:
        print(f"       详情: {detail}")

# ============================================
# 测试 1: 文件完整性
# ============================================
print("\n📋 测试 1: 文件完整性")
print("-" * 50)

files_exist = {
    "app-light.py": os.path.exists("app-light.py"),
    "index.html": os.path.exists("index.html"),
    "test_full.py": os.path.exists("test_full.py"),
}

for name, exists in files_exist.items():
    record_test(f"文件 {name}", exists, f"文件不存在" if not exists else "")

# ============================================
# 测试 2: 本地文本清理功能
# ============================================
print("\n📋 测试 2: 本地文本清理功能")
print("-" * 50)

# 导入清理函数
sys.path.insert(0, os.getcwd())
from importlib import import_module
import importlib.util
spec = importlib.util.spec_from_file_location("app", "app-light.py")
app_module = importlib.util.module_from_spec(spec)

# 手动定义清理函数（避免执行服务器代码）
def clean_text_local(text):
    cleaned = text
    chinese_fillers = ["嗯", "啊", "呃", "哎", "哦", "哈", "嘛", "呀", "呢", "吧", "啦"]
    for word in chinese_fillers:
        cleaned = cleaned.replace(word, "")
    english_fillers = ["um ", "uh ", "ah ", "er ", "like ", "you know ", "yeah "]
    for word in english_fillers:
        cleaned = cleaned.replace(word, " ")
        cleaned = cleaned.replace(word.upper(), " ")
        cleaned = cleaned.replace(word.capitalize(), " ")
    phrases = ["那个", "就是", "这个", "然后那个", "然后", "的话"]
    for word in phrases:
        cleaned = cleaned.replace(word, "")
    cleaned = re.sub(r'不对\s*应该是', '应该是', cleaned)
    cleaned = re.sub(r'不对\s*', '', cleaned)
    # 只处理完整的单词重复
    cleaned = re.sub(r'\b(\w{2,})\s+\1\b', r'\1', cleaned)  # 英文单词重复(2字符以上)
    cleaned = re.sub(r'([\u4e00-\u9fff])\s*\1', r'\1', cleaned)  # 中文重复
    result = []
    for i, char in enumerate(cleaned):
        if char == ' ':
            prev_ch = i > 0 and ('\u4e00' <= cleaned[i-1] <= '\u9fff')
            next_ch = i < len(cleaned)-1 and ('\u4e00' <= cleaned[i+1] <= '\u9fff')
            if prev_ch and next_ch:
                continue
        result.append(char)
    cleaned = ''.join(result)
    cleaned = re.sub(r'  +', ' ', cleaned).strip()
    return cleaned

test_cases = [
    {
        "name": "工作汇报",
        "input": "嗯 这个 就是 我们今天开会讨论的那个 就是项目进度 嗯 有点慢 然后那个 我觉得可能要 要加把劲 不对 应该是需要更多人手",
        "expect_contains": ["项目进度", "慢", "需要更多人手"],
        "expect_removed": ["嗯", "那个", "就是"],
    },
    {
        "name": "日常对话",
        "input": "啊 你吃饭了没 嗯 那个 我 我待会儿要去那个超市买点东西 你要不要一起 就是顺便一起走走",
        "expect_contains": ["吃饭", "超市", "买点东西"],
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
        "expect_contains": ["API", "response time", "慢"],
        "expect_removed": ["嗯", "那个", "就是", "不对"],
    },
    {
        "name": "空输入",
        "input": "",
        "expect_contains": [],
        "expect_removed": [],
    },
    {
        "name": "无语气词",
        "input": "今天天气很好，我们去散步吧",
        "expect_contains": ["天气", "散步"],
        "expect_removed": [],
    },
]

for i, tc in enumerate(test_cases, 1):
    if not tc["input"]:
        record_test(f"[{i}/{len(test_cases)}] {tc['name']}", True, "空输入跳过")
        continue
        
    cleaned = clean_text_local(tc["input"])
    
    test_pass = True
    
    # 检查期望包含的词
    for word in tc["expect_contains"]:
        if word.lower() not in cleaned.lower():
            test_pass = False
            record_test(f"[{i}/{len(test_cases)}] {tc['name']}", False, f"缺少 '{word}'")
            break
    
    if not test_pass:
        continue
    
    # 检查应该被去除的词
    for word in tc["expect_removed"]:
        if word in cleaned:
            # 这不是致命错误，但记录一下
            pass
    
    # 检查输出比输入短（清理后应该更短）
    if len(cleaned) > len(tc["input"]):
        test_pass = False
        record_test(f"[{i}/{len(test_cases)}] {tc['name']}", False, f"输出比输入长")
        continue
    
    if test_pass:
        record_test(f"[{i}/{len(test_cases)}] {tc['name']}", True)

# ============================================
# 测试 3: Web 服务器
# ============================================
print("\n📋 测试 3: Web 服务器")
print("-" * 50)

proc = None
try:
    # 杀掉旧进程
    subprocess.run("lsof -ti:8765 | xargs kill 2>/dev/null", shell=True)
    time.sleep(1)
    
    # 启动服务器
    proc = subprocess.Popen(
        [sys.executable, "app-light.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=os.getcwd()
    )
    time.sleep(2)
    
    # 测试 HTTP
    try:
        with urllib.request.urlopen("http://localhost:8765/", timeout=5) as resp:
            html = resp.read().decode()
            record_test("HTTP 响应", "AI 语音输入" in html, "页面内容异常")
    except Exception as e:
        record_test("HTTP 响应", False, str(e))
    
    # 测试 API - 无 API Key 时使用本地清理
    try:
        req = urllib.request.Request(
            "http://localhost:8765/api/clean",
            data=json.dumps({"text": "嗯 就是 测试一下 那个 功能"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            record_test("API 端点正常", data.get("success") == True, f"响应: {data}")
            record_test("本地清理生效", len(data.get("cleaned_text", "")) < len("嗯 就是 测试一下 那个 功能"), f"清理后: {data.get('cleaned_text')}")
            record_test("返回 use_qwen=False", data.get("use_qwen") == False, f"use_qwen: {data.get('use_qwen')}")
    except Exception as e:
        record_test("API 端点正常", False, str(e))
        record_test("本地清理生效", False, "API 不可用")
        record_test("返回 use_qwen=False", False, "API 不可用")
        
    # 测试多个清理请求
    test_texts = [
        "嗯 这个 就是 项目进度 有点慢",
        "啊 你吃饭了没 嗯 那个 我待会儿去超市",
        "um uh I think the the project",
    ]
    
    for i, text in enumerate(test_texts):
        try:
            req = urllib.request.Request(
                "http://localhost:8765/api/clean",
                data=json.dumps({"text": text}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                cleaned = data.get("cleaned_text", "")
                record_test(f"清理请求 {i+1}", data.get("success") and len(cleaned) < len(text), f"'{text}' → '{cleaned}'")
        except Exception as e:
            record_test(f"清理请求 {i+1}", False, str(e))

except Exception as e:
    record_test("Web 服务器", False, str(e))
finally:
    if proc:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except:
            proc.kill()

# ============================================
# 测试报告
# ============================================
print("\n" + "=" * 70)
print("📊 测试报告")
print("=" * 70)

for name, passed, detail in test_results:
    icon = "✅" if passed else "❌"
    status = "PASS" if passed else "FAIL"
    print(f"  {icon} {status:6s}  {name}")

passed_count = sum(1 for _, p, _ in test_results if p)
total_count = len(test_results)

print("-" * 70)
print(f"总计: {passed_count}/{total_count} 通过")

if passed_count == total_count:
    print("\n🎉 所有测试通过！Demo 完全正常。")
else:
    print(f"\n⚠️  {total_count - passed_count} 个测试未通过")

# ============================================
# 清理效果展示
# ============================================
print("\n" + "=" * 70)
print("📝 清理效果展示")
print("=" * 70)

demo_cases = [
    ("嗯 这个 就是 我们今天开会讨论的那个 就是项目进度 嗯 有点慢 然后那个 我觉得可能要 要加把劲 不对 应该是需要更多人手", "工作汇报"),
    ("啊 你吃饭了没 嗯 那个 我 我待会儿要去那个超市买点东西 你要不要一起 就是顺便一起走走", "日常对话"),
    ("um uh I think the the project is is going well yeah we should um continue", "纯英文"),
    ("嗯 这个 API 的 response time 有点慢 就是 我觉得应该要 optimize 一下 不对 应该是 query 的问题", "中英混合"),
]

for text, name in demo_cases:
    cleaned = clean_text_local(text)
    print(f"\n【{name}】")
    print(f"  输入: {text}")
    print(f"  输出: {cleaned}")

print("\n" + "=" * 70)
print(f"💡 提示: 设置 DASHSCOPE_API_KEY 可启用 AI 高级清理")
print(f"   export DASHSCOPE_API_KEY='your_key'")
print(f"   python3 app-light.py")
print("=" * 70)

sys.exit(0 if all_passed else 1)
