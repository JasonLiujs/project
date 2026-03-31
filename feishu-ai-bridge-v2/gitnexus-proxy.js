#!/usr/bin/env node
/**
 * Lightweight reverse proxy for GitNexus API
 * - Listens on :8890 by default
 * - Forwards all paths to the target GitNexus server (default http://127.0.0.1:7770)
 * - Adds permissive CORS for the Feishu WebView
 * - Supports SSE and streaming by piping raw HTTP
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.GITNEXUS_PROXY_PORT || 8890);
const TARGET = process.env.GITNEXUS_TARGET || 'http://127.0.0.1:7770';
const DEFAULT_REPO = process.env.GITNEXUS_DEFAULT_REPO || 'feishu-ai-bridge-v2';
const STATIC_ROOT = path.join(__dirname, 'public', 'gitnexus');
const targetUrl = new URL(TARGET);
const targetClient = targetUrl.protocol === 'https:' ? https : http;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

function writeSseEvent(res, event, data) {
  if (event) {
    res.write(`event: ${event}\n`);
  }
  if (data !== undefined) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`data: ${payload}\n`);
  }
  res.write('\n');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify(payload));
}

function serveStaticFile(req, res) {
  const requestPath = req.url.split('?')[0];
  if (!requestPath.startsWith('/gitnexus')) {
    return false;
  }

  const relativePath = requestPath === '/gitnexus' || requestPath === '/gitnexus/'
    ? 'index.html'
    : requestPath.replace(/^\/gitnexus\/?/, '');
  const resolvedPath = path.resolve(STATIC_ROOT, relativePath);

  if (!resolvedPath.startsWith(STATIC_ROOT)) {
    sendJson(res, 403, { error: 'forbidden' });
    return true;
  }

  let filePath = resolvedPath;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: 'not_found', path: requestPath });
    return true;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const cacheHeaders = ext === '.html'
    ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    : {};
  res.writeHead(200, { 'Content-Type': contentType, ...cacheHeaders, ...corsHeaders });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  // Health endpoint for the plugin probe
  if (req.url === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      proxy: `http://localhost:${PORT}`,
      target: TARGET,
      staticRoot: STATIC_ROOT,
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/heartbeat') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...corsHeaders,
    });

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    req.socket?.setKeepAlive?.(true, 1000);
    req.socket?.setTimeout?.(0);
    res.socket?.setKeepAlive?.(true, 1000);
    res.socket?.setTimeout?.(0);

    // Let the embedded GitNexus app treat the proxy as an always-on heartbeat source.
    writeSseEvent(res, 'connected', {
      status: 'ok',
      proxy: `http://localhost:${PORT}`,
      target: TARGET,
      ts: Date.now(),
    });

    // Keep the connection active more frequently than Node's default 5s idle window.
    const interval = setInterval(() => {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    }, 2500);

    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method === 'GET' && serveStaticFile(req, res)) {
    return;
  }

  const upstreamRequestUrl = new URL(req.url, `${targetUrl.protocol}//${targetUrl.host}`);
  if (
    req.method === 'GET' &&
    DEFAULT_REPO &&
    ['/api/repo', '/api/graph', '/api/file', '/api/grep'].includes(upstreamRequestUrl.pathname) &&
    !upstreamRequestUrl.searchParams.has('repo')
  ) {
    upstreamRequestUrl.searchParams.set('repo', DEFAULT_REPO);
  }

  const proxiedPath = `${targetUrl.pathname.replace(/\/$/, '')}${upstreamRequestUrl.pathname}${upstreamRequestUrl.search}`;
  const options = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    method: req.method,
    path: proxiedPath,
    headers: { ...req.headers, host: targetUrl.host },
  };

  const proxyReq = targetClient.request(options, (proxyRes) => {
    // copy headers but override CORS
    const headers = { ...proxyRes.headers, ...corsHeaders };
    res.writeHead(proxyRes.statusCode || 502, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    sendJson(res, 502, { error: 'proxy_error', message: err.message });
  });

  // pipe body
  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`[gitnexus-proxy] listening on http://localhost:${PORT} -> ${TARGET}`);
});

// SSE endpoints need a longer lifetime than Node's default keep-alive window.
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 0;

process.on('SIGINT', () => {
  server.close(() => {
    console.log('[gitnexus-proxy] closed');
    process.exit(0);
  });
});
