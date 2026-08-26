import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentSession, TokenUsage, ContextWindowHealth, AgentActivityState } from '../types';
import { calculateCost } from '../pricing';

export class HermesParser {
  private hermesDir: string;
  private appDataDir: string;

  constructor() {
    const home = os.homedir();
    this.hermesDir = path.join(home, '.hermes');
    this.appDataDir = path.join(home, 'AppData', 'Local', 'hermes');
  }

  public async parseAllSessions(limit = 10): Promise<AgentSession[]> {
    const sessions: AgentSession[] = [];
    const dbPath = path.join(this.appDataDir, 'state.db');

    if (fs.existsSync(dbPath)) {
      try {
        const Database = require('better-sqlite3');
        const db = new Database(dbPath, { readonly: true, timeout: 2000 });
        
        const rows = db.prepare(`
          SELECT id, model, cwd, title, started_at, last_activity_at, last_activity_description, git_branch,
                 input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens,
                 message_count, tool_call_count, chat_type, profile_name,
                 estimated_cost_usd, actual_cost_usd, cost_status, cost_source
          FROM sessions
          WHERE hidden = 0 AND archived = 0
          ORDER BY last_activity_at DESC
          LIMIT ?
        `).all(limit);

        for (const row of rows) {
          const model = row.model || 'unknown';
          const tokens: TokenUsage = {
            inputTokens: row.input_tokens || 0,
            outputTokens: row.output_tokens || 0,
            cacheCreationTokens: row.cache_write_tokens || 0,
            cacheReadTokens: row.cache_read_tokens || 0,
            thinkingTokens: row.reasoning_tokens || 0,
            totalTokens: (row.input_tokens || 0) + (row.output_tokens || 0) + (row.cache_write_tokens || 0) + (row.cache_read_tokens || 0)
          };

          const calculatedCost = calculateCost(tokens, model);
          const hasActualCost = typeof row.actual_cost_usd === 'number' && Number.isFinite(row.actual_cost_usd);
          const hasEstimatedCost = typeof row.estimated_cost_usd === 'number' && Number.isFinite(row.estimated_cost_usd);
          const reportedTotalCost = hasActualCost
            ? row.actual_cost_usd
            : hasEstimatedCost
              ? row.estimated_cost_usd
              : calculatedCost.totalCostUSD;
          const cost = {
            ...calculatedCost,
            totalCostUSD: Number(Number(reportedTotalCost).toFixed(4)),
          };
          const maxContext = 200000;

          const context: ContextWindowHealth = {
            known: false,
            usedTokens: 0,
            maxTokens: maxContext,
            usedPercentage: 0,
            remainingPercentage: 100,
            isNearCompaction: false,
            warningLevel: 'healthy'
          };

          const lastActiveAt = (row.last_activity_at || 0) * 1000;
          const startedAt = (row.started_at || 0) * 1000;
          const isRecent = (Date.now() - lastActiveAt) < 180_000;
          
          let state: AgentActivityState = 'idle';
          if (isRecent) {
             if (row.last_activity_description && row.last_activity_description.includes('tool running')) {
                 state = 'coding';
             } else {
                 state = 'thinking';
             }
          }

          sessions.push({
            id: row.id,
            harness: 'hermes',
            projectName: row.cwd ? path.basename(row.cwd) : (row.profile_name || 'hermes-agent'),
            workspacePath: row.cwd || this.appDataDir,
            model,
            modelDisplayName: 'Hermes ' + (row.profile_name || 'Agent'),
            currentTask: row.title || 'Standing Orchestration',
            state,
            subagentCount: row.tool_call_count > 0 ? 1 : 0,
            tokens,
            cost,
            context,
            startedAt: startedAt,
            lastActiveAt: lastActiveAt,
            tokenVelocity: isRecent ? 28 : 0,
            machineTag: row.chat_type === 'dm' ? '@frank-mobile' : '@frank-desktop',
            gitBranch: row.git_branch || undefined,
            usageAccuracy: 'measured',
            costBasis: hasActualCost ? 'actual' : 'api_equivalent',
          });
        }
        
        db.close();
      } catch (err) {
        // Fallback or ignore
        console.error('HermesParser error reading sqlite:', err);
      }
    }

    // Fallback if no db found or if it failed but we still want to show something
    if (sessions.length === 0) {
      const logPath = path.join(this.hermesDir, 'logs', 'agent.log');
      if (fs.existsSync(logPath)) {
        try {
          const stat = fs.statSync(logPath);
          const lastActiveAt = stat.mtimeMs;
          const isRecent = (Date.now() - lastActiveAt) < 180_000;
          
          const model = 'unknown';
          const tokens: TokenUsage = {
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            totalTokens: 0,
          };
          
          const cost = calculateCost(tokens, model);
          sessions.push({
            id: 'hermes-standing-orchestrator',
            harness: 'hermes',
            projectName: 'hermes-orchestrator',
            workspacePath: this.appDataDir,
            model,
            modelDisplayName: 'Hermes / Starlight Queen',
            currentTask: 'Hermes log detected — usage details unavailable',
            state: isRecent ? 'thinking' : 'idle',
            subagentCount: 2,
            tokens,
            cost,
            context: {
              known: false,
              usedTokens: 0,
              maxTokens: 200000,
              usedPercentage: 0,
              remainingPercentage: 100,
              isNearCompaction: false,
              warningLevel: 'healthy'
            },
            startedAt: lastActiveAt - 7200_000,
            lastActiveAt,
            tokenVelocity: 0,
            machineTag: '@frank-desktop',
            gitBranch: 'queen/starlight',
            usageAccuracy: 'unavailable',
            costBasis: 'unavailable',
          });
        } catch {
          // ignore
        }
      }
    }

    return sessions;
  }
}
