# AGENTS.md — Starlight Agent Pet Operating Contract

**Repository SSOT:** `C:/Users/frank/starlight/repos/starlight-agent-pet`  
**GitHub Remote:** `frankxai/starlight-agent-pet`  
**Purpose:** Real-time token telemetry engine, cost optimizer, and desktop floating pet companion for the Starlight agent fleet.

---

## Architecture Guidelines
- All parsers must be non-blocking and fail silently on corrupted log lines.
- Local privacy is absolute: no prompts, secrets, or file contents leave the local host.
- Always use `pnpm build` (`tsc`) after editing files in `src/`.
- Verify tests with `node dist/test/run-tests.js` before commits.
