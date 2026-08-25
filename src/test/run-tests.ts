import { FleetAggregator } from '../engine/aggregator';
import { calculateCost, resolveModelPricing } from '../engine/pricing';
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

  // 1. Test Pricing Engine
  console.log('1. Testing Pricing Engine...');
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

  // 5. Test Live Hook Injection
  console.log('\n5. Testing Live Hook Event Handler...');
  aggregator.handleHookEvent({
    harness: 'claude',
    event: 'pre_tool_use',
    sessionId: 'test-live-session-123',
    model: 'claude-3-7-sonnet-20250219',
    task: 'Building Starlight Agent Pet',
    toolName: 'write_to_file',
    toolSummary: 'Creating Pet UI',
    contextRemainingPct: 65,
    tokens: {
      inputTokens: 12000,
      outputTokens: 3400,
      cacheReadTokens: 8000,
      cacheCreationTokens: 4000
    }
  });

  const updatedState = await aggregator.getFleetState();
  const injected = updatedState.activeSessions.find(s => s.id === 'test-live-session-123');
  assert(injected !== undefined, 'Live injected session found in state');
  assert(injected?.state === 'coding', 'Injected session state is coding');
  assert(injected?.activeTool?.name === 'write_to_file', 'Active tool is write_to_file');

  console.log(`\n--- TEST RESULTS: ${passed} PASSED, ${failed} FAILED ---\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
