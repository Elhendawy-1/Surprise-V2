// Headless tests for the deep Gift module (js/gift.js).
// Run:  node tests/gift.roundtrip.mjs   (Node >= 20, no dependencies)
// Loads the REAL js/share.js + js/generator.js + js/gift.js in a fresh VM
// realm (browser-like globals, no DOM). No network is used.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'https://elhendawy-1.github.io/Surprise-V2/';

let pass = 0, failN = 0;
const results = [];
function ok(cond, name, extra) {
  if (cond) { pass++; results.push(['PASS', name, extra || '']); }
  else { failN++; results.push(['FAIL', name, extra || '']); }
}
const eq = (a, b, name, extra) => ok(JSON.stringify(a) === JSON.stringify(b), name, extra);

function loadRealm() {
  const ctx = vm.createContext({});
  Object.assign(ctx, {
    window: ctx, location: { href: PAGE }, console, atob, btoa,
    TextEncoder, TextDecoder, URL, AbortController, setTimeout, clearTimeout
  });
  for (const f of ['js/share.js', 'js/generator.js', 'js/gift.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

// ---------- pure create / defaults ----------
{
  const { Gift, Generator } = loadRealm();
  const { record, warnings } = Gift.create({ to: 'Mom' });
  eq([record.occasion, record.theme, record.lang, record.music], ['birthday', 'classic', 'en', true], 'defaults: birthday/classic/en/music');
  eq(record.name, 'Mom', 'defaults: name kept');
  ok(typeof record.message === 'string' && record.message.includes('Mom'), 'defaults: auto message mentions name');
  eq(warnings, [], 'defaults: no warnings');
  ok(Gift.version === 1, 'version exposed');
  // Generator is the merged in-process dep behind the seam, not a port.
  ok(record.message === Generator.generateMessage({ relationship: 'mom', occasion: 'birthday', lang: 'en', name: 'Mom', fields: {} }), 'message matches Generator directly');
}
{
  const { Gift } = loadRealm();
  let code = '';
  try { Gift.create({ to: '   ' }); } catch (e) { code = e.code; }
  eq(code, 'INVALID_DRAFT', 'empty `to` rejected (only required field)');
  let code2 = '';
  try { Gift.create({ to: 'Layla', message: { mode: 'custom', text: '  ' } }); } catch (e) { code2 = e.code; }
  eq(code2, 'INVALID_DRAFT', 'empty custom message rejected');
  const r = Gift.create({ to: 'Layla', occasion: 'nope', theme: 'nope', lang: 'xx' });
  eq([r.record.occasion, r.record.theme, r.record.lang], ['birthday', 'classic', 'en'], 'unknown occasion/theme/lang fall back, never reject');
  const many = Gift.create({ to: 'Layla', photos: Array.from({ length: 150 }, (_, i) => 'https://example.com/p' + i + '.jpg') });
  eq(many.record.photoUrls.length, 100, 'photos capped at 100');
  ok(many.warnings.some(w => w.reason === 'too-many-photos'), 'over-cap warns instead of new method');
  const bad = Gift.create({ to: 'Layla', photos: ['not a url', 'javascript:alert(1)'] });
  eq(bad.record.photoUrls.length, 0, 'unusable photo URLs dropped');
  eq(bad.warnings.length, 2, 'each bad photo warns with slot');
}
{
  const { Gift } = loadRealm();
  const d = Gift.create({ to: 'Layla', photos: ['https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing'] });
  ok(d.record.photoUrls[0].includes('drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOpQrStUv'), 'Drive share link normalized behind seam');
}

// ---------- parseRef: full URL, #g=id, bare id, legacy, garbage (never throws) ----------
{
  const { Gift, Share } = loadRealm();
  eq(Gift.parseRef('#g=Ab12Cd34Ef').type, 'id', 'parse #g=id');
  eq(Gift.parseRef('g=Ab12Cd34Ef').type, 'id', 'parse bare g=id');
  eq(Gift.parseRef(PAGE + '#g=Ab12Cd34Ef').type, 'id', 'parse full URL');
  eq(Gift.parseRef('g=ab').type, 'badid', 'parse short id -> badid');
  eq(Gift.parseRef('').type, 'none', 'parse empty -> none');
  eq(Gift.parseRef('%%%not-base64').type, 'broken', 'parse garbage -> broken');
  const legacyUrl = PAGE + '#' + Share.encodeData({ occasion: 'birthday', name: 'Old', photoUrls: [], photoTexts: [] });
  const p = Gift.parseRef(legacyUrl);
  eq(p.type, 'legacy', 'parse legacy base64 payload');
}

// ---------- QR gate + link-length flags (single source) ----------
{
  const { Gift } = loadRealm();
  const short = PAGE + '#g=Ab12Cd34Ef';
  ok(Gift.qrFor(short).includes('api.qrserver.com') && Gift.qrFor(short).includes(encodeURIComponent(short)), 'short URL gets QR string');
  eq(Gift.qrFor('https://x.example/' + 'A'.repeat(2001)), '', 'URL over 2000 chars hides QR');
  eq(Gift.shareFlags(short).hideQr, false, 'short: QR shown');
  eq(Gift.shareFlags('https://x.example/' + 'A'.repeat(2001)).hideQr, true, 'long: QR hidden');
  eq(Gift.shareFlags('https://x.example/' + 'A'.repeat(8001)).truncateWarn, true, 'very long: truncate warning');
}

// ---------- registerOccasion: only sanctioned extension point ----------
{
  const { Gift } = loadRealm();
  const before = Object.keys(Gift.occasions).length;
  Gift.registerOccasion('graduation', { icon: '🎓', galleryHead: 'galGrad', closing: '🎓 ✨ 🎓', people: ['friend', 'other'] });
  eq(Object.keys(Gift.occasions).length, before + 1, 'new occasion registered');
  eq(Gift.occasions.graduation.people, ['friend', 'other'], 'registered people kept');
  const g = Gift.create({ to: 'Sara', occasion: 'graduation', relationship: 'friend' });
  eq(g.record.occasion, 'graduation', 'registered occasion usable in create');
  let dup = '';
  try { Gift.registerOccasion('graduation', {}); } catch (e) { dup = e.code; }
  eq(dup, 'INVALID_DRAFT', 'duplicate occasion rejected');
  let bad = '';
  try { Gift.registerOccasion('9bad', {}); } catch (e) { bad = e.code; }
  eq(bad, 'INVALID_DRAFT', 'bad occasion id rejected');
}

// ---------- share -> open round-trip through injected memory ports (no network) ----------
{
  const { Gift } = loadRealm();
  const mem = new Map();
  const ports = {
    save: async (stored) => { const id = 'Ab12Cd34Ef'; mem.set(id, JSON.parse(JSON.stringify(stored))); return id; },
    load: async (id) => {
      if (!/^[A-Za-z0-9]{6,32}$/.test(id)) { const e = new Error('bad'); e.code = 'BAD_ID'; throw e; }
      if (!mem.has(id)) { const e = new Error('missing'); e.code = 'NOT_FOUND'; throw e; }
      return mem.get(id);
    },
    buildShareUrl: (id) => PAGE + '#g=' + id
  };
  const { record } = Gift.create({ to: 'Layla', relationship: 'mom', photos: ['https://example.com/a.jpg'] });
  const s = await Gift.share(record, ports);
  eq(s.mode, 'short', 'share mode short');
  ok(s.url === PAGE + '#g=Ab12Cd34Ef', 'share URL first-party');
  ok(s.qrUrl.includes('api.qrserver.com'), 'share includes QR for short URL');
  const o = await Gift.open(s.url, ports);
  eq(o.ok, true, 'open ok (never rejects on success)');
  eq(o.data.name, 'Layla', 'open reconstructs name');
  eq(o.data.photoUrls, ['https://example.com/a.jpg'], 'open reconstructs photos');
  const missing = await Gift.open(PAGE + '#g=Zz9Zz9Zz9Z', ports);
  eq([missing.ok, missing.reason], [false, 'unknown-id'], 'unknown id -> unknown-id (not throw)');
  const broken = await Gift.open('g=ab', ports);
  eq([broken.ok, broken.reason], [false, 'truncated'], 'malformed id -> truncated (not throw)');
  const { Share } = loadRealm();
  const legacyHash = Share.encodeData({ occasion: 'birthday', name: 'Old', photoUrls: [], photoTexts: [] });
  const legacy = await Gift.open(PAGE + '#' + legacyHash, ports);
  eq([legacy.ok, legacy.mode], [true, 'legacy'], 'legacy payload opens without throwing');
}

// ---------- report ----------
for (const [s, n, x] of results) console.log((s === 'PASS' ? '  ok   ' : '  FAIL ') + n + (x ? '   [' + x + ']' : ''));
console.log('\n' + pass + ' passed, ' + failN + ' failed');
process.exit(failN ? 1 : 0);
