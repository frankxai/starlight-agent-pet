import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentSession, TokenUsage, ContextWindowHealth, AgentActivityState, AgentToolCall } from '../types';
import { calculateCost, resolveModelPricing } from '../pricing';

export class ClaudeParser {
  private baseDir: string;
  private todosDir: string;
  private tmpDir: string;

  constructor() {
    const home = os.homedir();
    const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude');
    this.baseDir = path.join(claudeDir, 'projects');
    this.todosDir = path.join(claudeDir, 'todos');
    this.tmpDir = os.tmpdir();
  }

  public async parseAllSessions(limit = 50): Promise<AgentSession[]> {
    if (!fs.existsSync(this.baseDir)) {
      return [];
    }

    const sessions: AgentSession[] = [];
    const projectDirs = this.getProjectDirs();

    for (const projDir of projectDirs) {
      const fullProjPath = path.join(this.baseDir, projDir);
      try {
        const files = fs.readdirSync(fullProjPath)
          .filter(f => f.endsWith('.jsonl'))
          .map(f => {
            const fp = path.join(fullProjPath, f);
            return {
              name: f,
              path: fp,
              mtime: fs.statSync(fp).mtimeMs
            };
          })
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 10); // Check top 10 most recent per project

        for (const file of files) {
          const session = await this.parseSessionFile(file.path, projDir);
          if (session) {
            sessions.push(session);
          }
        }
      } catch (err) {
        // Skip unreadable directories
      }
    }

