/**
 * dingtalk-notify
 * DingTalk (钉钉) notifications for OpenCode
 *
 * Philosophy: "Notify your team when OpenCode needs attention or completes work."
 *
 * Features:
 * - Send notifications to DingTalk group via webhook
 * - Support for session completion, errors, and permission requests
 * - Markdown formatted messages with session details
 * - Configurable webhook URL and secret
 *
 * Based on:
 * - notify-dingtalk: DingTalk message sending logic
 * - opencode-notify: OpenCode plugin event handling
 */

import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import * as crypto from "node:crypto"
import type { Plugin } from "@opencode-ai/plugin"
import type { Event } from "@opencode-ai/sdk"

// ==========================================
// TYPE DEFINITIONS
// ==========================================

interface OpencodeClient {
  session: {
    get: (params: { path: { id: string } }) => Promise<{
      data?: {
        id?: string
        title?: string
        parentID?: string
        status?: string
      }
    }>
  }
}

interface DingTalkConfig {
  /** DingTalk webhook access token */
  accessToken: string
  /** DingTalk webhook secret for signature */
  secret: string
  /** Whether to notify for child/sub-session events (default: false) */
  notifyChildSessions: boolean
  /** Whether to @all in the group (default: false) */
  atAll: boolean
  /** Specific mobile numbers to @ (optional) */
  atMobiles: string[]
  /** Quiet hours configuration */
  quietHours: {
    enabled: boolean
    start: string // "HH:MM" format
    end: string // "HH:MM" format
  }
  /** Enable/disable notifications for specific events */
  events: {
    idle: boolean
    error: boolean
    permission: boolean
    question: boolean
  }
}

const DEFAULT_CONFIG: DingTalkConfig = {
  accessToken: "",
  secret: "",
  notifyChildSessions: false,
  atAll: false,
  atMobiles: [],
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
  },
  events: {
    idle: true,
    error: true,
    permission: true,
    question: true,
  },
}

// ==========================================
// CONFIGURATION LOADING
// ==========================================

async function loadConfig(): Promise<DingTalkConfig> {
  const configPath = path.join(os.homedir(), ".config", "opencode", "dingtalk-notify.json")

  try {
    const content = await fs.readFile(configPath, "utf8")
    const userConfig = JSON.parse(content) as Partial<DingTalkConfig>

    // Merge with defaults
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      quietHours: {
        ...DEFAULT_CONFIG.quietHours,
        ...userConfig.quietHours,
      },
      events: {
        ...DEFAULT_CONFIG.events,
        ...userConfig.events,
      },
    }
  } catch {
    // Config doesn't exist or is invalid, use defaults
    return DEFAULT_CONFIG
  }
}

// ==========================================
// DINGTALK MESSAGE SENDING
// ==========================================

interface SendMessageOptions {
  accessToken: string
  secret: string
  title: string
  content: string
  atAll?: boolean
  atMobiles?: string[]
}

