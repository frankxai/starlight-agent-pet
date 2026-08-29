# ✦ Starlight Agent Pet & Fleet Observatory

> **Unified Real-Time Coding Agent Telemetry, Cost Optimizer & Interactive Desktop Companion**  
> *Sovereign Telemetry Substrate for Claude Code, Codex CLI, Antigravity, Hermes Agent, Kilo, and Grok.*

---

## 🌌 Overview

**Starlight Agent Pet** is a next-generation local-first telemetry engine and interactive desktop companion designed for AI-native engineers running multi-agent CLI swarms.

It absorbs the best token calculation algorithms from **`ccusage`** and **`tokscale`**, the interactive desktop pet mechanics from **`Clyde`** and **`AgentPet`**, and the dynamic island / live WebSocket stream patterns from **`Claude Buddy`**, elevating them into a unified, glassmorphic **Observatory HUD** tailored for Frank's Starlight & Arcanea ecosystem.

```
       /\_/\    ✦ STELLARIS [Level 10]
      ( o.o )   Gate 10: Unity (Nexus Master)
       > ^ <    XP: [████████░░] 840/1000
                Mood: "Hyper-Focus / Burning code fast!"
```

---

## ✨ Key Capabilities

1. **Multi-Harness Auto-Discovery & Live Tailing**
   - **Claude Code**: Tail `~/.claude/projects/**/*.jsonl`, active tasks from `~/.claude/todos/`, context bridge files (`claude-ctx-*.json`), prompt cache reads & 1h/5m creation discounts.
   - **Antigravity (Gemini)**: Tail `~/.gemini/antigravity/brain/**/transcript.jsonl` with step indexing and subagent swarms.
   - **Codex CLI / Codex App**: Auto-detect active workspace roots and global state from `~/.codex/`.
   - **Hermes Agent**: Live queue and log monitor from `AppData/Local/hermes` and `~/.hermes/`.
   - **Kilo / Grok / ACOS**: Cross-harness auto-router session detection and worktree monitoring.

2. **Interactive Floating Pet & 5 Archetype Companions**
   - 🦊 **Stellaris (Celestial Cosmic Kitsune)**: 9 pulsing celestial tails, reactive eyes that track cursor, and star dust trails.
   - 💎 **Arcanea Luminor**: Floating crystalline geometric golem with rotating elemental shards representing the 10 Gates.
   - 🤖 **Cyber-Pulsar 2077**: Retro cyber-bot with digital visor LED matrix and particle jet thrusters.
   - 🐈 **Kuro-Neko Astral**: Space Void Cat with celestial crescent moon, glowing slit eyes, and floating rune dust.
   - 👑 **Starlight Queen Hive-Mind**: Geodesic constellation orb with dynamic particle links and orbiting queen familiars.

3. **Web Audio API Synth Engine (Zero Audio File Dependencies)**
   - Synthesizes dynamic harmonics for task completion chimes (880Hz + 1318Hz), level-up arpeggios, permission alerts, and purrs when poked.

4. **Holographic Permission Cards & Interactive Approval**
   - When any agent requests tool permission, an interactive card floats next to the pet with `[Approve]` and `[Deny]` buttons to resolve without switching terminal tabs.

5. **Prompt Cache Savings & Budget Optimizer**
   - API-equivalent cache economics for supported model pricing; never presented as an invoice or guaranteed cash saving.
   - Context window health radar alerting before auto-compaction.

6. **Measured Usage Intelligence**
   - Reads Tokscale's local-log report for today's fresh input, output, cache-read, cache-write, message, harness, and model totals.
   - Displays authenticated provider quota windows when Tokscale exposes them, including used/remaining percentages and reset times.
   - Labels cost as an **API-equivalent estimate** unless a provider source explicitly reports actual billed cost. Subscription and bundled-plan charges can differ.
   - Never substitutes fixed synthetic token values when a usage source is unavailable.

7. **Constellation Mini HUD + Command Center Bridge**
   - A draggable two-row rail keeps Codex, Claude, Grok, Antigravity, and OpenCode visible without opening the full dashboard.
   - Codex and Claude show authenticated subscription-limit usage when available. Providers without a quota feed show today's measured token share and are labeled differently so the percentages are never conflated.
   - Expands in place to every detected model, every quota window, and fixed read-only routes into the local Starlight Command Center at `127.0.0.1:4321`.
   - `?mode=compact` is shell-neutral and now runs inside the transparent, always-on-top Electron desktop companion.

