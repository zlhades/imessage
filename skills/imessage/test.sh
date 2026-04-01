#!/bin/bash
# iMessage Skill 测试脚本

SKILL="/Users/benson/Documents/incident/skills/imessage/imessage_skill.py"

echo "========================================"
echo "iMessage Skill 测试"
echo "========================================"

echo ""
echo "📋 测试 1: 获取最后一条消息 (+18336801616)"
echo "----------------------------------------"
python3 "$SKILL" last "+18336801616" | python3 -m json.tool

echo ""
echo "📋 测试 2: 搜索消息 (+18336801616, 最新 3 条)"
echo "----------------------------------------"
python3 "$SKILL" search "+18336801616" 3 | python3 -m json.tool

echo ""
echo "📋 测试 3: 获取联系人列表 (前 5 个)"
echo "----------------------------------------"
python3 "$SKILL" contacts | python3 -c "import sys,json; contacts=json.load(sys.stdin); print(json.dumps(contacts[:5], indent=2, ensure_ascii=False))"

echo ""
echo "📋 测试 4: 导出消息"
echo "----------------------------------------"
python3 "$SKILL" export "+18336801616" /tmp/test_messages.json
cat /tmp/test_messages.json | python3 -m json.tool | head -20

echo ""
echo "========================================"
echo "✅ 所有测试完成!"
echo "========================================"
