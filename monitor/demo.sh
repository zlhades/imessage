#!/bin/bash
# 演示脚本 - 展示完整工作流程

set -e

echo "============================================================"
echo "🚨 Incident Monitor 演示"
echo "============================================================"

# 进入 monitor 目录
cd "$(dirname "$0")"

# 清理旧数据
echo ""
echo "🧹 清理旧数据..."
rm -rf data/demo-*.jsonl data/demo-*-state.json 2>/dev/null || true

# 1. 创建初始消息
echo ""
echo "1️⃣  创建初始消息..."
cat > data/demo-incident.jsonl << 'EOF'
{"ts": "1", "user": "oncall", "text": "生产环境 API 响应超时，有人知道吗？"}
{"ts": "2", "user": "dev1", "text": "我也看到了，从 5 分钟前开始"}
{"ts": "3", "user": "oncall", "text": "影响范围多大？"}
{"ts": "4", "user": "dev1", "text": "错误率 30%，主要在支付服务"}
EOF

echo "✅ 已创建 4 条初始消息"
echo ""
echo "📄 消息内容:"
cat data/demo-incident.jsonl | while read line; do
  echo "  $line" | jq -r '.text' 2>/dev/null || echo "$line"
done

# 2. 启动监控（后台运行）
echo ""
echo "2️⃣  启动监控（间隔 3 秒，运行 10 秒）..."
echo "💡 提示：监控会在后台运行，检测新消息"

# 启动监控（超时 10 秒）
timeout 10 node bin/monitor.js data/demo-incident.jsonl --interval 3 &
MONITOR_PID=$!

# 等待 2 秒让监控启动
sleep 2

# 3. 添加新消息
echo ""
echo "3️⃣  添加新消息..."
echo '{"ts": "5", "user": "dev2", "text": "正在检查日志..."}' >> data/demo-incident.jsonl
echo "✅ 已添加：'正在检查日志...'"

# 等待监控检测
sleep 4

# 4. 再添加一条消息
echo ""
echo "4️⃣  添加更多消息..."
echo '{"ts": "6", "user": "dev2", "text": "发现数据库连接池满了"}' >> data/demo-incident.jsonl
echo "✅ 已添加：'发现数据库连接池满了'"

# 等待监控检测
sleep 4

# 5. 添加结束标记
echo ""
echo "5️⃣  添加结束标记..."
echo '{"ts": "7", "user": "dev1", "text": "已修复，是连接池配置问题 [CLOSED]"}' >> data/demo-incident.jsonl
echo "✅ 已添加：'已修复...[CLOSED]'"

# 等待监控自动停止
echo ""
echo "⏳ 等待监控检测到结束标记..."

# 等待监控结束或超时
wait $MONITOR_PID 2>/dev/null || true

# 6. 显示最终状态
echo ""
echo "6️⃣  显示最终状态..."
node bin/monitor.js data/demo-incident.jsonl --status

# 7. 显示完整对话
echo ""
echo "7️⃣  完整对话记录:"
echo "------------------------------------------------------------"
cat data/demo-incident.jsonl | while read line; do
  ts=$(echo "$line" | jq -r '.ts' 2>/dev/null || echo "?")
  user=$(echo "$line" | jq -r '.user' 2>/dev/null || echo "?")
  text=$(echo "$line" | jq -r '.text' 2>/dev/null || echo "$line")
  echo "[$user]: $text"
done
echo "------------------------------------------------------------"

# 清理
echo ""
echo "🧹 清理演示数据..."
rm -f data/demo-incident.jsonl data/demo-incident-state.json

echo ""
echo "============================================================"
echo "✅ 演示完成！"
echo "============================================================"
echo ""
echo "💡 提示:"
echo "  - 查看快速指南：cat QUICKSTART.md"
echo "  - 运行测试：npm test"
echo "  - 完整文档：cat README.md"
echo ""
