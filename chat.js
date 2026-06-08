export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' });

  const body = req.body || {};

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      body.model      || 'claude-sonnet-4-6',
      max_tokens: body.max_tokens || 8000,
      stream:     true,
      system:     body.system     || '',
      messages:   body.messages   || [],
    }),
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(upstream.status);

  const reader = upstream.body.getReader();
  const pump = async () => {
    const { done, value } = await reader.read();
    if (done) return res.end();
    res.write(Buffer.from(value));
    return pump();
  };
  await pump();
}
