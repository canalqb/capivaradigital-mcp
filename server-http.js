'use strict';
/*
 * capivaradigital-mcp - ponte HTTP (Streamable HTTP + OAuth 2.1 com DCR e PKCE)
 *
 * Expoe o server.js do capivaradigital (stdio) como conector remoto para o claude.ai.
 * Zero dependencias: apenas Node 18+ nativo. O server.js NAO e modificado:
 * cada requisicao JSON-RPC vira um processo `node server.js` efemero.
 * Fonte: implementação.txt (22/10/2026), codigo testado contra o server.js real
 * (26 verificacoes automaticas passaram). Adaptacao local: candidatos do SERVER_JS.
 *
 * Variaveis de ambiente:
 *   PUBLIC_URL        (obrigatoria) URL publica HTTPS sem barra final, ex.: https://capivaradigital.exemplo.com.br
 *   ADMIN_PASSWORD    (obrigatoria) senha pedida na tela de consentimento OAuth
 *   PORT              porta local (padrao 8787)
 *   HOST              interface local (padrao 127.0.0.1; atras de proxy reverso/tunel)
 *   SERVER_JS         caminho do server.js (padrao ./server.js, ./capivaradigital-mcp/server.js ou ../capivaradigital-mcp/server.js)
 *   STATE_FILE        arquivo JSON para clientes/refresh tokens (padrao ./oauth-state.json)
 *   DISABLE_TOOLS     ferramentas bloqueadas, separadas por virgula
 *                     (padrao: mcp_atualizar,guia_instalacao)
 *   NO_LOGIN_SECRET   modo SEM LOGIN (claude.ai "Sem login"): se definido, o
 *                     caminho /mcp/<NO_LOGIN_SECRET> aceita requisicoes SEM
 *                     OAuth. O /mcp puro continua exigindo token. Quem tiver
 *                     a URL completa tem acesso — mais fraco que OAuth
 *                     (a URL pode vazar em logs), use com segredo longo.
 *   ALLOWED_REDIRECTS callbacks OAuth EXATOS extras, separados por virgula, para
 *                     qualquer cliente remoto (ChatGPT, Freebuff, etc.). O claude.ai
 *                     ja vem na lista padrao e loopback http://localhost|127.0.0.1
 *                     com qualquer porta/caminho e aceito sem cadastro (RFC 8252).
 *   TOOL_TIMEOUT_MS   limite por chamada (padrao 280000; o claude.ai desiste em 300 s)
 *   EXA_API_KEY, DATAJUD_API_KEY   repassadas ao server.js quando definidas
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const PORT = parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '127.0.0.1';
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, 'oauth-state.json');
const TOOL_TIMEOUT_MS = parseInt(process.env.TOOL_TIMEOUT_MS || '280000', 10);
const NO_LOGIN_SECRET = process.env.NO_LOGIN_SECRET || '';
const DISABLED = new Set((process.env.DISABLE_TOOLS === undefined ? 'mcp_atualizar,guia_instalacao' : process.env.DISABLE_TOOLS)
  .split(',').map(s => s.trim()).filter(Boolean));
const SERVER_JS = process.env.SERVER_JS ||
  [path.join(__dirname, 'server.js'), path.join(__dirname, 'capivaradigital-mcp', 'server.js'), path.join(__dirname, '..', 'capivaradigital-mcp', 'server.js')].find(p => fs.existsSync(p)) || '';

const ALLOWED_REDIRECTS = ['https://claude.ai/api/mcp/auth_callback']
  .concat((process.env.ALLOWED_REDIRECTS || '').split(',').map(s => s.trim()).filter(Boolean));
console.error('OAuth: ' + ALLOWED_REDIRECTS.length + ' callback(s) exato(s) aceitos' + (process.env.ALLOWED_REDIRECTS ? ' (env ALLOWED_REDIRECTS presente)' : '') + ' + loopback http://localhost|127.0.0.1 em qualquer porta/caminho.');
const ACCESS_TTL = 3600;                 // 1 h
const REFRESH_TTL = 60 * 60 * 24 * 90;   // 90 dias
const CODE_TTL = 300;                    // 5 min
const MAX_BODY = 1024 * 1024;

if (!PUBLIC_URL || !/^https:\/\//.test(PUBLIC_URL) && !/^http:\/\/localhost/.test(PUBLIC_URL)) {
  console.error('ERRO: defina PUBLIC_URL com a URL publica HTTPS (ex.: https://capivaradigital.exemplo.com.br).'); process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) { console.error('ERRO: defina ADMIN_PASSWORD com pelo menos 12 caracteres.'); process.exit(1); }
if (!SERVER_JS || !fs.existsSync(SERVER_JS)) { console.error('ERRO: server.js do capivaradigital nao encontrado. Defina SERVER_JS.'); process.exit(1); }

/* ---------------- estado persistente (clientes DCR + refresh tokens) ---------------- */
let state = { clients: {}, refresh: {} };
try { state = Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))); } catch (e) { /* primeira execucao */ }
let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify(state), { mode: 0o600 }); fs.renameSync(STATE_FILE + '.tmp', STATE_FILE); }
    catch (e) { console.error('aviso: nao salvou estado:', e.message); }
  }, 200);
}
// codigos e access tokens ficam em memoria (curta duracao); refresh tokens persistem.
const codes = new Map();
const access = new Map();
const rnd = (n = 32) => crypto.randomBytes(n).toString('base64url');
const sha256b64u = (s) => crypto.createHash('sha256').update(s).digest('base64url');
const hashTok = (t) => crypto.createHash('sha256').update(t).digest('hex');
const now = () => Math.floor(Date.now() / 1000);
function gc() {
  const t = now();
  for (const [k, v] of codes) if (v.exp < t) codes.delete(k);
  for (const [k, v] of access) if (v.exp < t) access.delete(k);
  for (const [k, v] of Object.entries(state.refresh)) if (v.exp < t) { delete state.refresh[k]; saveState(); }
}
setInterval(gc, 60000).unref();