async function sendDingTalkMessage(
  client: OpencodeClient,
  options: SendMessageOptions,
): Promise<void> {
  const { accessToken, secret, title, content, atAll = false, atMobiles = [] } = options

  if (!accessToken) {
    await (client as any).app?.log({
      body: {
        service: "dingtalk-notify",
        level: "error",
        message: "accessToken is not configured",
      },
    }).catch(() => {})
    return
  }

  if (!secret) {
    await (client as any).app?.log({
      body: {
        service: "dingtalk-notify",
        level: "error",
        message: "secret is not configured",
      },
    }).catch(() => {})
    return
  }

  try {
    const timestamp = Date.now()
    const sign = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}\n${secret}`)
      .digest("base64")

    const messageData = {
      msgtype: "markdown",
      markdown: {
        title: title,
        text: content,
      },
      at: {
        atMobiles: atMobiles,
        isAtAll: atAll,
      },
    }

    // Add @mentions to message text if needed
    if (!atAll && atMobiles.length > 0) {
      const mobilesToMention = atMobiles.filter(mobile => !content.includes(`@${mobile}`))
      if (mobilesToMention.length > 0) {
        const atText = mobilesToMention.map(m => `@${m}`).join(" ")
        messageData.markdown.text += `\n\n<!-- ${atText} -->`
      }
    }

    const response = await fetch(
      `https://oapi.dingtalk.com/robot/send?access_token=${accessToken}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`,
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
      await (client as any).app?.log({
        body: {
          service: "dingtalk-notify",
          level: "error",
          message: `Failed to send message: ${result.errmsg}`,
        },
      }).catch(() => {})
    } else {
      await (client as any).app?.log({
        body: {
          service: "dingtalk-notify",
          level: "info",
          message: `Message sent successfully: ${title}`,
        },
      }).catch(() => {})
    }
  } catch (error) {
    await (client as any).app?.log({
      body: {
        service: "dingtalk-notify",
        level: "error",
        message: "Error sending message",
        extra: { error: String(error) },
      },
    }).catch(() => {})
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function isQuietHours(config: DingTalkConfig): boolean {
  if (!config.quietHours.enabled) return false

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [startHour, startMin] = config.quietHours.start.split(":").map(Number)
  const [endHour, endMin] = config.quietHours.end.split(":").map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes
}

async function isParentSession(client: OpencodeClient, sessionID: string): Promise<boolean> {
  try {
    const session = await client.session.get({ path: { id: sessionID } })
    // No parentID means this IS the parent/root session
    return !session.data?.parentID
  } catch {
    // If we can't fetch, assume it's a parent to be safe (notify rather than miss)
    return true
  }
}

// ==========================================
// MESSAGE FORMATTERS
// ==========================================

function formatSessionIdleMessage(sessionTitle: string, sessionID: string): { title: string; content: string } {
  const title = "✅ OpenCode 任务完成"
  const content = `## ✅ 任务完成

**任务名称:** ${sessionTitle}

**会话 ID:** \`${sessionID}\`

**状态:** 任务执行完成，等待您审查结果

**时间:** ${new Date().toLocaleString("zh-CN")}

`

  return { title, content }
}

function formatSessionErrorMessage(sessionTitle: string, sessionID: string, error?: string): { title: string; content: string } {
  const title = "❌ OpenCode 任务出错"
  const errorContent = error ? error.slice(0, 500) : "未知错误"
  
  const content = `## ❌ 任务执行出错

**任务名称:** ${sessionTitle}

**会话 ID:** \`${sessionID}\`

**错误信息:**
\`\`\`
${errorContent}
\`\`\`

**时间:** ${new Date().toLocaleString("zh-CN")}

---
⚠️ 需要人工介入处理`

  return { title, content }
}

function formatPermissionMessage(): { title: string; content: string } {
  const title = "⏸️ OpenCode 需要权限"
  
  const content = `## ⏸️ 等待权限确认

**状态:** OpenCode 需要您的权限才能继续执行

**时间:** ${new Date().toLocaleString("zh-CN")}

---
🔔 请及时处理，AI 正在等待您的响应`

  return { title, content }
}

function formatQuestionMessage(): { title: string; content: string } {
  const title = "❓ OpenCode 有问题要问"
  
  const content = `## ❓ 需要您的输入

**状态:** OpenCode 有一个问题需要您回答

**时间:** ${new Date().toLocaleString("zh-CN")}

---
💬 请查看终端并回答问题`

  return { title, content }
}

// ==========================================
// EVENT HANDLERS
// ==========================================

async function handleSessionIdle(
  client: OpencodeClient,
  sessionID: string,
  config: DingTalkConfig,
): Promise<void> {
  if (!config.events.idle) return

  // Check if we should notify for this session
  if (!config.notifyChildSessions) {
    const isParent = await isParentSession(client, sessionID)
    if (!isParent) return
  }

  // Check quiet hours
  if (isQuietHours(config)) return

  // Get session info for context
  let sessionTitle = "未命名任务"
  try {
    const session = await client.session.get({ path: { id: sessionID } })
    if (session.data?.title) {
      sessionTitle = session.data.title.slice(0, 100)
    }
  } catch {
    // Use default title
  }

  const { title, content } = formatSessionIdleMessage(sessionTitle, sessionID)

  await sendDingTalkMessage(client, {
    accessToken: config.accessToken,
    secret: config.secret,
    title,
    content,
    atAll: config.atAll,
    atMobiles: config.atMobiles,
  })
}

async function handleSessionError(
  client: OpencodeClient,
  sessionID: string,
  error: string | undefined,
  config: DingTalkConfig,
): Promise<void> {
  if (!config.events.error) return

  // Check if we should notify for this session
  if (!config.notifyChildSessions) {
    const isParent = await isParentSession(client, sessionID)
    if (!isParent) return
  }

  // Check quiet hours
  if (isQuietHours(config)) return

  // Get session info for context
  let sessionTitle = "未命名任务"
  try {
    const session = await client.session.get({ path: { id: sessionID } })
    if (session.data?.title) {
      sessionTitle = session.data.title.slice(0, 100)
    }
  } catch {
    // Use default title
  }

  const errorMessage = typeof error === "string" ? error : JSON.stringify(error)
  const { title, content } = formatSessionErrorMessage(sessionTitle, sessionID, errorMessage)

  await sendDingTalkMessage(client, {
    accessToken: config.accessToken,
    secret: config.secret,
    title,
    content,
    atAll: config.atAll,
    atMobiles: config.atMobiles,
  })
}

async function handlePermissionUpdated(
  client: OpencodeClient,
  config: DingTalkConfig,
): Promise<void> {
  if (!config.events.permission) return

  // Always notify for permission events - AI is blocked waiting for human
  // Check quiet hours
  if (isQuietHours(config)) return

  const { title, content } = formatPermissionMessage()

  await sendDingTalkMessage(client, {
    accessToken: config.accessToken,
    secret: config.secret,
    title,
    content,
    atAll: config.atAll,
    atMobiles: config.atMobiles,
  })
}

async function handleQuestionAsked(
  client: OpencodeClient,
  config: DingTalkConfig,
): Promise<void> {
  if (!config.events.question) return

  // Check quiet hours
  if (isQuietHours(config)) return

  const { title, content } = formatQuestionMessage()

  await sendDingTalkMessage(client, {
    accessToken: config.accessToken,
    secret: config.secret,
    title,
    content,
    atAll: config.atAll,
    atMobiles: config.atMobiles,
  })
}

// ==========================================
// PLUGIN EXPORT
// ==========================================

export const DingTalkPlugin: Plugin = async (ctx) => {
  const { client } = ctx

  // Load config once at startup
  const config = await loadConfig()

  // Validate config
  if (!config.accessToken || !config.secret) {
    await (client as any).app?.log({
      body: {
        service: "dingtalk-notify",
        level: "warn",
        message: "accessToken or secret not configured. Please set up ~/.config/opencode/dingtalk-notify.json",
      },
    }).catch(() => {})
  }

  return {
    "tool.execute.before": async (input: { tool: string; sessionID: string; callID: string }) => {
      if (input.tool === "question") {
        await handleQuestionAsked(client as OpencodeClient, config)
      }
    },
    event: async ({ event }: { event: Event }): Promise<void> => {
      switch (event.type) {
        case "session.idle": {
          const sessionID = event.properties.sessionID
          if (sessionID) {
            await handleSessionIdle(client as OpencodeClient, sessionID, config)
          }
          break
        }
        case "session.error": {
          const sessionID = event.properties.sessionID
          const error = event.properties.error
          if (sessionID) {
            await handleSessionError(
              client as OpencodeClient,
              sessionID,
              typeof error === "string" ? error : JSON.stringify(error),
              config,
            )
          }
          break
        }
        case "permission.updated": {
          await handlePermissionUpdated(client as OpencodeClient, config)
          break
        }
      }
    },
  }
}

export default DingTalkPlugin
