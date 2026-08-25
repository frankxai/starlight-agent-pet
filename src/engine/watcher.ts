import fs from 'fs';
import path from 'path';
import os from 'os';
import { FleetAggregator } from './aggregator';

export class FileSystemWatcher {
  private aggregator: FleetAggregator;
  private watchInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(aggregator: FleetAggregator) {
    this.aggregator = aggregator;
  }

  public start(pollIntervalMs = 2000) {
    if (this.watchInterval) return;

    const home = os.homedir();
    const claudeDir = path.join(home, '.claude', 'projects');
    const brainDir = path.join(home, '.gemini', 'antigravity', 'brain');
    const codexDir = path.join(home, '.codex');

    // Run initial parse
    this.poll();

    // Set up polling interval to ensure reliable cross-platform updates
    this.watchInterval = setInterval(() => {
      this.poll();
    }, pollIntervalMs);

    // Watch key dirs if available
    try {
      if (fs.existsSync(claudeDir)) {
        fs.watch(claudeDir, { recursive: true }, () => this.debouncedPoll());
      }
      if (fs.existsSync(brainDir)) {
        fs.watch(brainDir, { recursive: true }, () => this.debouncedPoll());
      }
      if (fs.existsSync(codexDir)) {
        fs.watch(codexDir, () => this.debouncedPoll());
      }
    } catch {
      // Fall back safely to interval polling
    }
  }

  public stop() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  private debounceTimer: NodeJS.Timeout | null = null;
  private debouncedPoll() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.poll();
    }, 500);
  }

  private async poll() {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      await this.aggregator.getFleetState();
    } catch {
      // ignore
    } finally {
      this.isPolling = false;
    }
  }
}
