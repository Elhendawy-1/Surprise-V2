/* ===== Share Module =====
 * Gifts are stored server-side (see worker/worker.js); the share URL only
 * carries a short id:  <page>#g=Ab12Cd34Ef
 * Legacy Base64 links (#<base64 json>) are still decoded for old gifts but
 * are never generated any more.
 */

class ShareError extends Error {
  constructor(code, message, extra) {
    super(message || code);
    this.name = 'ShareError';
    this.code = code;
    if (extra) Object.assign(this, extra);
  }
}

const Share = {
  config: {
    // Set to your deployed Worker URL (see README "Sharing service").
    apiBase: 'https://surprise-v2-api.YOUR-SUBDOMAIN.workers.dev',
    // Public Turnstile site key (safe to expose). Required by the Worker.
    turnstileSiteKey: '',
    maxImageBytes: 15 * 1024 * 1024,
    timeoutMs: 60000
  },
  fetchImpl: null, // tests inject a fetch; browsers use window.fetch
  _session: null,

  ShareError: ShareError,

  isConfigured() {
    const b = this.config.apiBase;
    return !!b && /^https?:\/\//.test(b) && b.indexOf('YOUR-SUBDOMAIN') === -1;
  },

  _api(path) { return this.config.apiBase.replace(/\/+$/, '') + path; },

  async _fetch(path, options, timeoutMs) {
    const f = this.fetchImpl || ((u, o) => fetch(u, o));
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs || this.config.timeoutMs) : null;
    try {
      return await f(this._api(path), Object.assign({}, options, controller ? { signal: controller.signal } : {}));
    } finally {
      if (timer) clearTimeout(timer);
    }
  },

  // ---- Turnstile + short-lived write session (one challenge per gift) ----
  async getTurnstileToken() {
    const siteKey = this.config.turnstileSiteKey;
    if (!siteKey) throw new ShareError('SESSION_FAILED', 'Turnstile site key is not configured');
    if (typeof document === 'undefined') throw new ShareError('SESSION_FAILED', 'No browser');
    if (!window.turnstile) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = resolve;
        s.onerror = () => reject(new ShareError('SESSION_FAILED', 'Could not load the human-check script'));
        document.head.appendChild(s);
      });
    }
    return new Promise((resolve, reject) => {
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:10000;';
      document.body.appendChild(box);
      const done = (fn, v) => { try { window.turnstile.remove(box); } catch (e) { /* ignore */ } box.remove(); fn(v); };
      const timer = setTimeout(() => done(reject, new ShareError('SESSION_FAILED', 'Human check timed out')), 60000);
      window.turnstile.render(box, {
        sitekey: siteKey,
        callback: (tok) => { clearTimeout(timer); done(resolve, tok); },
        'error-callback': () => { clearTimeout(timer); done(reject, new ShareError('SESSION_FAILED', 'Human check failed')); }
      });
    });
  },

  async getSession() {
    const now = Math.floor(Date.now() / 1000);
    if (this._session && this._session.exp - 60 > now) return this._session.session;
    if (!this.isConfigured()) throw new ShareError('NOT_CONFIGURED', 'Sharing service is not configured');
    const turnstile = await this.getTurnstileToken();
    let res;
    try {
      res = await this._fetch('/api/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstile })
      }, 20000);
    } catch (e) { throw new ShareError('SESSION_FAILED', 'Could not reach the sharing service'); }
    if (res.status === 503) throw new ShareError('NOT_CONFIGURED', 'Sharing service is not fully configured');
    if (!res.ok) throw new ShareError('SESSION_FAILED', 'Session rejected (HTTP ' + res.status + ')');
    this._session = await res.json();
    return this._session.session;
  },

  // ---- Device uploads: original bytes, stored as an r2:<id> reference ----
  async uploadImage(file) {
    if (!file) throw new ShareError('UPLOAD_FAILED', 'No file');
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type || '')) {
      throw new ShareError('UPLOAD_FAILED', 'Unsupported image type (' + (file.type || 'unknown') + '). Use JPEG, PNG, WebP or GIF.');
    }
    if (file.size > this.config.maxImageBytes) {
      throw new ShareError('UPLOAD_FAILED', 'Image is larger than ' + Math.round(this.config.maxImageBytes / 1048576) + ' MB');
    }
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const session = await this.getSession();
        const res = await this._fetch('/api/img', {
          method: 'PUT', headers: { 'Content-Type': file.type, 'X-Session': session }, body: file
        });
        if (res.status === 401) { this._session = null; throw new ShareError('UPLOAD_FAILED', 'Session expired'); }
        if (res.status === 503) throw new ShareError('NOT_CONFIGURED', 'Sharing service is not fully configured');
        if (!res.ok) {
          const retryable = res.status >= 500 || res.status === 429;
          lastErr = new ShareError('UPLOAD_FAILED', 'Upload rejected (HTTP ' + res.status + ')');
          if (!retryable) throw lastErr;
          continue;
        }
        const body = await res.json();
        if (!body || !/^[A-Za-z0-9]{8,32}$/.test(body.id || '')) throw new ShareError('UPLOAD_FAILED', 'Bad response from server');
        return 'r2:' + body.id;
      } catch (e) {
        if (e instanceof ShareError && (e.code === 'NOT_CONFIGURED' || e.code === 'SESSION_FAILED')) throw e;
        lastErr = e instanceof ShareError ? e : new ShareError('UPLOAD_FAILED', 'Network error while uploading');
        if (attempt === 1 || (e instanceof ShareError && /Unsupported|larger|rejected \(HTTP 4/.test(e.message))) throw lastErr;
      }
    }
    throw lastErr || new ShareError('UPLOAD_FAILED', 'Upload failed');
  },

  // ---- Photo references (compact; never bytes, never data:/blob:) ----
  driveIdFrom(url) {
    const m = String(url || '').match(/^https?:\/\/drive\.google\.com\/thumbnail\?id=([A-Za-z0-9_-]{10,100})/);
    return m ? m[1] : null;
  },

  toRef(url) {
    if (!url || typeof url !== 'string') return '';
    const u = url.trim();
    if (/^(r2|drive):/.test(u)) return /^(r2:[A-Za-z0-9]{8,32}|drive:[A-Za-z0-9_-]{10,100})$/.test(u) ? u : '';
    const drive = this.driveIdFrom(u);
    if (drive) return 'drive:' + drive;
    if (this.isConfigured()) {
      const base = this._api('/img/');
      if (u.indexOf(base) === 0) {
        const id = u.slice(base.length);
        if (/^[A-Za-z0-9]{8,32}$/.test(id)) return 'r2:' + id;
      }
    }
    if (/^(data|blob|file):/i.test(u)) return '';
    return /^https:\/\//i.test(u) ? this.sanitizePhotoUrl(u) : '';
  },

  refToUrl(ref) {
    if (!ref || typeof ref !== 'string') return '';
    let m = ref.match(/^r2:([A-Za-z0-9]{8,32})$/);
    if (m) return this.isConfigured() ? this._api('/img/' + m[1]) : '';
    m = ref.match(/^drive:([A-Za-z0-9_-]{10,100})$/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w2000';
    return this.sanitizePhotoUrl(ref); // legacy links: plain https or old data:image
  },

  // Gift record stored on the server: same shape as before, photoUrls -> refs
  toRecord(data) {
    const rec = Object.assign({}, data);
    const urls = Array.isArray(data.photoUrls) ? data.photoUrls : [];
    const texts = Array.isArray(data.photoTexts) ? data.photoTexts : [];
    rec.photoUrls = [];
    rec.photoTexts = [];
    urls.forEach((u, i) => {
      const ref = this.toRef(u);
      if (!ref) throw new ShareError('INVALID_PHOTO', 'Photo ' + (i + 1) + ' cannot be shared', { index: i + 1 });
      rec.photoUrls.push(ref);
      rec.photoTexts.push(texts[i] || '');
    });
    return rec;
  },

  // Turn a stored/legacy record into something renderable (refs -> URLs).
  // Keeps photoUrls and photoTexts aligned when an entry is unusable.
  resolveGift(rec) {
    if (!rec || typeof rec !== 'object') return rec;
    const out = Object.assign({}, rec);
    const urls = Array.isArray(rec.photoUrls) ? rec.photoUrls : [];
    const texts = Array.isArray(rec.photoTexts) ? rec.photoTexts : [];
    out.photoUrls = [];
    out.photoTexts = [];
    urls.forEach((u, i) => {
      const url = this.refToUrl(u);
      if (url) { out.photoUrls.push(url); out.photoTexts.push(texts[i] || ''); }
    });
    return out;
  },

  // ---- Gift storage ----
  async saveGift(data) {
    const record = this.toRecord(data);
    if (!this.isConfigured()) throw new ShareError('NOT_CONFIGURED', 'Sharing service is not configured');
    let res;
    try {
      const session = await this.getSession();
      res = await this._fetch('/api/gift', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session': session },
        body: JSON.stringify(record)
      });
    } catch (e) {
      if (e instanceof ShareError) throw e;
      throw new ShareError('STORAGE_FAILED', 'Could not reach the sharing service');
    }
    if (res.status === 401) this._session = null;
    if (res.status === 503) throw new ShareError('NOT_CONFIGURED', 'Sharing service is not fully configured');
    if (!res.ok) throw new ShareError('STORAGE_FAILED', 'Storage rejected the gift (HTTP ' + res.status + ')');
    const body = await res.json().catch(() => null);
    if (!body || !/^[A-Za-z0-9]{6,32}$/.test(body.id || '')) throw new ShareError('STORAGE_FAILED', 'Bad response from server');
    return body.id;
  },

  async loadGift(id) {
    if (!/^[A-Za-z0-9]{6,32}$/.test(id || '')) throw new ShareError('BAD_ID', 'Malformed gift id');
    if (!this.isConfigured()) throw new ShareError('NOT_CONFIGURED', 'Sharing service is not configured');
    let res;
    try {
      res = await this._fetch('/api/gift/' + encodeURIComponent(id), { method: 'GET' }, 20000);
    } catch (e) { throw new ShareError('STORAGE_FAILED', 'Could not reach the sharing service'); }
    if (res.status === 404) throw new ShareError('NOT_FOUND', 'Gift not found');
    if (res.status === 400) throw new ShareError('BAD_ID', 'Malformed gift id');
    if (!res.ok) throw new ShareError('STORAGE_FAILED', 'HTTP ' + res.status);
    let rec;
    try { rec = await res.json(); } catch (e) { throw new ShareError('STORAGE_FAILED', 'Corrupt gift record'); }
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) throw new ShareError('STORAGE_FAILED', 'Corrupt gift record');
    return rec;
  },

  buildShareUrl(id) {
    const base = window.location.href.split('#')[0].split('?')[0];
    return base + '#g=' + id;
  },

  // Classify a location.hash (without the leading '#')
  parseHash(hash) {
    const h = String(hash || '');
    if (!h) return { type: 'none' };
    if (h.indexOf('g=') === 0) {
      const id = h.slice(2);
      return /^[A-Za-z0-9]{6,32}$/.test(id) ? { type: 'id', id: id } : { type: 'badid' };
    }
    const data = this.decodeData(h);
    return data && typeof data === 'object' ? { type: 'legacy', data: data } : { type: 'broken' };
  },

  // ---- Diagnostics (counts only; never logs gift content or URLs) ----
  urlStats(gift, url, urlBefore) {
    const enc = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length);
    let embedded = 0;
    const hash = String(url || '').split('#')[1] || '';
    const legacy = hash && hash.indexOf('g=') !== 0 ? this.decodeData(hash) : null;
    const photos = legacy && Array.isArray(legacy.photoUrls) ? legacy.photoUrls : [];
    photos.forEach(p => { if (/^data:image/i.test(p)) embedded += p.length; });
    const out = {
      payloadBytes: enc(JSON.stringify(gift || {})),
      urlChars: String(url || '').length,
      urlBytes: enc(String(url || '')),
      embeddedImageChars: embedded
    };
    if (urlBefore != null) {
      out.urlCharsBefore = String(urlBefore).length;
      out.urlCharsAfter = out.urlChars;
    }
    return out;
  },

  sanitizePhotoUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const u = url.trim();
    if (!/^(https?:\/\/|data:image\/)/i.test(u)) return '';
    if (/["'<>\s`]/.test(u)) return '';
    return u;
  },

  // Convert share-page links into direct image links that render in <img>
  normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    // Strip query string and hash (e.g. ?raw=true) before matching
    let u = url.trim().split('?')[0].split('#')[0];
    let m;
    // https://github.com/OWNER/REPO/blob/BRANCH/PATH -> raw link
    m = u.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+)\/blob\/([^/]+)\/(.+)$/);
    if (m) return 'https://raw.githubusercontent.com/' + m[1] + '/' + m[2] + '/' + m[3];
    // https://github.com/OWNER/REPO/raw/BRANCH/PATH -> raw link
    m = u.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+)\/raw\/([^/]+)\/(.+)$/);
    if (m) return 'https://raw.githubusercontent.com/' + m[1] + '/' + m[2] + '/' + m[3];
    // Google Drive share link -> direct thumbnail link
    // https://drive.google.com/file/d/FILEID/view...
    m = u.match(/^https?:\/\/drive\.google\.com\/file\/d\/([^/]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w2000';
    // https://drive.google.com/open?id=FILEID
    m = url.trim().match(/^https?:\/\/drive\.google\.com\/open\?[^#]*\bid=([^&#]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w2000';
    // Dropbox share link -> direct download link
    // https://www.dropbox.com/s/..../photo.jpg -> dl.dropboxusercontent.com
    m = u.match(/^https?:\/\/(?:www\.)?dropbox\.com\/(.+)$/);
    if (m) return 'https://dl.dropboxusercontent.com/' + m[1];
    return url.trim();
  },

  encodeData(data) {
    try {
      const jsonStr = JSON.stringify(data);
      return btoa(unescape(encodeURIComponent(jsonStr)));
    } catch (err) {
      console.error('Encode error:', err);
      return '';
    }
  },

  decodeData(hash) {
    try {
      const jsonStr = decodeURIComponent(escape(atob(hash)));
      return JSON.parse(jsonStr);
    } catch (err) {
      console.error('Failed to decode data:', err);
      return null;
    }
  },

  // ---- Legacy link fallback (no sharing service configured) ----
  // When no backend is deployed, gifts are shared the original way:
  // everything lives in the URL hash, device photos packed in as small
  // thumbnails. Purely local work: no network calls, no shorteners.
  maxEmbedLinkLength: 60000,

  // Scale so the LARGEST side fits maxWidth (tall portraits included)
  fitWithin(w, h, maxWidth) {
    if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0 || !isFinite(maxWidth) || maxWidth <= 0) {
      return { width: 0, height: 0 };
    }
    const scale = Math.min(1, maxWidth / Math.max(w, h));
    return { width: Math.round(w * scale), height: Math.round(h * scale) };
  },

  // Build a small thumbnail data-URL for embedding directly in the link.
  // Fallback only, used when there is no server to upload to.
  async makeThumbnailDataUrl(file, maxWidth = 384, quality = 0.55) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
    const dims = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height, src: dataUrl });
      img.onerror = () => reject(new Error('Cannot decode image (HEIC photos are not supported - use JPEG or a screenshot)'));
      img.src = dataUrl;
    });
    const size = this.fitWithin(dims.w, dims.h, maxWidth);
    let width = size.width;
    let height = size.height;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Cannot decode image'));
      img.src = dims.src;
    });
  },

  // Legacy only (kept for tests / decoding old links). The app no longer
  // uses this to build share links.
  generateFullUrl(data) {
    // Use href (not origin+pathname) so links also work from file:// and any host
    const baseUrl = window.location.href.split('#')[0];
    const encoded = this.encodeData(data);
    return baseUrl + '#' + encoded;
  },

  getQrCodeUrl(url) {
    // Big modules + wide quiet zone + low error correction + explicit
    // black-on-white: the easiest possible code for phone cameras.
    return 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&qzone=4&ecc=L&color=0-0-0&bgcolor=255-255-255&data=' + encodeURIComponent(url);
  },

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      const activeEl = document.activeElement;
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.readOnly = true;
      textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
      document.body.appendChild(textarea);
      textarea.focus({ preventScroll: true });
      textarea.select();
      try { textarea.setSelectionRange(0, textarea.value.length); } catch (e) { /* ignore */ }
      try {
        const ok = document.execCommand('copy');
        return !!ok;
      } catch (e) {
        return false;
      } finally {
        document.body.removeChild(textarea);
        try { if (activeEl && activeEl.focus) activeEl.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }
  }
};

window.Share = Share;
