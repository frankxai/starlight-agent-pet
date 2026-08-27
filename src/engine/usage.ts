import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ConsolidatedUsageSnapshot,
  ProviderQuotaWindow,
  UsageShare,
} from './types';

interface TokscaleEntry {
  client?: string;
  model?: string;
  provider?: string;
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
  messageCount?: number;
  cost?: number;
}

interface TokscaleDailyReport {
  groupBy?: string;
  entries?: TokscaleEntry[];
  totalInput?: number;
  totalOutput?: number;
  totalCacheRead?: number;
  totalCacheWrite?: number;
  totalMessages?: number;
  totalCost?: number;
}

interface TokscaleQuotaMetric {
  label?: string;
  used_percent?: number;
  resets_at?: string | null;
}

interface TokscaleQuotaProvider {
  provider?: string;
  plan?: string | null;
  email?: string;
  metrics?: TokscaleQuotaMetric[];
}

type CommandRunner = (args: string[], timeoutMs: number) => Promise<string>;

const EMPTY_TOTALS: ConsolidatedUsageSnapshot['totals'] = {
  freshInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
  freshProcessedTokens: 0,
  totalProcessedTokens: 0,
  cacheReadPercent: 0,
  freshInputPercent: 0,
  outputPercent: 0,
  cacheWritePercent: 0,
  messages: 0,
};

