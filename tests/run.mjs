// Regression tests for the compact-share-link system.
// Run:  node tests/run.mjs        (Node >= 20, no dependencies)
// Exercises the REAL js/share.js and the REAL worker/worker.js together, with
// in-memory KV/R2 standing in for Cloudflare. No network is used.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'https://elhendawy-1.github.io/Surprise-V2/';
const API = 'https://surprise-v2-api.example.workers.dev';
const ORIGIN = 'https://elhendawy-1.github.io';

let pass = 0, failN = 0;
const results = [];
function ok(cond, name, extra) {
  if (cond) { pass++; results.push(['PASS', name, extra || '']); }
  else { failN++; results.push(['FAIL', name, extra || '']); }
}
const eq = (a, b, name, extra) => ok(JSON.stringify(a) === JSON.stringify(b), name, extra);

// ---------- load modules ----------
function loadShare(file) {
  // each call = brand-new JS realm = "fresh browser session" (no shared state)
  const ctx = vm.createContext({});
  Object.assign(ctx, {
    window: ctx, location: { href: PAGE }, console, atob, btoa, TextEncoder, TextDecoder, URL,
    AbortController, setTimeout, clearTimeout
  });
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  return ctx.Share;
}
const { default: worker } = await import(pathToFileURL(path.join(ROOT, 'worker/worker.js')).href);

// ---------- in-memory Cloudflare ----------
function makeEnv(over) {
  const kv = new Map(), r2 = new Map();
  return Object.assign({
    ALLOWED_ORIGIN: ORIGIN, TURNSTILE_SECRET: 's', SESSION_SECRET: 'x'.repeat(40),
    GIFTS: { async get(k) { return kv.has(k) ? kv.get(k) : null; }, async put(k, v) { kv.set(k, v); } },
    IMAGES: {
      async put(k, v, o) { r2.set(k, { bytes: Buffer.from(v), httpMetadata: o && o.httpMetadata }); },
      async get(k) { const e = r2.get(k); return e ? { body: e.bytes, httpMetadata: e.httpMetadata } : null; }
    },
    _kv: kv, _r2: r2
  }, over || {});
}

// Turnstile siteverify is the only outbound call the Worker makes: stub it.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://challenges.cloudflare.com/')) {
    const tok = String(opts.body.get ? opts.body.get('response') : '');
    return new Response(JSON.stringify({ success: tok === 'good-token' }), { headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error('unexpected network call: ' + url);
};

// ---------- a "device": Share instance wired to the worker ----------
function device(env, opts) {
  opts = opts || {};
  const S = loadShare(path.join(ROOT, 'js/share.js'));
  S.config.apiBase = API;
  S.config.turnstileSiteKey = 'site';
  S.getTurnstileToken = async () => 'good-token';
  S.calls = [];
  S.fetchImpl = async (url, o) => {
    S.calls.push((o && o.method || 'GET') + ' ' + url.replace(API, ''));
    if (opts.networkDown) throw new TypeError('network down');
    const u = new URL(url);
    if (opts.failPath && u.pathname.startsWith(opts.failPath)) {
      if (opts.failMode === 'throw') throw new TypeError('network down');
      return new Response('boom', { status: opts.failStatus || 500 });
    }
    const headers = new Headers(o && o.headers || {});
    headers.set('Origin', ORIGIN);
    headers.set('CF-Connecting-IP', opts.ip || '203.0.113.7');
    let body = o && o.body;
    if (body && typeof body.arrayBuffer === 'function') body = Buffer.from(await body.arrayBuffer());
    return worker.fetch(new Request(url, { method: o.method, headers, body }), env);
  };
  return S;
}

// ---------- fixtures ----------
const jpeg = (mb) => {
  const b = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1]), crypto.randomBytes(Math.floor(mb * 1048576))]);
  return new File([b], 'photo.jpg', { type: 'image/jpeg' });
};
const arabic = 'كل عام وأنت بخير يا أغلى الناس، أتمنى لك عامًا مليئًا بالفرح والصحة والسعادة. '.repeat(250);
const english = 'Happy birthday! Wishing you a year full of joy, health and every good thing you deserve. '.repeat(330);
const emoji = '🎂🎉💖 «Love» & <care> "quotes" \'apos\' \\ / % # ? = + ؟ ✨ 日本語 ñ é\n\ttab';
const base = (over) => Object.assign({
  relationship: 'mom', lang: 'en', customRelationship: '', occasion: 'birthday', name: 'Layla',
  fields: { dob: '1990-05-17' }, message: 'Hi', theme: 'warm', music: true, musicChoice: 'assets/music/song.mp3',
  photoUrls: [], photoTexts: []
}, over);

