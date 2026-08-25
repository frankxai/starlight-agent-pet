import { FleetAggregator } from './engine/aggregator';
import { FileSystemWatcher } from './engine/watcher';
import { TelemetryServer } from './engine/server';
import { runCli } from './cli';

export * from './engine/types';
export * from './engine/pricing';
export * from './engine/aggregator';
export * from './engine/watcher';
export * from './engine/server';

// If executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  runCli(args);
}
