// NexAgent Proxy Server — Deploy on Render.com (free)
// 1. Create account at render.com
// 2. New → Web Service → connect GitHub repo
// 3. Build command: npm install
// 4. Start command: node render-proxy.js
// 5. Add env var: ANTHROPIC_API_KEY = your key
// 6. Copy your Render URL and set NEXAGENT_WORKER_URL in nexagent-app.html

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST')    { res.writeHead(405); res.end('Method not allowed'); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'ANTHROPIC_API_KEY not set'})); return; }

  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch(e) { res.writeHead(400); res.end('Bad JSON'); return; }

    const payload = JSON.stringify({
      model:      parsed.model      || 'claude-sonnet-4-6',
      max_tokens: parsed.max_tokens || 8000,
      stream:     true,
      system:     parsed.system     || '',
      messages:   parsed.messages   || [],
    });

    const options = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'content-type':    'application/json',
        'content-length':  Buffer.byteLength(payload),
        'x-api-key':       key,
        'anthropic-version': '2023-06-01',
      },
    };

    const upReq = https.request(options, upRes => {
      res.writeHead(upRes.statusCode, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });
      upRes.pipe(res);
    });
    upReq.on('error', e => { res.writeHead(502); res.end(JSON.stringify({error:e.message})); });
    upReq.write(payload);
    upReq.end();
  });
});

server.listen(PORT, () => console.log(`NexAgent proxy running on port ${PORT}`));
