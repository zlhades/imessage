#!/bin/bash
# 一键启动脚本
# 使用方法: ./run.sh

# 检查是否已配置 API Key
if [ -z "$DASHSCOPE_API_KEY" ]; then
    # 尝试从 .env 文件加载
    if [ -f ".env" ]; then
        echo "📁 从 .env 文件加载 API Key..."
        export DASHSCOPE_API_KEY=$(grep DASHSCOPE_API_KEY .env | cut -d '=' -f2)
    fi
fi

if [ -z "$DASHSCOPE_API_KEY" ] || [ "$DASHSCOPE_API_KEY" = "your_api_key_here" ]; then
    echo "⚠️  未配置 API Key"
    echo ""
    echo "📝 请先配置通义千问 API Key:"
    echo ""
    echo "方法 1: 直接设置环境变量"
    echo "  export DASHSCOPE_API_KEY='你的Key'"
    echo ""
    echo "方法 2: 编辑 .env 文件"
    echo "  cp .env.example .env"
    echo "  nano .env  (填入你的 API Key)"
    echo ""
    echo "👉 获取 API Key: https://dashscope.console.aliyun.com/"
    echo ""
    echo "按回车继续使用本地清理模式..."
    read -t 10
    echo ""
    echo "🚀 启动服务（本地清理模式）..."
else
    echo "✅ API Key 已配置"
    echo "🚀 启动服务（AI 清理模式）..."
fi

echo ""
cd "$(dirname "$0")"
python3 app-light.py
