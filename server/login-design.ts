import type { Express, RequestHandler } from 'express';
import { copyDefaultLoginDesign, parseLoginDesign } from '@shared/login-design';
import { storage } from './storage';
export const LOGIN_DESIGN_KEYS = ['login_design_draft', 'login_design_published'];
type DesignStore = Pick<typeof storage, 'getAllSettings' | 'upsertSetting'>;
export function registerLoginDesignRoutes(app: Express, guard: RequestHandler, store: DesignStore = storage) {
  const origin = process.env.APP_PUBLIC_URL || 'https://nakedapp.up.railway.app';
  async function load(key: string) {
    const row = (await store.getAllSettings()).find(s => s.key === key);
    if (!row) return copyDefaultLoginDesign();
    try { return parseLoginDesign(JSON.parse(row.value), origin); } catch { return copyDefaultLoginDesign(); }
  }
  const sameOrigin: RequestHandler = (req, res, next) => {
    const expected = `${req.protocol}://${req.get('host')}`;
    if ((req.headers.origin && req.headers.origin !== expected) || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])))) return res.status(403).json({ message: 'Use the Nakedapp admin editor' });
    next();
  };
  app.get('/api/login-design', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=30');
    try { res.json(await load('login_design_published')); }
    catch { res.status(503).json({ message: 'Design temporarily unavailable' }); }
  });
  app.get('/api/admin/login-design', guard, async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try { res.json({ draft: await load('login_design_draft'), published: await load('login_design_published') }); }
    catch { res.status(503).json({ message: 'Cannot load login design' }); }
  });
  app.put('/api/admin/login-design', guard, sameOrigin, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    let design;
    try {
      if (!req.body || !['draft', 'publish'].includes(req.body.action) || Object.keys(req.body).some(k => !['action', 'design'].includes(k))) throw new Error();
      design = parseLoginDesign(req.body.design, origin);
    } catch { return res.status(400).json({ message: 'Invalid design. Use the supplied fonts, colours and uploaded images.' }); }
    try {
      if (req.body.action === 'publish') await store.upsertSetting({ key: 'login_design_draft', value: JSON.stringify(design), type: 'json', section: 'login_design', label: 'Login screen draft' });
      await store.upsertSetting({ key: req.body.action === 'publish' ? 'login_design_published' : 'login_design_draft', value: JSON.stringify(design), type: 'json', section: 'login_design', label: 'Login screen design' });
      res.json({ design });
    } catch { res.status(503).json({ message: 'Design was not saved. Please try again.' }); }
  });
}
