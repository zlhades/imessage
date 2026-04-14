#!/usr/bin/env python3
"""
AI 语音输入 Demo - 超轻量版本
功能：输入文本 → 本地清理 或 Qwen 清理 → 输出文本
支持：从 .env 文件加载 API Key
"""
import os, sys, json, urllib.request
from http.server import HTTPServer
from http.server import SimpleHTTPRequestHandler
import re

# 切换到脚本所在目录
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = 8766

def load_config():
    """加载配置：从环境变量或 .env 文件"""
    
    # 1. 检查环境变量
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if api_key:
        print(f"✅ 从环境变量加载 API Key: {api_key[:5]}...")
        return api_key

    # 2. 检查 .env 文件
    env_file = os.path.join(os.getcwd(), ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, value = line.split("=", 1)
                        if key.strip() == "DASHSCOPE_API_KEY":
                            api_key = value.strip().strip("'\"").strip()
                            print(f"✅ 从 .env 文件加载 API Key: {api_key[:5]}... (长度: {len(api_key)})")
                            return api_key
        except Exception as e:
            print(f"⚠️ 读取 .env 文件失败: {e}")
    
    print("⚠️ 未找到 API Key（使用本地清理模式）")
    return ""

# 全局配置
DASHSCOPE_API_KEY = load_config()

def clean_text_local(text):
    """本地规则清理：去除语气词、重复、自我纠正"""
    cleaned = text

    # 去除常见中文语气词
    chinese_fillers = ["嗯", "啊", "呃", "哎", "哦", "哈", "嘛", "呀", "呢", "吧", "啦"]
    for word in chinese_fillers:
        cleaned = cleaned.replace(word, "")

    # 去除常见英文语气词（注意：不包含 "well " 等有实际含义的词）
    english_fillers = ["um ", "uh ", "ah ", "er ", "like ", "you know ", "yeah "]
    for word in english_fillers:
        cleaned = cleaned.replace(word, " ")
        cleaned = cleaned.replace(word.upper(), " ")
        cleaned = cleaned.replace(word.capitalize(), " ")

    # 去除常见中文短语语气词
    phrases = ["那个", "就是", "这个", "然后那个", "然后那个", "然后", "的话", "的话说"]
    for word in phrases:
        cleaned = cleaned.replace(word, "")

    # 处理自我纠正
    cleaned = re.sub(r'不对\s*应该是', '应该是', cleaned)
    cleaned = re.sub(r'不对\s*', '', cleaned)
    cleaned = re.sub(r'不是\s*应该是', '应该是', cleaned)

    # 处理重复：只处理完整的单词重复（2字符以上）
    cleaned = re.sub(r'\b(\w{2,})\s+\1\b', r'\1', cleaned)  # 英文单词重复
    cleaned = re.sub(r'([\u4e00-\u9fff])\s*\1', r'\1', cleaned)  # 中文字符重复

    # 去除多余空格（中文之间）
    result = []
    for i, char in enumerate(cleaned):
        if char == ' ':
            prev_chinese = i > 0 and ('\u4e00' <= cleaned[i-1] <= '\u9fff')
            next_chinese = i < len(cleaned)-1 and ('\u4e00' <= cleaned[i+1] <= '\u9fff')
            if prev_chinese and next_chinese:
                continue  # 中文之间去掉空格
            elif prev_chinese or next_chinese:
                result.append(char)  # 中英文之间保留空格
            else:
                result.append(char)  # 英文之间保留空格
        else:
            result.append(char)
    cleaned = ''.join(result)

    # 清理多余空格
    cleaned = re.sub(r'  +', ' ', cleaned).strip()

    return cleaned


def clean_with_qwen(text):
    """使用通义千问清理文本"""
    if not DASHSCOPE_API_KEY:
        return None  # 返回 None 表示使用本地清理

    url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    payload = {
        "model": "qwen-turbo",
        "messages": [
            {
                "role": "system",
                "content": "你是文本清理助手。只输出清理后的文本，不要任何解释、说明或分析。规则：1.去除语气词(嗯啊那个就是) 2.去除重复 3.处理自我纠正 4.添加标点 5.保持原意"
            },
            {"role": "user", "content": f"请清理：{text}"}
        ],
        "temperature": 0.1
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DASHSCOPE_API_KEY}"
            },
            method="POST"
        )
        print(f"   请求模型: {payload['model']}")
        print(f"   API Key 长度: {len(DASHSCOPE_API_KEY)}")
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            return result["choices"][0]["message"]["content"].strip()
    except Exception as e:
        # 读取错误响应体
        error_body = ""
        if hasattr(e, 'read'):
            try:
                error_body = e.read().decode('utf-8', errors='ignore')
            except:
                pass
        print(f"⚠️ Qwen API 调用失败: {e}")
        if error_body:
            print(f"   错误详情: {error_body[:200]}")
        return None  # 失败时回退到本地清理


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.webmanifest': 'application/manifest+json',
    }

    def do_POST(self):
        if self.path == "/api/clean":
            length = int(self.headers.get('Content-Length', 0))
            raw_body = self.rfile.read(length)
            try:
                body = json.loads(raw_body)
            except Exception as e:
                print(f"❌ POST 解析错误: {e}")
                print(f"   原始内容: {raw_body[:200]}")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": "Invalid JSON"}).encode())
                return

            text = body.get("text", "")
            print(f"\n📝 收到清理请求 (长度: {len(text)})")
            print(f"   原文: {text[:100]}...")

            # 先尝试 Qwen，失败则使用本地清理
            cleaned = clean_with_qwen(text)
            use_qwen = cleaned is not None

            if not use_qwen:
                print("   使用本地清理模式")
                cleaned = clean_text_local(text)

            print(f"   结果: {cleaned[:100]}...")
            print(f"   清理方式: {'✨ Qwen AI' if use_qwen else '📝 本地规则'}")

            response_data = json.dumps({
                "success": True,
                "cleaned_text": cleaned,
                "use_qwen": use_qwen
            })

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(response_data.encode())
            print("   ✅ 响应已发送\n")
        else:
            print(f"⚠️ 未找到路径: {self.path}")
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        """记录所有 HTTP 请求"""
        method = args[0].split()[0] if args[0] else '?'
        path = args[0].split()[1] if len(args[0].split()) > 1 else '?'
        status = args[1] if len(args) > 1 else '?'
        print(f"🌐 {method} {path} → {status}")


# 启动信息
has_api_key = bool(DASHSCOPE_API_KEY)
print(f"\n{'='*50}")
print(f"🎤 AI 语音输入 PWA")
print(f"{'='*50}")
print(f"📁 工作目录: {os.getcwd()}")
print(f"🔑 API Key: {'已配置' if has_api_key else '未配置（使用本地清理）'}")
if has_api_key:
    print(f"   来源: 环境变量 或 .env 文件")
print(f"🌐 浏览器访问: http://localhost:{PORT}")
print(f"📱 手机访问: http://[你的IP]:{PORT}")
print(f"📲 PWA: 支持安装到桌面/主屏幕")
print(f"{'='*50}\n")

HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
