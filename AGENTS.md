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

## Design Language
- Never render all-caps interface copy and never use `text-transform: uppercase`.
- Use sentence case for headings, labels, buttons, badges, navigation, and status text.
- Preserve the official casing of product and provider names; prefer plain-language labels over acronyms.

## Visual identity and sprite sourcing (design-time only)
- Reuse verified visual masters before generating or replacing a skin. Consult the [Starlight character retrieval protocol](https://github.com/Starlight-Intelligence/starlight-design-intelligence/blob/main/playbooks/character-canon-retrieval.md) and the existing [VIS integration PR #67](https://github.com/frankxai/visual-intelligence/pull/67) for versioned source/rights and approval contracts. Until PR #67 is merged, treat its new manifest and skill as **draft**, not runtime authority.
- The five skin IDs documented in the README (`stellaris`, `arcanea_luminor`, `cyber_bot`, `kuro_neko`, `starlight_queen`) are **product skin selectors**. They do not prove a canonical character identity, legal rights, external partnership, or that a live pet instance was observed.
- Codex's eight built-in pets (`codex`, `dewey`, `fireball`, `rocky`, `seedy`, `stacky`, `bsod`, `null-signal`) are external OpenAI-controlled source characters. Their [source catalog](https://github.com/openai/codex/blob/main/codex-rs/tui/src/pets/catalog.rs) names individual `-spritesheet-v4.webp` assets and a default 192 × 208 frame layout (8 columns × 9 rows). Do not claim those sprites as Starlight-owned IP or redistribute/adapt them without a rights review.
- Mini Frank (`host.frank`), Nilo (`custom.nilo`), Brio (`custom.brio`) and Riff (`custom.riff`) are an independent owned ensemble. Prior model/provider equivalences for Nilo, Brio and Riff were withdrawn. Retrieve the private master sheets and verify source hashes before character-consistent images, exports or animation.
- A sprite/pet skin, recurring character, provider/model, running agent, and an authorized publication are five different entities. Keep their IDs and evidence separate.
- Record original source and rendition, rights, ownership, status, author/approval scope, sprite layout, measured dimensions and SHA-256. Never infer a preferred/approved look from a repository file existing or a displayed animation.
- Preserve private negative examples with review reasons for critique. Never use rejected or third-party images as default generation references, nor silently publish them.
- **Runtime privacy is unchanged:** source recovery and remote VIS/MCP queries occur only in explicitly authorized design workflows. No new background network access, raw transcript upload or credential sharing is authorized by this guidance.
