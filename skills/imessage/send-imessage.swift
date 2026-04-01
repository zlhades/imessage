#!/usr/bin/env swift
import Foundation
import ScriptingBridge

// 使用 SBApplication 发送 iMessage
@main
struct SendIMessage {
    static func main() {
        let args = CommandLine.arguments
        if args.count < 3 {
            print("用法：send-imessage <contact> <message>")
            exit(1)
        }
        
        let contact = args[1]
        let message = args[2]
        
        // 使用 Messages 应用发送
        let appleScript = """
        tell application "Messages"
            send "\(message.replacingOccurrences(of: "\"", with: "\\\""))" to buddy "\(contact)" of (service 1 whose service type is iMessage)
        end tell
        """
        
        var error: NSDictionary?
        if let scriptObject = NSAppleScript(source: appleScript) {
            let result = scriptObject.executeAndReturnError(&error)
            if let err = error {
                print("❌ 错误：\(err)")
                exit(1)
            }
            print("✅ 发送成功")
        }
    }
}
