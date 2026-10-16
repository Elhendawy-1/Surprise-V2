/* ===== Gift Module (deep) =====
 * One small Interface over the whole creator -> share -> recipient slice.
 * Callers learn 3 methods + GiftDraft; everything else sits behind the seam.
 *
 *   Gift.create(draft)            -> { record, warnings }   (pure, no I/O)
 *   Gift.share(record, ports?)    -> Promise<{ url, qrUrl, mode }> (I/O)
 *   Gift.open(ref, ports?)        -> Promise<{ ok, data|reason }> (never rejects)
 *   Gift.registerOccasion(id,def) -> registry (only extension point)
 *
 * Ports (injected, mocked in tests):
 *   store: { save(record):id, load(id):record }  (remote-but-owned Worker)
 *   media: { upload(file):ref, thumbnail(file):dataUrl } (device/raster)
 * Gone / hypothetical (no port): QR render (pure string), song catalogue,
 * shortener (deleted). See DESIGN hybrid: 1's interface + 4's ports +
 * 3's defaults + 2's registry for occasions only.
 */

(function (root) {
  'use strict';

  function GiftError(code, message, extra) {
    var e = new Error(message || code);
    e.name = 'GiftError';
    e.code = code;
    if (extra) Object.assign(e, extra);
    return e;
  }

  var OCCASIONS = {
    birthday: { icon: '🎂', galleryHead: null, closing: '❤ ❤ ❤', people: ['mom', 'dad', 'sister', 'brother', 'aunt', 'friend', 'husband', 'wife', 'boyfriend', 'girlfriend', 'other'] },
    valentine: { icon: '💘', galleryHead: 'galValentine', closing: '💘 💖 💘', people: ['boyfriend', 'girlfriend', 'husband', 'wife', 'other'] },
    anniversary: { icon: '🥂', galleryHead: 'galAnniversary', closing: '🥂 ✨ 🥂', people: ['boyfriend', 'girlfriend', 'husband', 'wife', 'other'] },
    thankYou: { icon: '🙏', galleryHead: 'galThanks', closing: '🙏 💐 🙏', people: ['mom', 'dad', 'sister', 'brother', 'aunt', 'friend', 'husband', 'wife', 'boyfriend', 'girlfriend', 'other'] },
    justBecause: { icon: '💌', galleryHead: 'galJust', closing: '💌 ✨ 💌', people: ['mom', 'dad', 'sister', 'brother', 'aunt', 'friend', 'husband', 'wife', 'boyfriend', 'girlfriend', 'other'] }
  };

  var THEMES = ['classic', 'soft', 'deep', 'dark', 'elegant', 'warm'];
  var MAX_PHOTOS = 100;

  // QR / link-length gates (single source; App previously duplicated these
  // blocks in generateLink + generateLegacyLink).
  var QR_MAX_CHARS = 2000;
  var TRUNCATE_WARN_CHARS = 8000;

  function safeStr(v) { return v == null ? '' : String(v); }

  function getShare() { return (root && root.Share) || (typeof Share !== 'undefined' ? Share : null); }
  function getGenerator() { return (root && root.Generator) || (typeof Generator !== 'undefined' ? Generator : null); }

  // Normalize a caller draft to a full spec. Only `to` is required.
  // Never throws except INVALID_DRAFT for empty `to`. Unknown
  // occasion/theme/lang fall back to defaults, never reject.
  function normalizeDraft(draft) {
    var d = draft || {};
    var to = safeStr(d.to != null ? d.to : d.name).trim();
    if (!to) throw GiftError('INVALID_DRAFT', 'Recipient name is required');
    var occasion = OCCASIONS[d.occasion] ? d.occasion : 'birthday';
    var theme = THEMES.indexOf(d.theme) !== -1 ? d.theme : 'classic';
    var lang = d.lang === 'ar' ? 'ar' : 'en';
    var relationship = safeStr(d.relationship).trim() || 'mom';
    var photos = Array.isArray(d.photos) ? d.photos.slice(0, MAX_PHOTOS) : [];
    var warnings = [];
    if (Array.isArray(d.photos) && d.photos.length > MAX_PHOTOS) {
      warnings.push({ slot: -1, reason: 'too-many-photos' });
    }
    var message = d.message && typeof d.message === 'object' ? d.message : { mode: 'auto' };
    if (message.mode !== 'custom') message = { mode: 'auto' };
    else message = { mode: 'custom', text: safeStr(message.text) };
    return {
      to: to,
      occasion: occasion,
      relationship: relationship,
      customRelationship: safeStr(d.customRelationship),
      lang: lang,
      fields: (d.fields && typeof d.fields === 'object' && !Array.isArray(d.fields)) ? d.fields : {},
      message: message,
      theme: theme,
      music: d.music === false ? false : true,
      musicChoice: safeStr(d.musicChoice || d.songChoice),
      photos: photos,
      warnings: warnings
    };
  }

  // Build the stored gift record from a normalized spec. Pure: message text
  // comes from Generator (in-process, merged behind the seam); photo entries
  // are normalized to refs/links via Share when present, otherwise kept as
  // https: strings. Files are left as { file, caption } for share() to upload.
  function create(draft, ports) {
    var spec = normalizeDraft(draft);
    var G = (ports && ports.generator) || getGenerator();
    var S = (ports && ports.share) || getShare();
    var name = spec.to;
    var messageText = '';
    if (spec.message.mode === 'custom') {
      messageText = spec.message.text.trim();
      if (!messageText) throw GiftError('INVALID_DRAFT', 'Custom message is empty');
    } else if (G && G.generateMessage) {
      messageText = G.generateMessage({
        relationship: spec.relationship,
        occasion: spec.occasion,
        lang: spec.lang,
        name: name,
        fields: spec.fields
      });
    } else {
      messageText = spec.lang === 'ar' ? ('عيد ميلاد سعيد يا ' + name + '!') : ('Happy Birthday, ' + name + '!');
    }
    var photoUrls = [];
    var photoTexts = [];
    var warnings = spec.warnings.slice();
    spec.photos.forEach(function (p, i) {
      if (p && typeof p === 'object' && !(p instanceof String) && (p.file || p.url != null || p.caption != null)) {
        var caption = safeStr(p.caption);
        if (p.file) { photoUrls.push({ file: p.file, caption: caption }); photoTexts.push(caption); return; }
        var u = safeStr(p.url);
        var norm = S && S.normalizeImageUrl ? S.normalizeImageUrl(u) : u.trim();
        if (norm && /^(https?:\/\/|r2:|drive:)/i.test(norm)) { photoUrls.push(norm); photoTexts.push(caption); }
        else warnings.push({ slot: i + 1, reason: 'invalid-photo-url' });
        return;
      }
      var s = safeStr(p);
      if (!s) return;
      var n = S && S.normalizeImageUrl ? S.normalizeImageUrl(s) : s.trim();
      if (n && /^(https?:\/\/|r2:|drive:)/i.test(n)) { photoUrls.push(n); photoTexts.push(''); }
      else warnings.push({ slot: i + 1, reason: 'invalid-photo-url' });
    });
    var record = {
      relationship: spec.relationship,
      customRelationship: spec.customRelationship,
      lang: spec.lang,
      occasion: spec.occasion,
      name: name,
      fields: spec.fields,
      message: messageText,
      theme: spec.theme,
      music: spec.music,
      musicChoice: spec.musicChoice,
      photoUrls: photoUrls,
      photoTexts: photoTexts
    };
    return { spec: spec, record: record, warnings: warnings };
  }

  // Classify a share locator without throwing: full URL, "#g=id", "g=id",
  // bare id, or legacy base64 payload. Delegates to Share.parseHash when
  // present so old links keep working; never rejects.
  function parseRef(ref) {
    try {
      var h = safeStr(ref).trim();
      if (!h) return { type: 'none' };
      if (h.indexOf('http://') === 0 || h.indexOf('https://') === 0) {
        var hashIdx = h.indexOf('#');
        h = hashIdx === -1 ? '' : h.slice(hashIdx + 1);
        if (!h) return { type: 'none' };
      }
      if (h.charAt(0) === '#') h = h.slice(1);
      var S = getShare();
      if (S && S.parseHash) return S.parseHash(h);
      if (h.indexOf('g=') === 0) {
        var id = h.slice(2);
        return /^[A-Za-z0-9]{6,32}$/.test(id) ? { type: 'id', id: id } : { type: 'badid' };
      }
      return { type: 'broken' };
    } catch (e) { return { type: 'broken' }; }
  }

  // Open a gift by locator. Never rejects: malformed -> { ok:false,
  // reason:'truncated' }, unknown id -> 'unknown-id', unreachable ->
  // 'unreachable', unconfigured backend -> 'not-configured'.
  async function open(ref, ports) {
    var parsed = parseRef(ref);
    if (parsed.type === 'legacy') {
      try {
        var S0 = (ports && ports.share) || getShare();
        var data = S0 && S0.resolveGift ? S0.resolveGift(parsed.data) : parsed.data;
        return { ok: true, data: data, mode: 'legacy' };
      } catch (e) { return { ok: false, reason: 'truncated' }; }
    }
    if (parsed.type === 'id') {
      var load = ports && ports.load;
      var S1 = (ports && ports.share) || getShare();
      try {
        var rec = load ? await load(parsed.id) : await S1.loadGift(parsed.id);
        var out = S1 && S1.resolveGift ? S1.resolveGift(rec) : rec;
        return { ok: true, data: out, mode: 'short', id: parsed.id };
      } catch (e) {
        var code = e && e.code;
        if (code === 'NOT_FOUND' || code === 'BAD_ID') return { ok: false, reason: 'unknown-id', code: code };
        if (code === 'NOT_CONFIGURED') return { ok: false, reason: 'not-configured', code: code };
        return { ok: false, reason: 'unreachable', code: code || 'STORAGE_FAILED' };
      }
    }
    if (parsed.type === 'badid' || parsed.type === 'broken') return { ok: false, reason: 'truncated' };
    return { ok: false, reason: 'truncated' };
  }

  // Persist a record through injected ports (tests) or Share (browser).
  // Files inside record.photoUrls ({ file, caption }) are uploaded first.
  async function share(record, ports) {
    var S = (ports && ports.share) || getShare();
    var save = (ports && ports.save) || (S && S.saveGift && S.saveGift.bind(S));
    var upload = (ports && ports.upload) || (S && S.uploadImage && S.uploadImage.bind(S));
    var buildUrl = (ports && ports.buildShareUrl) || (S && S.buildShareUrl && S.buildShareUrl.bind(S));
    if (!save) throw GiftError('NOT_CONFIGURED', 'Sharing service is not configured');
    var rec = Object.assign({}, record);
    var urls = Array.isArray(rec.photoUrls) ? rec.photoUrls.slice() : [];
    var texts = Array.isArray(rec.photoTexts) ? rec.photoTexts.slice() : [];
    var outUrls = [];
    var outTexts = [];
    for (var i = 0; i < urls.length; i++) {
      var u = urls[i];
      if (u && typeof u === 'object' && u.file) {
        if (!upload) throw GiftError('NOT_CONFIGURED', 'Upload is not configured');
        var ref = await upload(u.file);
        outUrls.push(ref);
        outTexts.push(safeStr(u.caption || texts[i] || ''));
      } else { outUrls.push(u); outTexts.push(texts[i] || ''); }
    }
    rec.photoUrls = outUrls;
    rec.photoTexts = outTexts;
    var toRecord = S && S.toRecord ? S.toRecord.bind(S) : null;
    var stored = toRecord ? toRecord(rec) : rec;
    var id = await save(stored);
    var url = buildUrl ? buildUrl(id) : ('#g=' + id);
    return { id: id, url: url, qrUrl: qrFor(url), mode: 'short', gift: rec };
  }

  // QR gate (single source of truth): huge links produce unscannable codes,
  // so callers hide the QR and ask for Copy instead.
  function qrFor(url) {
    var S = getShare();
    if (!url || url.length > QR_MAX_CHARS) return '';
    if (S && S.getQrCodeUrl) return S.getQrCodeUrl(url);
    return '';
  }

  function shareFlags(url) {
    var len = safeStr(url).length;
    return { hideQr: len > QR_MAX_CHARS, truncateWarn: len > TRUNCATE_WARN_CHARS, length: len };
  }

  // Only sanctioned extension point: new occasions (icon, gallery heading,
  // closing hearts, eligible people). No generic plugin system: one adapter
  // is a hypothetical seam.
  function registerOccasion(id, def) {
    if (!id || typeof id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(id)) {
      throw GiftError('INVALID_DRAFT', 'Bad occasion id');
    }
    if (OCCASIONS[id]) throw GiftError('INVALID_DRAFT', 'Occasion already exists: ' + id);
    var d = def || {};
    OCCASIONS[id] = {
      icon: safeStr(d.icon) || '🎁',
      galleryHead: d.galleryHead != null ? d.galleryHead : null,
      closing: safeStr(d.closing) || '❤ ❤ ❤',
      people: Array.isArray(d.people) && d.people.length ? d.people.slice() : ['other']
    };
    return OCCASIONS;
  }

  var Gift = {
    GiftError: GiftError,
    occasions: OCCASIONS,
    themes: THEMES,
    limits: { maxPhotos: MAX_PHOTOS, qrMaxChars: QR_MAX_CHARS, truncateWarnChars: TRUNCATE_WARN_CHARS },
    normalizeDraft: normalizeDraft,
    create: create,
    parseRef: parseRef,
    open: open,
    share: share,
    qrFor: qrFor,
    shareFlags: shareFlags,
    registerOccasion: registerOccasion,
    version: 1
  };

  if (root) root.Gift = Gift;
  if (typeof module !== 'undefined' && module.exports) module.exports = Gift;
})(typeof window !== 'undefined' ? window : globalThis);
