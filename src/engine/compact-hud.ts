import { CommandCenterBridge } from './command-center';
import {
  CompactHudSnapshot,
  CompactProviderMetric,
  ConsolidatedUsageSnapshot,
  ProviderQuotaWindow,
  UsageShare,
} from './types';

interface UsageSnapshotSource {
  getSnapshot(): ConsolidatedUsageSnapshot;
}

interface ProviderDefinition {
  id: CompactProviderMetric['id'];
  label: string;
  shortLabel: string;
  quotaProvider?: string;
  usageMatcher: (share: UsageShare) => boolean;
  usageSource: 'harness' | 'model';
}

const KEY_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'codex',
    label: 'Codex',
    shortLabel: 'Codex',
    quotaProvider: 'Codex',
    usageSource: 'harness',
    usageMatcher: (share) => share.id.toLowerCase() === 'codex',
  },
  {
    id: 'claude',
    label: 'Claude',
    shortLabel: 'Claude',
    quotaProvider: 'Claude',
    usageSource: 'harness',
    usageMatcher: (share) => share.id.toLowerCase() === 'claude',
  },
  {
    id: 'grok',
    label: 'Grok',
    shortLabel: 'Grok',
    usageSource: 'model',
    usageMatcher: (share) => {
      const identity = `${share.id} ${share.provider || ''}`.toLowerCase();
      return identity.includes('grok') || identity.includes('xai');
    },
  },
  {
    id: 'antigravity',
    label: 'Antigravity',
    shortLabel: 'AntiG',
    usageSource: 'harness',
    usageMatcher: (share) => share.id.toLowerCase().includes('antigravity'),
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    shortLabel: 'Open',
    usageSource: 'model',
    usageMatcher: (share) => {
      const identity = `${share.id} ${share.provider || ''}`.toLowerCase();
      return identity.includes('opencode');
    },
  },
];

function roundPercent(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

function selectQuota(quotas: ProviderQuotaWindow[], provider: string): ProviderQuotaWindow | undefined {
  return quotas
    .filter((quota) => quota.provider.toLowerCase() === provider.toLowerCase())
    .sort((a, b) => b.usedPercent - a.usedPercent)[0];
}

function activityPercent(
  definition: ProviderDefinition,
  usage: ConsolidatedUsageSnapshot,
): number {
  const shares = definition.usageSource === 'harness' ? usage.byHarness : usage.byModel;
  const processed = shares
    .filter(definition.usageMatcher)
    .reduce((total, share) => total + share.totalProcessedTokens, 0);
  if (usage.totals.totalProcessedTokens <= 0) return 0;
  return roundPercent((processed / usage.totals.totalProcessedTokens) * 100);
}

export function buildKeyProviderMetrics(
  usage: ConsolidatedUsageSnapshot,
): CompactProviderMetric[] {
  return KEY_PROVIDERS.map((definition) => {
    const quota = definition.quotaProvider
      ? selectQuota(usage.quotas, definition.quotaProvider)
      : undefined;
    if (quota) {
      return {
        id: definition.id,
        label: definition.label,
        shortLabel: definition.shortLabel,
        percent: roundPercent(quota.usedPercent),
        basis: 'quota',
        basisLabel: 'Subscription limit used',
        detail: `${quota.label}${quota.plan ? ` · ${quota.plan}` : ''}`,
        resetsAt: quota.resetsAt,
        status: quota.status,
      };
    }

    if (usage.status !== 'ready' && usage.status !== 'stale') {
      return {
        id: definition.id,
        label: definition.label,
        shortLabel: definition.shortLabel,
        percent: null,
        basis: 'unavailable',
        basisLabel: 'Unavailable',
        detail: 'Waiting for measured local telemetry',
        status: 'unavailable',
      };
    }

    const percent = activityPercent(definition, usage);
    return {
      id: definition.id,
      label: definition.label,
      shortLabel: definition.shortLabel,
      percent,
      basis: 'activity_share',
      basisLabel: "Today's processed-token share",
      detail: 'No authenticated quota feed available',
      status: 'neutral',
    };
  });
}

/** A compact projection for the always-available HUD; callers learn one interface. */
export class CompactHudService {
  constructor(
    private readonly usage: UsageSnapshotSource,
    private readonly commandCenter: CommandCenterBridge = new CommandCenterBridge(),
  ) {}

  public async getSnapshot(): Promise<CompactHudSnapshot> {
    const usage = this.usage.getSnapshot();
    return {
      status: usage.status,
      observedAt: usage.observedAt,
      keyProviders: buildKeyProviderMetrics(usage),
      allModels: usage.byModel.filter((model) => model.totalProcessedTokens > 0),
      allQuotas: usage.quotas,
      commandCenter: await this.commandCenter.getSnapshot(),
    };
  }
}
