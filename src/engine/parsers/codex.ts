import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentSession, TokenUsage, ContextWindowHealth, AgentActivityState } from '../types';
import { calculateCost } from '../pricing';

export class CodexParser {
  private codexDir: string;
  private rolloutCache = new Map<string, { mtimeMs: number; snapshot: CodexRolloutSnapshot | null }>();

  constructor() {
    const home = os.homedir();
    this.codexDir = path.join(home, '.codex');
  }

  public async parseAllSessions(limit = 10): Promise<AgentSession[]> {
    if (!fs.existsSync(this.codexDir)) {
      return [];
    }

    const sessions: AgentSession[] = [];
    const dbPath = path.join(this.codexDir, 'state_5.sqlite');

    if (fs.existsSync(dbPath)) {
      try {
        const Database = require('better-sqlite3');
        const db = new Database(dbPath, { readonly: true, timeout: 2000 });

        const rows = db.prepare(`
          SELECT id, cwd, title, tokens_used, created_at, updated_at, rollout_path,
                 model, git_branch, agent_role, agent_nickname, memory_mode, archived
          FROM threads
          WHERE archived = 0
          ORDER BY updated_at DESC
          LIMIT ?
        `).all(limit);

        for (const row of rows) {
          const model = row.model || 'gpt-5.6-sol';
          const rollout = this.readLatestRolloutSnapshot(row.rollout_path);
          const totalUsage = rollout?.totalUsage;
          const cachedInput = Number(totalUsage?.cached_input_tokens || 0);
          const reportedInput = Number(totalUsage?.input_tokens || 0);
          const output = Number(totalUsage?.output_tokens || 0);
          const tokens: TokenUsage = rollout ? {
            inputTokens: Math.max(0, reportedInput - cachedInput),
            outputTokens: output,
            cacheCreationTokens: 0,
            cacheReadTokens: cachedInput,
            thinkingTokens: Number(totalUsage?.reasoning_output_tokens || 0),
            totalTokens: Number(totalUsage?.total_tokens || (reportedInput + output)),
          } : {
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            thinkingTokens: 0,
            totalTokens: Number(row.tokens_used || 0),
          };

          const cost = calculateCost(tokens, model);
          const lastUsage = rollout?.lastUsage;
          const contextUsed = Number(lastUsage?.total_tokens || 0);
          const maxContext = Number(rollout?.modelContextWindow || 256000);
          const usedPct = Math.min(100, Math.round((contextUsed / maxContext) * 100));

          const context: ContextWindowHealth = {
            known: Boolean(rollout?.lastUsage),
            usedTokens: contextUsed,
            maxTokens: maxContext,
            usedPercentage: usedPct,
            remainingPercentage: Math.max(0, 100 - usedPct),
            isNearCompaction: usedPct > 85,
            warningLevel: usedPct > 90 ? 'critical' : usedPct > 75 ? 'high' : 'healthy'
          };

          const lastActiveAt = (row.updated_at || 0) * 1000;
          const startedAt = (row.created_at || 0) * 1000;
          const isRecent = (Date.now() - lastActiveAt) < 180_000;
          
          let state: AgentActivityState = 'idle';
          if (isRecent) {
             state = 'coding';
          }

          let ws = row.cwd || 'Codex Workspace';
          // Fix path display
          if (ws.startsWith('\\\\?\\')) ws = ws.substring(4);
          
          let title = row.title || 'Codex Session';
          if (title.length > 50) title = title.substring(0, 47) + '...';

          sessions.push({
            id: `codex-${row.id}`,
            harness: 'codex',
            projectName: path.basename(ws),
            workspacePath: ws,
            model,
            modelDisplayName: row.agent_nickname || (model === 'gpt-5.6-sol' ? 'GPT-5.6 Sol' : model),
            currentTask: title,
            state,
            subagentCount: row.agent_role ? 1 : 0,
            tokens,
            cost,
            context,
            startedAt,
            lastActiveAt,
            tokenVelocity: isRecent ? 42 : 0,
            machineTag: '@frank-desktop',
            gitBranch: row.git_branch || 'agent/codex',
            usageAccuracy: rollout ? 'measured' : 'unavailable',
            costBasis: rollout ? 'api_equivalent' : 'unavailable',
          });
        }
        db.close();
      } catch (err) {
        console.error('CodexParser error reading sqlite:', err);
      }
    }

    // Fallback logic
    if (sessions.length === 0) {
      try {
        const files = fs.readdirSync(this.codexDir)
          .filter(f => f.includes('codex-global-state') || f.endsWith('.json'))
          .map(f => {
            const fp = path.join(this.codexDir, f);
            return { name: f, path: fp, size: fs.statSync(fp).size, mtime: fs.statSync(fp).mtimeMs };
          })
          .filter(f => f.size > 0)
          .sort((a, b) => b.mtime - a.mtime);

        if (files.length > 0) {
          const stateFile = files[0];
          const content = fs.readFileSync(stateFile.path, 'utf8');
          const state = JSON.parse(content);

          const activeRoots = state['active-workspace-roots'] || state['electron-saved-workspace-roots'] || [];
          const projectOrder = state['project-order'] || [];

          for (let i = 0; i < Math.min(projectOrder.length || activeRoots.length, limit); i++) {
            const ws = activeRoots[i] || (projectOrder[i] ? `Project ${projectOrder[i]}` : 'Codex Workspace');
            const projectName = path.basename(ws);

            const model = 'gpt-5.6-sol';
            const tokens: TokenUsage = {
              inputTokens: 0,
              outputTokens: 0,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              thinkingTokens: 0,
              totalTokens: 0,
            };

            const cost = calculateCost(tokens, model);
            const maxContext = 256000;
            const usedPct = Math.round((tokens.totalTokens / maxContext) * 100);

            const context: ContextWindowHealth = {
              known: false,
              usedTokens: tokens.totalTokens,
              maxTokens: maxContext,
              usedPercentage: 0,
              remainingPercentage: 100 - usedPct,
              isNearCompaction: false,
              warningLevel: 'healthy'
            };

            const lastActiveAt = stateFile.mtime;
            const isRecent = (Date.now() - lastActiveAt) < 180_000;
            const agentState: AgentActivityState = isRecent ? 'coding' : 'idle';

            sessions.push({
              id: `codex-${i}-${path.basename(ws)}`,
              harness: 'codex',
              projectName,
              workspacePath: ws,
              model,
              modelDisplayName: 'GPT-5.6 Sol',
              currentTask: 'Codex workspace detected — usage details unavailable',
              state: agentState,
              subagentCount: 1,
              tokens,
              cost,
              context,
              startedAt: lastActiveAt - 3600_000,
              lastActiveAt,
              tokenVelocity: 0,
              machineTag: '@frank-desktop',
              gitBranch: 'agent/codex/feature',
              usageAccuracy: 'unavailable',
              costBasis: 'unavailable',
            });
          }
        }
      } catch {
        // ignore
      }
    }

    return sessions;
  }

  private readLatestRolloutSnapshot(filePath?: string): CodexRolloutSnapshot | null {
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
      const mtimeMs = fs.statSync(filePath).mtimeMs;
      const cached = this.rolloutCache.get(filePath);
      if (cached?.mtimeMs === mtimeMs) return cached.snapshot;

      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
      let snapshot: CodexRolloutSnapshot | null = null;
      for (let index = lines.length - 1; index >= 0; index--) {
        const line = lines[index].trim();
        if (!line) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'event_msg' && event.payload?.type === 'token_count' && event.payload?.info) {
            snapshot = {
              totalUsage: event.payload.info.total_token_usage,
              lastUsage: event.payload.info.last_token_usage,
              modelContextWindow: event.payload.info.model_context_window,
            };
            break;
          }
        } catch {
          // Ignore truncated rollout lines.
        }
      }
      this.rolloutCache.set(filePath, { mtimeMs, snapshot });
      return snapshot;
    } catch {
      return null;
    }
  }
}

interface CodexTokenCounter {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
}

interface CodexRolloutSnapshot {
  totalUsage?: CodexTokenCounter;
  lastUsage?: CodexTokenCounter;
  modelContextWindow?: number;
}
