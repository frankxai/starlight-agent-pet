import { FleetAggregator } from '../engine/aggregator';
import { FileSystemWatcher } from '../engine/watcher';
import { TelemetryServer } from '../engine/server';
import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function runCli(args: string[]) {
  const command = args[0] || 'status';
  const aggregator = new FleetAggregator();

  switch (command) {
    case 'status': {
      console.log('\n\x1b[1m\x1b[36m✦ STARLIGHT AGENT PET & FLEET OBSERVATORY ✦\x1b[0m');
      console.log('\x1b[2mScanning coding agent harnesses (Claude, Codex, Antigravity, Hermes, Grok)...\x1b[0m\n');
      
      const state = await aggregator.getFleetState();
      printTerminalDashboard(state);
      break;
    }

    case 'hud':
    case 'open': {
      console.log('\x1b[1m\x1b[32m[+] Launching Starlight Agent Pet & HUD...\x1b[0m');
      const watcher = new FileSystemWatcher(aggregator);
      watcher.start();
      const server = new TelemetryServer(aggregator);
      const port = await server.start();
      const url = `http://localhost:${port}`;
      
      console.log(`[+] Observatory available at: ${url}`);
      openBrowser(url);
      break;
    }

    case 'daemon': {
      console.log('\x1b[1m\x1b[35m[+] Starting Starlight Fleet Telemetry Daemon...\x1b[0m');
      const watcher = new FileSystemWatcher(aggregator);
      watcher.start();
      const server = new TelemetryServer(aggregator);
      await server.start();
      console.log('[+] Telemetry daemon running in background.');
      break;
    }

    case 'report': {
      const state = await aggregator.getFleetState();
      const format = args[1] === '--json' ? 'json' : 'markdown';
      if (format === 'json') {
        console.log(JSON.stringify(state, null, 2));
      } else {
        printMarkdownReport(state);
      }
      break;
    }

    case 'hooks': {
      const sub = args[1];
      if (sub === 'install') {
        installClaudeHook();
      } else {
        console.log('Usage: starlight-pet hooks install');
      }
      break;
    }

    case 'help':
    default: {
      console.log(`
\x1b[1mSTARLIGHT AGENT PET & FLEET TELEMETRY CLI\x1b[0m

Commands:
  \x1b[36mstarlight-pet status\x1b[0m         View live fleet status and pet mood in terminal
  \x1b[36mstarlight-pet hud\x1b[0m            Launch interactive floating pet and full Observatory HUD
  \x1b[36mstarlight-pet daemon\x1b[0m         Run background telemetry bridge server (port 9224)
  \x1b[36mstarlight-pet report\x1b[0m         Generate Markdown usage and cost breakdown
  \x1b[36mstarlight-pet report --json\x1b[0m  Output raw JSON telemetry
  \x1b[36mstarlight-pet hooks install\x1b[0m  Install drop-in lifecycle hooks into Claude Code
      `);
      break;
    }
  }
}

function printTerminalDashboard(state: any) {
  const { pet, historicalSummary, activeSessions, overallState, currentFleetVelocity } = state;
  const today = historicalSummary.today;

  // Pet ASCII Art
  const petArt = `
      /\\_/\\    \x1b[1m\x1b[33m✦ ${pet.skin.toUpperCase()} [Level ${pet.level}]\x1b[0m
     ( o.o )   \x1b[35m${pet.arcaneaGate}\x1b[0m
      > ^ <    \x1b[32mXP: [${'█'.repeat(Math.floor(pet.currentXP / 100))}${'░'.repeat(10 - Math.floor(pet.currentXP / 100))}] ${pet.currentXP}/${pet.nextLevelXP}\x1b[0m
               \x1b[36mMood: "${pet.currentMood}"\x1b[0m
  `;
  console.log(petArt);

  console.log('─'.repeat(70));
  console.log(`\x1b[1mFLEET STATE:\x1b[0m ${formatStateBadge(overallState)}  │  \x1b[1mBURN VELOCITY:\x1b[0m \x1b[33m${currentFleetVelocity} tok/s\x1b[0m  │  \x1b[1mACTIVE SESSIONS:\x1b[0m ${activeSessions.length}`);
  console.log(`\x1b[1mTODAY TOKENS:\x1b[0m \x1b[36m${today.totalTokens.toLocaleString()}\x1b[0m  │  \x1b[1mESTIMATED COST:\x1b[0m \x1b[32m$${today.totalCostUSD.toFixed(4)}\x1b[0m`);
  console.log('─'.repeat(70));

  console.log('\n\x1b[1mACTIVE & RECENT AGENT SESSIONS:\x1b[0m');
  if (activeSessions.length === 0) {
    console.log('  (No active sessions detected)');
  } else {
    console.log(
      rPad('HARNESS', 12) +
      rPad('PROJECT', 24) +
      rPad('MODEL', 20) +
      rPad('TOKENS', 12) +
      rPad('COST', 10) +
      'STATE'
    );
    console.log('─'.repeat(88));

    for (const s of activeSessions.slice(0, 8)) {
      console.log(
        rPad(`[${s.harness.toUpperCase()}]`, 12) +
        rPad(truncate(s.projectName, 22), 24) +
        rPad(truncate(s.modelDisplayName || s.model, 18), 20) +
        rPad(s.tokens.totalTokens.toLocaleString(), 12) +
        rPad(`$${s.cost.totalCostUSD.toFixed(3)}`, 10) +
        formatStateBadge(s.state)
      );
    }
  }

  console.log('\n\x1b[2mRun "starlight-pet hud" to open the interactive floating pet dashboard.\x1b[0m\n');
}

