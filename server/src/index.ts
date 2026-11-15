import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { getDb, closeDb } from './db/database.js';
import { apiRouter } from './routes/index.js';
import { runReminderDispatcher } from './demo-clock.js';
import { runSeed } from './db/seed.js';
import { checkDatastoreHealth, syncFullProfileToDatastore } from './services/datastore.js';

const app = express();

// Enable Gzip/Brotli HTTP compression for high throughput & low bandwidth
app.use(compression());

// Security and utility middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Production HTTP Security Headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

// Correlation ID & request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// Health & Readiness checks required by Section P
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'HEALTHY',
    service: 'sahaaya-care-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version
  });
});

app.get('/ready', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    const dsStatus = await checkDatastoreHealth();
    res.status(200).json({
      status: 'READY',
      database: 'GOOGLE_CLOUD_DATASTORE',
      cloudDatastoreStatus: dsStatus.status,
      emailProvider: config.emailProvider,
      geminiAssistantEnabled: config.enableAiAssistant && Boolean(config.geminiApiKey),
      geminiModel: config.geminiModel,
      projectId: config.projectId,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'NOT_READY',
      error: 'Database check failed'
    });
  }
});

// Mount Main API Router
app.use('/api/v1', apiRouter);

// Serve built frontend assets in production or standalone container
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let clientDistPath = path.resolve(__dirname, '../../client/dist');
if (!fs.existsSync(clientDistPath)) {
  clientDistPath = path.resolve(process.cwd(), 'client/dist');
}

if (fs.existsSync(clientDistPath)) {
  // 1-year immutable caching for fingerprinted assets
  app.use('/assets', express.static(path.join(clientDistPath, 'assets'), {
    maxAge: '1y',
    immutable: true
  }));
  // Standard static file serving with HTML freshness
  app.use(express.static(clientDistPath, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));
  app.get('*', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'An internal server error occurred',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// Start HTTP Server
const server = app.listen(config.port, () => {
  console.log(`===================================================`);
  console.log(`  Sahaaya Care Platform API running on port ${config.port}`);
  console.log(`  GCP Project: ${config.projectId}`);
  console.log(`  Gemini Model: ${config.geminiModel} (Active: ${Boolean(config.geminiApiKey)})`);
  console.log(`  Health Check: http://localhost:${config.port}/health`);
  console.log(`  Readiness:    http://localhost:${config.port}/ready`);
  console.log(`===================================================`);

  // Auto-seed demo personas if database is fresh
  try {
    const db = getDb();
    const userRow = db.prepare('SELECT count(*) as count FROM users').get() as any;
    if (!userRow || userRow.count === 0) {
      console.log('Fresh database detected. Initializing demo seed data...');
      runSeed();
      console.log('Deterministic demo seed initialized successfully.');
    }
    // Sync to Google Cloud Datastore in background
    syncFullProfileToDatastore('cp-anita-rao-01').catch(e => console.error('Cloud Datastore background sync notice:', e.message));
  } catch (err: any) {
    console.error('Auto-seed check notice:', err?.message || err);
  }
});

// Background dispatcher timer (scans due doses periodically)
const dispatcherInterval = setInterval(() => {
  runReminderDispatcher().catch(e => console.error('Dispatcher error:', e.message));
}, 30000);

// Graceful termination handling for Cloud Run & local process
function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  clearInterval(dispatcherInterval);
  server.close(() => {
    closeDb();
    console.log('Database connection closed. Process exited safely.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