/* ---------------- utilidades HTTP ---------------- */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('payload grande'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function json(res, status, obj, extra = {}) {
  const b = JSON.stringify(obj);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(b) }, extra));
  res.end(b);
}
function html(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://claude.ai" });
  res.end(body);
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&#38;', '<': '&#60;', '>': '&#62;', '"': '&#34;', "'": '&#39;' }[c]));
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, mcp-protocol-version, mcp-session-id, accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, Mcp-Session-Id');
}
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/* limitador simples de tentativas de senha por IP */
const attempts = new Map();
function tooMany(ip) { const a = attempts.get(ip); return a && a.n >= 5 && a.t > Date.now(); }
function failed(ip) { const a = attempts.get(ip) || { n: 0, t: 0 }; a.n++; a.t = Date.now() + 15 * 60 * 1000; attempts.set(ip, a); }
function ok(ip) { attempts.delete(ip); }

/* ---------------- metadados de descoberta ---------------- */
const MCP_URL = PUBLIC_URL + '/mcp';
function protectedResourceMeta() {
  return { resource: MCP_URL, authorization_servers: [PUBLIC_URL], bearer_methods_supported: ['header'], scopes_supported: ['mcp'], resource_name: 'capivaradigital' };
}
function authServerMeta() {
  return {
    issuer: PUBLIC_URL,
    authorization_endpoint: PUBLIC_URL + '/authorize',
    token_endpoint: PUBLIC_URL + '/token',
    registration_endpoint: PUBLIC_URL + '/register',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    scopes_supported: ['mcp', 'offline_access']
  };
}
function unauthorized(res) {
  json(res, 401, { error: 'unauthorized', error_description: 'Token ausente ou invalido' },
    { 'WWW-Authenticate': `Bearer resource_metadata="${PUBLIC_URL}/.well-known/oauth-protected-resource", scope="mcp"` });
}

