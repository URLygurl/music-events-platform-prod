import assert from 'node:assert/strict';
import { once } from 'node:events';
import express, { type RequestHandler } from 'express';
import { registerLoginDesignRoutes } from '../server/login-design';
import { copyDefaultLoginDesign, parseLoginDesign } from '../shared/login-design';

const rows = new Map<string, any>();
const store = { getAllSettings: async () => [...rows.values()], upsertSetting: async (row: any) => { rows.set(row.key, row); return row; } };
const guard: RequestHandler = (req, res, next) => { if (!req.headers['x-test-role']) return res.sendStatus(401); if (!['admin','superadmin'].includes(String(req.headers['x-test-role']))) return res.sendStatus(403); next(); };
const app = express(); app.use(express.json()); registerLoginDesignRoutes(app, guard, store);
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
async function call(path: string, role?: string, design?: unknown, action = 'draft', origin = base) { return fetch(base + path, { method: design ? 'PUT' : 'GET', headers: { ...(role ? { 'x-test-role': role } : {}), ...(design ? { 'content-type': 'application/json', origin } : {}) }, body: design ? JSON.stringify({ action, design }) : undefined }); }
try {
  assert.equal((await call('/api/admin/login-design')).status, 401);
  assert.equal((await call('/api/admin/login-design', 'user')).status, 403);
  for (const role of ['admin','superadmin']) assert.equal((await call('/api/admin/login-design', role)).status, 200);
  const theme = copyDefaultLoginDesign(); theme.left.headline = '<script>not executable</script>'; theme.right.signupTitle = 'Artists welcome';
  assert.equal((await call('/api/admin/login-design', 'user', theme)).status, 403);
  assert.equal((await call('/api/admin/login-design', 'admin', theme, 'draft', 'https://evil.test')).status, 403);
  assert.equal((await call('/api/admin/login-design', 'admin', theme)).status, 200);
  assert.notEqual((await (await call('/api/login-design')).json()).right.signupTitle, 'Artists welcome');
  assert.equal((await call('/api/admin/login-design', 'superadmin', theme, 'publish')).status, 200);
  assert.equal((await (await call('/api/login-design')).json()).right.signupTitle, 'Artists welcome');
  const admin = await (await call('/api/admin/login-design', 'admin')).json(); assert.deepEqual(admin.draft, admin.published);
  for (const mutate of [(x:any)=>x.left.font='url(evil)', (x:any)=>x.left.imageUrl='https://evil.test/a.png', (x:any)=>x.left.background='red;display:none', (x:any)=>x.right.headingSize=1000, (x:any)=>x.credentials='no']) {
    const invalid = structuredClone(theme); mutate(invalid); assert.throws(() => parseLoginDesign(invalid)); assert.equal((await call('/api/admin/login-design', 'admin', invalid, 'publish')).status, 400);
  }
  assert.deepEqual(await (await call('/api/login-design')).json(), theme);
  const defaults = copyDefaultLoginDesign(); assert.equal((await call('/api/admin/login-design', 'admin', defaults, 'publish')).status, 200);
  assert.deepEqual(await (await call('/api/login-design')).json(), defaults);
  console.log('PASS: admin/superadmin only, CSRF guard, invalid themes rejected, public published-only settings, draft isolation and restore defaults; no real DB accessed.');
} finally { server.closeAllConnections(); server.close(); }
