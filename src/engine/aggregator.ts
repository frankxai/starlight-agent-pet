import { ClaudeParser } from './parsers/claude';
import { AntigravityParser } from './parsers/antigravity';
import { CodexParser } from './parsers/codex';
import { HermesParser } from './parsers/hermes';
import { GrokKiloParser } from './parsers/grok';
import { 
  FleetState, 
  AgentSession, 
  DailyUsageSummary, 
  AgentActivityState, 
  PetSkinId, 
  HookEventPayload, 
  AgentHarness,
  PermissionRequest 
} from './types';
import { calculateCost, calculateSavings } from './pricing';
import { HistoricalAnalytics, AnalyticsRecord } from './analytics';

export class FleetAggregator {
  private claudeParser = new ClaudeParser();
  private antigravityParser = new AntigravityParser();
  private codexParser = new CodexParser();
  private hermesParser = new HermesParser();
  private grokParser = new GrokKiloParser();

  private liveSessions: Map<string, AgentSession> = new Map();
  private pendingPermissions: Map<string, PermissionRequest> = new Map();
  private currentPetSkin: PetSkinId = 'codex_bot';
  private soundEnabled = true;
  private serverStartTime = Date.now();
  
  public analytics = new HistoricalAnalytics();
  private lastCheckedDate: string;

