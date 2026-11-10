# Sprite and Character Source Contract

**Status:** implementation handoff, 2026-11-10. Do not interpret as proof of deployed VIS integration, archived binaries or public trademark licensing.

## Pet sprite inventory: externally owned

Upstream [OpenAI Codex pet catalog](https://github.com/openai/codex/blob/main/codex-rs/tui/src/pets/catalog.rs) defines these eight builtin pets:

| Stable upstream ID | Display | Filename in upstream catalog |
| --- | --- | --- |
| `codex` | Codex | `codex-spritesheet-v4.webp` |
| `dewey` | Dewey | `dewey-spritesheet-v4.webp` |
| `fireball` | Fireball | `fireball-spritesheet-v4.webp` |
| `rocky` | Rocky | `rocky-spritesheet-v4.webp` |
| `seedy` | Seedy | `seedy-spritesheet-v4.webp` |
| `stacky` | Stacky | `stacky-spritesheet-v4.webp` |
| `bsod` | BSOD | `bsod-spritesheet-v4.webp` |
| `null-signal` | Null Signal | `null-signal-spritesheet-v4.webp` |

The inspected source catalog sets default frame width `192`, height `208`, columns `8`, rows `9` (nominal sheet `1536 × 1872`). **The actual upstream PNG/WebP binary dimensions, licenses and per-animation state mappings were not independently measured in this change.** Do not assume every pet uses the defaults without measured validation.

Use the upstream catalog for names, not AI-generated lookalikes. Original vendor artwork should not be silently embedded in a public Starlight product, commercial content or generated derivative without a rights/brand check.

## Starlight local pet skins: product-defined selections

Existing README/CLI documents five skin selectors:

| Selector | Working visual identity |
| --- | --- |
| `stellaris` | Stellaris · Celestial Cosmic Kitsune |
| `arcanea_luminor` | Arcanea Luminor · crystal geometric companion |
| `cyber_bot` | Cyber-Pulsar 2077 · retro cyber-bot |
| `kuro_neko` | Kuro-Neko Astral · space void cat |
| `starlight_queen` | Starlight Queen Hive-Mind · constellation orb |

Treat these as **code-defined choices**, not as an approved source image collection or as the same identities as the Queen's porcelain study and house conductor portraits.

## Mini Me original cast

Mini Frank, Nilo, Brio and Riff have separately recovered owned likeness/cast sheets in a private original vault. The authoritative design-time bundle is revision `2026-10-09.4` of `mini-me-storyboard`, subject to later corrections. Two original Drive sheets (Mini-Frank-Canonical-Likeness and Mini-Frank-Core-Cast) were separately downloaded, visually inspected, copied to private Library and readback-hash verified on 2026-11-10. All other exact private skill references still require verification. Never copy their raw bytes, private source links or user-specific image context into this public repository.

**The October creative correction withdrew** the earlier Nilo→Codex, Brio→Claude and Riff→OpenClaw assignments. Do not encode those as canonical agent/provider mappings.

## Contract for future designers and coding agents

- Start at the [canonical character retrieval protocol](https://github.com/Starlight-Intelligence/starlight-design-intelligence/blob/main/playbooks/character-canon-retrieval.md) and [VIS DAM agent access/rollout PR](https://github.com/frankxai/visual-intelligence/pull/67).
- For every produced sprite or skin, emit `identity_id`, `skin_id`, `version_id`, `source_uri`, `sha256`, `frame_layout`, `animation_states`, `review_state`, `rights_state`, and `publication_receipt` (nullable when not verified).
- Store original sprite bytes privately with source/perceptual hashes and licensing metadata. Source declarations alone are not proof of archive availability.
- Use neutral fallbacks when a vendor sprite is unavailable or distribution rights are unresolved.
- Keep runtime telemetry and permissions separate from design-time identity lookup.
- Never elevate a sprite, screenshot or generated study to approved character canon without a review of its exact source and variant.
- Make one bounded render/animation test against a verified sheet; test actual frame cell extraction, alpha, idle/working/waiting/failed state mapping, 1×/2× scaling, reduced motion and release rights.

## Integration gates

1. Verify the current local skin files and actual renderer behavior from `public/js/pet-canvas.js` and desktop shell; inventory binary and animation assets actually committed.
2. Retrieve permitted external sprite sheets as read-only provenance, inspect rights and exact pixel/state geometry. Do not download and redistribute them by default.
3. Link private Mini Me reference masters via VIS-protected asset IDs; refuse unavailable/expired sources.
4. Test the same exact character references with Figma/ChatGPT/Claude/Perplexity, recording source hash, rights and review status.
5. Public product release remains a separate authorized action.

### What this change actually does
Adds a searchable source contract and AGENTS.md retrieval guidance. **No new pet image, model assignment, live telemetry adapter, background lookup, or publication is installed.**
