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

  if (req.method === 'GET') {
    try {
      const data = await kv.get(DATA_KEY);
      return res.status(200).json(data || { users: [], agentImm: {}, agentTypes: {}, commData: {}, visites: [], timestamp: 0 });
    } catch (e) {
      return res.status(500).json({ error: 'Read failed', detail: e.message });
    }
  }

  if (req.method === 'POST') {
    if (req.headers.authorization !== `Bearer ${AUTH_KEY}`) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const data = req.body;
      data.timestamp = Date.now();
      await kv.set(DATA_KEY, data);
      return res.status(200).json({ ok: true, timestamp: data.timestamp });
    } catch (e) {
      return res.status(500).json({ error: 'Write failed', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
