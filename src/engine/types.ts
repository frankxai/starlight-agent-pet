export type AgentHarness = 
  | 'claude' 
  | 'antigravity' 
  | 'codex' 
  | 'hermes' 
  | 'grok' 
  | 'kilo' 
  | 'opencode' 
  | 'custom';

export type AgentActivityState = 
  | 'idle' 
  | 'thinking' 
  | 'coding' 
  | 'swarming' 
  | 'approval_required' 
  | 'low_context_alert' 
  | 'victory' 
  | 'error' 
  | 'sleeping';

export type PetSkinId = 
  | 'stellaris' 
  | 'arcanea_luminor' 
  | 'cyber_bot' 
  | 'kuro_neko' 
  | 'starlight_queen';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number; // 1h or 5m
  cacheReadTokens: number;
  thinkingTokens?: number;
  totalTokens: number;
}

export interface CostEstimate {
  inputCostUSD: number;
  outputCostUSD: number;
  cacheCreationCostUSD: number;
  cacheReadCostUSD: number;
  totalCostUSD: number;
}

export interface SavingsEstimate {
  cacheSavingsUSD: number;
  cacheHitPercentage: number;
  totalUncachedCostUSD: number;
}

export interface ContextWindowHealth {
  usedTokens: number;
  maxTokens: number;
  usedPercentage: number;
  remainingPercentage: number;
  isNearCompaction: boolean; // >= 80%
  warningLevel: 'healthy' | 'moderate' | 'high' | 'critical';
}

export interface AgentToolCall {
  id?: string;
  name: string;
  summary?: string;
  startedAt: number;
  durationMs?: number;
  status: 'running' | 'completed' | 'failed';
  inputArgs?: Record<string, any>;
}

export interface PermissionRequest {
  id: string;
  sessionId: string;
  harness: AgentHarness;
  toolName: string;
  description: string;
  requestedAt: number;
  status: 'pending' | 'approved' | 'denied';
}

export interface AgentSession {
  id: string;
  harness: AgentHarness;
  projectName: string;
  workspacePath: string;
  model: string;
  modelDisplayName?: string;
  currentTask?: string;
  state: AgentActivityState;
  activeTool?: AgentToolCall;
  subagentCount: number;
  tokens: TokenUsage;
  cost: CostEstimate;
  savings?: SavingsEstimate;
  context: ContextWindowHealth;
  startedAt: number;
  lastActiveAt: number;
  tokenVelocity: number; // tokens/sec
  machineTag: string; // e.g. @frank-desktop, @yoga-c940
  gitBranch?: string;
}

export interface DailyUsageSummary {
  date: string; // YYYY-MM-DD
  totalTokens: number;
  totalCostUSD: number;
  totalSavingsUSD?: number;
  sessionsCount: number;
  tokensByHarness: Record<AgentHarness, number>;
  costByHarness: Record<AgentHarness, number>;
  tokensByModel: Record<string, number>;
  costByModel: Record<string, number>;
}

export interface FleetState {
  activeSessions: AgentSession[];
  pendingPermissions: PermissionRequest[];
  historicalSummary: {
    today: DailyUsageSummary;
    last7Days: DailyUsageSummary[];
    totalAllTimeCostUSD: number;
    totalAllTimeTokens: number;
    totalAllTimeSavingsUSD: number;
  };
  overallState: AgentActivityState;
  activeSubagentsTotal: number;
  currentFleetVelocity: number; // total tokens/sec
  pet: {
    skin: PetSkinId;
    level: number;
    currentXP: number;
    nextLevelXP: number;
    arcaneaGate: string; // e.g., "Gate 1: Foundation", "Gate 7: Crown"
    currentMood: string;
    speechBubble?: string;
    soundEnabled: boolean;
  };
  systemStatus: {
    machine: string;
    serverUptimeSeconds: number;
    lastPolledAt: number;
    activeHarnesses: AgentHarness[];
  };
}

export interface HookEventPayload {
  harness: AgentHarness;
  event: 'session_start' | 'pre_tool_use' | 'post_tool_use' | 'notification' | 'stop' | 'status_update' | 'permission_request';
  sessionId: string;
  model?: string;
  task?: string;
  workspace?: string;
  toolName?: string;
  toolSummary?: string;
  toolArgs?: Record<string, any>;
  tokens?: Partial<TokenUsage>;
  contextRemainingPct?: number;
  machineTag?: string;
  gitBranch?: string;
  timestamp?: number;
}
