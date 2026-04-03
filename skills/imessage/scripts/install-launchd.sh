#!/bin/bash
# 安装 iMessage 监听器为 launchd 服务

PLIST_FILE="$HOME/Library/LaunchAgents/com.imessage.listener.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cat > "$PLIST_FILE" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
 "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.imessage.listener</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>SCRIPT_DIR/imessage-auto-exec.py</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>SCRIPT_DIR</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>/tmp/imessage-listener.log</string>
    
    <key>StandardErrorPath</key>
    <string>/tmp/imessage-listener.err</string>
</dict>
</plist>
EOF

# 替换脚本路径
sed -i '' "s|SCRIPT_DIR|$SCRIPT_DIR|g" "$PLIST_FILE"

# 加载服务
launchctl unload "$PLIST_FILE" 2>/dev/null
launchctl load "$PLIST_FILE"

echo "✅ iMessage 监听器已安装为 launchd 服务"
echo "📋 状态：launchctl list | grep imessage"
echo "🛑 停止：launchctl unload $PLIST_FILE"
echo "🔄 重启：launchctl unload $PLIST_FILE && launchctl load $PLIST_FILE"
