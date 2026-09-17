import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export interface LocalServerInfo {
  port: number;
  pid: number;
  processName: string;
  ramMB: number;
  serviceName: string;
  url: string;
  isStarlight: boolean;
}

export const KNOWN_SERVICES: Record<number, { name: string; isStarlight: boolean }> = {
  1234: { name: 'LM Studio / Local Inference', isStarlight: false },
  3000: { name: 'FrankX.AI / Next.js Web', isStarlight: true },
  3007: { name: 'Starlight Preview (SDS)', isStarlight: true },
  3333: { name: 'Agent Dev Service', isStarlight: true },
  4321: { name: 'Starlight Command Center', isStarlight: true },
  5173: { name: 'Arcanea Studio / Vite', isStarlight: true },
  7317: { name: 'Agent RPC Bus', isStarlight: true },
  9222: { name: 'Chrome CDP Browser Hub', isStarlight: true },
  9224: { name: 'Starlight Fleet Telemetry Daemon', isStarlight: true },
  9225: { name: 'Starlight Fleet Telemetry (Alt)', isStarlight: true },
};

/**
 * Scans active listening TCP ports on localhost and inspects process memory.
 */
export async function listActiveLocalServers(): Promise<LocalServerInfo[]> {
  const isWindows = process.platform === 'win32';
  if (!isWindows) {
    return [];
  }

  try {
    const psCommand = `powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -in '127.0.0.1', '0.0.0.0' -and $_.LocalPort -gt 1024 -and $_.LocalPort -lt 10000 } | Select-Object -Property LocalPort, OwningProcess | ConvertTo-Json"`;
    const { stdout } = await execAsync(psCommand, { timeout: 6000 });
    const trimmed = stdout.trim();
    if (!trimmed) return [];

    let rawList: any[] = [];
    try {
      const parsed = JSON.parse(trimmed);
      rawList = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }

    // Deduplicate by port
    const portMap = new Map<number, number>();
    for (const item of rawList) {
      if (item.LocalPort && item.OwningProcess) {
        portMap.set(Number(item.LocalPort), Number(item.OwningProcess));
      }
    }

    if (portMap.size === 0) return [];

    // Query process details in bulk
    const pids = Array.from(new Set(portMap.values())).join(',');
    let procMap = new Map<number, { name: string; ramMB: number }>();
    try {
      const procCommand = `powershell -NoProfile -Command "Get-Process -Id ${pids} -ErrorAction SilentlyContinue | Select-Object -Property Id, ProcessName, @{Name='RamMB';Expression={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json"`;
      const { stdout: procOut } = await execAsync(procCommand, { timeout: 6000 });
      const pTrimmed = procOut.trim();
      if (pTrimmed) {
        const pParsed = JSON.parse(pTrimmed);
        const pList = Array.isArray(pParsed) ? pParsed : [pParsed];
        for (const p of pList) {
          if (p.Id) {
            procMap.set(Number(p.Id), { name: String(p.ProcessName || 'unknown'), ramMB: Number(p.RamMB || 0) });
          }
        }
      }
    } catch {
      // Process query failure is non-fatal
    }

    const results: LocalServerInfo[] = [];
    for (const [port, pid] of portMap.entries()) {
      const proc = procMap.get(pid) || { name: 'process', ramMB: 0 };
      const known = KNOWN_SERVICES[port] || { name: `Custom Service (:${port})`, isStarlight: false };
      results.push({
        port,
        pid,
        processName: proc.name,
        ramMB: proc.ramMB,
        serviceName: known.name,
        url: `http://localhost:${port}`,
        isStarlight: known.isStarlight,
      });
    }

    return results.sort((a, b) => a.port - b.port);
  } catch {
    return [];
  }
}

/**
 * Stop a process by port number.
 */
export async function stopServerByPort(port: number): Promise<{ success: boolean; pid?: number; error?: string }> {
  try {
    const servers = await listActiveLocalServers();
    const target = servers.find(s => s.port === port);
    if (!target) {
      return { success: false, error: `No process found listening on port ${port}` };
    }

    if (process.platform === 'win32') {
      await execAsync(`powershell -NoProfile -Command "Stop-Process -Id ${target.pid} -Force -ErrorAction SilentlyContinue"`);
    } else {
      process.kill(target.pid, 'SIGTERM');
    }

    return { success: true, pid: target.pid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Reaps idle development servers using SDS if available.
 */
export async function reapIdleServers(): Promise<string> {
  try {
    const { stdout } = await execAsync('sds reap', { timeout: 8000 });
    return stdout.trim() || 'SDS reap completed successfully.';
  } catch {
    return 'SDS command not available or no idle servers were reaped.';
  }
}