function printMarkdownReport(state: any) {
  const { today } = state.historicalSummary;
  console.log(`# Starlight Agent Fleet Telemetry Report — ${today.date}`);
  console.log(`\n**Total Tokens:** ${today.totalTokens.toLocaleString()}  `);
  console.log(`**Total Cost:** $${today.totalCostUSD.toFixed(4)}  `);
  console.log(`**Active Sessions:** ${today.sessionsCount}  `);
  console.log(`**Pet Level:** Level ${state.pet.level} (${state.pet.arcaneaGate})  \n`);

  console.log(`### Breakdown by Harness`);
  console.log(`| Harness | Tokens | Cost (USD) |`);
  console.log(`|---|---|---|`);
  for (const [h, tok] of Object.entries(today.tokensByHarness)) {
    const tokenCount = Number(tok) || 0;
    if (tokenCount > 0) {
      console.log(`| ${h} | ${tokenCount.toLocaleString()} | $${today.costByHarness[h]?.toFixed(4) || '0.0000'} |`);
    }
  }

  console.log(`\n### Breakdown by Model`);
  console.log(`| Model | Tokens | Cost (USD) |`);
  console.log(`|---|---|---|`);
  for (const [m, tok] of Object.entries(today.tokensByModel)) {
    const tokenCount = Number(tok) || 0;
    if (tokenCount > 0) {
      console.log(`| ${m} | ${tokenCount.toLocaleString()} | $${today.costByModel[m]?.toFixed(4) || '0.0000'} |`);
    }
  }
}

function installClaudeHook() {
  const claudeDir = path.join(os.homedir(), '.claude');
  const hooksDir = path.join(claudeDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const hookScript = `#!/usr/bin/env node
// Starlight Fleet Pet Auto-Hook
const http = require('http');
let input = '';
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const payload = JSON.stringify({
      harness: 'claude',
      event: 'status_update',
      sessionId: data.session_id || 'claude-session',
      model: data.model?.display_name,
      workspace: data.workspace?.current_dir,
      contextRemainingPct: data.context_window?.remaining_percentage
    });
    const req = http.request({
      hostname: 'localhost',
      port: 9224,
      path: '/api/hook',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    });
    req.on('error', () => {}); // silent
    req.write(payload);
    req.end();
  } catch {}
});
`;

  const dest = path.join(hooksDir, 'starlight-pet-hook.js');
  fs.writeFileSync(dest, hookScript, { mode: 0o755 });
  console.log(`\x1b[32m[✓] Starlight Pet hook installed to: ${dest}\x1b[0m`);
}

function formatStateBadge(state: string): string {
  switch (state) {
    case 'coding': return '\x1b[32m● CODING\x1b[0m';
    case 'thinking': return '\x1b[34m◈ THINKING\x1b[0m';
    case 'approval_required': return '\x1b[33m▲ APPROVAL\x1b[0m';
    case 'low_context_alert': return '\x1b[31m⚠ LOW CONTEXT\x1b[0m';
    case 'swarming': return '\x1b[35m❖ SWARMING\x1b[0m';
    case 'sleeping': return '\x1b[2mzzz SLEEPING\x1b[0m';
    default: return '\x1b[36m○ IDLE\x1b[0m';
  }
}

function rPad(str: string, len: number): string {
  return str.padEnd(len, ' ');
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function openBrowser(url: string) {
  const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${start} ${url}`);
}
