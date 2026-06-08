// api/chat.js — NexAgent Serverless Proxy
// Vercel Node.js Serverless Function
// Set ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const body     = req.body || {};
  const apiKey   = process.env.ANTHROPIC_API_KEY || body.apiKey || '';

  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(401).json({
      error: 'ANTHROPIC_API_KEY not set. Go to Vercel → Settings → Environment Variables and add it.'
    });
  }

  const payload = {
    model:      body.model      || 'claude-sonnet-4-6',
    max_tokens: body.max_tokens || 8000,
    messages:   body.messages   || [],
    stream:     true,
  };
  if (body.system) payload.system = body.system;

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Cannot reach Anthropic: ' + err.message });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(upstream.status);

  const reader = upstream.body.getReader();
  const pump = async () => {
    const { done, value } = await reader.read();
    if (done) { res.end(); return; }
    res.write(Buffer.from(value));
    await pump();
  };
  await pump();
};