function finite(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function cleanLabel(value: unknown, fallback: string): string {
  const label = String(value || fallback).trim();
  return label.slice(0, 80);
}

function aggregateShares(
  entries: TokscaleEntry[],
  keyFor: (entry: TokscaleEntry) => string,
  labelFor: (entry: TokscaleEntry) => string,
  totalProcessedTokens: number,
): UsageShare[] {
  const groups = new Map<string, UsageShare>();

  for (const entry of entries) {
    const id = cleanLabel(keyFor(entry), 'unknown');
    const input = finite(entry.input);
    const output = finite(entry.output);
    const cacheRead = finite(entry.cacheRead);
    const cacheWrite = finite(entry.cacheWrite);
    const processed = input + output + cacheRead + cacheWrite;
    const existing = groups.get(id) || {
      id,
      label: cleanLabel(labelFor(entry), id),
      provider: entry.provider ? cleanLabel(entry.provider, '') : undefined,
      totalProcessedTokens: 0,
      freshInputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      messageCount: 0,
      apiEquivalentCostUSD: 0,
      percent: 0,
    };

    existing.totalProcessedTokens += processed;
    existing.freshInputTokens += input;
    existing.outputTokens += output;
    existing.cacheReadTokens += cacheRead;
    existing.cacheWriteTokens += cacheWrite;
    existing.reasoningTokens += finite(entry.reasoning);
    existing.messageCount += finite(entry.messageCount);
    existing.apiEquivalentCostUSD += finite(entry.cost);
    groups.set(id, existing);
  }

  return Array.from(groups.values())
    .map(group => ({
      ...group,
      apiEquivalentCostUSD: Number(group.apiEquivalentCostUSD.toFixed(4)),
      percent: percent(group.totalProcessedTokens, totalProcessedTokens),
    }))
    .sort((a, b) => b.totalProcessedTokens - a.totalProcessedTokens);
}

export function normalizeTokscaleDailyReport(
  report: TokscaleDailyReport,
  observedAt = new Date(),
): Pick<ConsolidatedUsageSnapshot, 'windowLabel' | 'timezone' | 'observedAt' | 'totals' | 'cost' | 'byHarness' | 'byModel' | 'coverage'> {
  const entries = Array.isArray(report?.entries) ? report.entries : [];
  const freshInputTokens = finite(report?.totalInput);
  const outputTokens = finite(report?.totalOutput);
  const cacheReadTokens = finite(report?.totalCacheRead);
  const cacheWriteTokens = finite(report?.totalCacheWrite);
  const reasoningTokens = entries.reduce((sum, entry) => sum + finite(entry.reasoning), 0);
  const totalProcessedTokens = freshInputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
  const freshProcessedTokens = freshInputTokens + outputTokens + cacheWriteTokens;
  const byHarness = aggregateShares(
    entries,
    entry => cleanLabel(entry.client, 'unknown'),
    entry => cleanLabel(entry.client, 'Unknown harness'),
    totalProcessedTokens,
  );
  const byModel = aggregateShares(
    entries,
    entry => `${cleanLabel(entry.provider, 'unknown')}:${cleanLabel(entry.model, 'unknown')}`,
    entry => cleanLabel(entry.model, 'Unknown model'),
    totalProcessedTokens,
  );

  return {
    windowLabel: 'Today',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
    observedAt: observedAt.toISOString(),
    totals: {
      freshInputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      reasoningTokens,
      freshProcessedTokens,
      totalProcessedTokens,
      cacheReadPercent: percent(cacheReadTokens, totalProcessedTokens),
      freshInputPercent: percent(freshInputTokens, totalProcessedTokens),
      outputPercent: percent(outputTokens, totalProcessedTokens),
      cacheWritePercent: percent(cacheWriteTokens, totalProcessedTokens),
      messages: finite(report?.totalMessages),
    },
    cost: {
      apiEquivalentUSD: Number(finite(report?.totalCost).toFixed(4)),
      actualBilledUSD: null,
      basisLabel: 'Metered-equivalent estimate from local usage logs',
    },
    byHarness,
    byModel,
    coverage: {
      measuredHarnesses: byHarness.map(item => item.id),
      note: 'Local log telemetry. Subscription and bundled-plan charges may differ from API-equivalent pricing.',
    },
  };
}

export function normalizeTokscaleQuotaReport(report: TokscaleQuotaProvider[]): ProviderQuotaWindow[] {
  if (!Array.isArray(report)) return [];

  const quotas: ProviderQuotaWindow[] = [];
  for (const provider of report) {
    const providerName = cleanLabel(provider?.provider, 'Unknown provider');
    const plan = provider?.plan ? cleanLabel(provider.plan, '') : undefined;
    for (const metric of Array.isArray(provider?.metrics) ? provider.metrics : []) {
      const usedPercent = Math.min(100, Math.max(0, finite(metric?.used_percent)));
      quotas.push({
        provider: providerName,
        plan,
        label: cleanLabel(metric?.label, 'Usage window'),
        usedPercent,
        remainingPercent: Number((100 - usedPercent).toFixed(1)),
        resetsAt: metric?.resets_at ? String(metric.resets_at) : undefined,
        status: usedPercent >= 90 ? 'critical' : usedPercent >= 70 ? 'watch' : 'healthy',
      });
    }
  }

  return quotas.sort((a, b) => b.usedPercent - a.usedPercent);
}

function resolveTokscaleCommand(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const command = path.join(appData, 'npm', 'tokscale.cmd');
    if (fs.existsSync(command)) return command;
  }
  return 'tokscale';
}

