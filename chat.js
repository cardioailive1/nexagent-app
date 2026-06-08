module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel environment variables' });

  const b = req.body || {};
  const up = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: b.model || 'claude-sonnet-4-6', max_tokens: b.max_tokens || 8000, stream: true, system: b.system || '', messages: b.messages || [] }),
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(up.status);
  const r = up.body.getReader();
  const pump = async () => { const { done, value } = await r.read(); if (done) return res.end(); res.write(Buffer.from(value)); return pump(); };
  await pump();
};
