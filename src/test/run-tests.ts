
import { buildKeyProviderMetrics, CompactHudService } from '../engine/compact-hud';
import { FleetAggregator } from '../engine/aggregator';
import { calculateCost, calculateSavings, resolveModelPricing } from '../engine/pricing';
import { ClaudeParser } from '../engine/parsers/claude';
import { AntigravityParser } from '../engine/parsers/antigravity';
import { TokenUsage } from '../engine/types';
import { normalizeTokscaleDailyReport, normalizeTokscaleQuotaReport, UsageIntelligence } from '../engine/usage';

import { CommandCenterBridge } from '../engine/command-center';

process.env.STARLIGHT_DISABLE_TOKSCALE = '1';

async function runTests() {
  console.log('\n--- [STARLIGHT FLEET OBSERVATORY TEST SUITE] ---\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`);
      passed++;
    } else {
      console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`);
      failed++;
    }
  }

  // 1. Test Pricing & Savings Engine
  console.log('1. Testing Pricing & Savings Engine...');
  const sonnetPricing = resolveModelPricing('claude-3-7-sonnet-20250219');
  assert(sonnetPricing.inputPerMTok === 3.0, 'Sonnet input rate resolved ($3.00/MTok)');
  assert(sonnetPricing.outputPerMTok === 15.0, 'Sonnet output rate resolved ($15.00/MTok)');

  const geminiPricing = resolveModelPricing('gemini-3.7-flash');
  assert(geminiPricing.maxContextTokens >= 1000000, 'Gemini 3.7 Flash 1M context resolved');

  const tokens: TokenUsage = {
    inputTokens: 100000,
    outputTokens: 20000,
    cacheCreationTokens: 50000,
    cacheReadTokens: 100000,
    totalTokens: 270000
  };
  const cost = calculateCost(tokens, 'claude-3-7-sonnet-20250219');
  assert(cost.totalCostUSD > 0, `Cost calculated correctly: $${cost.totalCostUSD}`);

  const savings = calculateSavings(tokens, 'claude-3-7-sonnet-20250219');
  assert(savings.cacheSavingsUSD === 0.27, `Prompt cache savings calculated: $${savings.cacheSavingsUSD}`);
  assert(savings.cacheHitPercentage === 50, `Cache hit rate calculated: ${savings.cacheHitPercentage}%`);

  // 2. Test Claude Parser
  console.log('\n2. Testing Claude Code Session Parser...');
  const claudeParser = new ClaudeParser();
  const claudeSessions = await claudeParser.parseAllSessions(5);
  console.log(`Discovered ${claudeSessions.length} Claude sessions`);
  assert(Array.isArray(claudeSessions), 'Claude parser returns a session collection when local logs are absent');
  if (claudeSessions.length > 0) {
    const s = claudeSessions[0];
    assert(s.tokens.totalTokens >= 0, `Session ${s.id} tokens: ${s.tokens.totalTokens}`);
    assert(typeof s.cost.totalCostUSD === 'number', `Session cost: $${s.cost.totalCostUSD}`);
  }

  // 3. Test Antigravity Parser
  console.log('\n3. Testing Antigravity Transcript Parser...');
  const antiParser = new AntigravityParser();
  const antiSessions = await antiParser.parseAllSessions(5);
  console.log(`Discovered ${antiSessions.length} Antigravity brain sessions`);
  assert(Array.isArray(antiSessions), 'Antigravity parser returns a session collection when local logs are absent');

  // 4. Test Aggregator & Fleet State
  console.log('\n4. Testing Aggregator & Arcanea Gates Progression...');
  const aggregator = new FleetAggregator();
  const state = await aggregator.getFleetState();
  assert(Array.isArray(state.activeSessions), `Fleet state returns ${state.activeSessions.length} observed sessions`);
  assert(state.activeSessions.every(session => !session.context.known || session.context.usedPercentage <= 100), 'Known context-window percentages are bounded to 0–100%');
  assert(state.pet.level >= 1, `Pet Level: ${state.pet.level}`);
  assert(state.pet.arcaneaGate.includes('Gate'), `Arcanea Gate: ${state.pet.arcaneaGate}`);
  assert(state.historicalSummary.today.totalTokens >= 0, `Total Tokens: ${state.historicalSummary.today.totalTokens}`);

  // 5. Test Live Hook & Permission Flow
  console.log('\n5. Testing Live Hook & Permission Flow...');
  aggregator.handleHookEvent({
    harness: 'claude',
    event: 'permission_request',
    sessionId: 'test-live-session-123',
    model: 'claude-3-7-sonnet-20250219',
    task: 'Executing critical database migration',
    toolName: 'bash',
    toolSummary: 'Running pnpm migrate',
    contextRemainingPct: 65,
    tokens: {
      inputTokens: 12000,
      outputTokens: 3400,
      cacheReadTokens: 8000,
      cacheCreationTokens: 4000
    }
  });

  const permState = await aggregator.getFleetState();
  const injected = permState.activeSessions.find(s => s.id === 'test-live-session-123');
  assert(injected !== undefined, 'Live injected session found in state');
  assert(injected?.state === 'approval_required', 'Injected session state is approval_required');
  assert(permState.pendingPermissions.length > 0, 'Pending permission request generated');

  if (permState.pendingPermissions.length > 0) {
    const permId = permState.pendingPermissions[0].id;
    const approved = aggregator.approvePermission(permId);
    assert(approved === true, 'Permission approved via API');
    const postApproveState = await aggregator.getFleetState();
    const approvedSession = postApproveState.activeSessions.find(s => s.id === 'test-live-session-123');
    assert(approvedSession?.state === 'coding', 'Session transitioned to coding after approval');
  }

  // 6. Test Skin Switching
  console.log('\n6. Testing Skin Switching...');
  aggregator.setPetSkin('kuro_neko');
  const skinState = await aggregator.getFleetState();
  assert(skinState.pet.skin === 'kuro_neko', 'Pet skin switched to kuro_neko');

  aggregator.setPetSkin('starlight_queen');
  const queenState = await aggregator.getFleetState();
  assert(queenState.pet.skin === 'starlight_queen', 'Pet skin switched to starlight_queen');

  // 7. Test Inference Router
  console.log('\n7. Testing Inference Router...');
  const { InferenceRouter } = await import('../engine/router');
  const router = new InferenceRouter();

  // 7a. Code generation task should select a code-strong model
  const codeRoute = router.route({
    taskShape: 'code_generation',
    contextTokensUsed: 50_000,
    contextTokensMax: 200_000,
    budgetRemainingUSD: 10.0,
    dailyBudgetCapUSD: 50.0,
    preferLocal: false,
    requiresVision: false,
    requiresExtendedThinking: false,
  });
  assert(codeRoute.selectedModel.strengths.includes('code_generation'),
    `Code task routed to ${codeRoute.selectedModel.displayName} (has code_generation strength)`);
  assert(codeRoute.selectedModel.tier === 'free',
    `Router prefers free tier first: ${codeRoute.selectedModel.tier}`);

  // 7b. Budget exhausted → must select free or local
  const brokeRoute = router.route({
    taskShape: 'deep_reasoning',
    contextTokensUsed: 50_000,
    contextTokensMax: 200_000,
    budgetRemainingUSD: 0,
    dailyBudgetCapUSD: 0,
    preferLocal: false,
    requiresVision: false,
    requiresExtendedThinking: false,
  });
  assert(
    brokeRoute.selectedModel.tier === 'free' || brokeRoute.selectedModel.tier === 'local',
    `Budget exhausted → routed to ${brokeRoute.selectedModel.tier} tier: ${brokeRoute.selectedModel.displayName}`
  );

  // 7c. Cross-model verification: maker ≠ checker
  const verifyRoute = router.route({
    taskShape: 'code_review',
    contextTokensUsed: 30_000,
    contextTokensMax: 200_000,
    budgetRemainingUSD: 20.0,
    dailyBudgetCapUSD: 50.0,
    preferLocal: false,
    requiresVision: false,
    requiresExtendedThinking: false,
    previousModelId: 'claude-3-7-sonnet-20250219', // Claude was the maker
  });
  assert(verifyRoute.crossModelVerifier !== undefined,
    `Cross-model verifier assigned: ${verifyRoute.crossModelVerifier?.displayName}`);
  assert(verifyRoute.crossModelVerifier?.provider !== 'anthropic',
    `Verifier is NOT same provider as maker (${verifyRoute.crossModelVerifier?.provider} ≠ anthropic)`);

  // 7d. Vision required → filters to vision-capable models
  const visionRoute = router.route({
    taskShape: 'creative_media',
    contextTokensUsed: 10_000,
    contextTokensMax: 200_000,
    budgetRemainingUSD: 10.0,
    dailyBudgetCapUSD: 50.0,
    preferLocal: false,
    requiresVision: true,
    requiresExtendedThinking: false,
  });
  assert(visionRoute.selectedModel.supportsVision === true,
    `Vision task routed to vision-capable model: ${visionRoute.selectedModel.displayName}`);

  // 7e. Local preference → selects local model
  const localRoute = router.route({
    taskShape: 'local_private',
    contextTokensUsed: 10_000,
    contextTokensMax: 200_000,
    budgetRemainingUSD: 10.0,
    dailyBudgetCapUSD: 50.0,
    preferLocal: true,
    requiresVision: false,
    requiresExtendedThinking: false,
  });
  assert(localRoute.selectedModel.isLocal === true,
    `Local-prefer routed to local model: ${localRoute.selectedModel.displayName}`);

  // 7f. Registry completeness
  const registry = router.getRegistry();
  assert(registry.length >= 13, `Model registry contains ${registry.length} models (≥13 expected)`);
  const providers = new Set(registry.map(m => m.provider));
  assert(providers.size >= 7, `Registry spans ${providers.size} providers (≥7 expected: anthropic, google, openai, xai, deepseek, kilo, groq, ollama, nvidia)`);

  // 8. Test Historical Analytics
  console.log('\n8. Testing Historical Analytics Engine...');
  const { HistoricalAnalytics } = await import('../engine/analytics');
  const path = await import('path');
  const os = await import('os');
  const fs = await import('fs');
  const testDbPath = path.join(os.tmpdir(), 'test_history_' + Date.now() + '.ndjson');
  
    const now = Date.now();
  const todayStr = new Date(now).toISOString().split('T')[0];
  const yesterdayStr = new Date(now - 86400000).toISOString().split('T')[0];
  const dayBeforeStr = new Date(now - 2 * 86400000).toISOString().split('T')[0];
  const analytics = new HistoricalAnalytics(testDbPath);
  analytics.appendDailySummary({
    date: dayBeforeStr,
    harness: 'claude',
    model: 'claude-3-7-sonnet-20250219',
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 0,
    totalTokens: 1500,
    costUSD: 0.015,
    sessionsCount: 1,
    machineTag: '@test'
  });
  analytics.appendDailySummary({
    date: dayBeforeStr,
    harness: 'antigravity',
    model: 'gemini-3.7-flash',
    inputTokens: 2000,
    outputTokens: 1000,
    cacheReadTokens: 0,
    totalTokens: 3000,
    costUSD: 0.02,
    sessionsCount: 2,
    machineTag: '@test'
  });
  analytics.appendDailySummary({
    date: yesterdayStr,
    harness: 'claude',
    model: 'claude-3-7-sonnet-20250219',
    inputTokens: 1000,
    outputTokens: 1000,
    cacheReadTokens: 0,
    totalTokens: 2000,
    costUSD: 0.025,
    sessionsCount: 1,
    machineTag: '@test'
  });

  const trend = await analytics.getDailyTrend(30);
  assert(trend.length === 2, 'Trend data returns 2 days of records');
  assert(trend[0].date === dayBeforeStr, 'First date is correct');
  assert(trend[0].totalTokens === 4500, `First day total tokens is correct (got ${trend[0].totalTokens})`);
  assert(trend[1].totalTokens === 2000, `Second day total tokens is correct (got ${trend[1].totalTokens})`);

  const modelBreakdown = await analytics.getModelBreakdown(30);
  assert(modelBreakdown['claude-3-7-sonnet-20250219'].totalTokens === 3500, 'Model breakdown for Claude is correct');
  assert(modelBreakdown['gemini-3.7-flash'].totalTokens === 3000, 'Model breakdown for Gemini is correct');

  // 9. Test consolidated usage truth contract
  console.log('\n9. Testing Consolidated Usage Intelligence...');
  const dailyUsage = normalizeTokscaleDailyReport({
    groupBy: 'client,model',
    entries: [
      { client: 'codex', model: 'gpt-5.6-sol', provider: 'openai', input: 100, output: 50, cacheRead: 700, cacheWrite: 25, reasoning: 10, messageCount: 2, cost: 1.5 },
      { client: 'claude', model: 'claude-opus-5', provider: 'anthropic', input: 100, output: 25, cacheRead: 0, cacheWrite: 0, reasoning: 5, messageCount: 1, cost: 2.5 }
    ],
    totalInput: 200,
    totalOutput: 75,
    totalCacheRead: 700,
    totalCacheWrite: 25,
    totalMessages: 3,
    totalCost: 4
  }, new Date('2026-08-26T12:00:00+02:00'));
  assert(dailyUsage.totals.totalProcessedTokens === 1000, 'Processed total counts fresh, output, cache read, and cache write exactly once');
  assert(dailyUsage.totals.cacheReadPercent === 70, `Cache reuse percentage is correct (${dailyUsage.totals.cacheReadPercent}%)`);
  assert(dailyUsage.byHarness[0].percent === 87.5, `Largest harness share is calculated (${dailyUsage.byHarness[0].percent}%)`);
  assert(dailyUsage.cost.apiEquivalentUSD === 4 && dailyUsage.cost.actualBilledUSD === null, 'API-equivalent cost is explicitly separated from actual billing');

  const quotas = normalizeTokscaleQuotaReport([
    { provider: 'Claude', plan: null, email: 'must-not-leak@example.com', metrics: [{ label: 'Weekly', used_percent: 28, resets_at: '2026-08-30T06:00:00+02:00' }] },
    { provider: 'Codex', plan: 'Pro', email: 'must-not-leak@example.com', metrics: [{ label: '5h', used_percent: 25, resets_at: '2026-09-01T17:18:15+02:00' }] }
  ]);
  assert(quotas.length === 2, 'Provider quota windows are normalized');
  assert(quotas[0].remainingPercent === 72, `Remaining quota is calculated (${quotas[0].remainingPercent}%)`);
  assert(!JSON.stringify(quotas).includes('must-not-leak'), 'Account emails are removed from the public usage contract');

  const refreshCalls: string[] = [];
  const liveUsage = new UsageIntelligence(async (args) => {
    refreshCalls.push(args.join(' '));
    if (args[0] === 'usage') {
      return JSON.stringify([
        { provider: 'Codex', plan: 'Pro', metrics: [{ label: '5h', used_percent: 38, resets_at: '2026-09-03T19:47:35+02:00' }] },
      ]);
    }
    return JSON.stringify({
      entries: [{ client: 'codex', provider: 'openai', model: 'gpt-5.6-sol', input: 20, output: 5, cacheRead: 75, messageCount: 1 }],
      totalInput: 20,
      totalOutput: 5,
      totalCacheRead: 75,
      totalCacheWrite: 0,
      totalMessages: 1,
      totalCost: 0.5,
    });
  }, false, { cachePath: false });
  await liveUsage.refreshNow();
  const liveUsageSnapshot = liveUsage.getSnapshot();
  assert(refreshCalls.length === 2, 'Explicit refresh updates the daily and quota lanes from their real adapters');
  assert(liveUsageSnapshot.quotas[0]?.usedPercent === 38, 'Live quota refresh preserves the measured provider percentage');
  assert(liveUsageSnapshot.freshness?.activity.status === 'live' && liveUsageSnapshot.freshness?.quotas.status === 'live', 'Usage snapshot exposes independent live freshness for activity and limits');
  assert(liveUsageSnapshot.isRefreshing === false, 'Usage refresh state settles after both adapters complete');

  // 10. Test compact HUD projection and command-center bridge
  console.log('\n10. Testing Compact Subscription HUD...');
  const compactUsage = {
    ...dailyUsage,
    status: 'ready' as const,
    source: 'tokscale' as const,
    sourceLabel: 'Tokscale · test fixture',
    quotas,
    byHarness: [
      ...dailyUsage.byHarness,
      {
        id: 'antigravity-cli', label: 'antigravity-cli', provider: 'google',
        totalProcessedTokens: 10, freshInputTokens: 8, outputTokens: 2,
        cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0,
        messageCount: 1, apiEquivalentCostUSD: 0, percent: 1,
      },
    ],
    byModel: [
      ...dailyUsage.byModel,
      {
        id: 'xai_oauth:grok-4.6', label: 'grok-4.6', provider: 'xai_oauth',
        totalProcessedTokens: 50, freshInputTokens: 10, outputTokens: 5,
        cacheReadTokens: 35, cacheWriteTokens: 0, reasoningTokens: 0,
        messageCount: 1, apiEquivalentCostUSD: 0, percent: 5,
      },
      {
        id: 'opencode_free:hy3-free', label: 'hy3-free', provider: 'opencode_free',
        totalProcessedTokens: 25, freshInputTokens: 5, outputTokens: 2,
        cacheReadTokens: 18, cacheWriteTokens: 0, reasoningTokens: 0,
        messageCount: 1, apiEquivalentCostUSD: 0, percent: 2.5,
      },
    ],
  };
  const keyProviders = buildKeyProviderMetrics(compactUsage);
  assert(keyProviders.length === 5, 'Compact HUD always returns the five canonical provider cells');
  assert(keyProviders.find(metric => metric.id === 'codex')?.percent === 25, 'Codex cell prefers authenticated quota usage');
  assert(keyProviders.find(metric => metric.id === 'claude')?.basis === 'quota', 'Claude cell is explicitly labeled as subscription quota');
  assert(keyProviders.find(metric => metric.id === 'grok')?.percent === 5, 'Grok falls back to measured activity share when no quota feed exists');
  assert(keyProviders.find(metric => metric.id === 'opencode')?.basis === 'activity_share', 'OpenCode never presents activity share as subscription quota');

  const grokQuotaProviders = buildKeyProviderMetrics({
    ...compactUsage,
    quotas: [
      ...quotas,
      { provider: 'Grok Build', label: 'Weekly', usedPercent: 74, remainingPercent: 26, status: 'watch' as const },
    ],
  });
  assert(grokQuotaProviders.find(metric => metric.id === 'grok')?.percent === 74, 'Grok uses its authenticated Build quota when Tokscale exposes it');

  let probeCalls = 0;
  const commandCenter = new CommandCenterBridge(async () => {
    probeCalls++;
    return { online: true, latencyMs: 12 };
  }, 15_000, () => Date.parse('2026-08-26T12:00:00Z'));
  const firstCommandSnapshot = await commandCenter.getSnapshot();
  const secondCommandSnapshot = await commandCenter.getSnapshot();
  assert(firstCommandSnapshot.status === 'online' && firstCommandSnapshot.surfaces.length === 5, 'Command Center bridge exposes fixed read-only surfaces');
  assert(secondCommandSnapshot.latencyMs === 12 && probeCalls === 1, 'Command Center health probe is cached instead of polling on every render');


  // 11. Test Compact HUD Service missing edge cases
  console.log('\n11. Testing Compact HUD...');


  const emptyUsage = {
    status: 'unavailable' as const,
    source: 'tokscale' as const,
    sourceLabel: 'Tokscale',
    windowLabel: 'Today',
    timezone: 'local',
    totals: { totalProcessedTokens: 0, cacheReadPercent: 0, freshInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, freshProcessedTokens: 0, freshInputPercent: 0, outputPercent: 0, cacheWritePercent: 0, messages: 0 },
    cost: { apiEquivalentUSD: 0, actualBilledUSD: null, basisLabel: '' },
    byHarness: [],
    byModel: [],
    quotas: [],
    coverage: { measuredHarnesses: [], note: '' }
  };
  const metricsUnavailable = buildKeyProviderMetrics(emptyUsage as any);
  assert(metricsUnavailable.find((m: any) => m.id === 'codex')?.basis === 'unavailable', 'Provider without quota shows unavailable when status is not ready/stale');

  const extremeUsage = {
    ...emptyUsage,
    status: 'ready' as const,
    totals: { ...emptyUsage.totals, totalProcessedTokens: 10 },
    byHarness: [{ id: 'claude', label: 'Claude', provider: 'anthropic', totalProcessedTokens: 15, freshInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, messageCount: 0, apiEquivalentCostUSD: 0, percent: 150 }],
  };
  const metricsExtreme = buildKeyProviderMetrics(extremeUsage as any);
  assert(metricsExtreme.find((m: any) => m.id === 'claude')?.percent === 100, 'Percentage is capped at 100%');

  const multiQuotaUsage = {
    ...emptyUsage,
    status: 'ready' as const,
    quotas: [
      { provider: 'Codex', plan: undefined, label: 'A', usedPercent: 40, remainingPercent: 60, status: 'healthy' as const },
      { provider: 'Codex', plan: undefined, label: 'B', usedPercent: 80, remainingPercent: 20, status: 'healthy' as const }
    ]
  };
  const metricsMulti = buildKeyProviderMetrics(multiQuotaUsage as any);
  assert(metricsMulti.find((m: any) => m.id === 'codex')?.percent === 80, 'selectQuota prefers the highest usedPercent');


  const missingByModelUsage = {
    ...compactUsage,
    byModel: [
      { id: 'random', label: 'Random', totalProcessedTokens: 0, freshInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, messageCount: 0, apiEquivalentCostUSD: 0, percent: 0 },
      { id: 'claude', label: 'Claude', provider: 'anthropic', totalProcessedTokens: 15, freshInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, messageCount: 0, apiEquivalentCostUSD: 0, percent: 100 }
    ]
  };
  const mockMissingByModel = { getSnapshot: () => missingByModelUsage as any };
  const mockMissingByModelService = new CompactHudService(mockMissingByModel, commandCenter);


  const mockMissingByModelSnapshot = await mockMissingByModelService.getSnapshot();
  assert(mockMissingByModelSnapshot.allModels.length === 1 && mockMissingByModelSnapshot.allModels[0].id === 'claude', 'allModels filters out models with 0 processed tokens');


  const mockOfflineCommandCenter = new CommandCenterBridge(async () => ({ online: false, latencyMs: null }), 1000, () => 0);
  const defaultFreshnessService = new CompactHudService({ getSnapshot: () => compactUsage as any }, mockOfflineCommandCenter);
  const defaultFreshnessSnapshot = await defaultFreshnessService.getSnapshot();
  assert(defaultFreshnessSnapshot.commandCenter.status === 'offline', 'CommandCenter dependency injection resolves deterministic offline mock');

  const zeroTotalsUsage = {
    ...emptyUsage,
    status: 'ready' as const,
    totals: { ...emptyUsage.totals, totalProcessedTokens: 0 },
    byHarness: [{ id: 'claude', label: 'Claude', provider: 'anthropic', totalProcessedTokens: 15, freshInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, messageCount: 0, apiEquivalentCostUSD: 0, percent: 0 }],
  };

  const zeroTotalsMetrics = buildKeyProviderMetrics(zeroTotalsUsage as any);
  assert(zeroTotalsMetrics.find((m: any) => m.id === 'claude')?.percent === 0, 'Zero processed tokens defaults to 0%');

  const planQuotaUsage = {
    ...compactUsage,
    quotas: [
      { provider: 'Codex', plan: 'Pro', label: 'Capped', usedPercent: 40, remainingPercent: 60, status: 'healthy' as const }
    ]
  };
  const metricsPlan = buildKeyProviderMetrics(planQuotaUsage as any);
  assert(metricsPlan.find((m: any) => m.id === 'codex')?.detail === 'Capped · Pro', 'Provider quota handles defined plan correctly');

  const opencodeUsage = {
    ...compactUsage,
    byModel: [{ id: 'opencode_free', label: 'OpenCode', provider: 'opencode', totalProcessedTokens: 50, freshInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, messageCount: 0, apiEquivalentCostUSD: 0, percent: 50 }],
  };
  const metricsOpencode = buildKeyProviderMetrics(opencodeUsage as any);
  assert(metricsOpencode.find((m: any) => m.id === 'opencode')?.percent === 5, 'OpenCode matcher correctly finds opencode models');

  const grokUsage = {
    ...compactUsage,
    byModel: [{ id: 'random_model', label: 'Grok', provider: 'xai', totalProcessedTokens: 50, freshInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, messageCount: 0, apiEquivalentCostUSD: 0, percent: 50 }],
  };
  const metricsGrok = buildKeyProviderMetrics(grokUsage as any);
  assert(metricsGrok.find((m: any) => m.id === 'grok')?.percent === 5, 'Grok matcher correctly finds xai models');

  const antigravityUsage = {
    ...compactUsage,
    byHarness: [{ id: 'antigravity', label: 'AntiG', provider: 'google', totalProcessedTokens: 50, freshInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, messageCount: 0, apiEquivalentCostUSD: 0, percent: 50 }],
  };
  const metricsAntiG = buildKeyProviderMetrics(antigravityUsage as any);
  assert(metricsAntiG.find((m: any) => m.id === 'antigravity')?.percent === 5, 'AntiG matcher correctly finds antigravity harness');

  const unusedQuotaUsage = {
    ...compactUsage,
    quotas: [
      { provider: 'UnusedProvider', plan: undefined, label: 'Uncapped', usedPercent: 40, remainingPercent: 60, status: 'healthy' as const }
    ]
  };
  const metricsUnused = buildKeyProviderMetrics(unusedQuotaUsage as any);
  assert(metricsUnused.find((m: any) => m.id === 'codex')?.detail !== 'Uncapped', 'Provider quota handles unmatched quota provider correctly');

  const missingFreshnessUsage = {
    ...compactUsage,
    freshness: undefined
  };
  const missingFreshnessMock = { getSnapshot: () => missingFreshnessUsage as any };
  const missingFreshnessService = new CompactHudService(missingFreshnessMock, commandCenter);
  const missingFreshnessSnapshot = await missingFreshnessService.getSnapshot();
  assert(missingFreshnessSnapshot.freshness.activity.status === 'unavailable', 'Snapshot provides fallback freshness if missing in snapshot');

  // Clean up
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  console.log(`\n--- TEST RESULTS: ${passed} PASSED, ${failed} FAILED ---\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
