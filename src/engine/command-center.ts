import http from 'http';
import { CommandCenterSnapshot, CommandCenterSurface } from './types';

const COMMAND_CENTER_ORIGIN = 'http://127.0.0.1:4321';
const DEFAULT_CACHE_TTL_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 1_200;

const SURFACES: CommandCenterSurface[] = [
  { id: 'operations', label: 'Operations', note: 'live agents', url: `${COMMAND_CENTER_ORIGIN}/` },
  { id: 'studio', label: 'Studio', note: 'teams · market', url: `${COMMAND_CENTER_ORIGIN}/studio` },
  { id: 'architecture', label: 'Architecture', note: 'graph · recs', url: `${COMMAND_CENTER_ORIGIN}/architecture` },
  { id: 'ops', label: 'Ops', note: 'queue · guard', url: `${COMMAND_CENTER_ORIGIN}/ops` },
  { id: 'fleet', label: 'Fleet', note: 'system · git', url: `${COMMAND_CENTER_ORIGIN}/fleet` },
];

export interface CommandCenterProbeResult {
  online: boolean;
  latencyMs: number | null;
}

export type CommandCenterProbe = (url: string, timeoutMs: number) => Promise<CommandCenterProbeResult>;

function defaultProbe(url: string, timeoutMs: number): Promise<CommandCenterProbeResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let settled = false;
    let deadline: NodeJS.Timeout | undefined;
    const finish = (result: CommandCenterProbeResult) => {
      if (settled) return;
      settled = true;
      if (deadline) clearTimeout(deadline);
      resolve(result);
    };
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      response.resume();
      const statusCode = response.statusCode || 0;
      finish({
        online: statusCode >= 200 && statusCode < 400,
        latencyMs: Date.now() - startedAt,
      });
    });

    deadline = setTimeout(() => {
      request.destroy();
      finish({ online: false, latencyMs: null });
    }, timeoutMs);
    request.on('timeout', () => request.destroy());
    request.on('error', () => finish({ online: false, latencyMs: null }));
  });
}

/**
 * Small read-only seam to the existing Starlight Command Center.
 * The origin and surfaces are fixed so this cannot become an arbitrary HTTP proxy.
 */
export class CommandCenterBridge {
  private cached: CommandCenterSnapshot | null = null;
  private cachedAt = 0;
  private inFlight: Promise<CommandCenterSnapshot> | null = null;

  constructor(
    private readonly probe: CommandCenterProbe = defaultProbe,
    private readonly cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  public async getSnapshot(force = false): Promise<CommandCenterSnapshot> {
    const now = this.now();
    if (!force && this.cached && now - this.cachedAt < this.cacheTtlMs) {
      return this.cached;
    }
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.collect().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async collect(): Promise<CommandCenterSnapshot> {
    const result = await this.probe(`${COMMAND_CENTER_ORIGIN}/`, DEFAULT_TIMEOUT_MS);
    const checkedAt = new Date(this.now()).toISOString();
    const snapshot: CommandCenterSnapshot = {
      status: result.online ? 'online' : 'offline',
      label: 'Starlight Command Center',
      url: `${COMMAND_CENTER_ORIGIN}/`,
      latencyMs: result.latencyMs,
      checkedAt,
      surfaces: SURFACES.map((surface) => ({ ...surface })),
    };

    this.cached = snapshot;
    this.cachedAt = this.now();
    return snapshot;
  }
}
