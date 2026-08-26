import { TokenUsage } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// STARLIGHT INTELLIGENT INFERENCE ROUTER
// The brain of the routing fabric: selects the optimal model for every task
// based on cost, latency, capability, context window state, and budget gates.
// ─────────────────────────────────────────────────────────────────────────────

export type TaskShape =
  | 'code_generation'
  | 'code_review'
  | 'deep_reasoning'
  | 'fast_research'
  | 'creative_media'
  | 'data_extraction'
  | 'conversation'
  | 'local_private'
  | 'mechanical_scan';

export type ModelTier = 'free' | 'discounted' | 'standard' | 'premium' | 'frontier' | 'local';

export interface ModelCandidate {
  id: string;
  provider: string;
  displayName: string;
  tier: ModelTier;
  maxContextTokens: number;
  inputPerMTok: number;
  outputPerMTok: number;
  strengths: TaskShape[];
  latencyClass: 'ultra_fast' | 'fast' | 'standard' | 'slow';
  supportsExtendedThinking: boolean;
  supportsToolUse: boolean;
  supportsVision: boolean;
  isLocal: boolean;
}

export interface RoutingContext {
  taskShape: TaskShape;
  contextTokensUsed: number;
  contextTokensMax: number;
  budgetRemainingUSD: number;
  dailyBudgetCapUSD: number;
  preferLocal: boolean;
  requiresVision: boolean;
  requiresExtendedThinking: boolean;
  previousModelId?: string; // For cross-model verification (maker ≠ checker)
}

export interface RoutingDecision {
  selectedModel: ModelCandidate;
  reason: string;
  alternativeModels: ModelCandidate[];
  estimatedCostUSD: number;
  crossModelVerifier?: ModelCandidate; // Different provider for verification
}

