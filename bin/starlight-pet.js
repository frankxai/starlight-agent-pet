#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

// Check if TypeScript build exists in dist, otherwise use ts-node or dist
const distCli = path.join(__dirname, '..', 'dist', 'cli', 'index.js');
const srcCli = path.join(__dirname, '..', 'src', 'cli', 'index.ts');

if (fs.existsSync(distCli)) {
  const { runCli } = require(distCli);
  runCli(process.argv.slice(2));
} else {
  try {
    require('ts-node/register');
    const { runCli } = require(srcCli);
    runCli(process.argv.slice(2));
  } catch (err) {
    console.error('Build required. Running compilation...');
    const { execSync } = require('child_process');
    execSync('npx tsc', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    const { runCli } = require(distCli);
    runCli(process.argv.slice(2));
  }
}