8. **Shell Statusline & Multi-Machine Sync**
   - `starlight-pet prompt`: Compact one-line statusline for PowerShell `$PROFILE`, Bash `.bashrc`, Zsh, or Starship.
   - `starlight-pet sync`: Snapshots telemetry for multi-machine synchronization (`@frank-desktop` and `@yoga-c940`).

---

## 🚀 Quick Start

### 1. Install & Build
```bash
# Clone or navigate to the repo
cd C:/Users/frank/starlight/repos/starlight-agent-pet

# Install dependencies and compile TypeScript
pnpm install
pnpm build
```

### 2. View terminal status
```bash
node bin/starlight-pet.js status
```

### 3. Launch the native floating desktop companion

```bash
pnpm desktop
```

The companion opens as a frameless, transparent, always-on-top window. Drag it by the pet, click the rail to expand details, and right-click for command center or quit actions. On Windows it registers itself to launch at sign-in; the context menu exposes that setting. A ten-second watchdog reuses a healthy telemetry service on port `9224`, starts one when needed, and recovers it if the local bridge exits.

Quota windows and daily activity are separate live lanes. Authenticated provider limits refresh every minute, while the heavier all-harness Tokscale scan refreshes every five minutes. The HUD shows each lane's own age and refresh state, retains only the normalized secret-free snapshot across restarts, and never presents an old value as newly observed.

### 4. Launch the full observatory in a browser

```bash
node bin/starlight-pet.js hud
```
*Opens `http://localhost:9224` in your default browser with live WebSocket synchronization.*

The usage cockpit enriches the local parsers with the installed `tokscale` CLI. If Tokscale is unavailable, session presence remains visible while measured daily totals and quota cards fail closed as unavailable.

### 5. Launch the lightweight two-row view

```bash
node bin/starlight-pet.js mini
```

The mini view uses the same loopback telemetry contract as the full observatory. Click it to reveal all detected models, detailed quota windows, and the Starlight command center destinations.

### 6. Install drop-in Claude Code hooks
```powershell
# On Windows PowerShell:
.\hooks\install-hooks.ps1
```

---

## 🛠️ CLI Reference

| Command | Description |
|---|---|
| `starlight-pet status` | Quick terminal dashboard with ASCII pet art and live metrics |
| `starlight-pet prompt` | Compact one-line ANSI string for shell prompt statuslines |
| `starlight-pet hud` | Launches background server and opens the full interactive HUD |
| `starlight-pet mini` | Opens the two-row key-provider HUD with expandable all-model details |
| `starlight-pet daemon` | Runs the telemetry daemon and file watcher on port `9224` |
| `starlight-pet skin <name>` | Switches pet companion skin (`stellaris`, `arcanea_luminor`, `cyber_bot`, `kuro_neko`, `starlight_queen`) |
| `starlight-pet sync` | Exports multi-machine telemetry snapshot |
| `starlight-pet report` | Generates a formatted Markdown report of token usage, costs, and cache savings |
| `starlight-pet report --json` | Outputs raw JSON telemetry for automated monitoring pipelines |
| `starlight-pet hooks install` | Installs lifecycle hooks into Claude Code |

---

## 🛡️ Architecture & Data Privacy

- **Local-First & Sovereign**: 100% of telemetry parsing and file watching happens locally on your machine.
- **Zero Sensitive Data Leakage**: Session transcripts and file paths are never uploaded to any external server.
- **Estate Standard**: Follows Starlight Estate SSOT rules (`WORKSPACE_MAP.md`).

### OSS composition strategy

Starlight keeps one small local interface and composes proven OSS behavior behind it:

- [Tokscale](https://github.com/junhoyeo/tokscale) is the active multi-harness token, model, cost, and quota adapter.
- [ccusage](https://github.com/ccusage/ccusage) informs the normalized local-report contract and remains a compatible future fallback rather than a second hot-path scanner.
- [CodexBar](https://github.com/steipete/CodexBar) informs the compact provider rail, explicit stale/error states, reset-aware quota presentation, and adaptive-refresh posture.
- [Tauri v2](https://v2.tauri.app/) remains the target lightweight native shell. The web surface and fixed loopback interfaces do not depend on the shell, so the current transparent Electron host can be replaced without rewriting telemetry or UI behavior.

The project consumes stable JSON or loopback interfaces instead of copying provider credential logic or coupling the HUD to another project's internal data structures.

---

*Built with precision for the Starlight & Arcanea Agent Ecosystem.*
