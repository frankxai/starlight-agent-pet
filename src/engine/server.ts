import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { FleetAggregator } from './aggregator';
import { HookEventPayload, PetSkinId } from './types';
import { InferenceRouter, RoutingContext } from './router';

export class TelemetryServer {
  private aggregator: FleetAggregator;
  private router: InferenceRouter;
  private port: number;
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private publicDir: string;

  constructor(aggregator: FleetAggregator, port = 9224) {
    this.aggregator = aggregator;
    this.router = new InferenceRouter();
    this.port = port;
    this.publicDir = path.resolve(__dirname, '..', '..', 'public');
  }

  public start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on('connection', async (ws) => {
        // Send initial state immediately
        try {
          const state = await this.aggregator.getFleetState();
          ws.send(JSON.stringify({ type: 'FLEET_STATE', payload: state }));
        } catch {
          // ignore
        }

        ws.on('message', async (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'SET_SKIN' && msg.skin) {
              this.aggregator.setPetSkin(msg.skin as PetSkinId);
              this.broadcast();
            } else if (msg.type === 'POKE_PET') {
              this.broadcast({ type: 'PET_POKED', timestamp: Date.now() });
            }
          } catch {
            // ignore
          }
        });
      });

      // Broadcast state every 1.5 seconds
      this.broadcastInterval = setInterval(() => {
        this.broadcast();
      }, 1500);

      this.server.listen(this.port, () => {
        console.log(`[Starlight Fleet Observatory] Telemetry Server active at http://localhost:${this.port}`);
        resolve(this.port);
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[Starlight Fleet Observatory] Port ${this.port} busy, attempting port ${this.port + 1}...`);
          this.port += 1;
          this.server?.listen(this.port, () => {
            console.log(`[Starlight Fleet Observatory] Telemetry Server active at http://localhost:${this.port}`);
            resolve(this.port);
          });
        } else {
          reject(err);
        }
      });
    });
  }

  public stop() {
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    if (this.wss) this.wss.close();
    if (this.server) this.server.close();
  }

  public async broadcast(customMessage?: any) {
    if (!this.wss || this.wss.clients.size === 0) return;

    try {
      const state = await this.aggregator.getFleetState();
      const message = JSON.stringify(customMessage || { type: 'FLEET_STATE', payload: state });

      for (const client of this.wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    } catch {
      // ignore
    }
  }

  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${this.port}`);
    const pathname = url.pathname;

    // API Routes
    if (pathname === '/api/fleet' && req.method === 'GET') {
      const state = await this.aggregator.getFleetState();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state));
      return;
    }

    if (pathname === '/api/router/registry' && req.method === 'GET') {
      const registry = this.router.getRegistry();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(registry));
      return;
    }

    if (pathname === '/api/router/decide' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const ctx: RoutingContext = JSON.parse(body);
          const decision = this.router.route(ctx);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(decision));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (pathname === '/api/hook' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload: HookEventPayload = JSON.parse(body);
          this.aggregator.handleHookEvent(payload);
          this.broadcast();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', received: payload.event }));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (pathname === '/api/permission/approve' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { id } = JSON.parse(body);
          const success = this.aggregator.approvePermission(id);
          this.broadcast();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: success ? 'ok' : 'not_found', id }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid payload' }));
        }
      });
      return;
    }

    if (pathname === '/api/permission/deny' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { id } = JSON.parse(body);
          const success = this.aggregator.denyPermission(id);
          this.broadcast();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: success ? 'ok' : 'not_found', id }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid payload' }));
        }
      });
      return;
    }

    if (pathname === '/api/pet/sound' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { enabled } = JSON.parse(body);
          this.aggregator.setSoundEnabled(Boolean(enabled));
          this.broadcast();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', soundEnabled: Boolean(enabled) }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid payload' }));
        }
      });
      return;
    }

    if (pathname === '/api/pet/skin' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { skin } = JSON.parse(body);
          if (skin) {
            this.aggregator.setPetSkin(skin);
            this.broadcast();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', skin }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid payload' }));
        }
      });
      return;
    }

    if (pathname === '/api/analytics/trend' && req.method === 'GET') {
      try {
        const days = parseInt(url.searchParams.get('days') || '30', 10);
        const trend = await this.aggregator.analytics.getDailyTrend(days);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(trend));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname === '/api/analytics/snapshot' && req.method === 'POST') {
      try {
        this.aggregator.snapshotTodayAnalytics();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Snapshot saved' }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', timestamp: Date.now() }));
      return;
    }

    // Static Assets
    this.serveStatic(pathname, res);
  }

  private serveStatic(pathname: string, res: http.ServerResponse) {
    let reqPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    let filePath = path.join(this.publicDir, reqPath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(this.publicDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff2': 'font/woff2',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  }
}
