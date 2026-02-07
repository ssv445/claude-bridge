# Why This Exists (and What Failed First)

## The Problem

Claude Code blocks on user input. You step away from your desk, Claude hits a permission prompt or a question, and it sits there. You come back 20 minutes later to find it's been waiting on a 2-second approval. Multiply that across a day and you're losing hours.

The root issue: Claude Code sessions are tied to the terminal that spawned them. Close the tab, lose the session. Walk away from the machine, no way to respond.

## Approaches Tried (and Why They Failed)

### 1. VS Code Tunnel + Mobile Profile

**The idea:** Use VS Code's built-in tunnel feature to access sessions from a phone. Built a custom VS Code extension for tmux session management and a mobile-optimized profile.

**What went wrong:**
- VS Code extensions don't load in browser mode (mobile or desktop). The custom extension was dead on arrival for the mobile use case.
- Mobile profile wouldn't auto-apply via tunnel. Had to manually switch every time.
- Settings sync across tunnel was broken, possibly gated behind a paid account.
- VS Code's web UI is fundamentally not designed for small screens. Too many panels, too many menus, too much chrome.

**Verdict:** VS Code is great on desktop. On a phone browser, it's the wrong tool.

### 2. webmux (Open Source)

**The idea:** Use an existing open-source web-based tmux client instead of building one.

**What went wrong:**
- Required installing the entire Rust toolchain just to run.
- Cloned repo had broken node_modules (`@rollup/rollup-darwin-arm64` missing).
- Once running, it didn't detect existing tmux sessions.
- More time spent debugging the tool than it would take to build a simpler one.

**Verdict:** Over-engineered for the use case. Needed something minimal that just works.

### 3. Tailscale Networking (The 2-Hour Rabbit Hole)

**The idea:** Tailscale creates a private network between devices. Just serve the web app on a port and access it from any device on the tailnet. Should be trivial.

**What actually happened:**
- Web server ran fine on localhost. Phone on the same Tailscale network got connection timeouts.
- Added Node.js to macOS application firewall allowlist. Didn't fix it.
- Configured pfctl (packet filter) rules. Didn't fix it.
- Added pf anchor configurations. Still didn't fix it.
- Tried 10+ different server restart configurations. All failed.

After 2+ hours of firewall debugging, the fix was: **Tailscale > Settings > "Allow incoming connections" > ON**. One toggle. All the pfctl work was a red herring — macOS firewall was never the problem.

For comparison: ngrok and VS Code tunnel expose ports instantly with zero config. Tailscale is more private but that one hidden toggle cost 2 hours.

**Lesson:** When Tailscale connections fail, check Tailscale's own settings before touching the OS firewall. Documented in SETUP.md troubleshooting.

## Why the Current Approach Works

### tmux (session persistence)
- Sessions survive disconnects, terminal closures, even reboots (with resurrect + continuum)
- Multiple clients can attach to the same session simultaneously
- Battle-tested, zero overhead, already part of most dev setups

### Custom web UI (Next.js + xterm.js + WebSocket)
- Built exactly for the use case: list sessions, tap to attach, type
- xterm.js renders a real terminal in the browser, not a dumbed-down web shell
- node-pty spawns `tmux attach`, pipes I/O over WebSocket — simple and direct
- Mobile-first: virtual keyboard with Claude Code shortcuts (Ctrl+C, Ctrl+G, etc.) since phone keyboards can't send control sequences
- PWA mode removes browser chrome on iOS for a native app feel

### Tailscale (private networking)
- Nothing exposed to the public internet. No auth layer needed.
- HTTPS via `tailscale serve` with automatic certs.
- Works from any device on the tailnet — phone, tablet, laptop, another desktop.

### Why not just SSH from phone?
SSH works and is documented as a fallback (via Terminus). But:
- Setting up SSH keys on iOS is friction
- Terminus is a paid app for full features
- No session list UI — you have to remember session names and type `tmux attach -t name`
- The web UI is faster for quick interactions (tap a session, send a keystroke, done)

## The Virtual Keyboard Problem

Phone keyboards can't send terminal control sequences. You can't type Ctrl+C, Ctrl+G, Escape, or any of the shortcuts Claude Code relies on. Three iterations to get it right:

1. **Floating draggable keyboard** — covered the terminal, required manual positioning, annoying to use.
2. **Reorganized with 42 Claude Code shortcuts** — right keys, wrong UX. Still floating.
3. **Fixed bottom keyboard** — terminal shrinks to make room, no overlap, no dragging. Works like a native terminal app keyboard.

## iOS-Specific Annoyances

- **No Fullscreen API.** Safari on iOS doesn't support `document.requestFullscreen()`. Workaround: PWA mode via "Add to Home Screen" removes browser chrome entirely. Built a hint dialog to guide users to this.
- **PWA standalone detection** requires checking both `display-mode: standalone` media query and the Safari-specific `navigator.standalone` property.
- **Viewport height** uses `dvh` (dynamic viewport height) instead of `vh` to account for Safari's collapsing address bar.
