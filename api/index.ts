import type { IncomingMessage, ServerResponse } from 'node:http';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildApp } from '../src/server.js';
import { openDatabase } from '../src/db.js';

const runtimeDatabase = join(tmpdir(), 'pricemcp-vercel.db');

const appPromise = (async () => {
  if (!existsSync(runtimeDatabase)) {
    copyFileSync(join(process.cwd(), 'data', 'vercel-snapshot.db'), runtimeDatabase);
  }
  process.env.PRICEMCP_SCHEDULER = 'false';
  const db = openDatabase(runtimeDatabase);
  db.exec('PRAGMA query_only=ON');
  const app = buildApp(db, { readOnly: true });
  await app.ready();
  return app;
})();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPromise;
  app.server.emit('request', req, res);
}

export const config = { maxDuration: 30 };
