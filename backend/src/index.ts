import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { prisma } from './prisma';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Required when deployed behind a reverse proxy (Vercel, Railway, Render, etc.)
// so that req.ip is populated from X-Forwarded-For instead of being undefined.
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
const getAllowedOrigins = () => {
  const envOrigin = process.env.ALLOWED_ORIGIN;
  if (!envOrigin) {
    return [
      'http://localhost:3000', 
      'https://localhost:3000', 
      'https://ad-spawn-kappa.vercel.app'
    ];
  }
  return envOrigin.split(',').map(o => o.trim());
};

app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// GLOBAL ERROR HANDLERS
process.on('uncaughtException', (error) => {
  console.error('!!! [CRITICAL] UNCAUGHT EXCEPTION !!!');
  console.error(error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('!!! [CRITICAL] UNHANDLED REJECTION !!!');
  console.error('Promise:', promise, 'Reason:', reason);
});

// REQUEST LOGGING
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`>>> [${new Date().toISOString()}] ${req.method} ${req.url} START`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`<<< [${new Date().toISOString()}] ${req.method} ${req.url} END (${res.statusCode}) - ${duration}ms`);
  });
  
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', pid: process.pid, time: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is alive' });
});

// Import routes
import authRoutes from './routes/auth.routes';
import adAccountRoutes from './routes/adAccount.routes';
import duplicationRoutes from './routes/duplication.routes';
import templateRoutes from './routes/template.routes';
import draftRoutes from './routes/draft.routes';
import wideCreationRoutes from './routes/wideCreation.routes';
import userRoutes from './routes/user.routes';
import uploadRoutes from './routes/upload.routes';
import teamRoutes from './routes/team.routes';
import profileRoutes from './routes/profile.routes';
import aiCreateRoutes from './routes/aiCreate.routes';
import analyticsRoutes from './routes/analytics.routes';
import activityRoutes from './routes/activity.routes';

app.use('/api/auth', authRoutes);
app.use('/api/adaccounts', adAccountRoutes);
app.use('/api/duplicate', duplicationRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/wide-creation', wideCreationRoutes);
app.use('/api/user', userRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/ai-create', aiCreateRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/activity', activityRoutes);

// Catch-all for 404s
app.use((req, res) => {
  console.warn(`[404] Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Not Found', path: req.url });
});

// Global error handler — Express 5 forwards sync + async errors here.
// Keeps responses as JSON instead of the default HTML error page.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.url}:`, err);
  if (res.headersSent) return;
  const status = typeof err?.status === 'number' ? err.status : 500;
  res.status(status).json({ message: err?.message || 'Internal server error' });
});

console.log(`[DEBUG] Attempting to start server on port ${PORT} (PID: ${process.pid})...`);

const server = app.listen(PORT);

server.on('listening', () => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr?.port}`;
  console.log('==================================================');
  console.log(`  SERVER IS LISTENING ON ${bind}`);
  console.log(`  PROCESS PID: ${process.pid}`);
  console.log(`  TIMESTAMP: ${new Date().toISOString()}`);
  console.log('==================================================');
});

server.on('error', (err: any) => {
  console.error('!!! SERVER ERROR EVENT !!!');
  if (err.code === 'EADDRINUSE') {
    console.error(`!!! Port ${PORT} is already in use. !!!`);
    process.exit(1);
  } else {
    console.error(err);
  }
});

server.on('close', () => {
  console.warn('!!! SERVER CLOSED !!!');
});

export { prisma };
