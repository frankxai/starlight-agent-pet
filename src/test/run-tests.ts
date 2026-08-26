import { FleetAggregator } from '../engine/aggregator';
import { calculateCost, calculateSavings, resolveModelPricing } from '../engine/pricing';
import { ClaudeParser } from '../engine/parsers/claude';
import { AntigravityParser } from '../engine/parsers/antigravity';
import { TokenUsage } from '../engine/types';

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
  assert(claudeSessions.length > 0, 'Discovered local Claude Code sessions from disk');
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
  assert(antiSessions.length > 0, 'Discovered local Antigravity brain sessions');

  // 4. Test Aggregator & Fleet State
  console.log('\n4. Testing Aggregator & Arcanea Gates Progression...');
  const aggregator = new FleetAggregator();
  const state = await aggregator.getFleetState();
  assert(state.activeSessions.length > 0, `Fleet contains ${state.activeSessions.length} total sessions`);
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
  
  const analytics = new HistoricalAnalytics(testDbPath);
  analytics.appendDailySummary({
    date: '2026-08-25',
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
    date: '2026-08-25',
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
    date: '2026-08-26',
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
  assert(trend[0].date === '2026-08-25', 'First date is correct');
  assert(trend[0].totalTokens === 4500, `First day total tokens is correct (got ${trend[0].totalTokens})`);
  assert(trend[1].totalTokens === 2000, `Second day total tokens is correct (got ${trend[1].totalTokens})`);

  const modelBreakdown = await analytics.getModelBreakdown(30);
  assert(modelBreakdown['claude-3-7-sonnet-20250219'].totalTokens === 3500, 'Model breakdown for Claude is correct');
  assert(modelBreakdown['gemini-3.7-flash'].totalTokens === 3000, 'Model breakdown for Gemini is correct');

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