// What the browser does at preview time vs share time: previews may use
// local data: URLs; the saved record must never contain them.
async function share(S, gift, files) {
  const g = JSON.parse(JSON.stringify(gift));
  for (const f of (files || [])) { g.photoUrls.push(await S.uploadImage(f)); g.photoTexts.push(g.photoTexts[g.photoUrls.length - 1] || ''); }
  const id = await S.saveGift(g);
  return { id, url: S.buildShareUrl(id), gift: g };
}
async function open(S, url) {
  const parsed = S.parseHash(url.split('#')[1]);
  if (parsed.type !== 'id') return { parsed };
  return { parsed, data: S.resolveGift(await S.loadGift(parsed.id)) };
}
const stripPhotos = (g) => { const c = Object.assign({}, g); delete c.photoUrls; delete c.photoTexts; return c; };

// Legacy "before" sizes, built with the ORIGINAL share.js encoder (tests/fixtures/share.legacy.js = unmodified original).
const Orig = loadShare(path.join(ROOT, 'tests/fixtures/share.legacy.js'));
const fakeThumb = (chars) => 'data:image/jpeg;base64,' + 'A'.repeat(chars);
const THUMB = 45000; // representative size of one packed 512px thumbnail (modelled, not measured)

const sizes = [];
function record(name, S, gift, url, legacyGift) {
  const st = S.urlStats(gift, url, Orig.generateFullUrl(legacyGift || gift));
  sizes.push({ name, before: st.urlCharsBefore, after: st.urlChars, bytes: st.urlBytes, embedded: st.embeddedImageChars, payload: st.payloadBytes });
  return st;
}