  constructor() {
    this.lastCheckedDate = new Date().toISOString().split('T')[0];
  }
  public setPetSkin(skin: PetSkinId) {
    this.currentPetSkin = skin;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public approvePermission(permissionId: string): boolean {
    const perm = this.pendingPermissions.get(permissionId);
    if (perm) {
      perm.status = 'approved';
      const session = this.liveSessions.get(perm.sessionId);
      if (session && session.state === 'approval_required') {
        session.state = 'coding';
      }
      return true;
    }
    return false;
  }

  public denyPermission(permissionId: string): boolean {
    const perm = this.pendingPermissions.get(permissionId);
    if (perm) {
      perm.status = 'denied';
      const session = this.liveSessions.get(perm.sessionId);
      if (session && session.state === 'approval_required') {
        session.state = 'idle';
      }
      return true;
    }
    return false;
  }

  public handleHookEvent(payload: HookEventPayload) {
    const existing = this.liveSessions.get(payload.sessionId) || this.createSkeletonSession(payload);
    
    if (payload.model) {
      existing.model = payload.model;
    }
    if (payload.task) {
      existing.currentTask = payload.task;
    }
    if (payload.workspace) {
      existing.workspacePath = payload.workspace;
    }
    if (payload.toolName) {
      existing.activeTool = {
        name: payload.toolName,
        summary: payload.toolSummary || payload.toolName,
        startedAt: Date.now(),
        status: payload.event === 'stop' ? 'completed' : 'running',
        inputArgs: payload.toolArgs
      };
    }

    if (payload.event === 'permission_request' || payload.event === 'notification') {
      existing.state = 'approval_required';
      const permId = `perm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      this.pendingPermissions.set(permId, {
        id: permId,
        sessionId: payload.sessionId,
        harness: payload.harness,
        toolName: payload.toolName || 'Tool Action',
        description: payload.toolSummary || `Approval requested for ${payload.toolName || 'tool execution'}`,
        requestedAt: Date.now(),
        status: 'pending'
      });
    } else if (payload.event === 'pre_tool_use') {
      existing.state = 'coding';
    } else if (payload.event === 'post_tool_use') {
      existing.state = 'thinking';
    } else if (payload.event === 'stop') {
      existing.state = 'idle';
      if (existing.activeTool) {
        existing.activeTool.status = 'completed';
      }
    }

    if (payload.contextRemainingPct !== undefined) {
      const usedPct = Math.round(100 - payload.contextRemainingPct);
      existing.context.usedPercentage = usedPct;
      existing.context.remainingPercentage = payload.contextRemainingPct;
      existing.context.isNearCompaction = usedPct >= 80;
      existing.context.warningLevel = usedPct >= 85 ? 'critical' : usedPct >= 70 ? 'high' : 'healthy';
      if (existing.context.isNearCompaction) {
        existing.state = 'low_context_alert';
      }
    }

    if (payload.tokens) {
      existing.tokens.inputTokens = payload.tokens.inputTokens ?? existing.tokens.inputTokens;
      existing.tokens.outputTokens = payload.tokens.outputTokens ?? existing.tokens.outputTokens;
      existing.tokens.cacheReadTokens = payload.tokens.cacheReadTokens ?? existing.tokens.cacheReadTokens;
      existing.tokens.cacheCreationTokens = payload.tokens.cacheCreationTokens ?? existing.tokens.cacheCreationTokens;
      existing.tokens.totalTokens = existing.tokens.inputTokens + existing.tokens.outputTokens + existing.tokens.cacheCreationTokens + existing.tokens.cacheReadTokens;
      existing.cost = calculateCost(existing.tokens, existing.model);
      existing.savings = calculateSavings(existing.tokens, existing.model);
    }

    existing.lastActiveAt = Date.now();
    this.liveSessions.set(payload.sessionId, existing);
  }

  public async getFleetState(): Promise<FleetState> {
    // 1. Run all parsers in parallel
    const [claudeSessions, antiSessions, codexSessions, hermesSessions, grokSessions] = await Promise.all([
      this.claudeParser.parseAllSessions(30),
      this.antigravityParser.parseAllSessions(15),
      this.codexParser.parseAllSessions(5),
      this.hermesParser.parseAllSessions(5),
      this.grokParser.parseAllSessions(5),
    ]);

    const allDiscovered = [
      ...claudeSessions,
      ...antiSessions,
      ...codexSessions,
      ...hermesSessions,
      ...grokSessions,
    ];

    // Merge discovered with live hook memory
    for (const session of allDiscovered) {
      const live = this.liveSessions.get(session.id);
      if (live) {
        // Keep freshest timestamps & live states
        if (live.lastActiveAt >= session.lastActiveAt) {
          session.state = live.state;
          session.activeTool = live.activeTool;
          session.currentTask = live.currentTask || session.currentTask;
          session.tokens = live.tokens || session.tokens;
          session.cost = live.cost || session.cost;
          session.savings = live.savings || session.savings;
          session.lastActiveAt = live.lastActiveAt;
        }
      }
      this.liveSessions.set(session.id, session);
    }

    const sessions = Array.from(this.liveSessions.values())
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt);

    // 2. Compute Fleet-wide Metrics
    let totalTokens = 0;
    let totalCostUSD = 0;
    let totalSavingsUSD = 0;
    let activeSubagentsTotal = 0;
    let currentFleetVelocity = 0;

    const tokensByHarness: Record<AgentHarness, number> = {
      claude: 0,
      antigravity: 0,
      codex: 0,
      hermes: 0,
      grok: 0,
      kilo: 0,
      opencode: 0,
      custom: 0,
    };

    const costByHarness: Record<AgentHarness, number> = {
      claude: 0,
      antigravity: 0,
      codex: 0,
      hermes: 0,
      grok: 0,
      kilo: 0,
      opencode: 0,
      custom: 0,
    };

    const tokensByModel: Record<string, number> = {};
    const costByModel: Record<string, number> = {};

    let overallState: AgentActivityState = 'idle';
    const now = Date.now();

    for (const s of sessions) {
      totalTokens += s.tokens.totalTokens;
      totalCostUSD += s.cost.totalCostUSD;
      if (s.savings) {
        totalSavingsUSD += s.savings.cacheSavingsUSD;
      }
      activeSubagentsTotal += s.subagentCount;

      const isLive = (now - s.lastActiveAt) < 120_000;
      if (isLive) {
        currentFleetVelocity += s.tokenVelocity;
        if (s.state === 'approval_required') {
          overallState = 'approval_required';
        } else if (s.state === 'low_context_alert' && overallState !== 'approval_required') {
          overallState = 'low_context_alert';
        } else if (s.state === 'coding' && overallState !== 'approval_required' && overallState !== 'low_context_alert') {
          overallState = 'coding';
        } else if (s.state === 'thinking' && overallState === 'idle') {
          overallState = 'thinking';
        }
      }

      tokensByHarness[s.harness] = (tokensByHarness[s.harness] || 0) + s.tokens.totalTokens;
      costByHarness[s.harness] = (costByHarness[s.harness] || 0) + s.cost.totalCostUSD;

      const mKey = s.modelDisplayName || s.model;
      tokensByModel[mKey] = (tokensByModel[mKey] || 0) + s.tokens.totalTokens;
      costByModel[mKey] = (costByModel[mKey] || 0) + s.cost.totalCostUSD;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const todaySummary: DailyUsageSummary = {
      date: todayDate,
      totalTokens,
      totalCostUSD: Number(totalCostUSD.toFixed(4)),
      totalSavingsUSD: Number(totalSavingsUSD.toFixed(4)),
      sessionsCount: sessions.length,
      tokensByHarness,
      costByHarness,
      tokensByModel,
      costByModel
    };

    if (this.lastCheckedDate && this.lastCheckedDate !== todayDate) {
      this.snapshotTodayAnalytics(this.lastCheckedDate, sessions);
      this.lastCheckedDate = todayDate;
    }

    // Calculate Arcanea Ten Gates XP and progression
    const petProgression = this.calculatePetProgression(totalTokens, sessions.length);

    // Active pending permissions
    const pending = Array.from(this.pendingPermissions.values())
      .filter(p => p.status === 'pending')
      .slice(0, 5);

    // Collect active harnesses
    const activeHarnesses = Array.from(new Set(sessions.filter(s => (now - s.lastActiveAt) < 300_000).map(s => s.harness)));

    return {
      activeSessions: sessions.slice(0, 25),
      pendingPermissions: pending,
      historicalSummary: {
        today: todaySummary,
        last7Days: [todaySummary],
        totalAllTimeCostUSD: Number(totalCostUSD.toFixed(4)),
        totalAllTimeTokens: totalTokens,
        totalAllTimeSavingsUSD: Number(totalSavingsUSD.toFixed(4))
      },
      overallState,
      activeSubagentsTotal,
      currentFleetVelocity,
      pet: {
        skin: this.currentPetSkin,
        level: petProgression.level,
        currentXP: petProgression.currentXP,
        nextLevelXP: petProgression.nextLevelXP,
        arcaneaGate: petProgression.arcaneaGate,
        currentMood: this.getPetMood(overallState, currentFleetVelocity),
        speechBubble: this.getPetSpeech(overallState, sessions[0]),
        soundEnabled: this.soundEnabled
      },
      systemStatus: {
        machine: 'Frank Desktop (@frank-desktop)',
        serverUptimeSeconds: Math.round((Date.now() - this.serverStartTime) / 1000),
        lastPolledAt: Date.now(),
        activeHarnesses
      }
    };
  }

  private calculatePetProgression(totalTokens: number, sessionCount: number) {
    const baseXP = Math.round(totalTokens / 100) + (sessionCount * 50);
    const XP_PER_LEVEL = 1000;
    const level = Math.max(1, Math.floor(baseXP / XP_PER_LEVEL) + 1);
    const currentXP = baseXP % XP_PER_LEVEL;
    const nextLevelXP = XP_PER_LEVEL;

    const GATES = [
      'Gate 1: Foundation (Apprentice)',
      'Gate 2: Flow (Adept)',
      'Gate 3: Fire (Creator)',
      'Gate 4: Heart (Artisan)',
      'Gate 5: Voice (Speaker)',
      'Gate 6: Sight (Visionary)',
      'Gate 7: Crown (Luminor)',
      'Gate 8: Star (Starbound)',
      'Gate 9: Cosmos (Worldbuilder)',
      'Gate 10: Unity (Nexus Master)'
    ];

    const gateIndex = Math.min(GATES.length - 1, Math.floor((level - 1) / 3));
    const arcaneaGate = GATES[gateIndex];

    return { level, currentXP, nextLevelXP, arcaneaGate };
  }

  private getPetMood(state: AgentActivityState, velocity: number): string {
    if (state === 'approval_required') return 'Waiting for your command, Frank!';
    if (state === 'low_context_alert') return 'Warning! Context window saturation high!';
    if (state === 'coding') return velocity > 50 ? 'Hyper-Focus / Burning code fast!' : 'Executing tool actions';
    if (state === 'thinking') return 'Deep reasoning through the problem...';
    if (state === 'swarming') return 'Swarm active! Subagents dispatched.';
    return 'Vibing & standing by';
  }

  private getPetSpeech(state: AgentActivityState, topSession?: AgentSession): string {
    if (state === 'approval_required') {
      return 'Action requested! Click to review permission.';
    }
    if (state === 'low_context_alert') {
      return 'Context > 80%! Consider /compact or fresh worktree.';
    }
    if (state === 'coding') {
      return topSession?.activeTool?.name 
        ? `Running: ${topSession.activeTool.name}`
        : 'Synthesizing code...';
    }
    if (state === 'thinking') {
      return 'Reasoning across the estate...';
    }
    return 'All agent fleets operational.';
  }

  public snapshotTodayAnalytics(overrideDate?: string, activeSessions?: AgentSession[]): void {
    const date = overrideDate || new Date().toISOString().split('T')[0];
    const sessions = activeSessions || Array.from(this.liveSessions.values());
    
    const groups: Record<string, AnalyticsRecord> = {};
    for (const s of sessions) {
      const key = `${s.harness}|${s.model}|${s.machineTag || '@frank-desktop'}`;
      if (!groups[key]) {
        groups[key] = {
          date,
          harness: s.harness,
          model: s.model,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 0,
          costUSD: 0,
          sessionsCount: 0,
          machineTag: s.machineTag || '@frank-desktop'
        };
      }
      groups[key].inputTokens += s.tokens.inputTokens;
      groups[key].outputTokens += s.tokens.outputTokens;
      groups[key].cacheReadTokens += s.tokens.cacheReadTokens || 0;
      groups[key].totalTokens += s.tokens.totalTokens;
      groups[key].costUSD += s.cost.totalCostUSD;
      groups[key].sessionsCount += 1;
    }
    
    for (const record of Object.values(groups)) {
      this.analytics.appendDailySummary(record);
    }
  }

  private createSkeletonSession(payload: HookEventPayload): AgentSession {
    const model = payload.model || 'claude-3-7-sonnet-20250219';
    return {
      id: payload.sessionId,
      harness: payload.harness,
      projectName: payload.workspace ? payload.workspace.split(/[\\/]/).pop() || 'workspace' : 'agent-session',
      workspacePath: payload.workspace || process.cwd(),
      model,
      modelDisplayName: model,
      currentTask: payload.task,
      state: 'idle',
      subagentCount: 0,
      tokens: {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0
      },
      cost: {
        inputCostUSD: 0,
        outputCostUSD: 0,
        cacheCreationCostUSD: 0,
        cacheReadCostUSD: 0,
        totalCostUSD: 0
      },
      savings: {
        cacheSavingsUSD: 0,
        cacheHitPercentage: 0,
        totalUncachedCostUSD: 0
      },
      context: {
        usedTokens: 0,
        maxTokens: 200000,
        usedPercentage: 0,
        remainingPercentage: 100,
        isNearCompaction: false,
        warningLevel: 'healthy'
      },
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      tokenVelocity: 0,
      machineTag: payload.machineTag || '@frank-desktop',
      gitBranch: payload.gitBranch || 'main'
    };
  }
}
