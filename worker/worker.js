/* Surprise-V2 sharing API (Cloudflare Worker).
 *
 * Bindings (see wrangler.toml):  GIFTS (KV), IMAGES (R2)
 * Secrets:  TURNSTILE_SECRET, SESSION_SECRET   Vars: ALLOWED_ORIGIN
 *
 * Writes are fail-closed: without both secrets configured every write
 * returns 503, so a half-deployed Worker can never become an open endpoint.
 *
 *  POST /api/session   {turnstile}  -> {session, exp}      (Turnstile-verified)
 *  POST /api/gift      JSON gift    -> {id}                (X-Session required)
 *  PUT  /api/img       image bytes  -> {id}                (X-Session required)
 *  GET  /api/gift/:id               -> gift JSON
 *  GET  /img/:id                    -> image bytes
 */

const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // 56 symbols
const GIFT_ID_LEN = 10;   // 56^10 ~ 3e17 combinations
const IMG_ID_LEN = 12;
const MAX_GIFT_BYTES = 64 * 1024;
const MAX_IMG_BYTES = 15 * 1024 * 1024;
const MAX_PHOTOS = 100;
const SESSION_TTL_S = 30 * 60;
const GIFT_TTL_S = 400 * 24 * 60 * 60;
const REF_RE = /^(r2:[A-Za-z0-9]{8,32}|drive:[A-Za-z0-9_-]{10,100})$/;
const GIFT_ID_RE = /^[A-Za-z0-9]{6,32}$/;

const LIMITS = { session: 10, gift: 20, img: 120 }; // per IP per minute (best effort)

function newId(len) {
  const out = new Uint8Array(len);
  crypto.getRandomValues(out);
  let s = '';
  for (const b of out) s += ID_CHARS[b % ID_CHARS.length]; // 256 % 56 bias is negligible here
  return s;
}

function corsHeaders(req, env) {
  const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') || '';
  const h = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Session',
    'Access-Control-Max-Age': '86400'
  };
  if (allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

const json = (obj, status, h) =>
  new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, h) });
const fail = (status, code, h) => json({ error: code }, status, h);

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
  let s = '';
  for (const b of sig) s += b.toString(16).padStart(2, '0');
  return s;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function sessionValid(req, env) {
  const tok = req.headers.get('X-Session') || '';
  const [exp, sig] = tok.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return timingSafeEqual(sig, await hmac(env.SESSION_SECRET, exp));
}

async function rateLimited(req, env, bucket) {
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const key = 'rl:' + bucket + ':' + ip + ':' + Math.floor(Date.now() / 60000);
  const n = Number(await env.GIFTS.get(key)) || 0;
  if (n >= LIMITS[bucket]) return true;
  await env.GIFTS.put(key, String(n + 1), { expirationTtl: 120 });
  return false;
}

function sniffImage(b) {
  if (b.length > 12) {
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  }
  return null;
}

function validateGift(g) {
  if (!g || typeof g !== 'object' || Array.isArray(g)) return 'not an object';
  const urls = g.photoUrls == null ? [] : g.photoUrls;
  const texts = g.photoTexts == null ? [] : g.photoTexts;
  if (!Array.isArray(urls) || !Array.isArray(texts)) return 'photo arrays';
  if (urls.length > MAX_PHOTOS || texts.length > MAX_PHOTOS) return 'too many photos';
  for (const u of urls) {
    if (typeof u !== 'string' || u.length > 2000) return 'bad photo ref';
    if (/^(data|blob|file|javascript):/i.test(u)) return 'embedded/local photo not allowed';
    if (!REF_RE.test(u) && !/^https:\/\/[^\s"'<>`]+$/i.test(u)) return 'bad photo ref';
  }
  return null;
}

export default {
  async fetch(req, env) {
    const h = corsHeaders(req, env);
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

    // ---------- reads (public by design: the id is the capability) ----------
    if (req.method === 'GET' && path.startsWith('/api/gift/')) {
      const id = decodeURIComponent(path.slice('/api/gift/'.length));
      if (!GIFT_ID_RE.test(id)) return fail(400, 'bad_id', h);
      const v = await env.GIFTS.get('g:' + id);
      if (!v) return fail(404, 'not_found', h);
      return new Response(v, { headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }, h) });
    }
    if (req.method === 'GET' && path.startsWith('/img/')) {
      const id = decodeURIComponent(path.slice('/img/'.length));
      if (!GIFT_ID_RE.test(id)) return fail(400, 'bad_id', h);
      const o = await env.IMAGES.get(id);
      if (!o) return fail(404, 'not_found', h);
      return new Response(o.body, { headers: Object.assign({
        'Content-Type': (o.httpMetadata && o.httpMetadata.contentType) || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      }, h) });
    }

    // ---------- writes (fail closed) ----------
    const isWrite = (req.method === 'POST' && (path === '/api/session' || path === '/api/gift')) ||
                    (req.method === 'PUT' && path === '/api/img');
    if (!isWrite) return fail(404, 'not_found', h);
    if (!env.TURNSTILE_SECRET || !env.SESSION_SECRET) return fail(503, 'not_configured', h);

    if (path === '/api/session') {
      if (await rateLimited(req, env, 'session')) return fail(429, 'rate_limited', h);
      let body; try { body = await req.json(); } catch (e) { return fail(400, 'bad_json', h); }
      if (!body || typeof body.turnstile !== 'string' || !body.turnstile) return fail(403, 'challenge_required', h);
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: body.turnstile,
                                    remoteip: req.headers.get('CF-Connecting-IP') || '' })
      });
      const verdict = await r.json().catch(() => ({}));
      if (!verdict.success) return fail(403, 'challenge_failed', h);
      const exp = String(Math.floor(Date.now() / 1000) + SESSION_TTL_S);
      return json({ session: exp + '.' + await hmac(env.SESSION_SECRET, exp), exp: Number(exp) }, 200, h);
    }

    if (!(await sessionValid(req, env))) return fail(401, 'session_required', h);

    if (path === '/api/gift') {
      if (await rateLimited(req, env, 'gift')) return fail(429, 'rate_limited', h);
      const text = await req.text();
      if (new TextEncoder().encode(text).length > MAX_GIFT_BYTES) return fail(413, 'too_large', h);
      let gift; try { gift = JSON.parse(text); } catch (e) { return fail(400, 'bad_json', h); }
      const why = validateGift(gift);
      if (why) return fail(400, 'invalid_gift', h);
      for (let attempt = 0; attempt < 5; attempt++) {
        const id = newId(GIFT_ID_LEN);
        if (await env.GIFTS.get('g:' + id)) continue; // collision: pick another
        await env.GIFTS.put('g:' + id, JSON.stringify(gift), { expirationTtl: GIFT_TTL_S });
        return json({ id }, 201, h);
      }
      return fail(500, 'id_collision', h);
    }

    if (path === '/api/img') {
      if (await rateLimited(req, env, 'img')) return fail(429, 'rate_limited', h);
      const len = Number(req.headers.get('Content-Length'));
      if (len && len > MAX_IMG_BYTES) return fail(413, 'too_large', h);
      const buf = new Uint8Array(await req.arrayBuffer());
      if (buf.length === 0) return fail(400, 'empty', h);
      if (buf.length > MAX_IMG_BYTES) return fail(413, 'too_large', h);
      const type = sniffImage(buf); // trust the bytes, not the header
      if (!type) return fail(415, 'unsupported_image', h);
      const id = newId(IMG_ID_LEN);
      await env.IMAGES.put(id, buf, { httpMetadata: { contentType: type } });
      return json({ id }, 201, h);
    }
    return fail(404, 'not_found', h);
  }
};
