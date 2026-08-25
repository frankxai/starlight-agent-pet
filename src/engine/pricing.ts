import { CostEstimate, TokenUsage } from './types';

export interface ModelPricing {
  inputPerMTok: number;       // $ / Million Tokens
  outputPerMTok: number;      // $ / Million Tokens
  cacheWritePerMTok: number;  // $ / Million Tokens
  cacheReadPerMTok: number;   // $ / Million Tokens
  maxContextTokens: number;
}

// Pricing table (rates per 1M tokens)
export const MODEL_PRICING_TABLE: Record<string, ModelPricing> = {
  // Anthropic Claude
  'claude-3-7-sonnet-20250219': {
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    cacheWritePerMTok: 3.75,
    cacheReadPerMTok: 0.30,
    maxContextTokens: 200000,
  },
  'claude-sonnet-5': {
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    cacheWritePerMTok: 3.75,
    cacheReadPerMTok: 0.30,
    maxContextTokens: 200000,
  },
  'claude-3-5-sonnet-20241022': {
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    cacheWritePerMTok: 3.75,
    cacheReadPerMTok: 0.30,
    maxContextTokens: 200000,
  },
  'claude-3-5-haiku-20241022': {
    inputPerMTok: 0.80,
    outputPerMTok: 4.00,
    cacheWritePerMTok: 1.00,
    cacheReadPerMTok: 0.08,
    maxContextTokens: 200000,
  },
  'claude-3-opus-20240229': {
    inputPerMTok: 15.00,
    outputPerMTok: 75.00,
    cacheWritePerMTok: 18.75,
    cacheReadPerMTok: 1.50,
    maxContextTokens: 200000,
  },

  // OpenAI / Codex
  'gpt-5.6-sol': {
    inputPerMTok: 2.50,
    outputPerMTok: 10.00,
    cacheWritePerMTok: 2.50,
    cacheReadPerMTok: 0.25,
    maxContextTokens: 256000,
  },
  'gpt-5.6-terra': {
    inputPerMTok: 1.50,
    outputPerMTok: 6.00,
    cacheWritePerMTok: 1.50,
    cacheReadPerMTok: 0.15,
    maxContextTokens: 256000,
  },
  'gpt-4o': {
    inputPerMTok: 2.50,
    outputPerMTok: 10.00,
    cacheWritePerMTok: 2.50,
    cacheReadPerMTok: 1.25,
    maxContextTokens: 128000,
  },
  'gpt-4o-mini': {
    inputPerMTok: 0.15,
    outputPerMTok: 0.60,
    cacheWritePerMTok: 0.15,
    cacheReadPerMTok: 0.075,
    maxContextTokens: 128000,
  },
  'o3-mini': {
    inputPerMTok: 1.10,
    outputPerMTok: 4.40,
    cacheWritePerMTok: 1.10,
    cacheReadPerMTok: 0.55,
    maxContextTokens: 200000,
  },

  // Google Gemini / Antigravity
  'gemini-3.7-flash': {
    inputPerMTok: 0.10,
    outputPerMTok: 0.40,
    cacheWritePerMTok: 0.10,
    cacheReadPerMTok: 0.025,
    maxContextTokens: 1048576,
  },
  'gemini-3.7-pro': {
    inputPerMTok: 1.25,
    outputPerMTok: 5.00,
    cacheWritePerMTok: 1.25,
    cacheReadPerMTok: 0.30,
    maxContextTokens: 2097152,
  },
  'gemini-2.5-flash': {
    inputPerMTok: 0.075,
    outputPerMTok: 0.30,
    cacheWritePerMTok: 0.075,
    cacheReadPerMTok: 0.02,
    maxContextTokens: 1048576,
  },

  // xAI Grok
  'grok-4.5': {
    inputPerMTok: 2.00,
    outputPerMTok: 10.00,
    cacheWritePerMTok: 2.00,
    cacheReadPerMTok: 0.50,
    maxContextTokens: 131072,
  },
  'grok-3': {
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    cacheWritePerMTok: 3.00,
    cacheReadPerMTok: 0.75,
    maxContextTokens: 131072,
  },

  // DeepSeek
  'deepseek-chat': {
    inputPerMTok: 0.14,
    outputPerMTok: 0.28,
    cacheWritePerMTok: 0.14,
    cacheReadPerMTok: 0.014,
    maxContextTokens: 64000,
  },
  'deepseek-reasoner': {
    inputPerMTok: 0.55,
    outputPerMTok: 2.19,
    cacheWritePerMTok: 0.55,
    cacheReadPerMTok: 0.14,
    maxContextTokens: 64000,
  },

  // Kilo / Free tier / Local
  'kilo-auto-free': {
    inputPerMTok: 0.0,
    outputPerMTok: 0.0,
    cacheWritePerMTok: 0.0,
    cacheReadPerMTok: 0.0,
    maxContextTokens: 128000,
  }
};

