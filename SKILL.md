---
name: starlight-agent-pet
description: Starlight Agent Pet & Fleet Telemetry Observatory — live tracking of token usage, costs, context window health, and desktop companion across all agent harnesses.
---

# Starlight Agent Pet Skill

Use this skill when:
- Inspecting live token consumption and costs across Claude Code, Codex, Antigravity, Hermes, Grok, or Kilo.
- Checking context window health before long prompts or subagent fanouts.
- Opening or managing the desktop floating pet / interactive HUD.
- Synchronizing multi-machine telemetry (`@frank-desktop` and `@yoga-c940`).

## Commands

```bash
# Terminal status overview
node C:/Users/frank/starlight/repos/starlight-agent-pet/bin/starlight-pet.js status

# Open interactive HUD
node C:/Users/frank/starlight/repos/starlight-agent-pet/bin/starlight-pet.js hud

# Generate Markdown cost report
node C:/Users/frank/starlight/repos/starlight-agent-pet/bin/starlight-pet.js report
```
