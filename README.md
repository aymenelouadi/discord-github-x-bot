# discord-github-x-bot

<div align="center">

<img src="https://img.shields.io/badge/Node.js-18%2B-43853d?style=for-the-badge&logo=node.js&logoColor=white"/>
<img src="https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white"/>
<img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge"/>
<img src="https://img.shields.io/badge/Open%20Source-%E2%9D%A4-red?style=for-the-badge"/>

**A flexible, extensible Discord bot that listens to GitHub webhooks and automatically publishes beautiful release announcements on X (Twitter) — with a Canvas-generated image card.**

[📦 Features](#-features) · [🚀 Quick Start](#-quick-start) · [⚙️ Configuration](#️-configuration) · [🐦 X Setup](#-getting-x-authtoken) · [🎨 Card Preview](#-canvas-card-layout) · [📡 Adding Repos](#-adding-more-repositories)

</div>

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔗 **GitHub Webhooks** | Listens for `release` and `push` events — supports unlimited repos |
| 🎨 **Canvas Image** | Auto-generates a 1200×630 announcement card with logo, name, version & changelog |
| 🖼 **Discord Server Logo** | Fetched automatically from your Discord guild via bot token |
| 🐦 **X Auto-Tweet** | Posts a formatted tweet with the image, **no official Twitter API key needed** |
| 📊 **Discord Embed** | Rich branded embed sent to your announcement channel simultaneously |
| 🗄 **Deduplication DB** | JSON database prevents double-posting the same release |
| 🧩 **Multi-Repo** | Monitor multiple GitHub repos, each with different Discord channels & Twitter settings |
| 🔐 **MIT License** | Fully open source, free to use and extend |

---

## 📁 Project Structure

```
discord-github-x-bot/
├── index.js                        ← Entry point — boots all systems
├── config.json                     ← All non-secret configuration
├── .env                            ← 🔒 Secret tokens (never commit!)
├── .gitignore
├── LICENSE
├── README.md
│
├── commands/
│   └── status.js                   ← !status Discord command
│
├── database/
│   ├── db.js                       ← JSON database (deduplication)
│   └── data.json                   ← Auto-created at first run
│
├── media/                          ← Generated PNG announcement cards
│
├── systems/
│   ├── discord/
│   │   ├── client.js               ← Discord.js bot client + guild icon fetcher
│   │   └── canvas.js               ← 🎨 Canvas image generator (1200×630)
│   ├── github/
│   │   ├── webhook.js              ← Express server — receives GitHub webhooks
│   │   └── handler.js              ← Pipeline orchestrator (logo → canvas → Discord → X)
│   └── twitter/
│       ├── poster.js               ← X poster via auth_token cookie
│       └── formatter.js            ← Builds beautiful tweet text
│
└── utils/
    └── logger.js                   ← Colorful timestamped console logger
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js v18+** — [nodejs.org](https://nodejs.org)
- A **Discord bot** with `Send Messages`, `Attach Files`, `Embed Links` permissions — [Discord Developer Portal](https://discord.com/developers/applications)
- A **GitHub account** with webhook access to your repo(s)
- An **X (Twitter) account** you're logged into in your browser

---

### Step 1 — Clone & Install

```bash
git clone https://github.com/aymenelouadi/discord-github-x-bot.git
cd discord-github-x-bot
npm install
```

> **Windows users:** `canvas` requires native build tools. Run once if needed:
> ```bash
> npm install --global --production windows-build-tools
> ```

---

### Step 2 — Create your `.env` file

Create a `.env` file in the project root:

```env
# ── Discord ─────────────────────────────────────────────────
DISCORD_TOKEN=your_discord_bot_token_here

# ── GitHub ──────────────────────────────────────────────────
GITHUB_TOKEN=ghp_your_github_classic_token

# ── X (Twitter) ─────────────────────────────────────────────
TWITTER_AUTH_TOKEN=your_auth_token_cookie_value
TWITTER_CT0=your_ct0_cookie_value

# ── Webhook Server ───────────────────────────────────────────
WEBHOOK_PORT=3000
WEBHOOK_SECRET=optional_secret_for_hmac_verification
```

> How to get each token: see [Discord Token](#-discord-token), [GitHub Token](#-github-token), and [X auth_token](#-getting-x-authtoken) sections below.

---

### Step 3 — Configure `config.json`

Edit the `repositories` array — add one entry per GitHub repo you want to watch:

```json
{
  "repositories": [
    {
      "id":            "my-awesome-project",
      "enabled":       true,
      "repo":          "github-username/repo-name",
      "events":        ["release", "push"],
      "branch_filter": "main",

      "discord": {
        "guild_id":          "123456789012345678",
        "channel_id":        "987654321098765432",
        "notify_on_push":    false,
        "notify_on_release": true,
        "embed_color":       "#58b9ff"
      },

      "twitter": {
        "enabled":         true,
        "post_on_push":    false,
        "post_on_release": true,
        "hashtags":        ["OpenSource", "GitHub", "JavaScript"]
      },

      "project": {
        "name":              "My Awesome Project",
        "short_description": "A great open-source tool",
        "language":          "JavaScript",
        "logo_source":       "discord_guild"
      }
    }
  ]
}
```

> **`logo_source: "discord_guild"`** — the bot fetches your Discord server icon automatically and uses it in the card image.

---

### Step 4 — Set up the GitHub Webhook

In your GitHub repository → **Settings** → **Webhooks** → **Add webhook**:

| Field | Value |
|---|---|
| Payload URL | `https://your-domain.com/github/webhook` |
| Content type | `application/json` |
| Secret | Same value as `WEBHOOK_SECRET` in `.env` (optional) |
| Which events? | ☑ **Releases** · ☑ **Pushes** |
| Active | ✅ |

The Payload URL is built from `WEBHOOK_PUBLIC_URL` (`.env`) + the path in `config.json`:

```
# Example with a real domain:
WEBHOOK_PUBLIC_URL=https://your-domain.com
# → Payload URL = https://your-domain.com/github/webhook

# Example with localhost (no WEBHOOK_PUBLIC_URL set):
# → Payload URL = http://localhost:3000/github/webhook
```

> **No domain yet?** Use [ngrok](https://ngrok.com) for local testing:
> ```bash
> ngrok http 3000
> # Then set WEBHOOK_PUBLIC_URL=https://xxxx.ngrok.io
> ```

---

### Step 5 — Run

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

You should see:

```
  ╔══════════════════════════════════════════════╗
  ║   Discord × GitHub × X Auto-Publisher v1.0  ║
  ║              MIT License  🚀                 ║
  ╚══════════════════════════════════════════════╝

2026-03-13 12:00:00  [DISCORD]  Logged in as YourBot#1234
2026-03-13 12:00:01  [TWITTER]  Authenticated via auth_token cookie ✓
2026-03-13 12:00:01  [GITHUB ]  Webhook server listening on port 3000
2026-03-13 12:00:01  [GITHUB ]  Endpoint: POST http://localhost:3000/github/webhook
──────────────────────────────────────────────────────────────────────
2026-03-13 12:00:01  [SUCCESS]  All systems online. Listening for GitHub webhooks…
```

---

## ⚙️ Configuration

### Full `config.json` reference

```json
{
  "webhook_server": {
    "port": 3000,                   // Port the Express server listens on
    "path": "/github/webhook"       // Endpoint path
  },

  "discord": {
    "prefix": "!",                  // Bot command prefix
    "status_message": "Watching GitHub 🚀"
  },

  "repositories": [ /* see above */ ],

  "twitter": {
    "tweet_templates": {
      "release": {
        "header": "🚀 New Release Drop",
        "footer": "Built with ❤️ — Open Source under MIT License",
        "max_changelog_lines": 5    // Max bullet points shown in tweet
      },
      "push": {
        "header": "⚡ New Update Pushed",
        "footer": "Stay tuned for more updates!",
        "max_changelog_lines": 3
      }
    }
  },

  "canvas": {
    "width": 1200,
    "height": 630,
    "theme": {
      "bg_gradient_start":  "#0d1117",
      "bg_gradient_end":    "#161b22",
      "accent":             "#58b9ff",
      "accent_secondary":   "#7c3aed",
      "text_primary":       "#f0f6fc",
      "text_secondary":     "#8b949e",
      "logo_glow":          "#58b9ff"
    }
  }
}
```

---

## 🤖 Discord Token

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application** → give it a name
3. **Bot** tab → **Reset Token** → copy the token → paste as `DISCORD_TOKEN` in `.env`
4. **OAuth2 → URL Generator**: scopes `bot`, permissions: `Send Messages`, `Embed Links`, `Attach Files`
5. Open the generated URL and invite the bot to your server

---

## 🔑 GitHub Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**
2. Scopes needed: `repo` (private repos) or `public_repo` (public repos only)
3. Copy and paste as `GITHUB_TOKEN` in `.env`

---

## 🐦 Getting X `auth_token`

The bot uses **browser session cookies** — no Twitter Developer API required.

1. Log in to [x.com](https://x.com) in your browser
2. Open **DevTools** (`F12`) → **Application** tab → **Cookies** → `https://x.com`
3. Copy **`auth_token`** → paste as `TWITTER_AUTH_TOKEN` in `.env`
4. Copy **`ct0`** → paste as `TWITTER_CT0` in `.env`

```
DevTools → Application → Storage → Cookies → https://x.com
  auth_token  →  ebb31c...    ← copy this
  ct0         →  abc123...    ← copy this too
```

> ⚠️ **Cookies expire** when you log out or after some time. Re-copy them if tweets stop posting.
> ⚠️ **Do NOT log out** of X while the bot is running.

---

## 🎨 Tweet Format (Release)

When a new GitHub Release is published, the bot automatically posts:

```
🚀 New Release Drop

📦 My Awesome Project  v2.1.0
💬 A great open-source tool

✨ What's New:
  ▸ Added dark mode support
  ▸ 40% performance improvement
  ▸ Fixed critical bug in parser
  ▸ New CLI interface

🔗 https://github.com/owner/repo/releases/tag/v2.1.0

#OpenSource #GitHub #JavaScript

Built with ❤️ — Open Source under MIT License
```

---

## 🖼 Canvas Card Layout

The generated `1200×630` PNG card is attached to each tweet and Discord embed:

```
┌──────────────────────────────────────────────────────────────┐  ← accent line
│                                                              │
│   ╭────╮   My Awesome Project         [v2.1.0] [JavaScript] │
│   │LOGO│                                                     │
│   ╰────╯   A great open-source tool                         │
│            ─────────────────────────────────────────         │
│            ▸ Added dark mode support                         │
│            ▸ 40% performance improvement                     │
│            ▸ Fixed critical bug in parser                    │
│                                                              │
│  ⚙ github.com/owner/repo                  📄 MIT License   │
└──────────────────────────────────────────────────────────────┘  ← accent line
```

> The logo is circular with a neon glow ring. If no Discord guild icon is found, an auto-generated colored avatar with the project's initial letter is used as fallback.

---

## 📡 Adding More Repositories

No code changes needed — add another object to `config.json`:

```json
{
  "repositories": [
    { "id": "project-one",   "repo": "you/project-one",   ... },
    { "id": "project-two",   "repo": "you/project-two",   ... },
    { "id": "project-three", "repo": "org/another-repo",  ... }
  ]
}
```

Each repo can independently configure:
- Discord channel & embed color
- Twitter hashtags and on/off per event type
- Branch filter for push events

---

## 📊 Bot Commands

| Command | Description |
|---|---|
| `!status` | Shows monitored repos, total posts, recent releases and bot uptime |

---

## 🔌 Health Check

While the bot is running:

```bash
GET http://localhost:3000/health
```

Returns:
```json
{
  "ok": true,
  "uptime": 3600,
  "repositories": ["owner/repo-one", "owner/repo-two"],
  "timestamp": "2026-03-13T12:00:00.000Z"
}
```

---

## 🤝 Contributing

Pull requests are welcome! Open an issue first for major changes.

1. Fork: [github.com/aymenelouadi/discord-github-x-bot](https://github.com/aymenelouadi/discord-github-x-bot)
2. Create your branch: `git checkout -b feat/amazing-feature`
3. Commit: `git commit -m 'feat: add amazing feature'`
4. Push: `git push origin feat/amazing-feature`
5. Open a Pull Request

---

## 📜 License

[MIT](LICENSE) © 2026 [aymenelouadi](https://github.com/aymenelouadi)

---

<div align="center">
  <sub>Built with ❤️ · <a href="https://github.com/aymenelouadi/discord-github-x-bot">github.com/aymenelouadi/discord-github-x-bot</a></sub>
</div>
