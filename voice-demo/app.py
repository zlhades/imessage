#!/usr/bin/env python3
"""
AI 语音输入 Demo - 最小可用版本
功能：录音 → Whisper 转文字 → Qwen 清理 → 输出文本
"""

import os
import tempfile
import numpy as np
import sounddevice as sd
import soundfile as sf
import whisper
from flask import Flask, render_template, request, jsonify
from dashscope import Generation
import dashscope

app = Flask(__name__)

# 配置
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
dashscope.api_key = DASHSCOPE_API_KEY

# 加载 Whisper 模型 (small 平衡速度和准确率)
print("🔄 加载 Whisper 模型...")
whisper_model = whisper.load_model("small")
print("✅ Whisper 模型加载完成")

# 录音配置
SAMPLE_RATE = 16000  # Whisper 要求的采样率


def record_audio(duration=10):
    """录制音频"""
    print(f"🎤 开始录音 ({duration} 秒)...")
    recording = sd.rec(
        int(duration * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype=np.float32
    )
    sd.wait()
    print("✅ 录音完成")
    return recording


def save_audio(audio_data, filepath):
    """保存音频到文件"""
    sf.write(filepath, audio_data, SAMPLE_RATE)


def speech_to_text(audio_filepath):
    """使用 Whisper 将语音转为文字"""
    print("🔄 Whisper 转写中...")
    result = whisper_model.transcribe(
        audio_filepath,
        language="zh",
        fp16=False  # Mac 不支持 FP16
    )
    text = result.get("text", "").strip()
    print(f"✅ 转写完成: {text[:50]}...")
    return text


def clean_text_with_qwen(raw_text):
    """使用通义千问清理文本：去除语气词、重复、添加标点"""
    print("🔄 Qwen 清理文本中...")

    system_prompt = """你是一个专业的文本清理助手。请清理以下语音识别输出文本：

要求：
1. 去除语气词（嗯、啊、那个、就是、这个那个等）
2. 去除重复内容
3. 处理自我纠正（"不对，应该是" → 直接用正确版本）
4. 添加正确的标点符号
5. 保持用户的原始意思不变
6. 只输出清理后的文本，不要添加任何解释

请直接输出清理后的文本。"""

    response = Generation.call(
        model="qwen-turbo",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"请清理以下文本：\n\n{raw_text}"}
        ],
        max_tokens=1000,
        temperature=0.3
    )

    if response.status_code == 200:
        cleaned = response.output.text.strip()
        print(f"✅ 清理完成: {cleaned[:50]}...")
        return cleaned
    else:
        print(f"❌ Qwen 调用失败: {response.message}")
        return raw_text  # 失败时返回原始文本


@app.route("/")
def index():
    """主页"""
    return render_template("index.html")


@app.route("/api/record", methods=["POST"])
def api_record():
    """录音并转文字 API"""
    try:
        data = request.json
        duration = int(data.get("duration", 10))

        # 录音
        audio_data = record_audio(duration)

        # 保存临时文件
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            save_audio(audio_data, temp_path)

        # 语音转文字
        raw_text = speech_to_text(temp_path)

        # 清理文本
        cleaned_text = clean_text_with_qwen(raw_text)

        # 清理临时文件
        os.unlink(temp_path)

        return jsonify({
            "success": True,
            "raw_text": raw_text,
            "cleaned_text": cleaned_text
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/api/clean", methods=["POST"])
def api_clean():
    """仅清理文本 API"""
    try:
        data = request.json
        raw_text = data.get("text", "")

        if not raw_text:
            return jsonify({"success": False, "error": "文本不能为空"}), 400

        cleaned_text = clean_text_with_qwen(raw_text)

        return jsonify({
            "success": True,
            "cleaned_text": cleaned_text
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


if __name__ == "__main__":
    print("=" * 60)
    print("🎤 AI 语音输入 Demo")
    print("=" * 60)

    if not DASHSCOPE_API_KEY:
        print("⚠️  未设置 DASHSCOPE_API_KEY 环境变量")
        print("   Qwen 文本清理功能将不可用")
        print("   请运行: export DASHSCOPE_API_KEY=your_key")

    print("\n🚀 启动服务: http://localhost:5000")
    print("   按 Ctrl+C 停止\n")

    app.run(host="0.0.0.0", port=5000, debug=True)
