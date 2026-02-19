# claude-wormhole

Access your Claude Code sessions from any device. Phone, browser, laptop — same session, zero interruption.

> **Why "wormhole"?** A wormhole connects two distant points instantly. claude-wormhole does the same — it connects you to your running Claude Code session from wherever you are, as if you never left your desk.

[![Demo video](https://img.youtube.com/vi/f2igZfsvN4w/maxresdefault.jpg)](https://www.youtube.com/watch?v=f2igZfsvN4w)

## The Problem

Claude Code blocks on user input. It runs a 10-minute task, hits a permission prompt, and waits. You're on the couch, in a meeting, or grabbing coffee. By the time you're back, you've lost 20 minutes on a 2-second approval.

The root issue: sessions are tied to the terminal that spawned them. Close the tab, lose the session.

## How It Works

Sessions run in tmux on your Mac. You connect from whatever device is in front of you.

```
Phone (PWA)       ──┐
Browser           ──┤                ┌──────────────────────┐
Desktop terminal  ──┼── Tailscale ──>│  Mac / tmux           │
SSH (Terminus)    ──┘   private net  │   ├─ my-app (claude)  │
                                     │   ├─ api (claude)     │
                                     │   └─ scripts (bash)   │
                                     └──────────────────────┘
```

Start something on your desktop, approve a prompt from your phone, review the result on your laptop. Same session everywhere.

- **tmux** keeps sessions alive independent of any client
- **Next.js + xterm.js + WebSocket** serves a browser terminal that attaches to tmux sessions
- **Tailscale** creates a private network between your devices — nothing exposed to the internet
- **PWA** makes the terminal installable on iOS with no browser chrome
- **Push notifications** alert you when Claude needs input or finishes a task

## Quick Start

```sh
# 1. Set up the cld alias
echo 'alias cld="/path/to/claude-wormhole/scripts/cld.sh"' >> ~/.zshrc
source ~/.zshrc

# 2. Start a Claude session
cd ~/projects/my-app && cld

# 3. Start the web server
npm install && npm run dev

# 4. Expose over Tailscale
tailscale serve --bg 3100

# 5. Open on your phone
# https://your-machine.tailnet.ts.net/
```

## Project Structure

| Path | What |
|---|---|
| `server.ts` | Custom server — node-pty + WebSocket pipes tmux I/O to xterm.js |
| `src/` | Next.js app (session list, terminal view) |
| `public/` | PWA manifest + icons |
| `scripts/cld.sh` | CLI to launch Claude Code in tmux sessions |
| `scripts/tmux.conf` | tmux config with resurrect + continuum for persistence |

## Docs

- **[SETUP.md](SETUP.md)** — Full walkthrough: Tailscale, tmux, push notifications, PWA install, launchd service
- **[WHY.md](WHY.md)** — What failed first (VS Code tunnels, webmux) and why this approach won

## License

MIT
