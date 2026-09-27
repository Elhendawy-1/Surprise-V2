/* ===== Share Module ===== */

const Share = {
  imageHost: {
    // NOTE: verified by test (Nov 2026) that public CORS proxies do NOT
    // forward multipart POST bodies (allorigins refetches via GET and drops
    // the body; codetabs times out), so uploads go direct-only and fail
    // fast on CORS errors. The thumbnail-embed fallback covers failures.
    // Hard cap: embedded thumbnails must keep the full link under this length
    maxEmbedLinkLength: 60000,
    // Optional direct upload into the site's own repo (short permanent
    // Pages URLs, works on every device). Token is set from the creator
    // page and lives only in that browser's localStorage - never in links.
    githubToken: '',
    githubRepo: 'Elhendawy-1/Surprise',
    services: {
      picrd: {
        uploadUrl: 'https://picrd.com/api/upload',
        fieldName: 'file',
        getResponseUrl: (data) => {
          if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch(e) { return null; }
          }
          return data.image_url || data.url || null;
        }
      },
      catbox: {
        uploadUrl: 'https://catbox.moe/user/api.php',
        formData: { reqtype: 'fileupload' },
        fieldName: 'fileToUpload',
        getResponseUrl: (data) => {
          if (typeof data === 'string') return data.trim();
          return data.url || null;
        }
      }
    }
  },

  async uploadImage(file) {
    if (!file) return null;

    let compressedFile;
    try {
      compressedFile = await this.compressImage(file);
    } catch (e) {
      compressedFile = file;
    }

    // Direct upload into the site repo first when a GitHub token is saved:
    // photos land in assets/photos/, so links stay short and permanent.
    const ghToken = (this.imageHost.githubToken || '').trim();
    if (ghToken && this.imageHost.githubRepo) {
      try {
        const url = await this.uploadToGithub(compressedFile, ghToken, this.imageHost.githubRepo);
        if (url) return url;
      } catch (err) {
        console.warn('github upload failed:', err.message);
      }
    }

    // ImgBB first when the user saved an API key: it allows browser
    // uploads (CORS *) and returns short, permanent, full-quality URLs.
    const apiKey = (this.imageHost.imgbbKey || '').trim();
    if (apiKey) {
      try {
        const url = await this.uploadToImgbb(compressedFile, apiKey);
        if (url) return url;
      } catch (err) {
        console.warn(`imgbb upload failed:`, err.message);
      }
    }

    const services = ['picrd', 'catbox'];
    for (const serviceName of services) {
      try {
        const url = await this.uploadToService(serviceName, compressedFile);
        if (url) return url;
      } catch (err) {
        console.warn(`${serviceName} upload failed:`, err.message);
      }
    }

    return null;
  },

  async uploadToImgbb(file, apiKey) {
    const formData = new FormData();
    formData.append('image', file, file.name || 'photo.jpg');
    const data = await new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Request timeout'));
      }, 30000);
      fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(apiKey), {
        method: 'POST',
        body: formData,
        signal: controller.signal
      })
        .then(response => {
          clearTimeout(timeoutId);
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(json => {
          clearTimeout(timeoutId);
          resolve(json);
        })
        .catch(err => {
          clearTimeout(timeoutId);
          reject(err);
        });
    });
    if (data && data.success && data.data) {
      const url = data.data.display_url || data.data.url;
      if (url && typeof url === 'string' && url.startsWith('http')) return url;
    }
    throw new Error('ImgBB upload failed');
  },

  // Scale so the LARGEST side fits maxWidth (tall portraits included)
  // Safe repo-relative file name for a device upload (pure, testable).
  sanitizeUploadName(name) {
    const base = String(name || 'photo.jpg').split(/[\\/]/).pop();
    const clean = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return (clean || 'photo.jpg').slice(-60);
  },

  // Contents-API target for a device upload (pure, testable).
  githubUploadTarget(repo, fileName, nowMs) {
    const safe = this.sanitizeUploadName(fileName);
    const path = 'assets/photos/' + (nowMs || Date.now()) + '-' + safe;
    return {
      path: path,
      apiUrl: 'https://api.github.com/repos/' + repo + '/contents/' + path
    };
  },

  // Upload a file straight into the site repo via the GitHub Contents API
  // (CORS-enabled). Returns the permanent download URL, or throws.
  async uploadToGithub(file, token, repo) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
    const parts = String(dataUrl).split(',');
    if (parts.length < 2 || !parts[1]) throw new Error('Failed to encode file');
    const target = this.githubUploadTarget(repo, file && file.name);
    const body = JSON.stringify({
      message: 'Add gift photo ' + target.path.split('/').pop(),
      content: parts[1],
      branch: 'main'
    });
    const json = await new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Request timeout'));
      }, 60000);
      fetch(target.apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: body,
        signal: controller.signal
      })
        .then(response => {
          if (response.status === 401 || response.status === 403) {
            clearTimeout(timeoutId);
            throw new Error('GitHub rejected the token (HTTP ' + response.status + ') - check the token and its repo permission');
          }
          if (!response.ok) {
            clearTimeout(timeoutId);
            throw new Error('HTTP ' + response.status);
          }
          return response.json();
        })
        .then(data => { clearTimeout(timeoutId); resolve(data); })
        .catch(err => { clearTimeout(timeoutId); reject(err); });
    });
    const url = json && json.content && json.content.download_url;
    if (url && typeof url === 'string' && url.startsWith('http')) return url;
    throw new Error('GitHub upload failed');
  },
  fitWithin(w, h, maxWidth) {
    const scale = Math.min(1, maxWidth / Math.max(w, h));
    return { width: Math.round(w * scale), height: Math.round(h * scale) };
  },

  async compressImage(file, maxWidth = 1280, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const size = this.fitWithin(img.width, img.height, maxWidth);
            const width = size.width;
            const height = size.height;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              } else {
                resolve(file);
              }
            }, 'image/jpeg', quality);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },

  // Build a small thumbnail data-URL for embedding directly in the link.
  // Last resort when every upload host fails - no network needed.
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

  async uploadToService(serviceName, file) {
    const service = this.imageHost.services[serviceName];
    const formData = new FormData();
    if (service.formData) {
      Object.entries(service.formData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    formData.append(service.fieldName, file, file.name || 'photo.jpg');

    // Single direct attempt: CORS failures reject immediately, so this
    // stays fast. On failure the caller falls back to link embedding.
    const url = await this.doFetch(service.uploadUrl, service.method || 'POST', formData, service);
    if (url) return url;

    throw new Error(`${serviceName} upload failed`);
  },

  // Photo URLs come from the share-link payload, i.e. untrusted input.
  // Only allow safe schemes and reject anything that could break out
  // of an HTML attribute. Returns '' for anything suspicious.
  sanitizePhotoUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const u = url.trim();
    if (!/^(https?:\/\/|data:image\/)/i.test(u)) return '';
    if (/["'<>\s]/.test(u)) return '';
    return u;
  },

  doFetch(url, method, body, service) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Request timeout'));
      }, 15000);

      fetch(url, { method, body, signal: controller.signal })
        .then(response => {
          if (!response.ok) {
            clearTimeout(timeoutId);
            throw new Error('HTTP ' + response.status);
          }
          const ct = response.headers.get('content-type');
          if (ct && ct.includes('application/json')) {
            return response.json().then(data => ({ data, timeoutId }));
          }
          return response.text().then(data => ({ data, timeoutId }));
        })
        .then(({ data, timeoutId }) => {
          clearTimeout(timeoutId);
          if (!data) { reject(new Error('Empty response')); return; }
          
          // Try to extract URL using service's getResponseUrl
          if (service && service.getResponseUrl) {
            const resultUrl = service.getResponseUrl(data);
            if (resultUrl) {
              resolve(resultUrl);
              return;
            }
          }
          
          // Fallback: try common response formats
          if (typeof data === 'string' && data.startsWith('http')) {
            resolve(data);
          } else if (data && data.url) {
            resolve(data.url);
          } else if (data && data.image && data.image.url) {
            resolve(data.image.url);
          } else if (data && data.data && data.data.url) {
            resolve(data.data.url);
          } else if (data && data.image_url) {
            resolve(data.image_url);
          } else {
            console.warn('Could not extract URL from response:', data);
            resolve(null);
          }
        })
        .catch(err => {
          clearTimeout(timeoutId);
          reject(err);
        });
    });
  },

  // Convert share-page links into direct image links that render in <img>
  normalizeImageUrl(url) {
    if (!url) return '';
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
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1000';
    // https://drive.google.com/open?id=FILEID
    m = url.trim().match(/^https?:\/\/drive\.google\.com\/open\?[^#]*\bid=([^&#]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1000';
    // Dropbox share link -> direct download link
    // https://www.dropbox.com/s/..../photo.jpg -> dl.dropboxusercontent.com
    m = u.match(/^https?:\/\/(?:www\.)?dropbox\.com\/(.+)$/);
    if (m) return 'https://dl.dropboxusercontent.com/' + m[1];
    return url.trim();
  },

  encodeData(data) {
    const jsonStr = JSON.stringify(data);
    try {
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

  generateFullUrl(data) {
    // Use href (not origin+pathname) so links also work from file:// and any host
    const baseUrl = window.location.href.split('#')[0];
    const encoded = this.encodeData(data);
    return baseUrl + '#' + encoded;
  },

  fetchText(url, options, timeoutMs) {
    return new Promise((resolve) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 8000);
      fetch(url, Object.assign({ signal: controller.signal }, options || {}))
        .then(response => {
          clearTimeout(timeoutId);
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const ct = response.headers.get('content-type') || '';
          return (ct.indexOf('application/json') !== -1 ? response.json() : response.text())
            .then(data => ({ data, timeoutId }));
        })
        .then(({ data, timeoutId }) => {
          clearTimeout(timeoutId);
          if (!data) return resolve(null);
          const candidate = typeof data === 'string' ? data.trim() : (data.result_url || data.shorturl || data.link || '');
          resolve(candidate && String(candidate).trim().startsWith('http') ? String(candidate).trim() : null);
        })
        .catch(() => {
          clearTimeout(timeoutId);
          resolve(null);
        });
    });
  },

  async shortenUrl(longUrl) {
    // Short links make much sparser, easier-to-scan QR codes,
    // so try three free shorteners before falling back to the long URL.
    // Links already short need nothing; huge packed-photo links would
    // only burn ~16s of doomed shortener timeouts, so skip those too.
    if (longUrl.length < 200 || longUrl.length > 8000) return longUrl;

    const encoded = encodeURIComponent(longUrl);
    const attempts = [
      { url: 'https://tinyurl.com/api-create.php?url=' + encoded },
      { url: 'https://is.gd/create.php?format=simple&url=' + encoded },
      {
        url: 'https://cleanuri.com/api/v1/shorten',
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'url=' + encoded
        }
      }
    ];

    for (const attempt of attempts) {
      try {
        const shortUrl = await this.fetchText(attempt.url, attempt.options);
        if (shortUrl) return shortUrl;
      } catch (err) {
        console.warn('URL shortening failed:', err);
      }
    }
    // Return original URL if shortening fails
    return longUrl;
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
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
        return true;
      } catch (e) {
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }
};

window.Share = Share;
