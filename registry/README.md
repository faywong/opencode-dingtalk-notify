# faywong Registry

OCX Registry for opencode-dingtalk-notify plugin.

## Deploy

### Cloudflare Workers

```bash
cd registry
bun install
bun run deploy
```

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/faywong/opencode-dingtalk-notify)

### Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/faywong/opencode-dingtalk-notify)

## Usage

Once deployed, users can install the plugin:

```bash
# Add the registry
ocx registry add https://your-registry-url.com --name faywong

# Install the plugin
ocx add faywong/dingtalk-notify
```

## Components

### dingtalk-notify

DingTalk (钉钉) notifications for OpenCode - send task updates to your team via webhook.

**Features:**
- Send notifications to DingTalk group via webhook
- Support for session completion, errors, and permission requests
- Markdown formatted messages with session details
- Configurable webhook URL and secret
- Quiet hours support
- @ mentions support

**Configuration:**

Create `~/.config/opencode/dingtalk-notify.json`:

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

## Development

```bash
# Build the registry
bun run build

# Local development
bun run dev
```

## License

MIT