/* ---------------- OAuth ---------------- */
function redirectAllowed(uri) {
  if (ALLOWED_REDIRECTS.includes(uri)) return true;
  // loopback de app nativo (RFC 8252): qualquer porta e caminho em localhost/127.0.0.1/::1
  try {
    const u = new URL(uri);
    return u.protocol === 'http:' && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname) && !u.username && !u.password;
  } catch (e) { return false; }
}

async function register(req, res) {
  let b; try { b = JSON.parse(await readBody(req) || '{}'); } catch (e) { return json(res, 400, { error: 'invalid_client_metadata' }); }
  const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris : [];
  if (!uris.length || !uris.every(redirectAllowed)) {
    const reprovadas = uris.filter(u => !redirectAllowed(u)).map(u => String(u).slice(0, 160));
    return json(res, 400, { error: 'invalid_redirect_uri',
      error_description: 'redirect_uri nao permitido' + (reprovadas.length ? ': ' + reprovadas.join(', ') : ' (redirect_uris vazio)')
        + '. Aceitas: ' + ALLOWED_REDIRECTS.length + ' URI(s) exata(s) da lista (cadastre a do seu cliente em ALLOWED_REDIRECTS) e loopback http://localhost|127.0.0.1 com qualquer porta/caminho.' });
  }
  if (Object.keys(state.clients).length > 500) return json(res, 429, { error: 'too_many_clients' });
  const id = 'c_' + rnd(16);
  state.clients[id] = { redirect_uris: uris, name: String(b.client_name || 'Claude').slice(0, 80), created: now() };
  saveState();
  json(res, 201, { client_id: id, client_id_issued_at: now(), redirect_uris: uris, client_name: state.clients[id].name,
    token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] });
}

