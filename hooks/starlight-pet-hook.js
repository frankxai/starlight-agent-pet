#!/usr/bin/env node
/**
 * Starlight Fleet Observatory Hook
 * Pushes live agent context, active tool executions, and tokens directly to the Starlight Pet daemon.
 */

const http = require('http');
const path = require('path');
const os = require('os');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const session = data.session_id || 'claude-session';
    const model = data.model?.display_name || data.model?.id || 'Claude';
    const workspace = data.workspace?.current_dir || process.cwd();
    const remaining = data.context_window?.remaining_percentage;

    const payload = JSON.stringify({
      harness: 'claude',
      event: 'status_update',
      sessionId: session,
      model,
      workspace,
      contextRemainingPct: remaining,
      timestamp: Date.now()
    });

    const req = http.request({
      hostname: 'localhost',
      port: 9224,
      path: '/api/hook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 1000
    });

    req.on('error', () => {
      // Daemon may not be running yet, silent fail
      process.exit(0);
    });

    req.write(payload);
    req.end(() => {
      process.exit(0);
    });
  } catch (e) {
    process.exit(0);
  }
});
