import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

export interface AnalyticsRecord {
  date: string;
  harness: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUSD: number;
  sessionsCount: number;
  machineTag: string;
}

export class HistoricalAnalytics {
  private historyFilePath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.historyFilePath = customPath;
    } else {
      const telemetryDir = path.join(os.homedir(), '.starlight', 'telemetry');
      if (!fs.existsSync(telemetryDir)) {
        fs.mkdirSync(telemetryDir, { recursive: true });
      }
      this.historyFilePath = path.join(telemetryDir, 'history.ndjson');
    }
  }

  public appendDailySummary(summary: AnalyticsRecord): void {
    const line = JSON.stringify(summary) + '\n';
    fs.appendFileSync(this.historyFilePath, line, 'utf-8');
  }

  private async readAllRecords(): Promise<AnalyticsRecord[]> {
    if (!fs.existsSync(this.historyFilePath)) {
      return [];
    }

    const records: AnalyticsRecord[] = [];
    const fileStream = fs.createReadStream(this.historyFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          records.push(JSON.parse(line));
        } catch (e) {
          // ignore parsing errors for a line
        }
      }
    }
    return records;
  }

  private filterByDays(records: AnalyticsRecord[], days: number): AnalyticsRecord[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    return records.filter(r => r.date >= cutoffStr);
  }

  public async getDailyTrend(days: number) {
    const records = await this.readAllRecords();
    const filtered = this.filterByDays(records, days);

    const trend: Record<string, any> = {};
    for (const r of filtered) {
      if (!trend[r.date]) {
        trend[r.date] = {
          date: r.date,
          totalTokens: 0,
          costUSD: 0,
          sessionsCount: 0
        };
      }
      trend[r.date].totalTokens += r.totalTokens;
      trend[r.date].costUSD += r.costUSD;
      trend[r.date].sessionsCount += r.sessionsCount;
    }

    return Object.values(trend).sort((a, b) => a.date.localeCompare(b.date));
  }

  public async getModelBreakdown(days: number) {
    const records = await this.readAllRecords();
    const filtered = this.filterByDays(records, days);

    const breakdown: Record<string, any> = {};
    for (const r of filtered) {
      if (!breakdown[r.model]) {
        breakdown[r.model] = {
          model: r.model,
          totalTokens: 0,
          costUSD: 0
        };
      }
      breakdown[r.model].totalTokens += r.totalTokens;
      breakdown[r.model].costUSD += r.costUSD;
    }
    return breakdown;
  }

  public async getHarnessBreakdown(days: number) {
    const records = await this.readAllRecords();
    const filtered = this.filterByDays(records, days);

    const breakdown: Record<string, any> = {};
    for (const r of filtered) {
      if (!breakdown[r.harness]) {
        breakdown[r.harness] = {
          harness: r.harness,
          totalTokens: 0,
          costUSD: 0
        };
      }
      breakdown[r.harness].totalTokens += r.totalTokens;
      breakdown[r.harness].costUSD += r.costUSD;
    }
    return breakdown;
  }

  public async getTotalAllTime() {
    const records = await this.readAllRecords();
    let totalTokens = 0;
    let totalCostUSD = 0;
    let sessionsCount = 0;
    for (const r of records) {
      totalTokens += r.totalTokens;
      totalCostUSD += r.costUSD;
      sessionsCount += r.sessionsCount;
    }
    return {
      totalTokens,
      totalCostUSD,
      sessionsCount
    };
  }

  public getHistoryFilePath() {
    return this.historyFilePath;
  }
}