// =============== 1. no photos ===============
{
  const env = makeEnv(), A = device(env);
  const { id, url, gift } = await share(A, base({ message: 'Short message' }));
  const { data } = await open(A, url);
  eq(data, gift, '1 no photos: full reconstruction');
  const st = record('no photos', A, gift, url);
  ok(st.urlChars < 200 && st.embeddedImageChars === 0, '1 no photos: URL < 200 chars, no image data', st.urlChars + ' chars');
  ok(/^[A-Za-z0-9]{10}$/.test(id), '1 id format (10 chars from 56-symbol alphabet)');
}
// =============== 2. one photo / 3. several hi-res / 10. uploaded device images ===============
{
  const env = makeEnv(), A = device(env);
  const g1 = base({ photoTexts: ['first'] });
  const r1 = await share(A, g1, [jpeg(1)]);
  const o1 = await open(A, r1.url);
  eq(o1.data.photoTexts, ['first'], '2 one photo: caption kept');
  ok(o1.data.photoUrls.length === 1 && o1.data.photoUrls[0].startsWith(API + '/img/'), '2 one photo: resolves to Worker image URL');
  record('1 photo', A, r1.gift, r1.url, base({ photoUrls: [fakeThumb(THUMB)], photoTexts: ['first'] }));

  const files = [jpeg(6), jpeg(7), jpeg(5), jpeg(8)];
  const orig = files.map(f => f);
  const r4 = await share(A, base({ message: english, photoTexts: ['a', 'b', 'c', 'd'] }), files);
  const o4 = await open(A, r4.url);
  ok(o4.data.photoUrls.length === 4, '3 four hi-res photos (5-8 MB each): all present');
  const st = record('4 hi-res photos + long msg', A, r4.gift, r4.url, base({ message: english, photoUrls: [1, 2, 3, 4].map(() => fakeThumb(THUMB)), photoTexts: ['a', 'b', 'c', 'd'] }));
  ok(st.urlChars < 200 && st.embeddedImageChars === 0, '3 hi-res: URL < 200 chars, no image data', st.urlChars + ' chars');
  // original quality: stored bytes identical to the uploaded file bytes
  let identical = true;
  for (let i = 0; i < 4; i++) {
    const id = r4.gift.photoUrls[i].slice(3);
    const stored = env._r2.get(id).bytes;
    const src = Buffer.from(await orig[i].arrayBuffer());
    if (!stored.equals(src)) identical = false;
  }
  ok(identical, '3/10 original bytes preserved exactly (no re-compression)');
  ok(!JSON.stringify([...env._kv.values()]).includes('data:image'), '10 gift record contains no data: URLs');
  // image fetch via worker
  const img = await worker.fetch(new Request(o4.data.photoUrls[0], { headers: { Origin: ORIGIN } }), env);
  ok(img.status === 200 && img.headers.get('Content-Type') === 'image/jpeg' && /immutable/.test(img.headers.get('Cache-Control')), '3 image served with type + immutable cache');
}
// =============== 4/5/6/7/8 text content ===============
{
  const env = makeEnv(), A = device(env);
  const cases = [
    ['4 long Arabic', base({ lang: 'ar', message: arabic, name: 'ليلى' })],
    ['5 long English', base({ message: english })],
    ['6 emoji/special', base({ message: emoji, name: emoji.slice(0, 12), photoTexts: [emoji] , photoUrls: ['https://example.com/a.jpg?x=1&y=2']})],
    ['7 many captions', base({ photoUrls: Array.from({ length: 12 }, (_, i) => 'https://example.com/p' + i + '.jpg'), photoTexts: Array.from({ length: 12 }, (_, i) => 'Caption ' + i + ' ' + emoji) })],
    ['8a birthday date', base({ occasion: 'birthday', fields: { dob: '1988-02-29' } })],
    ['8b anniversary date', base({ occasion: 'anniversary', relationship: 'wife', fields: { date: '2015-06-01', years: 11 } })]
  ];
  for (const [name, g] of cases) {
    const r = await share(A, g);
    const o = await open(A, r.url);
    eq(o.data, g, name + ': exact round-trip');
    const st = A.urlStats(g, r.url);
    ok(st.urlChars < 200, name + ': URL < 200 chars', st.urlChars + ' chars / ' + st.payloadBytes + ' B payload');
    record(name, A, g, r.url);
  }
}
// =============== 9. Google Drive images ===============
{
  const env = makeEnv(), A = device(env);
  const pasted = A.normalizeImageUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing');
  const g = base({ photoUrls: [pasted, A.normalizeImageUrl('https://drive.google.com/open?id=0Zz9Yy8Xx7Ww6Vv5Uu4Tt')], photoTexts: ['d1', 'd2'] });
  const r = await share(A, g);
  const stored = JSON.parse(env._kv.get('g:' + r.id));
  eq(stored.photoUrls, ['drive:1AbCdEfGhIjKlMnOpQrStUv', 'drive:0Zz9Yy8Xx7Ww6Vv5Uu4Tt'], '9 Drive links stored as compact drive: refs');
  const o = await open(A, r.url);
  ok(o.data.photoUrls[0] === 'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOpQrStUv&sz=w2000', '9 Drive ref resolves to a direct thumbnail URL');
  ok(A.urlStats(g, r.url).urlChars < 200, '9 URL < 200 chars');
  // private / invalid files: the existing live check in the creator UI flags
  // those; here we make sure invalid inputs can never reach storage.
  let code = ''; try { await A.saveGift(base({ photoUrls: ['drive:short'] })); } catch (e) { code = e.code; }
  eq(code, 'INVALID_PHOTO', '9 malformed drive ref rejected client-side');
}
// =============== 11. failed image upload ===============
{
  const env = makeEnv();
  for (const [label, o] of [['HTTP 500', { failPath: '/api/img', failStatus: 500 }], ['network error', { failPath: '/api/img', failMode: 'throw' }], ['HTTP 415 (bad type)', {}]]) {
    const A = device(env, o);
    let err = null;
    try { await A.uploadImage(label.startsWith('HTTP 415') ? new File([Buffer.from('not an image at all, plain text')], 'x.jpg', { type: 'image/jpeg' }) : jpeg(0.1)); } catch (e) { err = e; }
    ok(err && err.code === 'UPLOAD_FAILED', '11 failed upload (' + label + ') -> UPLOAD_FAILED with message', err && err.message);
    if (o.failStatus === 500) ok(A.calls.filter(c => c.startsWith('PUT')).length === 2, '11 5xx retried exactly once');
  }
  const A = device(env);
  for (const f of [new File([Buffer.from([1, 2, 3])], 'a.heic', { type: 'image/heic' }), new File([Buffer.alloc(16 * 1048576)], 'big.jpg', { type: 'image/jpeg' })]) {
    let e2 = null; try { await A.uploadImage(f); } catch (e) { e2 = e; }
    ok(e2 && e2.code === 'UPLOAD_FAILED', '11 rejected locally: ' + f.type + ' / ' + f.size + ' B', e2 && e2.message);
  }
  ok(env._kv.size === 0 || [...env._kv.keys()].every(k => k.startsWith('rl:')), '11 failed uploads created no gift record');
}
// =============== 12. failed storage request ===============
{
  const env = makeEnv();
  for (const [label, o] of [['HTTP 500', { failPath: '/api/gift', failStatus: 500 }], ['network down', { failPath: '/api/gift', failMode: 'throw' }], ['everything down', { networkDown: true }]]) {
    const A = device(env, o);
    let err = null; try { await A.saveGift(base()); } catch (e) { err = e; }
    ok(err && (err.code === 'STORAGE_FAILED' || err.code === 'SESSION_FAILED'), '12 failed storage (' + label + ') -> clear error code', err && err.code);
  }
  // reader side: storage unreachable while opening
  const A = device(env, { networkDown: true });
  let err = null; try { await A.loadGift('Ab12Cd34Ef'); } catch (e) { err = e; }
  eq(err && err.code, 'STORAGE_FAILED', '12 opening while storage unreachable -> STORAGE_FAILED (not "not found")');
  // unconfigured client
  const U = device(env); U.config.apiBase = 'https://surprise-v2-api.YOUR-SUBDOMAIN.workers.dev';
  let e3 = null; try { await U.saveGift(base()); } catch (e) { e3 = e; }
  eq(e3 && e3.code, 'NOT_CONFIGURED', '12 unconfigured client -> NOT_CONFIGURED (never falls back to a fat URL)');
}
// =============== 13. URL shortening ===============
{
  const env = makeEnv(), A = device(env);
  const before = A.calls.length;
  const r = await share(A, base({ message: english }));
  ok(!A.calls.some(c => /tinyurl|is\.gd|cleanuri/.test(c)), '13 no third-party shortener is called');
  ok(typeof A.shortenUrl === 'undefined', '13 shortener code removed (first-party URL is already short)');
  ok(r.url.startsWith(PAGE + '#g='), '13 final URL is first-party', r.url);
}
// =============== 14/15. fresh session, other device ===============
{
  const env = makeEnv(), A = device(env, { ip: '198.51.100.1' });
  const files = [jpeg(2), jpeg(2)];
  const r = await share(A, base({ message: arabic, lang: 'ar', photoTexts: ['x', 'y'] }), files);
  const B = device(env, { ip: '192.0.2.99' });        // new instance, new IP, no shared JS state
  const o = await open(B, r.url);
  eq(stripPhotos(o.data), stripPhotos(r.gift), '14/15 fresh instance (different IP) reconstructs all settings');
  ok(o.data.photoUrls.length === 2, '14/15 photos present');
  const imgs = await Promise.all(o.data.photoUrls.map(u => worker.fetch(new Request(u, { headers: { 'CF-Connecting-IP': '192.0.2.99' } }), env)));
  ok(imgs.every(i => i.status === 200), '14/15 images load with no creator-side state');
  ok(B._session === null, '14/15 reader never needs a write session');
}
// =============== 16. legacy links ===============
{
  const legacyGift = base({ message: 'old gift ' + emoji, photoUrls: ['https://i.imgur.com/a.jpg', fakeThumb(200)], photoTexts: ['p', 'q'] });
  const url = Orig.generateFullUrl(legacyGift);
  const A = device(makeEnv());
  const parsed = A.parseHash(url.split('#')[1]);
  eq(parsed.type, 'legacy', '16 legacy URL recognised');
  const data = A.resolveGift(parsed.data);
  eq(data, legacyGift, '16 legacy gift reconstructs exactly (https + embedded thumbnail photos)');
  const st = A.urlStats(legacyGift, url);
  ok(st.embeddedImageChars > 0, '16 diagnostics detect embedded image data in a legacy URL', st.embeddedImageChars + ' chars');
  const evil = Orig.generateFullUrl(base({ photoUrls: ['javascript:alert(1)', 'https://x.com/a" onerror="x'], photoTexts: ['a', 'b'] }));
  eq(A.resolveGift(A.parseHash(evil.split('#')[1]).data).photoUrls, [], '16 hostile legacy photo URLs are still stripped');
}
// =============== 17. malformed / unknown ids ===============
{
  const env = makeEnv(), A = device(env);
  for (const h of ['g=', 'g=ab', 'g=../../etc', 'g=<script>', 'g=' + 'A'.repeat(40)]) eq(A.parseHash(h).type, 'badid', '17 parseHash rejects ' + JSON.stringify(h.slice(0, 20)));
  eq(A.parseHash('%%%not-base64').type, 'broken', '17 garbage hash -> broken');
  eq(A.parseHash('').type, 'none', '17 empty hash -> none');
  let e = null; try { await A.loadGift('Zz9Zz9Zz9Z'); } catch (x) { e = x; }
  eq(e && e.code, 'NOT_FOUND', '17 unknown (well-formed) id -> NOT_FOUND');
  e = null; try { await A.loadGift('bad id!'); } catch (x) { e = x; }
  eq(e && e.code, 'BAD_ID', '17 malformed id -> BAD_ID (no request sent)');
  const r = await worker.fetch(new Request(API + '/api/gift/bad!id'), env);
  eq(r.status, 400, '17 worker rejects malformed id with 400');
}
// =============== 18. QR ===============
{
  const env = makeEnv(), A = device(env);
  const r = await share(A, base({ message: english }), [jpeg(1), jpeg(1)]);
  const qr = A.getQrCodeUrl(r.url);
  const data = new URL(qr).searchParams.get('data');
  eq(data, r.url, '18 QR request encodes exactly the final share URL');
  fs.writeFileSync(path.join(ROOT, 'tests', '.qr-urls.json'), JSON.stringify({ short: r.url, legacy: Orig.generateFullUrl(base({ message: english, photoUrls: [fakeThumb(THUMB)], photoTexts: [''] })).slice(0, 2900) }));
}
// =============== Worker security ===============
{
  const env = makeEnv(), A = device(env);
  const call = (method, p, o) => worker.fetch(new Request(API + p, Object.assign({ method, headers: { Origin: ORIGIN, 'CF-Connecting-IP': '1.1.1.1' } }, o)), env);
  eq((await call('POST', '/api/gift', { body: '{}' })).status, 401, 'SEC write without session -> 401');
  eq((await call('PUT', '/api/img', { body: Buffer.from([0xFF, 0xD8, 0xFF, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) })).status, 401, 'SEC image write without session -> 401');
  const noSecrets = makeEnv({ TURNSTILE_SECRET: '', SESSION_SECRET: '' });
  eq((await worker.fetch(new Request(API + '/api/gift', { method: 'POST', body: '{}' }), noSecrets)).status, 503, 'SEC fails closed (503) when secrets are missing');
  eq((await call('POST', '/api/session', { body: JSON.stringify({ turnstile: 'bad' }) })).status, 403, 'SEC bad Turnstile token -> 403');
  eq((await call('POST', '/api/session', { body: '{}' })).status, 403, 'SEC missing Turnstile token -> 403');
  const sess = (await (await call('POST', '/api/session', { body: JSON.stringify({ turnstile: 'good-token' }) })).json()).session;
  const H = (extra) => Object.assign({ Origin: ORIGIN, 'CF-Connecting-IP': '1.1.1.2', 'X-Session': sess, 'Content-Type': 'application/json' }, extra);
  const post = (body, h) => worker.fetch(new Request(API + '/api/gift', { method: 'POST', headers: h || H(), body }), env);
  eq((await post(JSON.stringify({ photoUrls: ['data:image/jpeg;base64,AAAA'] }))).status, 400, 'SEC data: image in gift -> 400');
  eq((await post(JSON.stringify({ photoUrls: ['blob:https://x/1'] }))).status, 400, 'SEC blob: URL in gift -> 400');
  eq((await post(JSON.stringify({ photoUrls: ['http://insecure.example/a.jpg'] }))).status, 400, 'SEC non-https photo URL -> 400');
  eq((await post(JSON.stringify({ message: 'x'.repeat(70000) }))).status, 413, 'SEC oversize gift -> 413');
  eq((await post('not json')).status, 400, 'SEC invalid JSON -> 400');
  eq((await post(JSON.stringify([1, 2]))).status, 400, 'SEC array instead of object -> 400');
  eq((await post(JSON.stringify({ photoUrls: Array(101).fill('r2:abcdefgh12') }))).status, 400, 'SEC >100 photos -> 400');
  const tampered = sess.split('.')[0] + '.' + '0'.repeat(64);
  eq((await post('{}', H({ 'X-Session': tampered }))).status, 401, 'SEC tampered session signature -> 401');
  const expired = '1000000000.' + sess.split('.')[1];
  eq((await post('{}', H({ 'X-Session': expired }))).status, 401, 'SEC expired/forged expiry -> 401');
  eq((await worker.fetch(new Request(API + '/api/img', { method: 'PUT', headers: H({ 'Content-Type': 'image/jpeg' }), body: Buffer.from('<html>script</html> padding padding') }), env)).status, 415, 'SEC non-image bytes with image header -> 415');
  const pre = await worker.fetch(new Request(API + '/api/gift', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env);
  ok(!pre.headers.get('Access-Control-Allow-Origin'), 'SEC CORS: foreign origin not allowed');
  const pre2 = await worker.fetch(new Request(API + '/api/gift', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env);
  eq(pre2.headers.get('Access-Control-Allow-Origin'), ORIGIN, 'SEC CORS: Pages origin allowed');
  let last = 0; for (let i = 0; i < 25; i++) last = (await post(JSON.stringify({ n: i }), H({ 'CF-Connecting-IP': '9.9.9.9' }))).status;
  eq(last, 429, 'SEC rate limit kicks in (429) after 20 gifts/min/IP');
}
// =============== Diagnostics ===============
{
  const A = device(makeEnv());
  const g = base({ message: emoji });
  const st = A.urlStats(g, PAGE + '#g=Ab12Cd34Ef');
  ok(st.payloadBytes === Buffer.byteLength(JSON.stringify(g)) && st.urlChars === (PAGE + '#g=Ab12Cd34Ef').length && st.urlBytes === st.urlChars, 'DIAG byte/char counts correct');
  ok(!JSON.stringify(st).includes('Layla') && !JSON.stringify(st).includes('🎂'), 'DIAG output contains no gift content');
}

// ---------- report ----------
for (const [s, n, x] of results) console.log((s === 'PASS' ? '  ok   ' : '  FAIL ') + n + (x ? '   [' + x + ']' : ''));
console.log('\nBefore/after URL length (chars). "before" for photo gifts models ' + THUMB + '-char embedded thumbnails per photo:');
for (const r of sizes) console.log('  ' + r.name.padEnd(30) + String(r.before).padStart(9) + ' -> ' + String(r.after).padStart(4) + '   (payload ' + r.payload + ' B, embedded image chars ' + r.embedded + ')');
console.log('\n' + pass + ' passed, ' + failN + ' failed');
globalThis.fetch = realFetch;
process.exit(failN ? 1 : 0);
