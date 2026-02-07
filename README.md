# dingtalk-notify

> 将 OpenCode 的任务状态推送到钉钉群 - 实时掌握 AI 工作进展

一个 [OpenCode](https://github.com/sst/opencode) 插件，当任务完成、出错或需要人工介入时，自动发送通知到钉钉群。让你在手机/PC 上随时了解 OpenCode 的工作状态。

## 功能特点

- ✅ **任务完成通知** - 任务执行完毕，等待审查
- ❌ **错误告警** - 任务执行出错，需要处理
- ⏸️ **权限请求** - AI 需要权限才能继续
- ❓ **问题询问** - AI 有问题需要回答
- 🌙 **免打扰时段** - 支持设置安静时间
- 📱 **@指定成员** - 支持 @所有人或指定手机号

## 安装

### 方式一：通过 OCX 安装（推荐）

```bash
# 安装 OCX
curl -fsSL https://ocx.kdco.dev/install.sh | sh

# 添加插件
ocx add dingtalk-notify
```

### 方式二：手动安装

将 `src/plugin/dingtalk-notify.ts` 复制到你的 OpenCode 插件目录：

```bash
mkdir -p ~/.config/opencode/plugins
cp src/plugin/dingtalk-notify.ts ~/.config/opencode/plugins/
```

## 配置

创建配置文件 `~/.config/opencode/dingtalk-notify.json`：

```json
{
  "accessToken": "your-dingtalk-access-token",
  "secret": "your-dingtalk-secret",
  "notifyChildSessions": false,
  "atAll": false,
  "atMobiles": ["13800138000"],
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00"
  },
  "events": {
    "idle": true,
    "error": true,
    "permission": true,
    "question": true
  }
}
```

### 配置说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `accessToken` | string | - | 钉钉机器人 webhook 的 access_token |
| `secret` | string | - | 钉钉机器人安全设置的密钥 |
| `notifyChildSessions` | boolean | false | 是否通知子任务事件 |
| `atAll` | boolean | false | 是否 @所有人 |
| `atMobiles` | string[] | [] | 要 @ 的手机号列表 |
| `quietHours.enabled` | boolean | false | 是否开启免打扰 |
| `quietHours.start` | string | "22:00" | 免打扰开始时间 |
| `quietHours.end` | string | "08:00" | 免打扰结束时间 |
| `events.idle` | boolean | true | 任务完成时通知 |
| `events.error` | boolean | true | 任务出错时通知 |
| `events.permission` | boolean | true | 需要权限时通知 |
| `events.question` | boolean | true | 有问题时通知 |

## 获取钉钉机器人配置

1. 在钉钉群中创建自定义机器人
2. 复制 webhook 地址中的 `access_token` 参数
3. 设置安全方式为"加签"，复制密钥
4. 将这两个值填入配置文件

## 消息格式

插件会发送 Markdown 格式的消息到钉钉群：

### 任务完成
```
✅ OpenCode 任务完成

## ✅ 任务完成

**任务名称:** 修复登录 bug
**会话 ID:** ses_abc123
**状态:** 任务执行完成，等待您审查结果
**时间:** 2026/2/7 14:30:00
```

### 任务出错
```
❌ OpenCode 任务出错

## ❌ 任务执行出错

**任务名称:** 部署生产环境
**会话 ID:** ses_def456
**错误信息:** Connection timeout...
**时间:** 2026/2/7 14:35:00

⚠️ 需要人工介入处理
```

## 技术实现

本插件结合了以下两个项目的核心功能：

- **notify-dingtalk**: 钉钉消息发送逻辑（HMAC-SHA256 签名、Markdown 格式）
- **opencode-notify**: OpenCode 插件事件监听机制

## 许可证

MIT
