import { startServer } from './dist/server.cjs';

startServer().catch(err => {
  console.error('[KABALY Server Startup Error]:', err);
});

