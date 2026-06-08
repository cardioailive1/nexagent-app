// Vercel Edge Function — NexAgent API Proxy
// File: api/chat.js → POST /api/chat
// Uses ANTHROPIC_API_KEY env var (set in Vercel dashboard)
// Customers never see or enter an API key

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // 1. Use server-side env var (Vercel dashboard) — customers never see this
  // 2. Fall back to apiKey from body (dev/testing only)
  const apiKey = process.env.ANTHROPIC_API_KEY || body.apiKey || '';

  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return new Response(JSON.stringify({
      error: 'API key not configured. Add ANTHROPIC_API_KEY to your Vercel environment variables.',
    }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const anthropicBody = {
    model:      body.model      || 'claude-sonnet-4-6',
    max_tokens: body.max_tokens || 8000,
    messages:   body.messages   || [],
    stream:     body.stream     !== false,
  };

  if (body.system)      anthropicBody.system      = body.system;
  if (body.temperature != null) anthropicBody.temperature = body.temperature;
  if (body.tools)       anthropicBody.tools       = body.tools;
  if (body.tool_choice) anthropicBody.tool_choice = body.tool_choice;

  let anthropicResp;
  try {
    anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to reach Anthropic: ' + err.message }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(anthropicResp.body, {
    status: anthropicResp.status,
    headers: {
      ...CORS,
      'Content-Type': anthropicResp.headers.get('content-type') || 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
