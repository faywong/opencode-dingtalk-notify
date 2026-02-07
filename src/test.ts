/**
 * Test script for dingtalk-notify plugin
 * Tests the DingTalk message sending functionality
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface DingTalkConfig {
  accessToken: string
  secret: string
}

async function loadConfig(): Promise<DingTalkConfig | null> {
  try {
    const configPath = path.join(__dirname, "../config.example.json")
    const content = await fs.readFile(configPath, "utf8")
    return JSON.parse(content) as DingTalkConfig
  } catch {
    return null
  }
}

async function sendTestMessage(config: DingTalkConfig): Promise<void> {
  const crypto = await import("node:crypto")
  
  const timestamp = Date.now()
  const sign = crypto
    .createHmac("sha256", config.secret)
    .update(`${timestamp}\n${config.secret}`)
    .digest("base64")

  const messageData = {
    msgtype: "markdown",
    markdown: {
      title: "🧪 DingTalk-Notify 测试消息",
      text: `## 🧪 测试消息

**插件:** dingtalk-notify
**状态:** ✅ 配置正确，消息发送成功

**时间:** ${new Date().toLocaleString("zh-CN")}

---
如果看到这条消息，说明插件配置正确，可以正常使用！`,
    },
    at: {
      atMobiles: [],
      isAtAll: false,
    },
  }

  try {
    const response = await fetch(
      `https://oapi.dingtalk.com/robot/send?access_token=${config.accessToken}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
      }
    )

    const result = await response.json() as { errcode: number; errmsg: string }

    if (result.errcode !== 0) {
      console.error(`❌ Failed to send message: ${result.errmsg}`)
      process.exit(1)
    } else {
      console.log("✅ Test message sent successfully!")
      console.log("Please check your DingTalk group for the test message.")
    }
  } catch (error) {
    console.error("❌ Error sending message:", error)
    process.exit(1)
  }
}

async function main() {
  console.log("🚀 Testing dingtalk-notify plugin...\n")
  
  const config = await loadConfig()
  
  if (!config || !config.accessToken || !config.secret) {
    console.error("❌ Config not found or incomplete. Please check config.example.json")
    process.exit(1)
  }
  
  console.log("📋 Configuration loaded:")
  console.log(`   Access Token: ${config.accessToken.slice(0, 10)}...${config.accessToken.slice(-10)}`)
  console.log(`   Secret: ${config.secret.slice(0, 10)}...${config.secret.slice(-10)}\n`)
  
  await sendTestMessage(config)
}

main()
