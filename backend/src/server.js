import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import config from './config.js';
import { setupDatabase } from './db/index.js';
import { setupRedis } from './services/redis.js';
import sessionRoutes from './routes/sessions.js';
import uploadRoutes from './routes/uploads.js';
import wsHandler from './ws/handler.js';
import testRoutes from './routes/test.js';

const app = Fastify({
  logger: {
    level: config.env === 'development' ? 'debug' : 'info'
  }
});

async function start() {
  try {
    // Plugins
    await app.register(cors, {
      origin: true,
      credentials: true
    });

    await app.register(websocket);

    // Services setup
    app.decorate('db', await setupDatabase());
    app.decorate('redis', await setupRedis());

    // Routes
    app.register(sessionRoutes, { prefix: '/api/sessions' });
    app.register(uploadRoutes, { prefix: '/api/uploads' });
    app.register(wsHandler, { prefix: '/ws' });
    app.register(testRoutes, { prefix: '/api/test' });

    // Health check
    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // Root route
    app.get('/', async () => ({ 
      name: 'Secure File Exchange API',
      version: '1.0.0',
      status: 'running'
    }));

    // Start server
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`✅ Server running on http://localhost:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
