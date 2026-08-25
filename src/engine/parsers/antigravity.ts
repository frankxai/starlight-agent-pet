import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentSession, TokenUsage, ContextWindowHealth, AgentActivityState, AgentToolCall } from '../types';
import { calculateCost } from '../pricing';

export class AntigravityParser {
  private brainDir: string;

  constructor() {
    const home = os.homedir();
    this.brainDir = path.join(home, '.gemini', 'antigravity', 'brain');
  }

  public async parseAllSessions(limit = 20): Promise<AgentSession[]> {
    if (!fs.existsSync(this.brainDir)) {
      return [];
    }

    const sessions: AgentSession[] = [];
    try {
      const convDirs = fs.readdirSync(this.brainDir)
        .map(name => {
          const fullPath = path.join(this.brainDir, name);
          const transcriptPath = path.join(fullPath, '.system_generated', 'logs', 'transcript.jsonl');
          const hasTranscript = fs.existsSync(transcriptPath);
          const mtime = hasTranscript ? fs.statSync(transcriptPath).mtimeMs : 0;
          return { name, fullPath, transcriptPath, hasTranscript, mtime };
        })
        .filter(item => item.hasTranscript)
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, limit);

      for (const item of convDirs) {
        const session = await this.parseTranscriptFile(item.transcriptPath, item.name);
        if (session) {
          sessions.push(session);
        }
      }
    } catch {
      // ignore
    }

    return sessions;
  }

  public async parseTranscriptFile(transcriptPath: string, convId: string): Promise<AgentSession | null> {
    try {
      const content = fs.readFileSync(transcriptPath, 'utf8');
      const lines = content.split('\n');
      if (lines.length === 0 || !lines[0].trim()) return null;

      const fileMtime = fs.statSync(transcriptPath).mtimeMs;
      let startedAt = fileMtime;
      let lastActiveAt = fileMtime;
      let activeTool: AgentToolCall | undefined;
      let lastUserMessage = '';
      let subagents = 0;
      let totalSteps = 0;

      // Estimate tokens based on step content / length
      let estimatedInputTokens = 0;
      let estimatedOutputTokens = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        totalSteps++;

        try {
          const step = JSON.parse(line);

          if (step.created_at) {
            const ts = new Date(step.created_at).getTime();
            if (ts > lastActiveAt) lastActiveAt = ts;
            if (ts < startedAt) startedAt = ts;
          }

          if (step.type === 'USER_INPUT' && step.content) {
            lastUserMessage = typeof step.content === 'string' ? step.content.slice(0, 100) : '';
            estimatedInputTokens += Math.round((step.content.length || 0) / 3.8);
          }

          if (step.type === 'PLANNER_RESPONSE') {
            if (step.tool_calls && Array.isArray(step.tool_calls)) {
              for (const tc of step.tool_calls) {
                if (tc.toolAction === 'invoke_subagent' || tc.toolAction?.includes('subagent')) {
                  subagents++;
                }
                activeTool = {
                  name: tc.toolAction || tc.toolSummary || 'Planner Action',
                  summary: tc.toolSummary || tc.toolAction,
                  startedAt: lastActiveAt,
                  status: 'running'
                };
              }
            }
            if (step.content) {
              estimatedOutputTokens += Math.round((step.content.length || 0) / 3.8);
            }
          }

          if (step.content && typeof step.content === 'string') {
            estimatedInputTokens += Math.round(step.content.length / 5);
          }
        } catch {
          // ignore
        }
      }

      const model = 'gemini-3.7-flash';
      const maxContextTokens = 1048576; // 1M context
      const totalTokens = estimatedInputTokens + estimatedOutputTokens;

      const tokens: TokenUsage = {
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        thinkingTokens: Math.round(estimatedOutputTokens * 0.3),
        totalTokens,
      };

      const usedPct = Math.min(100, Math.round((totalTokens / maxContextTokens) * 100));
      const context: ContextWindowHealth = {
        usedTokens: totalTokens,
        maxTokens: maxContextTokens,
        usedPercentage: usedPct,
        remainingPercentage: Math.max(0, 100 - usedPct),
        isNearCompaction: usedPct >= 80,
        warningLevel: usedPct >= 85 ? 'critical' : usedPct >= 70 ? 'high' : 'healthy'
      };

      const now = Date.now();
      const isRecent = (now - lastActiveAt) < 120_000;
      let state: AgentActivityState = 'idle';

      if (isRecent) {
        state = activeTool ? 'coding' : 'thinking';
      } else if ((now - lastActiveAt) > 3600_000 * 4) {
        state = 'sleeping';
      }

      const cost = calculateCost(tokens, model);
      const durationSeconds = Math.max(1, (lastActiveAt - startedAt) / 1000);
      const tokenVelocity = isRecent ? Math.round(tokens.outputTokens / Math.min(durationSeconds, 180)) : 0;

      return {
        id: convId,
        harness: 'antigravity',
        projectName: 'antigravity-brain',
        workspacePath: path.join(this.brainDir, convId),
        model,
        modelDisplayName: 'Gemini 3.7 Flash',
        currentTask: lastUserMessage || `Antigravity Session (${totalSteps} steps)`,
        state,
        activeTool,
        subagentCount: subagents,
        tokens,
        cost,
        context,
        startedAt,
        lastActiveAt,
        tokenVelocity,
        machineTag: '@frank-desktop',
        gitBranch: 'main'
      };
    } catch {
      return null;
    }
  }
}