    // Sort all sessions by last active time descending
    sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    return sessions.slice(0, limit);
  }

  public async parseSessionFile(filePath: string, projDirName: string): Promise<AgentSession | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      if (lines.length === 0 || !lines[0].trim()) return null;

      const sessionId = path.basename(filePath, '.jsonl');
      const fileMtime = fs.statSync(filePath).mtimeMs;
      let model = 'claude-3-7-sonnet-20250219';
      let gitBranch = 'main';
      let workspacePath = this.decodeProjDir(projDirName);
      let startedAt = fileMtime;
      let lastActiveAt = fileMtime;
      let activeTool: AgentToolCall | undefined;
      let isThinking = false;
      let lastUserMessage = '';

      const tokens: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
      };

      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          const data = JSON.parse(line);

          if (data.sessionId && !sessionId) {
            // Found session ID
          }

          if (data.gitBranch) {
            gitBranch = data.gitBranch;
          }

          if (data.cwd) {
            workspacePath = data.cwd;
          }

          if (data.timestamp) {
            const ts = new Date(data.timestamp).getTime();
            if (ts > lastActiveAt) lastActiveAt = ts;
            if (ts < startedAt) startedAt = ts;
          }

          // Parse Usage
          const msg = data.message;
          if (msg && typeof msg === 'object') {
            if (msg.model && msg.model !== '<synthetic>') {
              model = msg.model;
            }

            const usage = msg.usage;
            if (usage && typeof usage === 'object') {
              tokens.inputTokens += Number(usage.input_tokens || 0);
              tokens.outputTokens += Number(usage.output_tokens || 0);
              tokens.cacheCreationTokens += Number(usage.cache_creation_input_tokens || 0);
              tokens.cacheReadTokens += Number(usage.cache_read_input_tokens || 0);
              
              if (usage.output_tokens_details && usage.output_tokens_details.thinking_tokens) {
                tokens.thinkingTokens = (tokens.thinkingTokens || 0) + Number(usage.output_tokens_details.thinking_tokens);
              }
            }

            // Check tool execution
            if (Array.isArray(msg.content)) {
              for (const block of msg.content) {
                if (block.type === 'tool_use') {
                  if (!activeTool) {
                    activeTool = {
                      name: block.name || 'tool',
                      summary: block.input?.toolSummary || block.name,
                      startedAt: lastActiveAt,
                      status: 'running'
                    };
                  }
                } else if (block.type === 'thinking') {
                  isThinking = true;
                }
              }
            }
          }

          // User message
          if (data.type === 'user' && !lastUserMessage && data.message?.content) {
            if (typeof data.message.content === 'string') {
              lastUserMessage = data.message.content.slice(0, 120);
            }
          }
        } catch {
          // Ignore bad line
        }
      }

      tokens.totalTokens = tokens.inputTokens + tokens.outputTokens + tokens.cacheCreationTokens + tokens.cacheReadTokens;

      // Check context window bridge
      const context = this.readContextBridge(sessionId, model);

      // Check active task in todos
      const currentTask = this.readCurrentTask(sessionId) || lastUserMessage;

      // Determine state
      const now = Date.now();
      const isRecent = (now - lastActiveAt) < 90_000; // Active within 90s
      let state: AgentActivityState = 'idle';

      if (context.isNearCompaction) {
        state = 'low_context_alert';
      } else if (isRecent) {
        if (isThinking) {
          state = 'thinking';
        } else if (activeTool) {
          state = 'coding';
        } else {
          state = 'thinking';
        }
      } else if ((now - lastActiveAt) > 3600_000 * 4) {
        state = 'sleeping';
      }

      const cost = calculateCost(tokens, model);

      // Calculate token velocity (rough estimate over active session)
      const durationSeconds = Math.max(1, (lastActiveAt - startedAt) / 1000);
      const tokenVelocity = isRecent ? Math.round(tokens.outputTokens / Math.min(durationSeconds, 300)) : 0;

      const projectName = path.basename(workspacePath) || 'workspace';

      return {
        id: sessionId,
        harness: 'claude',
        projectName,
        workspacePath,
        model,
        modelDisplayName: this.formatModelName(model),
        currentTask,
        state,
        activeTool,
        subagentCount: 0,
        tokens,
        cost,
        context,
        startedAt,
        lastActiveAt,
        tokenVelocity,
        machineTag: '@frank-desktop',
        gitBranch,
      };
    } catch {
      return null;
    }
  }

  private readContextBridge(sessionId: string, model: string): ContextWindowHealth {
    const bridgePath = path.join(this.tmpDir, `claude-ctx-${sessionId}.json`);
    const pricing = resolveModelPricing(model);
    const maxTokens = pricing.maxContextTokens || 200000;

    if (fs.existsSync(bridgePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));
        const usedPct = data.used_pct ?? (100 - (data.remaining_percentage ?? 100));
        const remainingPct = data.remaining_percentage ?? (100 - usedPct);
        const usedTokens = Math.round((usedPct / 100) * maxTokens);
        const isNearCompaction = usedPct >= 80;

        let warningLevel: ContextWindowHealth['warningLevel'] = 'healthy';
        if (usedPct >= 85) warningLevel = 'critical';
        else if (usedPct >= 75) warningLevel = 'high';
        else if (usedPct >= 50) warningLevel = 'moderate';

        return {
          usedTokens,
          maxTokens,
          usedPercentage: usedPct,
          remainingPercentage: remainingPct,
          isNearCompaction,
          warningLevel
        };
      } catch {
        // fallback
      }
    }

    return {
      usedTokens: 0,
      maxTokens,
      usedPercentage: 0,
      remainingPercentage: 100,
      isNearCompaction: false,
      warningLevel: 'healthy'
    };
  }

  private readCurrentTask(sessionId: string): string | undefined {
    if (!fs.existsSync(this.todosDir)) return undefined;
    try {
      const files = fs.readdirSync(this.todosDir)
        .filter(f => f.startsWith(sessionId) && f.endsWith('.json'));

      if (files.length > 0) {
        const filePath = path.join(this.todosDir, files[0]);
        const todos = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(todos)) {
          const inProgress = todos.find(t => t.status === 'in_progress');
          if (inProgress) return inProgress.activeForm || inProgress.content;
        }
      }
    } catch {
      // fallback
    }
    return undefined;
  }

  private getProjectDirs(): string[] {
    try {
      return fs.readdirSync(this.baseDir).filter(f => {
        return fs.statSync(path.join(this.baseDir, f)).isDirectory();
      });
    } catch {
      return [];
    }
  }

  private decodeProjDir(dirName: string): string {
    // Converts e.g. "C--Users-frank-starlight-repos" -> "C:/Users/frank/starlight/repos"
    if (dirName.startsWith('C--')) {
      return dirName.replace(/^C--/, 'C:/').replace(/-/g, '/');
    }
    return dirName.replace(/-/g, '/');
  }

  private formatModelName(model: string): string {
    if (model.includes('sonnet')) return 'Claude 3.7 Sonnet';
    if (model.includes('haiku')) return 'Claude 3.5 Haiku';
    if (model.includes('opus')) return 'Claude 3 Opus';
    return model;
  }
}