// ─────────────────────────────────────────────────────────────────────────────
// MODEL REGISTRY
// All frontier, cloud, and local models available to the routing fabric.
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_REGISTRY: ModelCandidate[] = [
  // ── Anthropic ──
  {
    id: 'claude-3-7-sonnet-20250219',
    provider: 'anthropic',
    displayName: 'Claude 3.7 Sonnet',
    tier: 'standard',
    maxContextTokens: 200_000,
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
    strengths: ['code_generation', 'code_review', 'deep_reasoning', 'conversation'],
    latencyClass: 'fast',
    supportsExtendedThinking: true,
    supportsToolUse: true,
    supportsVision: true,
    isLocal: false,
  },
  {
    id: 'claude-4-opus',
    provider: 'anthropic',
    displayName: 'Claude Opus 4',
    tier: 'frontier',
    maxContextTokens: 200_000,
    inputPerMTok: 15.0,
    outputPerMTok: 75.0,
    strengths: ['deep_reasoning', 'code_review', 'creative_media'],
    latencyClass: 'slow',
    supportsExtendedThinking: true,
    supportsToolUse: true,
    supportsVision: true,
    isLocal: false,
  },
  {
    id: 'claude-4-haiku',
    provider: 'anthropic',
    displayName: 'Claude 4 Haiku',
    tier: 'discounted',
    maxContextTokens: 200_000,
    inputPerMTok: 0.80,
    outputPerMTok: 4.0,
    strengths: ['mechanical_scan', 'data_extraction', 'conversation'],
    latencyClass: 'ultra_fast',
    supportsExtendedThinking: false,
    supportsToolUse: true,
    supportsVision: true,
    isLocal: false,
  },

  // ── Google DeepMind ──
  {
    id: 'gemini-3.7-flash',
    provider: 'google',
    displayName: 'Gemini 3.7 Flash',
    tier: 'discounted',
    maxContextTokens: 1_000_000,
    inputPerMTok: 0.10,
    outputPerMTok: 0.40,
    strengths: ['fast_research', 'data_extraction', 'conversation', 'creative_media'],
    latencyClass: 'ultra_fast',
    supportsExtendedThinking: true,
    supportsToolUse: true,
    supportsVision: true,
    isLocal: false,
  },
  {
    id: 'gemini-3.7-pro',
    provider: 'google',
    displayName: 'Gemini 3.7 Pro',
    tier: 'standard',
    maxContextTokens: 2_000_000,
    inputPerMTok: 1.25,
    outputPerMTok: 10.0,
    strengths: ['deep_reasoning', 'code_generation', 'creative_media'],
    latencyClass: 'standard',
    supportsExtendedThinking: true,
    supportsToolUse: true,
    supportsVision: true,
    isLocal: false,
  },

  // ── OpenAI ──
  {
    id: 'gpt-5.6-sol',
    provider: 'openai',
    displayName: 'GPT-5.6 Sol',
    tier: 'frontier',
    maxContextTokens: 256_000,
    inputPerMTok: 10.0,
    outputPerMTok: 30.0,
    strengths: ['deep_reasoning', 'code_generation', 'code_review'],
    latencyClass: 'standard',
    supportsExtendedThinking: true,
    supportsToolUse: true,
    supportsVision: true,
    isLocal: false,
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    tier: 'standard',
    maxContextTokens: 128_000,
    inputPerMTok: 2.50,
    outputPerMTok: 10.0,
    strengths: ['code_generation', 'conversation', 'fast_research'],
    latencyClass: 'fast',
    supportsExtendedThinking: false,
    supportsToolUse: true,
    supportsVision: true,
    isLocal: false,
  },

  // ── xAI ──
  {
    id: 'grok-4.5',
    provider: 'xai',
    displayName: 'Grok 4.5',
    tier: 'standard',
    maxContextTokens: 131_072,
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
    strengths: ['fast_research', 'code_generation', 'conversation'],
    latencyClass: 'fast',
    supportsExtendedThinking: true,
    supportsToolUse: true,
    supportsVision: true,
    isLocal: false,
  },

  // ── DeepSeek ──
  {
    id: 'deepseek-v4-flash',
    provider: 'deepseek',
    displayName: 'DeepSeek V4 Flash',
    tier: 'discounted',
    maxContextTokens: 128_000,
    inputPerMTok: 0.14,
    outputPerMTok: 0.28,
    strengths: ['code_generation', 'deep_reasoning', 'mechanical_scan'],
    latencyClass: 'fast',
    supportsExtendedThinking: true,
    supportsToolUse: true,
    supportsVision: false,
    isLocal: false,
  },

  // ── Kilo Free Tier ──
  {
    id: 'kilo-auto-free',
    provider: 'kilo',
    displayName: 'Kilo Auto (Free)',
    tier: 'free',
    maxContextTokens: 128_000,
    inputPerMTok: 0,
    outputPerMTok: 0,
    strengths: ['code_generation', 'code_review', 'conversation', 'mechanical_scan'],
    latencyClass: 'fast',
    supportsExtendedThinking: false,
    supportsToolUse: true,
    supportsVision: false,
    isLocal: false,
  },
  {
    id: 'nemotron-3-ultra-free',
    provider: 'kilo',
    displayName: 'Nemotron 3 Ultra (Free)',
    tier: 'free',
    maxContextTokens: 128_000,
    inputPerMTok: 0,
    outputPerMTok: 0,
    strengths: ['code_generation', 'deep_reasoning'],
    latencyClass: 'standard',
    supportsExtendedThinking: false,
    supportsToolUse: true,
    supportsVision: false,
    isLocal: false,
  },

  // ── Groq (LPU) ──
  {
    id: 'groq-llama-3.3-70b',
    provider: 'groq',
    displayName: 'Groq LLaMA 3.3 70B',
    tier: 'discounted',
    maxContextTokens: 128_000,
    inputPerMTok: 0.59,
    outputPerMTok: 0.79,
    strengths: ['fast_research', 'conversation', 'data_extraction'],
    latencyClass: 'ultra_fast',
    supportsExtendedThinking: false,
    supportsToolUse: true,
    supportsVision: false,
    isLocal: false,
  },

  // ── Local / Sovereign ──
  {
    id: 'ollama-qwen3-32b',
    provider: 'ollama',
    displayName: 'Ollama Qwen3 32B (Local)',
    tier: 'local',
    maxContextTokens: 32_768,
    inputPerMTok: 0,
    outputPerMTok: 0,
    strengths: ['code_generation', 'conversation', 'local_private'],
    latencyClass: 'standard',
    supportsExtendedThinking: false,
    supportsToolUse: true,
    supportsVision: false,
    isLocal: true,
  },
  {
    id: 'nvidia-nim-llama-3.1-70b',
    provider: 'nvidia',
    displayName: 'NVIDIA NIM LLaMA 3.1 70B',
    tier: 'local',
    maxContextTokens: 128_000,
    inputPerMTok: 0,
    outputPerMTok: 0,
    strengths: ['code_generation', 'deep_reasoning', 'local_private'],
    latencyClass: 'fast',
    supportsExtendedThinking: false,
    supportsToolUse: true,
    supportsVision: false,
    isLocal: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export class InferenceRouter {

  public route(ctx: RoutingContext): RoutingDecision {
    let candidates = [...MODEL_REGISTRY];

    // 1. Filter by hard requirements
    if (ctx.requiresVision) {
      candidates = candidates.filter(m => m.supportsVision);
    }
    if (ctx.requiresExtendedThinking) {
      candidates = candidates.filter(m => m.supportsExtendedThinking);
    }
    if (ctx.preferLocal) {
      const localOnly = candidates.filter(m => m.isLocal);
      if (localOnly.length > 0) candidates = localOnly;
    }

    // 2. Filter by context window capacity
    candidates = candidates.filter(m => m.maxContextTokens >= ctx.contextTokensUsed);

    // 3. Filter by budget gate
    if (ctx.budgetRemainingUSD <= 0) {
      const freeOrLocal = candidates.filter(m => m.tier === 'free' || m.tier === 'local');
      if (freeOrLocal.length > 0) candidates = freeOrLocal;
    }

    // 4. Sort by task-shape affinity, then by cost efficiency
    candidates.sort((a, b) => {
      const aMatch = a.strengths.includes(ctx.taskShape) ? 1 : 0;
      const bMatch = b.strengths.includes(ctx.taskShape) ? 1 : 0;
      if (bMatch !== aMatch) return bMatch - aMatch; // Prefer task-matched models

      // Prefer free/local, then discounted, then standard, then premium
      const tierOrder: Record<ModelTier, number> = {
        free: 0, local: 1, discounted: 2, standard: 3, premium: 4, frontier: 5
      };
      const aTier = tierOrder[a.tier];
      const bTier = tierOrder[b.tier];
      if (aTier !== bTier) return aTier - bTier;

      // Finally, prefer lower cost
      return (a.inputPerMTok + a.outputPerMTok) - (b.inputPerMTok + b.outputPerMTok);
    });

    if (candidates.length === 0) {
      // Absolute fallback: Kilo free tier
      candidates = MODEL_REGISTRY.filter(m => m.tier === 'free');
    }

    const selected = candidates[0];

    // 5. Estimate cost for a typical exchange (10K input, 2K output)
    const estInput = 10_000;
    const estOutput = 2_000;
    const estimatedCostUSD =
      (estInput / 1_000_000) * selected.inputPerMTok +
      (estOutput / 1_000_000) * selected.outputPerMTok;

    // 6. Cross-model verification: select a checker from a DIFFERENT provider
    let crossModelVerifier: ModelCandidate | undefined;
    if (ctx.previousModelId) {
      const previousProvider = MODEL_REGISTRY.find(m => m.id === ctx.previousModelId)?.provider;
      const verifierCandidates = MODEL_REGISTRY
        .filter(m => m.provider !== previousProvider && m.supportsToolUse)
        .filter(m => m.strengths.includes('code_review') || m.strengths.includes('deep_reasoning'))
        .sort((a, b) => {
          const tierOrder: Record<ModelTier, number> = {
            free: 0, local: 1, discounted: 2, standard: 3, premium: 4, frontier: 5
          };
          return tierOrder[a.tier] - tierOrder[b.tier];
        });
      crossModelVerifier = verifierCandidates[0];
    }

    // 7. Build routing reason
    const budgetNote = ctx.budgetRemainingUSD <= 0 ? ' (budget exhausted → free/local only)' : '';
    const reason = `Task shape "${ctx.taskShape}" → ${selected.displayName} (${selected.provider}, ${selected.tier})${budgetNote}. ` +
      `Context: ${ctx.contextTokensUsed.toLocaleString()}/${selected.maxContextTokens.toLocaleString()} tokens. ` +
      `Est. cost: $${estimatedCostUSD.toFixed(4)}.`;

    return {
      selectedModel: selected,
      reason,
      alternativeModels: candidates.slice(1, 4),
      estimatedCostUSD,
      crossModelVerifier,
    };
  }

  public getRegistry(): ModelCandidate[] {
    return [...MODEL_REGISTRY];
  }

  public getModelById(id: string): ModelCandidate | undefined {
    return MODEL_REGISTRY.find(m => m.id === id);
  }

  public getProviderModels(provider: string): ModelCandidate[] {
    return MODEL_REGISTRY.filter(m => m.provider === provider);
  }
}