const defaultCommandRunner: CommandRunner = (args, timeoutMs) => new Promise((resolve, reject) => {
  const child = spawn(resolveTokscaleCommand(), args, {
    shell: process.platform === 'win32',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let settled = false;
  const timeout = setTimeout(() => {
    if (!settled) child.kill();
  }, timeoutMs);

  child.stdout.on('data', chunk => {
    if (stdout.length < 8_000_000) stdout += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    if (stderr.length < 8_000) stderr += chunk.toString();
  });
  child.on('error', error => {
    settled = true;
    clearTimeout(timeout);
    reject(error);
  });
  child.on('close', code => {
    settled = true;
    clearTimeout(timeout);
    if (code === 0) resolve(stdout);
    else reject(new Error(`Tokscale exited with code ${code}: ${stderr.trim().slice(0, 240)}`));
  });
});

export class UsageIntelligence {
  private snapshot: ConsolidatedUsageSnapshot;
  private dailyUpdatedAt = 0;
  private quotaUpdatedAt = 0;
  private dailyInFlight: Promise<void> | null = null;
  private quotaInFlight: Promise<void> | null = null;

  constructor(
    private runCommand: CommandRunner = defaultCommandRunner,
    private autoRefresh = true,
  ) {
    this.snapshot = {
      status: 'loading',
      source: 'tokscale',
      sourceLabel: 'Tokscale · local harness logs',
      windowLabel: 'Today',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
      totals: { ...EMPTY_TOTALS },
      cost: {
        apiEquivalentUSD: 0,
        actualBilledUSD: null,
        basisLabel: 'Metered-equivalent estimate from local usage logs',
      },
      byHarness: [],
      byModel: [],
      quotas: [],
      coverage: {
        measuredHarnesses: [],
        note: 'Waiting for local usage telemetry.',
      },
    };
  }

  public start(): void {
    if (!this.autoRefresh) return;
    // Quotas are fast and immediately useful. Run the heavier local-log scan
    // after them so startup never fans out multiple Tokscale processes.
    this.dailyUpdatedAt = Date.now();
    void this.refreshQuota().finally(() => this.refreshDaily());
  }

  public getSnapshot(): ConsolidatedUsageSnapshot {
    const now = Date.now();
    if (this.autoRefresh && !this.dailyInFlight && now - this.dailyUpdatedAt > 5 * 60_000) void this.refreshDaily();
    if (this.autoRefresh && !this.quotaInFlight && now - this.quotaUpdatedAt > 60_000) void this.refreshQuota();
    return {
      ...this.snapshot,
      totals: { ...this.snapshot.totals },
      cost: { ...this.snapshot.cost },
      byHarness: this.snapshot.byHarness.map(item => ({ ...item })),
      byModel: this.snapshot.byModel.map(item => ({ ...item })),
      quotas: this.snapshot.quotas.map(item => ({ ...item })),
      coverage: {
        ...this.snapshot.coverage,
        measuredHarnesses: [...this.snapshot.coverage.measuredHarnesses],
      },
    };
  }

  private refreshDaily(): Promise<void> {
    if (this.dailyInFlight) return this.dailyInFlight;
    this.dailyInFlight = (async () => {
      try {
        const raw = await this.runCommand(['--today', '--json', '--no-spinner'], 120_000);
        const normalized = normalizeTokscaleDailyReport(JSON.parse(raw));
        this.dailyUpdatedAt = Date.now();
        this.snapshot = {
          ...this.snapshot,
          ...normalized,
          status: 'ready',
          error: undefined,
        };
      } catch (error: any) {
        this.dailyUpdatedAt = Date.now();
        this.snapshot = {
          ...this.snapshot,
          status: this.snapshot.observedAt ? 'stale' : 'unavailable',
          error: error?.message || 'Tokscale daily usage unavailable',
        };
      } finally {
        this.dailyInFlight = null;
      }
    })();
    return this.dailyInFlight;
  }

  private refreshQuota(): Promise<void> {
    if (this.quotaInFlight) return this.quotaInFlight;
    this.quotaInFlight = (async () => {
      try {
        const raw = await this.runCommand(['usage', '--json'], 30_000);
        const quotas = normalizeTokscaleQuotaReport(JSON.parse(raw));
        this.quotaUpdatedAt = Date.now();
        this.snapshot = {
          ...this.snapshot,
          quotas,
          quotaObservedAt: new Date().toISOString(),
        };
      } catch {
        this.quotaUpdatedAt = Date.now();
        // Quota telemetry is additive. Preserve a valid daily snapshot if this provider call is unavailable.
      } finally {
        this.quotaInFlight = null;
      }
    })();
    return this.quotaInFlight;
  }
}
