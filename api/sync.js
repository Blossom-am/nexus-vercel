import { Redis } from '@upstash/redis';

let kv;
try {
  kv = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} catch (initErr) {
  kv = null;
}

const DATA_KEY = 'nexus_data';
const BACKUP_KEY = 'nexus_data_backup';
const AUTH_KEY = 'nexus2026';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!kv) {
    return res.status(500).json({
      error: 'Redis not initialized',
      hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN
    });
  }

  // ── GET: read data (add ?backup=true to read last backup) ──
  if (req.method === 'GET') {
    try {
      const key = req.query.backup === 'true' ? BACKUP_KEY : DATA_KEY;
      const data = await kv.get(key);
      return res.status(200).json(data || { users: [], agentImm: {}, agentTypes: {}, commData: {}, visites: [], timestamp: 0 });
    } catch (e) {
      return res.status(500).json({ error: 'Read failed', detail: e.message });
    }
  }

  // ── POST: write data with safety checks ──
  if (req.method === 'POST') {
    if (req.headers.authorization !== `Bearer ${AUTH_KEY}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const data = req.body;

      // PROTECTION 1 — reject malformed payloads
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Invalid data: must be a JSON object' });
      }
      const required = ['users', 'agentImm', 'agentTypes', 'commData', 'visites'];
      const missing = required.filter(k => !(k in data));
      if (missing.length > 0) {
        return res.status(400).json({ error: 'Missing required keys', missing });
      }

      // PROTECTION 2 — detect massive data loss
      const current = await kv.get(DATA_KEY);
      if (current && data.force !== true) {
        const checks = [
          { name: 'users',  cur: (current.users || []).length,              next: (data.users || []).length,              min: 5 },
          { name: 'agents', cur: Object.keys(current.agentImm || {}).length, next: Object.keys(data.agentImm || {}).length, min: 5 },
          { name: 'lots',   cur: Object.keys(current.commData || {}).length, next: Object.keys(data.commData || {}).length, min: 50 }
        ];
        for (const c of checks) {
          if (c.cur > c.min && c.next < c.cur * 0.5) {
            return res.status(409).json({
              error: `Data-loss protection: ${c.name} would drop from ${c.cur} to ${c.next}`,
              hint: 'Add "force":true to override'
            });
          }
        }
      }

      // PROTECTION 3 — auto-backup before overwrite
      if (current) {
        await kv.set(BACKUP_KEY, current);
      }

      delete data.force;
      data.timestamp = Date.now();
      await kv.set(DATA_KEY, data);
      return res.status(200).json({ ok: true, timestamp: data.timestamp, backedUp: !!current });
    } catch (e) {
      return res.status(500).json({ error: 'Write failed', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