function loginPage(p, msg) {
  const hidden = ['client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'scope', 'response_type', 'resource']
    .map(k => `<input type="hidden" name="${k}" value="${esc(p[k] || '')}">`).join('');
  let host = ''; try { host = new URL(p.redirect_uri).hostname; } catch (e) { /* ignora */ }
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autorizar capivaradigital</title>
<style>body{font-family:system-ui,sans-serif;background:#f5f5f5;color:#333;display:grid;place-items:center;min-height:100vh;margin:0}
main{background:#fff;padding:28px;border-radius:12px;max-width:380px;width:calc(100% - 32px);box-shadow:0 2px 12px #0002}
h1{font-size:1.2rem;margin:0 0 8px}p{color:#555;line-height:1.5;font-size:.95rem}input[type=password]{width:100%;padding:12px;margin:8px 0 14px;border:1px solid #bbb;border-radius:8px;font-size:1rem;box-sizing:border-box}
button{width:100%;padding:12px;border:0;border-radius:8px;background:#28a745;color:#fff;font-size:1rem;cursor:pointer}.err{color:#d32f2f;font-weight:600}</style></head>
<body><main><h1>Autorizar o conector capivaradigital</h1>
<p>O aplicativo <strong>${esc(host)}</strong> quer acessar as ferramentas de OSINT judicial deste servidor. Informe a senha de administrador para permitir.</p>
${msg ? `<p class="err">${esc(msg)}</p>` : ''}
<form method="post" action="/authorize">${hidden}<input type="password" name="password" autocomplete="current-password" placeholder="Senha" required autofocus><button type="submit">Autorizar</button></form></main></body></html>`;
}

async function authorize(req, res, url, ip) {
  let p;
  if (req.method === 'GET') p = Object.fromEntries(url.searchParams);
  else p = Object.fromEntries(new URLSearchParams(await readBody(req)));
  const c = state.clients[p.client_id];
  if (!c) return html(res, 400, '<p>client_id desconhecido.</p>');
  if (!c.redirect_uris.includes(p.redirect_uri)) return html(res, 400, '<p>redirect_uri nao registrado.</p>');
  const back = (params) => { const u = new URL(p.redirect_uri); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); if (p.state) u.searchParams.set('state', p.state); res.writeHead(302, { Location: u.toString() }); res.end(); };
  if (p.response_type !== 'code') return back({ error: 'unsupported_response_type' });
  if (!p.code_challenge || p.code_challenge_method !== 'S256') return back({ error: 'invalid_request', error_description: 'PKCE S256 obrigatorio' });
  if (req.method === 'GET') return html(res, 200, loginPage(p));
  if (tooMany(ip)) return html(res, 429, loginPage(p, 'Muitas tentativas. Aguarde 15 minutos.'));
  if (!safeEq(p.password || '', ADMIN_PASSWORD)) { failed(ip); return html(res, 401, loginPage(p, 'Senha incorreta.')); }
  ok(ip);
  const code = rnd(24);
  codes.set(code, { client_id: p.client_id, redirect_uri: p.redirect_uri, challenge: p.code_challenge, exp: now() + CODE_TTL });
  back({ code });
}

function issueTokens(clientId) {
  const at = rnd(32), rt = rnd(32);
  access.set(hashTok(at), { client_id: clientId, exp: now() + ACCESS_TTL });
  state.refresh[hashTok(rt)] = { client_id: clientId, exp: now() + REFRESH_TTL };
  saveState();
  return { access_token: at, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token: rt, scope: 'mcp' };
}

async function token(req, res) {
  const ct = String(req.headers['content-type'] || '');
  const raw = await readBody(req);
  const p = ct.includes('json') ? (() => { try { return JSON.parse(raw); } catch (e) { return {}; } })() : Object.fromEntries(new URLSearchParams(raw));
  const err = (e, d, s = 400) => json(res, s, { error: e, error_description: d });
  if (p.grant_type === 'authorization_code') {
    const c = codes.get(p.code); codes.delete(p.code);
    if (!c || c.exp < now()) return err('invalid_grant', 'codigo invalido ou expirado');
    if (c.client_id !== p.client_id || c.redirect_uri !== p.redirect_uri) return err('invalid_grant', 'client_id/redirect_uri nao conferem');
    if (!p.code_verifier || !safeEq(sha256b64u(p.code_verifier), c.challenge)) return err('invalid_grant', 'PKCE invalido');
    return json(res, 200, issueTokens(c.client_id));
  }
  if (p.grant_type === 'refresh_token') {
    const h = hashTok(String(p.refresh_token || ''));
    const r = state.refresh[h];
    if (!r || r.exp < now() || (p.client_id && r.client_id !== p.client_id)) return err('invalid_grant', 'refresh token invalido');
    delete state.refresh[h];               // rotacao obrigatoria para clientes publicos
    return json(res, 200, issueTokens(r.client_id));
  }
  return err('unsupported_grant_type', 'use authorization_code ou refresh_token');
}

function authed(req) {
  const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''));
  if (!m) return false;
  const t = access.get(hashTok(m[1].trim()));
  return !!t && t.exp >= now();
}

/* ---------------- ponte MCP: 1 requisicao JSON-RPC = 1 processo server.js ---------------- */
const childEnv = Object.assign({}, process.env);
delete childEnv.ADMIN_PASSWORD; delete childEnv.PUBLIC_URL;   // nao vaza segredos do OAuth ao server.js

function runRpc(msg) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SERVER_JS], { env: childEnv, stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '', done = false;
    const finish = (val) => { if (done) return; done = true; clearTimeout(timer); try { child.kill('SIGKILL'); } catch (e) { /* ja saiu */ } resolve(val); };
    const timer = setTimeout(() => finish({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: 'Tempo limite excedido no servidor' } }), TOOL_TIMEOUT_MS);
    child.stdout.on('data', (d) => {
      out += d.toString('utf8');
      const nl = out.indexOf('\n');
      if (nl >= 0) { try { finish(JSON.parse(out.slice(0, nl))); } catch (e) { finish({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: 'Resposta invalida do servidor' } }); } }
    });
    child.on('error', (e) => finish({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: 'Falha ao iniciar: ' + e.message } }));
    child.on('close', () => finish({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: 'Servidor encerrou sem resposta' } }));
    child.stdin.on('error', () => { /* processo pode fechar antes */ });
    child.stdin.end(JSON.stringify(msg) + '\n');
  });
}

async function handleRpc(msg) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return { jsonrpc: '2.0', id: (msg && msg.id) || null, error: { code: -32600, message: 'Requisicao invalida' } };
  }
  if (msg.id === undefined || msg.id === null) return null;                 // notificacao
  if (msg.method === 'initialize') {                                         // respondida aqui: negocia a versao do cliente
    const want = msg.params && msg.params.protocolVersion;
    const known = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
    return { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: known.includes(want) ? want : known[0], capabilities: { tools: {} }, serverInfo: { name: 'capivaradigital', version: 'http-bridge-1.1' } } };
  }
  if (msg.method === 'ping') return { jsonrpc: '2.0', id: msg.id, result: {} };
  if (msg.method === 'tools/call') {
    const name = msg.params && msg.params.name;
    if (DISABLED.has(name)) return { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: `A ferramenta ${name} esta desativada no modo remoto.` }], isError: true } };
  }
  const r = await runRpc(msg);
  if (msg.method === 'tools/list' && r.result && Array.isArray(r.result.tools)) r.result.tools = r.result.tools.filter(t => !DISABLED.has(t.name));
  return r;
}

async function mcp(req, res) {
  if (req.method === 'GET') { res.writeHead(405, { Allow: 'POST, DELETE, OPTIONS' }); return res.end(); }  // sem stream SSE servidor->cliente
  if (req.method === 'DELETE') { res.writeHead(204); return res.end(); }
  if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST, DELETE, OPTIONS' }); return res.end(); }
  let body; try { body = JSON.parse(await readBody(req)); } catch (e) { return json(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalido' } }); }
  if (Array.isArray(body)) {
    const rs = (await Promise.all(body.map(handleRpc))).filter(Boolean);
    return rs.length ? json(res, 200, rs) : (res.writeHead(202), res.end());
  }
  const r = await handleRpc(body);
  if (!r) { res.writeHead(202); return res.end(); }
  json(res, 200, r);
}

/* ---------------- roteamento ---------------- */
const server = http.createServer(async (req, res) => {
  cors(res);
  const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (p === '/healthz') return json(res, 200, { ok: true });
    if (p === '/.well-known/oauth-protected-resource' || p === '/.well-known/oauth-protected-resource/mcp') return json(res, 200, protectedResourceMeta());
    if (p === '/.well-known/oauth-authorization-server' || p === '/.well-known/openid-configuration') return json(res, 200, authServerMeta());
    if (p === '/register' && req.method === 'POST') return await register(req, res);
    if (p === '/authorize' && (req.method === 'GET' || req.method === 'POST')) return await authorize(req, res, url, ip);
    if (p === '/token' && req.method === 'POST') return await token(req, res);
    if (p === '/mcp') { if (!authed(req)) return unauthorized(res); return await mcp(req, res); }
    if (NO_LOGIN_SECRET && p === '/mcp/' + NO_LOGIN_SECRET) return await mcp(req, res);
    json(res, 404, { error: 'not_found' });
  } catch (e) {
    if (!res.headersSent) json(res, e.status || 500, { error: 'server_error', error_description: String(e.message || e) });
  }
});
server.requestTimeout = TOOL_TIMEOUT_MS + 20000;
server.headersTimeout = 30000;
server.keepAliveTimeout = 65000;
server.listen(PORT, HOST, () => console.log(`capivaradigital-http ouvindo em ${HOST}:${PORT} | conector: ${MCP_URL} | desativadas: ${[...DISABLED].join(',') || '-'}`));