const DEFAULT_PRICING: ModelPricing = {
  inputPerMTok: 3.00,
  outputPerMTok: 15.00,
  cacheWritePerMTok: 3.75,
  cacheReadPerMTok: 0.30,
  maxContextTokens: 200000,
};

export function resolveModelPricing(modelName?: string): ModelPricing {
  if (!modelName) return DEFAULT_PRICING;
  const clean = modelName.toLowerCase().trim();
  
  if (MODEL_PRICING_TABLE[clean]) {
    return MODEL_PRICING_TABLE[clean];
  }

  // Substring fuzzy matching
  for (const [key, pricing] of Object.entries(MODEL_PRICING_TABLE)) {
    if (clean.includes(key) || key.includes(clean)) {
      return pricing;
    }
  }

  if (clean.includes('haiku')) return MODEL_PRICING_TABLE['claude-3-5-haiku-20241022'];
  if (clean.includes('opus')) return MODEL_PRICING_TABLE['claude-3-opus-20240229'];
  if (clean.includes('sonnet')) return MODEL_PRICING_TABLE['claude-3-7-sonnet-20250219'];
  if (clean.includes('flash')) return MODEL_PRICING_TABLE['gemini-3.7-flash'];
  if (clean.includes('gemini') || clean.includes('pro')) return MODEL_PRICING_TABLE['gemini-3.7-pro'];
  if (clean.includes('gpt-4') || clean.includes('gpt-5') || clean.includes('codex')) return MODEL_PRICING_TABLE['gpt-5.6-sol'];
  if (clean.includes('grok')) return MODEL_PRICING_TABLE['grok-4.5'];
  if (clean.includes('deepseek')) return MODEL_PRICING_TABLE['deepseek-chat'];
  if (clean.includes('free') || clean.includes('qwen') || clean.includes('nemotron')) return MODEL_PRICING_TABLE['kilo-auto-free'];

  return DEFAULT_PRICING;
}

export function calculateCost(tokens: TokenUsage, modelName?: string): CostEstimate {
  const pricing = resolveModelPricing(modelName);
  
  const inputCostUSD = (tokens.inputTokens / 1_000_000) * pricing.inputPerMTok;
  const outputCostUSD = (tokens.outputTokens / 1_000_000) * pricing.outputPerMTok;
  const cacheCreationCostUSD = (tokens.cacheCreationTokens / 1_000_000) * pricing.cacheWritePerMTok;
  const cacheReadCostUSD = (tokens.cacheReadTokens / 1_000_000) * pricing.cacheReadPerMTok;

  const totalCostUSD = inputCostUSD + outputCostUSD + cacheCreationCostUSD + cacheReadCostUSD;

  return {
    inputCostUSD: Number(inputCostUSD.toFixed(6)),
    outputCostUSD: Number(outputCostUSD.toFixed(6)),
    cacheCreationCostUSD: Number(cacheCreationCostUSD.toFixed(6)),
    cacheReadCostUSD: Number(cacheReadCostUSD.toFixed(6)),
    totalCostUSD: Number(totalCostUSD.toFixed(4)),
  };
}
