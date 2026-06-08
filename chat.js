// api/chat.js — NexAgent API Proxy
// Vercel Serverless Function (Node.js runtime)
// Add ANTHROPIC_API_KEY to Vercel Environment Variables

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // API key: from Vercel env var (production) or request body (dev fallback)
  const apiKey = process.env.ANTHROPIC_API_KEY || req.body?.apiKey || '';

  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(401).json({
      error: 'ANTHROPIC_API_KEY not configured. Go to Vercel → Settings → Environment Variables and add it.',
    });
  }

  const {
    model        = 'claude-sonnet-4-6',
    max_tokens   = 8000,
    messages     = [],
    system,
    stream       = true,
    temperature,
    tools,
    tool_choice,
  } = req.body || {};

  const anthropicBody = { model, max_tokens, messages, stream };
  if (system)      anthropicBody.system      = system;
  if (temperature != null) anthropicBody.temperature = temperature;
  if (tools)       anthropicBody.tools       = tools;
  if (tool_choice) anthropicBody.tool_choice = tool_choice;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    // Stream the response back
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(upstream.status);

    const reader = upstream.body.getReader();
    const write  = () => reader.read().then(({ done, value }) => {
      if (done) { res.end(); return; }
      res.write(Buffer.from(value));
      write();
    });
    write();

  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Anthropic: ' + err.message });
  }
}
