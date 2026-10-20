import './dist/server.cjs';
import { startServer } from './dist/server.cjs';

startServer().catch(err => {
  console.error('[KABALY app.js Error]:', err);
});
