/* ===== Main App Module ===== */

const App = {
  // Current state
  state: {
    currentSection: 'hero',
    lang: 'en',
    occasion: null,
    relationship: null,
    customRelationship: '',
    name: '',
    fields: {},
    messageMode: 'auto',
    customMessage: '',
    theme: 'classic',
    musicEnabled: true,
    photos: {},
    photoUrls_fromFiles: {},
    photoSlotSeq: 0,
    songChoice: '',
    songChoiceName: '',
    selectedTheme: 'classic'
  },

  // Section order (topic first, then person)
  sections: ['hero', 'occasion', 'relationship', 'customize', 'preview', 'share'],

  // Initialize the app
  init() {
    // Recipient view: the URL hash is either a short gift id (#g=...) or a
    // legacy Base64 payload from older links. Routed through the Gift
    // module so hash parsing lives behind one seam (Gift.parseRef).
    if (window.location.hash && window.location.hash.length > 1) {
      const parse = (window.Gift && window.Gift.parseRef) ? window.Gift.parseRef : Share.parseHash.bind(Share);
      const parsed = parse(window.location.hash.substring(1));
      if (parsed.type === 'legacy') {
        this.showRecipientView(Share.resolveGift(parsed.data));
        return;
      }
      if (parsed.type === 'id') {
        this.loadSharedGift(parsed.id);
        return;
      }
      // Hash present but unusable (cut short, or malformed id): clear error.
      this.showBroken('brokenTitle', 'brokenText');
      return;
    }

    // Normal creator flow
    this.bindEvents();
    this.addPhotoSlot();
    this.addPhotoSlot();
    this.addPhotoSlot();
    this.applyLang();
    this.updateThemePreview();
    this.showSection('hero');
    Animations.startHeroAnimation();

    // Leave no timers or audio running when the page is hidden/closed.
    if (!window.__giftCleanupWired) {
      window.__giftCleanupWired = true;
      window.addEventListener('pagehide', () => {
        try {
          if (App.countdownTimer) clearInterval(App.countdownTimer);
          if (App.songPreviewAudio) App.songPreviewAudio.pause();
          const bg = document.getElementById('bg-music');
          if (bg) bg.pause();
          Animations.stopFloatingHearts();
        } catch (e) { /* ignore */ }
      });
    }
  },

  // Error page for unusable / missing / unreachable gifts
  showBroken(titleKey, textKey) {
    const title = document.querySelector('[data-i18n="brokenTitle"]');
    const text = document.querySelector('[data-i18n="brokenText"]');
    if (title) title.setAttribute('data-i18n', titleKey);
    if (text) text.setAttribute('data-i18n', textKey);
    this.bindEvents();
    this.applyLang();
    this.showSection('broken');
  },

  // Fetch a stored gift by id, then render it (recipient side).
  // Unified open path: Gift.open never rejects — it maps storage errors
  // to { ok, reason } so this stays a thin adapter over the deep module.
  async loadSharedGift(id) {
    const lang = this.state.lang || 'en';
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
    this.setLoadingStatus(t('loadingGift', lang));
    try {
      const opened = window.Gift && window.Gift.open
        ? await window.Gift.open('#g=' + id)
        : { ok: true, data: Share.resolveGift(await Share.loadGift(id)) };
      if (overlay) overlay.style.display = 'none';
      this.setLoadingStatus('');
      if (!opened.ok) {
        if (opened.reason === 'unknown-id') this.showBroken('brokenNotFoundTitle', 'brokenNotFoundText');
        else this.showBroken('brokenLoadTitle', 'brokenLoadText');
        return;
      }
      this.showRecipientView(opened.data);
    } catch (err) {
      if (overlay) overlay.style.display = 'none';
      this.setLoadingStatus('');
      const code = err && err.code;
      if (code === 'NOT_FOUND' || code === 'BAD_ID') this.showBroken('brokenNotFoundTitle', 'brokenNotFoundText');
      else this.showBroken('brokenLoadTitle', 'brokenLoadText');
    }
  },

  // Build one photo slot (unlimited - the user adds as many as they like)
  addPhotoSlot() {
    const slot = this.state.photoSlotSeq++;
    const grid = document.getElementById('photos-grid');
    const lang = this.state.lang || 'en';
    const addLabel = this.escapeHtml(t('addPhotoBtn', lang));
    const uploadAria = this.escapeHtml(t('photoUploadAria', lang));
    const linkAria = this.escapeHtml(t('photoLinkAria', lang));
    const captionAria = this.escapeHtml(t('photoCaptionAria', lang));
    const removeAria = this.escapeHtml(t('photoRemoveAria', lang));
    const previewAlt = this.escapeHtml(t('photoPreviewAlt', lang));
    const div = document.createElement('div');
    div.className = 'photo-slot';
    div.dataset.slot = slot;
    div.innerHTML =
      '<div class="photo-upload-area" id="photo-upload-area-' + slot + '">' +
        '<input type="file" accept="image/*" class="file-input photo-file-input" data-slot="' + slot + '" aria-label="' + uploadAria + '">' +
        '<div class="photo-preview" id="photo-preview-' + slot + '" style="display:none;">' +
          '<img id="photo-preview-img-' + slot + '" alt="' + previewAlt + '" data-i18n-managed="1">' +
          '<button type="button" class="btn-remove photo-remove-btn" data-slot="' + slot + '" aria-label="' + removeAria + '">&times;</button>' +
        '</div>' +
        '<div class="photo-placeholder" id="photo-placeholder-' + slot + '">' +
          '<span class="upload-icon">&#128247;</span>' +
          '<span class="photo-add-label">+ ' + addLabel + '</span>' +
        '</div>' +
      '</div>' +
      '<input type="text" class="photo-url-input" data-slot="' + slot + '" data-i18n-ph="urlPh" aria-label="' + linkAria + '" placeholder="' + this.escapeHtml(t('urlPh', lang)) + '">' +
      '<input type="text" class="photo-text-input" data-slot="' + slot + '" data-i18n-ph="captionPh" aria-label="' + captionAria + '" placeholder="' + this.escapeHtml(t('captionPh', lang)) + '">';
    grid.appendChild(div);
    return slot;
  },

  // Slot ids currently on the page, in order
  photoSlots() {
    return Array.from(document.querySelectorAll('#photos-grid .photo-slot'))
      .map(el => parseInt(el.dataset.slot, 10));
  },

  // Bind all event listeners
  bindEvents() {
    // Hero -> Topic
    document.getElementById('btn-start').addEventListener('click', () => {
      this.showSection('occasion');
    });

    // Topic selection
    document.getElementById('occasion-grid').addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      this.selectOccasion(card.dataset.occasion);
    });

    // Back from relationship to topic
    document.getElementById('btn-back-relationship').addEventListener('click', () => {
      this.showSection('occasion');
    });

    // Language toggle (creator flow)
    document.getElementById('lang-toggle').addEventListener('click', () => {
      this.state.lang = this.state.lang === 'ar' ? 'en' : 'ar';
      this.applyLang();
    });

    // Relationship selection
    document.getElementById('relationship-grid').addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      this.selectRelationship(card.dataset.relationship);
    });

    // Custom relationship continue + Enter key
    document.getElementById('btn-custom-continue').addEventListener('click', () => {
      this.confirmCustomRelationship();
    });
    document.getElementById('custom-relationship').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.confirmCustomRelationship();
      }
    });

    // Add-photo button (unlimited slots)
    document.getElementById('btn-add-photo').addEventListener('click', () => {
      this.addPhotoSlot();
      const grid = document.getElementById('photos-grid');
      if (grid.lastElementChild && grid.lastElementChild.scrollIntoView) {
        grid.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    // Photo grid events (delegated - slots are added dynamically)
    const grid = document.getElementById('photos-grid');
    grid.addEventListener('change', (e) => {
      const input = e.target.closest ? e.target.closest('.photo-file-input') : null;
      if (!input) return;
      const file = input.files[0];
      if (file) this.handlePhotoFile(file, parseInt(input.dataset.slot, 10));
    });
    grid.addEventListener('input', (e) => {
      const input = e.target.closest ? e.target.closest('.photo-url-input') : null;
      if (!input) return;
      this.handlePhotoUrlInput(input.value.trim(), parseInt(input.dataset.slot, 10));
    });
    grid.addEventListener('click', (e) => {
      const rm = e.target.closest ? e.target.closest('.photo-remove-btn') : null;
      if (rm) {
        e.stopPropagation();
        e.preventDefault();
        this.removePhoto(parseInt(rm.dataset.slot, 10));
        return;
      }
    });
    grid.addEventListener('dragover', (e) => {
      const area = e.target.closest ? e.target.closest('.photo-upload-area') : null;
      if (!area) return;
      e.preventDefault();
      area.style.borderColor = 'var(--primary)';
    });
    grid.addEventListener('dragleave', (e) => {
      const area = e.target.closest ? e.target.closest('.photo-upload-area') : null;
      if (area) area.style.borderColor = '';
    });
    grid.addEventListener('drop', (e) => {
      const area = e.target.closest ? e.target.closest('.photo-upload-area') : null;
      if (!area) return;
      e.preventDefault();
      area.style.borderColor = '';
      const slotEl = area.closest('.photo-slot');
      if (e.dataTransfer.files.length && slotEl) {
        this.handlePhotoFile(e.dataTransfer.files[0], parseInt(slotEl.dataset.slot, 10));
      }
    });

    // Message mode toggle
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.setMessageMode(btn.dataset.mode);
      });
    });

    // Theme selection
    document.getElementById('theme-grid').addEventListener('click', (e) => {
      const swatch = e.target.closest('.theme-swatch');
      if (!swatch) return;
      e.preventDefault();
      this.selectTheme(swatch.dataset.theme);
    });

    // Back buttons
    document.getElementById('btn-back-customize').addEventListener('click', () => {
      this.showSection('relationship');
    });

    // Preview button
    document.getElementById('btn-preview').addEventListener('click', () => {
      this.generatePreview();
    });

    // Back from preview
    document.getElementById('btn-back-preview').addEventListener('click', () => {
      this.showSection('customize');
    });

    // Generate link
    document.getElementById('btn-generate').addEventListener('click', () => {
      this.generateLink();
    });

    // Copy link
    document.getElementById('btn-copy').addEventListener('click', () => {
      const linkInput = document.getElementById('share-link');
      Share.copyToClipboard(linkInput.value).then(success => {
        const btn = document.getElementById('btn-copy');
        const lang = this.state.lang || 'en';
        btn.textContent = success ? t('copiedBtn', lang) : t('copyFailed', lang);
        btn.classList.toggle('copy-success', !!success);
        setTimeout(() => {
          btn.textContent = t('copyBtn', this.state.lang);
          btn.classList.remove('copy-success');
        }, 2000);
      });
    });

    // Open link
    document.getElementById('btn-open-link').addEventListener('click', () => {
      window.open(document.getElementById('share-link').value, '_blank', 'noopener');
    });

    // New gift
    document.getElementById('btn-new-gift').addEventListener('click', () => {
      this.reset();
      this.showSection('hero');
    });

    // Music controls (creator flow). Assigned via onclick (not
    // addEventListener) so the recipient gift page can overwrite it
    // with its own track-fallback controller without double-firing.
    document.getElementById('btn-music-toggle').onclick = () => {
      this.toggleMusic();
    };

    // Song choice (pick + preview a site song)
    document.getElementById('song-choice-btn').addEventListener('click', (e) => {
      e.preventDefault();
      this.openSongChoice();
    });
    document.getElementById('song-choice-close').addEventListener('click', () => {
      document.getElementById('song-choice-picker').style.display = 'none';
    });
    document.getElementById('song-choice-preview').addEventListener('click', (e) => {
      e.preventDefault();
      this.previewSongChoice();
    });

    // Name input triggers message regeneration
    document.getElementById('recipient-name').addEventListener('input', () => {
      this.updateAutoMessage();
    });

    // Topic field inputs trigger message regeneration
    ['birthday-date', 'love-reason', 'thank-you-reason', 'years-together', 'anniversary-date'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.updateAutoMessage());
    });

  },

  // Apply current language to all tagged static text + page direction
  applyLang() {
    const lang = this.state.lang || 'en';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try { document.title = t('pageTitle', lang) || document.title; } catch (e) { /* ignore */ }
    document.querySelectorAll('[data-i18n]').forEach(el => {
      // Song default name is dynamic once a song is picked — keep filename.
      if (el.id === 'song-choice-name' && this.state.songChoiceName && this.state.songChoice) return;
      el.textContent = t(el.dataset.i18n, lang);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPh, lang);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.dataset.i18nHtml;
      el.innerHTML = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || '';
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria, lang));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.setAttribute('title', t(el.dataset.i18nTitle, lang));
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
      el.setAttribute('alt', t(el.dataset.i18nAlt, lang));
    });
    const toggle = document.getElementById('lang-toggle');
    if (toggle) {
      toggle.textContent = lang === 'ar' ? 'EN' : 'عربي';
      toggle.setAttribute('aria-label', t('langSwitch', lang));
    }
    // Native date inputs render in the browser/device locale, but setting
    // lang on the element is a hint Chromium uses for field order/names.
    ['birthday-date', 'anniversary-date'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { try { el.lang = lang; } catch (e) { /* ignore */ } }
    });
    // Keep dynamic slot labels translated as well (table-driven so
    // translators only edit I18N, and new slots inherit on creation).
    document.querySelectorAll('.photo-file-input').forEach(el => {
      el.setAttribute('aria-label', t('photoUploadAria', lang));
    });
    const previewImgAlt = t('photoPreviewAlt', lang);
    document.querySelectorAll('[id^="photo-preview-img-"]').forEach(el => {
      if (!el.getAttribute('alt') || el.getAttribute('data-i18n-managed') === '1') {
        el.setAttribute('alt', previewImgAlt);
        el.setAttribute('data-i18n-managed', '1');
      }
    });
    document.querySelectorAll('.photo-add-label').forEach(el => {
      el.textContent = '+ ' + t('addPhotoBtn', lang);
    });
    document.querySelectorAll('.photo-url-input').forEach(el => {
      el.setAttribute('aria-label', t('photoLinkAria', lang));
    });
    document.querySelectorAll('.photo-text-input').forEach(el => {
      el.setAttribute('aria-label', t('photoCaptionAria', lang));
    });
    document.querySelectorAll('.photo-remove-btn').forEach(el => {
      el.setAttribute('aria-label', t('photoRemoveAria', lang));
    });
    // Candle buttons exist statically; keep their labels translated.
    this.translateCandles(lang);
    // Photo URL status lines were rendered in the old language — re-derive
    // them from stored keys so toggling never leaves mixed-language hints.
    document.querySelectorAll('.photo-url-status').forEach(el => {
      const key = el.dataset.i18nKey;
      if (key) {
        el.textContent = t(key, lang);
        el.style.display = el.textContent ? 'block' : 'none';
      }
    });
    this.updateThemePreview();
    this.updateFormFields();
    this.updateAutoMessage();
    // Song default label (when no custom song picked yet).
    if (!this.state.songChoice) {
      const songName = document.getElementById('song-choice-name');
      if (songName) songName.textContent = t('songDefaultName', lang);
    }
    // Preview page is a rendered snapshot — re-render it in the new
    // language so preview matches what the gift will show.
    if (this.state.currentSection === 'preview' && this.lastPreviewData) {
      try {
        const data = Object.assign({}, this.lastPreviewData, { lang: lang });
        this.renderRecipientView('preview-content', data);
      } catch (e) { /* ignore */ }
    }
    // The share note is dynamic (embed/QR status), not a static string:
    // restore it after the data-i18n sweep so a language toggle keeps it.
    if (this.state.currentSection === 'share' && this.lastShareNote) {
      const subtitle = document.querySelector('#section-share .section-subtitle');
      if (subtitle) subtitle.textContent = this.lastShareNote;
    }
  },

  // Translate static candle buttons (also called from setupCake).
  translateCandles(lang) {
    const l = lang || this.state.lang || 'en';
    document.querySelectorAll('.candle').forEach(c => {
      const n = c.dataset.candleN || c.getAttribute('aria-label').replace(/\D+/g, '') || '';
      c.setAttribute('aria-label', t('candleLabel', l, { n: n }));
    });
  },

  // Show a section
  showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => {
      s.classList.remove('active');
    });

    // Show target section
    const target = document.getElementById('section-' + sectionId);
    if (target) {
      target.classList.add('active');
      this.state.currentSection = sectionId;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Eager: warm the preview track as soon as the personalize form
    // opens, so the song button plays instantly.
    if (sectionId === 'customize') {
      this.warmupSongPreview();
    }
  },

  // Who each topic is for. Birthdays, gratitude and spontaneous gifts
  // fit everyone; romantic topics (Valentine, Anniversary) focus on
  // partners + Other.
  topicPeople: {
    birthday: ['mom', 'dad', 'sister', 'brother', 'aunt', 'friend', 'husband', 'wife', 'boyfriend', 'girlfriend', 'other'],
    valentine: ['boyfriend', 'girlfriend', 'husband', 'wife', 'other'],
    anniversary: ['boyfriend', 'girlfriend', 'husband', 'wife', 'other'],
    thankYou: ['mom', 'dad', 'sister', 'brother', 'aunt', 'friend', 'husband', 'wife', 'boyfriend', 'girlfriend', 'other'],
    justBecause: ['mom', 'dad', 'sister', 'brother', 'aunt', 'friend', 'husband', 'wife', 'boyfriend', 'girlfriend', 'other']
  },

  // Select topic (first step after entering)
  selectOccasion(occasion) {
    this.state.occasion = occasion;

    // Update UI
    document.querySelectorAll('#occasion-grid .card').forEach(card => {
      card.classList.toggle('selected', card.dataset.occasion === occasion);
    });

    // Show only the people this topic fits, and clear any
    // previous pick that is no longer available.
    // Single source: Gift.occasions registry drives eligibility, so a
    // registered occasion works in the UI without editing App.
    const registry = (window.Gift && window.Gift.occasions) || null;
    const allowed = (registry && registry[occasion] && registry[occasion].people)
      || this.topicPeople[occasion] || this.topicPeople.birthday;
    document.querySelectorAll('#relationship-grid .card').forEach(card => {
      const ok = allowed.indexOf(card.dataset.relationship) !== -1;
      card.style.display = ok ? '' : 'none';
      card.classList.remove('selected');
    });
    this.state.relationship = null;
    this.state.customRelationship = '';
    const customInput = document.getElementById('custom-relationship');
    if (customInput) customInput.value = '';
    document.getElementById('custom-relationship-wrap').style.display = 'none';

    // Small delay for visual feedback
    setTimeout(() => {
      this.showSection('relationship');
    }, 300);
  },

  // Select relationship (person the gift is for)
  selectRelationship(relationship) {
    this.state.relationship = relationship;

    // Update UI
    document.querySelectorAll('#relationship-grid .card').forEach(card => {
      card.classList.toggle('selected', card.dataset.relationship === relationship);
    });

    // "Other" needs a custom label first
    const customWrap = document.getElementById('custom-relationship-wrap');
    if (relationship === 'other') {
      customWrap.style.display = 'block';
      const input = document.getElementById('custom-relationship');
      if (input) input.focus();
      return;
    }
    customWrap.style.display = 'none';

    // Show only the fields for the chosen topic, then message
    this.updateFormFields();
    this.updateAutoMessage();

    // Small delay for visual feedback
    setTimeout(() => {
      this.showSection('customize');
    }, 300);
  },

  // Gather topic-specific field values
  occasionFields() {
    return {
      dob: document.getElementById('birthday-date')?.value || '',
      reason: document.getElementById('love-reason')?.value?.trim() ||
              document.getElementById('thank-you-reason')?.value?.trim() || '',
      anniversaryDate: document.getElementById('anniversary-date')?.value || '',
      years: document.getElementById('years-together')?.value || ''
    };
  },

  // Continue after typing a custom relationship (Other)
  confirmCustomRelationship() {
    const input = document.getElementById('custom-relationship');
    const label = input ? input.value.trim() : '';
    if (!label) {
      alert(t('alertLabel', this.state.lang));
      if (input) input.focus();
      return;
    }
    this.state.customRelationship = label;
    document.getElementById('custom-relationship-wrap').style.display = 'none';
    this.updateFormFields();
    this.updateAutoMessage();
    this.showSection('customize');
  },

  // Handle photo upload for specific slot
  handlePhotoFile(file, slot) {
    const lang = this.state.lang || 'en';
    if (!file || !file.type || !file.type.startsWith('image/')) {
      alert(t('alertNotImage', lang));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert(t('alertTooBig', lang));
      return;
    }
    if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '')) {
      alert(t('alertHeic', lang));
    }

    this.state.photos[slot] = file;
    // Clear any uploaded URL cache for this slot so fresh upload happens
    if (this.state.photoUrls_fromFiles) {
      this.state.photoUrls_fromFiles[slot] = null;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById(`photo-preview-img-${slot}`).src = e.target.result;
      document.getElementById(`photo-preview-${slot}`).style.display = 'block';
      document.getElementById(`photo-placeholder-${slot}`).style.display = 'none';
    };
    reader.readAsDataURL(file);
  },

  // Status line under a URL input (created on demand)
  urlStatusEl(slot) {
    const urlInput = document.querySelector(`.photo-url-input[data-slot="${slot}"]`);
    if (!urlInput) return null;
    let el = urlInput.parentNode.querySelector(`.photo-url-status[data-slot="${slot}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'photo-url-status';
      el.dataset.slot = slot;
      urlInput.parentNode.insertBefore(el, urlInput.nextSibling);
    }
    return el;
  },

  setUrlStatus(slot, ok, text, key) {
    const el = this.urlStatusEl(slot);
    if (!el) return;
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
    el.classList.toggle('status-ok', !!ok);
    el.classList.toggle('status-bad', !ok);
    // Remember the i18n key so applyLang can re-translate after a toggle.
    if (key) el.dataset.i18nKey = key;
    else if (!text) delete el.dataset.i18nKey;
  },

  // Handle pasted URL - show live preview + clear OK / error feedback
  handlePhotoUrlInput(rawVal, slot) {
    const lang = this.state.lang || 'en';
    const img = document.getElementById(`photo-preview-img-${slot}`);
    const preview = document.getElementById(`photo-preview-${slot}`);
    const placeholder = document.getElementById(`photo-placeholder-${slot}`);
    if (!img || !preview || !placeholder) return;
    // If a file is selected, file preview wins - don't override it
    // with URL status or error text.
    if (this.state.photos[slot]) return;
    // Google Photos share pages are not embeddable images - explain the
    // Drive route instead of a confusing red error after a load failure.
    if (/photos\.app\.goo\.gl|photos\.google\.com\/share/i.test(rawVal || '')) {
      const img0 = document.getElementById(`photo-preview-img-${slot}`);
      const preview0 = document.getElementById(`photo-preview-${slot}`);
      const placeholder0 = document.getElementById(`photo-placeholder-${slot}`);
      if (img0) img0.removeAttribute('src');
      if (preview0) preview0.style.display = 'none';
      if (placeholder0) placeholder0.style.display = 'flex';
      this.setUrlStatus(slot, false, t('statusGooglePhotos', lang), 'statusGooglePhotos');
      return;
    }
    const val = Share.normalizeImageUrl(rawVal || '');
    if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
      this.setUrlStatus(slot, true, t('statusChecking', lang), 'statusChecking');
      img.onerror = () => {
        preview.style.display = 'none';
        placeholder.style.display = 'flex';
        // Drive links that fail almost always mean the file is not shared
        // as "Anyone with the link" - say so directly.
        const isDrive = /drive\.google\.com|drive\.usercontent\.google\.com/i.test(val);
        const key = isDrive ? 'statusDrivePrivate' : 'statusBad';
        this.setUrlStatus(slot, false, t(key, lang), key);
      };
      img.onload = () => {
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        this.setUrlStatus(slot, true, t('statusOk', lang), 'statusOk');
      };
      img.src = val;
      // Trigger load check for cached images
      if (img.complete && img.naturalWidth > 0) {
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        this.setUrlStatus(slot, true, t('statusOk', lang), 'statusOk');
      }
    } else {
      preview.style.display = 'none';
      placeholder.style.display = 'flex';
      img.removeAttribute('src');
      const hasVal = rawVal && rawVal.trim();
      this.setUrlStatus(slot, false, hasVal ? t('statusNotLink', lang) : '', hasVal ? 'statusNotLink' : '');
    }
  },

  // Remove photo from specific slot
  removePhoto(slot) {
    this.state.photos[slot] = null;
    if (this.state.photoUrls_fromFiles) {
      this.state.photoUrls_fromFiles[slot] = null;
    }
    const input = document.querySelector(`.photo-file-input[data-slot="${slot}"]`);
    if (input) input.value = '';
    const img = document.getElementById(`photo-preview-img-${slot}`);
    if (img) img.removeAttribute('src');
    const previewEl = document.getElementById(`photo-preview-${slot}`);
    if (previewEl) previewEl.style.display = 'none';
    const placeholderEl = document.getElementById(`photo-placeholder-${slot}`);
    if (placeholderEl) placeholderEl.style.display = 'flex';
    // If a URL is still pasted, restore its preview (and status);
    // otherwise clear any stale status text.
    const urlInput = document.querySelector(`.photo-url-input[data-slot="${slot}"]`);
    if (urlInput && urlInput.value.trim()) {
      this.handlePhotoUrlInput(urlInput.value.trim(), slot);
    } else {
      this.setUrlStatus(slot, false, '');
    }
  },

  // Set message mode
  setMessageMode(mode) {
    this.state.messageMode = mode;

    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    document.getElementById('auto-message-group').style.display = mode === 'auto' ? 'block' : 'none';
    document.getElementById('custom-message-group').style.display = mode === 'custom' ? 'block' : 'none';
  },

  // Update auto-generated message preview
  updateAutoMessage() {
    if (this.state.messageMode !== 'auto') return;
    const lang = this.state.lang || 'en';
    const rawName = document.getElementById('recipient-name').value.trim();
    const name = rawName || (lang === 'ar' ? 'صديقنا' : 'Friend');

    const data = {
      relationship: this.state.relationship,
      occasion: this.state.occasion || 'birthday',
      lang: this.state.lang,
      name: name,
      fields: this.occasionFields()
    };

    const message = Generator.generateMessage(data);
    document.getElementById('auto-message-preview').textContent = message;
  },

  // Select theme (applies live so the creator previews it everywhere)
  selectTheme(theme) {
    this.state.selectedTheme = theme;

    document.querySelectorAll('.theme-swatch').forEach(swatch => {
      const on = swatch.dataset.theme === theme;
      swatch.classList.toggle('active', on);
      if (on) swatch.setAttribute('aria-pressed', 'true');
      else swatch.removeAttribute('aria-pressed');
    });

    // Live preview: the whole creator page re-themes instantly.
    document.documentElement.setAttribute('data-theme', theme);
    this.updateThemePreview();
  },

  // Theme name + HEX preview shown before generation.
  themeMeta: {
    classic: { hex: '#E63946' },
    soft: { hex: '#F8A4C8' },
    deep: { hex: '#800020' },
    dark: { hex: '#C9A0DC' },
    elegant: { hex: '#D4AF37' },
    warm: { hex: '#D4A373' }
  },

  updateThemePreview() {
    const dot = document.getElementById('theme-preview-dot');
    const text = document.getElementById('theme-preview-text');
    const hex = document.getElementById('theme-preview-hex');
    if (!dot || !text || !hex) return;
    const lang = this.state.lang || 'en';
    const theme = this.state.selectedTheme || 'classic';
    const meta = this.themeMeta[theme] || this.themeMeta.classic;
    const nameKey = { classic: 'themeClassic', soft: 'themeSoft', deep: 'themeDeep', dark: 'themeDark', elegant: 'themeElegant', warm: 'themeWarm' }[theme] || 'themeClassic';
    dot.style.background = meta.hex;
    text.textContent = t('themePreview', lang) + ': ' + t(nameKey, lang);
    hex.textContent = meta.hex;
  },

  // Repo used by the song picker (lists assets/music/*.mp3 to preview + choose).
  siteGallery: {
    repo: 'Elhendawy-1/Surprise-V2',
    musicCache: null
  },

  // Song choice picker (songs stored in the repo - always play)
  openSongChoice() {
    const panel = document.getElementById('song-choice-picker');
    const list = document.getElementById('song-choice-list');
    const status = document.getElementById('song-choice-status');
    if (!panel || !list || !status) return;
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Eager: keep the current choice preloaded while browsing songs.
    this.warmupSongPreview();

    if (this.siteGallery.musicCache) {
      this.renderSongChoice(this.siteGallery.musicCache);
      return;
    }

    status.textContent = t('songSiteLoading', this.state.lang);
    list.innerHTML = '';
    fetch('https://api.github.com/repos/' + this.siteGallery.repo + '/contents/assets/music')
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(files => {
        const songs = (Array.isArray(files) ? files : []).filter(f =>
          f.type === 'file' && /\.(mp3|wav|ogg|m4a)$/i.test(f.name));
        this.siteGallery.musicCache = songs;
        this.renderSongChoice(songs);
      })
      .catch((err) => {
        const limited = err && /403|429|rate/i.test(err.message || '');
        status.textContent = t(limited ? 'rateLimited' : 'songSiteEmpty', this.state.lang);
      });
  },

  renderSongChoice(songs) {
    const list = document.getElementById('song-choice-list');
    const status = document.getElementById('song-choice-status');
    if (!list || !status) return;
    if (!songs.length) {
      status.textContent = t('songSiteEmpty', this.state.lang);
      list.innerHTML = '';
      return;
    }
    status.textContent = t('songSiteTap', this.state.lang);
    list.innerHTML = '';
    songs.forEach(f => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'song-choice-item' + (this.state.songChoice === f.download_url ? ' selected' : '');
      btn.title = f.name;
      const icon = document.createElement('span');
      icon.className = 'song-play-icon';
      icon.textContent = '▶';
      const name = document.createElement('span');
      name.className = 'song-choice-title';
      name.textContent = f.name;
      btn.appendChild(icon);
      btn.appendChild(name);
      btn.addEventListener('click', () => this.pickSongChoice(f.download_url, f.name));
      list.appendChild(btn);
    });
  },

  pickSongChoice(url, name) {
    this.state.songChoice = url;
    this.state.songChoiceName = name || url;
    const label = document.getElementById('song-choice-name');
    if (label) label.textContent = this.state.songChoiceName;
    this.stopSongPreview();
    // Eager: preload the picked song right away for instant preview.
    this.warmupSongPreview(url);
    document.getElementById('song-choice-picker').style.display = 'none';
    this.renderSongChoice(this.siteGallery.musicCache || []);
  },

  // Preview the chosen song right in the form (tap again to stop).
  // Eager: the track is preloaded (warmed up when the form opens) and
  // fully loaded before play() so the preview starts instantly.
  previewSongChoice() {
    const btn = document.getElementById('song-choice-preview');
    if (this.songPreviewAudio && !this.songPreviewAudio.paused) {
      this.stopSongPreview();
      return;
    }
    this.stopSongPreview();
    // Never overlap the gift background track with the form preview.
    const bg = document.getElementById('bg-music');
    if (bg && !bg.paused) {
      try { bg.pause(); } catch (e) { /* ignore */ }
    }
    const src = this.state.songChoice || 'assets/music/song.mp3';
    const audio = new Audio();
    audio.preload = 'auto';
    audio.onerror = () => this.stopSongPreview();
    audio.onended = () => this.stopSongPreview();
    this.songPreviewAudio = audio;
    audio.src = src;
    try { audio.load(); } catch (e) { /* ignore */ }
    if (btn) btn.setAttribute('aria-label', t('musicPause', this.state.lang));
    audio.play().then(() => {
      if (btn) {
        btn.textContent = '⏹';
        btn.classList.add('playing');
      }
    }).catch(() => this.stopSongPreview());
  },

  stopSongPreview() {
    if (this.songPreviewAudio) {
      try {
        this.songPreviewAudio.pause();
        this.songPreviewAudio.removeAttribute('src');
      } catch (e) { /* ignore */ }
      this.songPreviewAudio = null;
    }
    const btn = document.getElementById('song-choice-preview');
    if (btn) {
      btn.textContent = '▶';
      btn.classList.remove('playing');
      btn.setAttribute('aria-label', t('musicPlay', this.state.lang));
    }
  },

  // Eager warmup: start downloading the preview track as soon as the
  // personalize form opens (or a song is picked), so the preview button
  // plays instantly from cache. Never plays by itself — pure preload.
  warmupSongPreview(src) {
    const url = src || this.state.songChoice || 'assets/music/song.mp3';
    if (this.songWarmupAudio && this.songWarmupUrl === url) return;
    try {
      const warm = new Audio();
      warm.preload = 'auto';
      warm.src = url;
      warm.load();
      this.songWarmupAudio = warm;
      this.songWarmupUrl = url;
    } catch (e) { /* ignore */ }
  },

  // Single source for per-topic identity: Gift.occasions registry wins so
  // registered occasions render without editing App; falls back to the
  // built-in table for older cached app.js.
  occasionMetaFor(occ) {
    const reg = (typeof window !== 'undefined' && window.Gift && window.Gift.occasions) || null;
    if (reg && reg[occ]) return reg[occ];
    return this.occasionMeta[occ] || this.occasionMeta.birthday;
  },

  // Per-topic identity: icon, centerpiece, gallery heading, closing hearts
  occasionMeta: {
    birthday: { icon: '🎂', galleryHead: null, closing: '❤ ❤ ❤' },
    valentine: { icon: '💘', galleryHead: 'galValentine', closing: '💘 💖 💘' },
    anniversary: { icon: '🥂', galleryHead: 'galAnniversary', closing: '🥂 ✨ 🥂' },
    thankYou: { icon: '🙏', galleryHead: 'galThanks', closing: '🙏 💐 🙏' },
    justBecause: { icon: '💌', galleryHead: 'galJust', closing: '💌 ✨ 💌' }
  },

  occasionName(occ, lang) {
    const map = { birthday: 'occBirthday', valentine: 'occValentine', anniversary: 'occAnniversary', thankYou: 'occThankYou', justBecause: 'occJustBecause' };
    return t(map[occ] || 'occBirthday', lang);
  },

  // Show only the form fields that belong to the chosen topic + banner
  updateFormFields() {
    const occ = this.state.occasion || 'birthday';
    const lang = this.state.lang || 'en';
    document.querySelectorAll('.occasion-field').forEach(field => {
      field.style.display = field.dataset.for === occ ? '' : 'none';
    });
    const meta = this.occasionMetaFor(occ);
    const icon = document.getElementById('occasion-banner-icon');
    const text = document.getElementById('occasion-banner-text');
    if (icon) icon.textContent = meta.icon;
    if (text) text.textContent = this.occasionName(occ, lang);
  },

  // Topic centerpiece for valentine / thank-you / just-because
  // (birthdays + anniversaries get the cake instead)
  renderCenterpiece(occ, lang) {
    const section = document.getElementById('recipient-centerpiece');
    const visual = document.getElementById('centerpiece-visual');
    const heading = document.getElementById('centerpiece-heading');
    const sub = document.getElementById('centerpiece-sub');
    const host = document.getElementById('recipient-view');
    if (!section || !visual) return;
    const configs = {
      valentine: { emoji: '💝', anim: 'beat', h: 'cpValentineH', s: 'cpValentineS', burst: 'hearts' },
      thankYou: { emoji: '💐', anim: 'sway', h: 'cpThanksH', s: 'cpThanksS', burst: 'petals' },
      justBecause: { emoji: '🎁', anim: 'twinkle', h: 'cpJustH', s: 'cpJustS', burst: 'confetti' }
    };
    const cfg = configs[occ];
    if (!cfg) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    visual.textContent = cfg.emoji;
    visual.className = 'centerpiece-visual ' + cfg.anim;
    heading.textContent = t(cfg.h, lang);
    sub.textContent = t(cfg.s, lang);
    const wrap = section.querySelector('.centerpiece-wrap');
    if (wrap) {
      const burstFn = () => {
        if (cfg.burst === 'hearts') Animations.celebrationBurst(host, 24);
        else if (cfg.burst === 'petals') Animations.petalShower(host, 3000, 220);
        else Animations.confettiShower(host, 60, 2500);
      };
      wrap.onclick = burstFn;
      // Keyboard/switch access: the wrap is role=button + tabindex.
      wrap.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          burstFn();
        }
      };
    }
  },

  // Get per-slot URL pasted by user (preserves slot index)
  getUrlForSlot(i) {
    const input = document.querySelector(`.photo-url-input[data-slot="${i}"]`);
    if (!input) return '';
    const val = Share.normalizeImageUrl(input.value);
    if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
      return val;
    }
    return '';
  },

  getCaptionForSlot(i) {
    const input = document.querySelector(`.photo-text-input[data-slot="${i}"]`);
    return input ? input.value.trim() : '';
  },

  // Collect form data - keeps URL + caption aligned per slot
  collectData() {
    const name = document.getElementById('recipient-name').value.trim();
    const fields = this.occasionFields();

    // Build aligned pairs per slot: file-upload URL wins, else pasted URL
    const allPhotoUrls = [];
    const allPhotoTexts = [];
    for (const i of this.photoSlots()) {
      let url = '';
      if (this.state.photoUrls_fromFiles[i]) {
        url = this.state.photoUrls_fromFiles[i];
      } else {
        url = this.getUrlForSlot(i);
      }
      if (url) {
        allPhotoUrls.push(url);
        allPhotoTexts.push(this.getCaptionForSlot(i));
      }
    }

    let message;
    if (this.state.messageMode === 'custom') {
      message = document.getElementById('custom-message').value.trim();
    } else {
      message = Generator.generateMessage({
        relationship: this.state.relationship,
        occasion: this.state.occasion || 'birthday',
        lang: this.state.lang,
        name: name,
        fields: fields
      });
    }

    return {
      relationship: this.state.relationship,
      lang: this.state.lang || 'en',
      customRelationship: this.state.relationship === 'other'
        ? (this.state.customRelationship || document.getElementById('custom-relationship')?.value.trim() || t('lovedOne', this.state.lang || 'en'))
        : '',
      occasion: this.state.occasion || 'birthday',
      name: name,
      fields: fields,
      message: message,
      theme: this.state.selectedTheme,
      music: document.getElementById('music-toggle').checked,
      musicChoice: this.state.songChoice || '',
      photoUrls: allPhotoUrls,
      photoTexts: allPhotoTexts
    };
  },

  // Build preview photo data using local file previews (instant, no upload needed)
  collectPreviewData() {
    const data = this.collectData();
    // For slots with a local file selected but not yet uploaded,
    // use the local preview dataURL so preview shows instantly.
    // File wins over pasted URL (same as collectData): if a file is
    // chosen but its FileReader hasn't finished yet, skip the slot
    // rather than flashing a pasted URL the final link won't use.
    const previewUrls = [];
    const previewTexts = [];
    for (const i of this.photoSlots()) {
      const caption = this.getCaptionForSlot(i);
      if (this.state.photos[i]) {
        const localImg = document.getElementById(`photo-preview-img-${i}`);
        // hasAttribute guard: without a src attribute, .src returns the
        // page URL - never use that as a photo.
        const localSrc = (localImg && localImg.hasAttribute('src')) ? localImg.src : '';
        if (localSrc) {
          previewUrls.push(localSrc);
          previewTexts.push(caption);
        } else if (this.state.photoUrls_fromFiles[i]) {
          previewUrls.push(this.state.photoUrls_fromFiles[i]);
          previewTexts.push(caption);
        }
        continue;
      }
      const pasted = this.getUrlForSlot(i);
      if (pasted) {
        previewUrls.push(pasted);
        previewTexts.push(caption);
        continue;
      }
      if (this.state.photoUrls_fromFiles[i]) {
        previewUrls.push(this.state.photoUrls_fromFiles[i]);
        previewTexts.push(caption);
      }
    }
    data.photoUrls = previewUrls;
    data.photoTexts = previewTexts;
    return data;
  },

  // Generate preview (guarded against double taps)
  async generatePreview() {
    if (this.isPreviewing) return;
    // Never let the form song-preview keep playing on the end pages.
    this.stopSongPreview();
    const name = document.getElementById('recipient-name').value.trim();
    if (!name) {
      alert(t('alertName', this.state.lang));
      return;
    }
    if (!this.state.occasion || !this.state.relationship) {
      alert(t('alertTopic', this.state.lang));
      return;
    }
    if (this.state.messageMode === 'custom' && !document.getElementById('custom-message').value.trim()) {
      alert(t('alertEmptyMessage', this.state.lang));
      document.getElementById('custom-message').focus();
      return;
    }
    this.isPreviewing = true;
    const btn = document.getElementById('btn-preview');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }
    try {
      const data = this.collectPreviewData();
      this.lastPreviewData = data;
      this.renderRecipientView('preview-content', data);
      this.showSection('preview');
    } finally {
      this.isPreviewing = false;
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    }
  },

  setLoadingStatus(text) {
    const el = document.getElementById('loading-status');
    if (el) el.textContent = text || '';
  },

  // Generate share link (guarded: one run at a time, no duplicate uploads)
  async generateLink() {
    const lang = this.state.lang || 'en';
    // The form preview must not bleed onto the share (end) page.
    this.stopSongPreview();
    if (this.isGenerating) {
      this.setLoadingStatus(t('generatingBusy', lang));
      return;
    }
    const earlyName = document.getElementById('recipient-name').value.trim();
    if (!earlyName) {
      alert(t('alertName', lang));
      return;
    }
    if (this.state.messageMode === 'custom' && !document.getElementById('custom-message').value.trim()) {
      alert(t('alertEmptyMessage', lang));
      return;
    }
    this.isGenerating = true;
    const genBtn = document.getElementById('btn-generate');
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.setAttribute('aria-busy', 'true');
    }
    // Show loading
    document.getElementById('loading-overlay').style.display = 'flex';
    this.setLoadingStatus(t('loadPreparing', lang));

    try {
      // No sharing service deployed: fall back to a self-contained legacy
      // link (gift data + packed thumbnails in the URL hash). Works with
      // zero setup on any static host.
      if (!Share.isConfigured()) {
        await this.generateLegacyLink(lang);
        return;
      }
      // Upload device photos (original files, no re-compression) to the
      // site's own storage. Nothing is uploaded without the creator's OK,
      // and any failure aborts with a clear message - photos are never
      // silently dropped and never packed into the link.
      const slots = this.photoSlots();
      const uploadedUrls = {};
      const fileSlots = slots.filter(s => this.state.photos[s]);
      const ordinalOf = (slotId) => fileSlots.indexOf(slotId) + 1;
      if (fileSlots.length > 0 && !this.uploadConsent) {
        if (!confirm(t('confirmUpload', lang))) return;
        this.uploadConsent = true;
      }
      if (!this.uploadedRefs) this.uploadedRefs = new WeakMap(); // retry never re-uploads
      let done = 0;
      for (const i of fileSlots) {
        done++;
        this.setLoadingStatus(t('loadUploading', lang, { a: done, b: fileSlots.length }));
        const file = this.state.photos[i];
        let ref = this.uploadedRefs.get(file);
        if (!ref) {
          try {
            ref = await Share.uploadImage(file);
          } catch (photoErr) {
            if (photoErr && photoErr.code === 'NOT_CONFIGURED') throw photoErr;
            alert(t('alertUploadFailed', lang, { a: ordinalOf(i), b: (photoErr && photoErr.message) || 'error' }));
            return;
          }
          this.uploadedRefs.set(file, ref);
        }
        uploadedUrls[i] = ref;
      }
      this.state.photoUrls_fromFiles = uploadedUrls;

      // Collect final data (file photos are r2: refs, pasted ones are
      // normalized links) and store it; the link carries only the id.
      const finalData = this.collectData();
      this.setLoadingStatus(t('loadCreating', lang));
      const giftId = await Share.saveGift(finalData);
      const shortUrl = Share.buildShareUrl(giftId);
      const diag = Share.urlStats(finalData, shortUrl);
      console.log('Share link stats:', diag);

      // Update share section
      document.getElementById('share-link').value = shortUrl;
      const subtitle = document.querySelector('#section-share .section-subtitle');
      const note = t('noteShort', lang);
      // QR gate lives in the Gift module (single source): huge links
      // produce codes no camera can read, so hide the code and say so.
      const qrBox = document.getElementById('share-qr');
      const qrUrl = (window.Gift && window.Gift.qrFor) ? window.Gift.qrFor(shortUrl) : Share.getQrCodeUrl(shortUrl);
      if (qrUrl) {
        document.getElementById('qr-image').src = qrUrl;
        const qrDownload = document.getElementById('qr-download');
        if (qrDownload) {
          qrDownload.href = qrUrl;
          qrDownload.style.display = '';
          // The download attribute is ignored cross-origin, so fetch
          // the image as a blob for a real download; fall back to
          // opening it in a new tab.
          qrDownload.onclick = (e) => {
            e.preventDefault();
            fetch(qrUrl)
              .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.blob();
              })
              .then(blob => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'gift-qr-' + (finalData.occasion || 'birthday') + '.png';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                  URL.revokeObjectURL(a.href);
                  a.remove();
                }, 1000);
              })
              .catch(() => window.open(qrUrl, '_blank', 'noopener'));
          };
        }
        qrBox.style.display = '';
      } else {
        qrBox.style.display = 'none';
      }
      subtitle.textContent = note;
      this.lastShareNote = note;

      this.showSection('share');
    } catch (err) {
      console.error('Error generating link:', err && err.code, err && err.message);
      const code = err && err.code;
      let msg;
      if (code === 'NOT_CONFIGURED') msg = t('alertNotConfigured', lang);
      else if (code === 'STORAGE_FAILED' || code === 'SESSION_FAILED') msg = t('alertStorageFailed', lang);
      else if (code === 'INVALID_PHOTO') msg = t('alertBadPhoto', lang, { a: err.index });
      else msg = t('alertError', lang, { a: err && err.message });
      alert(msg);
    } finally {
      this.isGenerating = false;
      if (genBtn) {
        genBtn.disabled = false;
        genBtn.removeAttribute('aria-busy');
      }
      this.setLoadingStatus('');
      document.getElementById('loading-overlay').style.display = 'none';
    }
  },

  // Legacy share path: everything lives in the link itself (Base64 hash).
  // Device photos are packed in as small thumbnails, pasted links stay as
  // links. Used whenever the sharing service isn't configured, so sharing
  // always works on a plain static host.
  async generateLegacyLink(lang) {
    const slots = this.photoSlots();
    const uploadedUrls = {};
    const fileSlots = slots.filter(s => this.state.photos[s]);
    const ordinalOf = (slotId) => fileSlots.indexOf(slotId) + 1;
    let embedded = 0;
    const skipped = [];
    let heicWarned = false;
    const tiers = [{ w: 512, q: 0.6 }, { w: 384, q: 0.55 }, { w: 256, q: 0.5 }];
    for (const i of fileSlots) {
      this.setLoadingStatus(t('loadPacking', lang, { a: ordinalOf(i) }));
      let placed = false;
      for (const tier of tiers) {
        try {
          const thumb = await Share.makeThumbnailDataUrl(this.state.photos[i], tier.w, tier.q);
          if (!thumb) continue;
          uploadedUrls[i] = thumb;
          this.state.photoUrls_fromFiles = uploadedUrls;
          const trialLength = Share.generateFullUrl(this.collectData()).length;
          if (trialLength <= (Share.maxEmbedLinkLength || 60000)) {
            embedded++;
            placed = true;
            break;
          }
          uploadedUrls[i] = null; // too big at this size - try smaller tier
        } catch (thumbErr) {
          if (!heicWarned && thumbErr && /HEIC/i.test(thumbErr.message || '')) {
            heicWarned = true;
            alert(t('alertHeic', lang));
          }
          break; // decode errors won't improve with smaller tiers
        }
      }
      if (!placed) {
        uploadedUrls[i] = null;
        skipped.push(ordinalOf(i));
      }
    }
    this.state.photoUrls_fromFiles = uploadedUrls;

    const finalData = this.collectData();
    if (fileSlots.length > 0 && finalData.photoUrls.length === 0) {
      alert(t('alertNoPhotos', lang));
    }
    this.setLoadingStatus(t('loadCreating', lang));
    const fullUrl = Share.generateFullUrl(finalData);

    // Update share section
    document.getElementById('share-link').value = fullUrl;
    const subtitle = document.querySelector('#section-share .section-subtitle');
    const photoCount = finalData.photoUrls.length;
    let note = t('noteDefault', lang);
    if (embedded > 0 && skipped.length === 0) {
      note = t('noteEmbedded', lang, { a: photoCount });
    } else if (skipped.length > 0) {
      note = t('noteSkipped', lang, { a: skipped.join(', ') });
      alert(t('alertSkipped', lang, { a: skipped.join(', ') }));
    }
    // QR gate lives in the Gift module (single source): huge links (packed
    // photos) produce codes no camera can read, so hide the code and say so.
    const qrBox = document.getElementById('share-qr');
    const qrUrl = (window.Gift && window.Gift.qrFor) ? window.Gift.qrFor(fullUrl) : Share.getQrCodeUrl(fullUrl);
    if (qrUrl) {
      document.getElementById('qr-image').src = qrUrl;
      const qrDownload = document.getElementById('qr-download');
      if (qrDownload) {
        qrDownload.href = qrUrl;
        qrDownload.style.display = '';
        // The download attribute is ignored cross-origin, so fetch
        // the image as a blob for a real download; fall back to
        // opening it in a new tab.
        qrDownload.onclick = (e) => {
          e.preventDefault();
          fetch(qrUrl)
            .then(r => {
              if (!r.ok) throw new Error('HTTP ' + r.status);
              return r.blob();
            })
            .then(blob => {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'gift-qr-' + (finalData.occasion || 'birthday') + '.png';
              document.body.appendChild(a);
              a.click();
              setTimeout(() => {
                URL.revokeObjectURL(a.href);
                a.remove();
              }, 1000);
            })
            .catch(() => window.open(qrUrl, '_blank', 'noopener'));
        };
      }
      qrBox.style.display = '';
    } else {
      qrBox.style.display = 'none';
      note += t('noteLong', lang);
    }
    // A very long link may be cut by chat apps on arrival, which
    // breaks the whole gift. Warn clearly when that risk exists.
    // Threshold lives in the Gift module (single source).
    const flags = (window.Gift && window.Gift.shareFlags) ? window.Gift.shareFlags(fullUrl) : { truncateWarn: fullUrl.length > 8000 };
    if (flags.truncateWarn) {
      note += ' ' + t('noteTruncate', lang);
    }
    subtitle.textContent = note;
    this.lastShareNote = note;

    this.showSection('share');
  },

  // Escape HTML to avoid breaking markup
  escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  // Render recipient view into a container (used for Preview)
  renderRecipientView(containerId, data) {
    const container = document.getElementById(containerId);
    const greeting = this.escapeHtml(Generator.getGreeting(data));
    const footer = this.escapeHtml(Generator.getFooter(data));
    const details = this.escapeHtml(Generator.getOccasionDetails(data));
    const safeMessage = this.escapeHtml(data.message);
    const photos = data.photoUrls || [];
    const photoTexts = data.photoTexts || [];

    let html = '';
    html += '<div style="text-align:center; padding: 2rem;">';

    // Greeting
    html += `<div class="recipient-greeting" style="font-family: var(--font-script); font-size: 2.5rem; margin-bottom: 1.5rem; opacity: 0; animation: fadeInUp 0.8s ease 0.3s forwards;">${greeting}</div>`;

    // Birthday details
    if (details) {
      html += `<div style="font-size: 1rem; color: var(--text-light); margin-bottom: 1.5rem; opacity: 0; animation: fadeInUp 0.6s ease 0.5s forwards;">${details}</div>`;
    }

    // Chosen photos with captions, right before the message
    if (photos.length > 0) {
      html += '<div style="font-family: var(--font-script); font-size: 1.8rem; margin-bottom: 1rem; opacity: 0; animation: fadeInUp 0.6s ease 0.5s forwards;">' + this.escapeHtml(t('galleryHeading', this.state.lang)) + '</div>';
      html += '<div style="display: flex; flex-direction: column; gap: 1.25rem; align-items: center; margin-bottom: 2rem;">';
      for (let i = 0; i < photos.length; i++) {
        const safeUrl = Share.sanitizePhotoUrl(photos[i]);
        if (!safeUrl) continue;
        html += `<div style="opacity: 0; animation: scaleIn 0.5s ease ${0.5 + i * 0.2}s forwards; max-width: 280px; width: 100%;">`;
        html += `<img src="${this.escapeHtml(safeUrl)}" alt="${this.escapeHtml(t('memoryAlt', this.state.lang || data.lang || 'en', { n: i + 1 }))}" referrerpolicy="no-referrer" style="width: 100%; border-radius: 12px; object-fit: cover; box-shadow: 0 4px 15px var(--shadow);" onerror="this.parentNode.style.display='none'">`;
        if (photoTexts[i]) {
          html += `<div style="font-size: 0.85rem; color: var(--text-light); font-style: italic; margin-top: 0.4rem;">${this.escapeHtml(photoTexts[i])}</div>`;
        }
        html += '</div>';
      }
      html += '</div>';
    } else {
      html += '<div style="margin-bottom: 1.5rem; padding: 1rem; border: 1px dashed var(--card-border); border-radius: 12px; color: var(--text-light); font-size: 0.9rem;">' + this.escapeHtml(t('previewNoPhotos', this.state.lang)) + '</div>';
    }

    // Message
    html += `<div style="font-family: var(--font-body); font-size: 1.1rem; line-height: 1.8; color: var(--text); max-width: 500px; margin: 0 auto 2rem; white-space: pre-wrap; opacity: 0; animation: fadeInUp 0.8s ease 0.6s forwards;">${safeMessage}</div>`;

    // Footer
    html += `<div style="font-size: 0.95rem; color: var(--text-light); font-style: italic; opacity: 0; animation: fadeIn 0.8s ease 1s forwards;">${footer}</div>`;

    // Decorative hearts
    html += '<div style="margin-top: 2rem; font-size: 1.5rem; opacity: 0; animation: fadeIn 0.8s ease 1.2s forwards;">&#10084; &#10084; &#10084;</div>';

    html += '</div>';
    container.innerHTML = html;
  },

  // Show recipient view (scrolling page when link is opened)
  showRecipientView(data) {
    document.body.style.background = 'none';

    // Hide all creator sections
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');

    // Show recipient view
    const recipientView = document.getElementById('recipient-view');
    recipientView.style.display = 'block';
    const occ = data.occasion || 'birthday';
    recipientView.dataset.occasion = occ;

    // Apply gift language. The toggle stays visible on the gift page too,
    // so the birthday person can switch languages (their own words stay
    // exactly as the sender wrote them).
    this.lastRecipientData = data;
    this.state.lang = data.lang === 'ar' ? 'ar' : 'en';
    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
      langToggle.style.display = '';
      langToggle.onclick = () => {
        this.state.lang = this.state.lang === 'ar' ? 'en' : 'ar';
        this.applyLang();
        this.refreshRecipientLang();
      };
    }
    this.applyLang();

    // Apply theme
    document.documentElement.setAttribute('data-theme', data.theme || 'classic');

    // Set background
    const bg = document.getElementById('recipient-bg');
    const themes = {
      classic: 'linear-gradient(135deg, #fff5f5, #ffffff)',
      soft: 'linear-gradient(135deg, #fff5f5, #fce4ec)',
      deep: 'linear-gradient(135deg, #1a0000, #2d0a0a)',
      dark: 'linear-gradient(135deg, #0d0000, #1a0a0a)',
      elegant: 'linear-gradient(135deg, #fafafa, #f5f5f5)',
      warm: 'linear-gradient(135deg, #fefae0, #faedcd)'
    };
    bg.style.background = themes[data.theme] || themes.classic;

    // Get data
    const greeting = Generator.getGreeting(data);
    const photos = data.photoUrls || [];
    const photoTexts = data.photoTexts || [];

    // Greeting
    document.getElementById('recipient-greeting').textContent = greeting;

    // Photo memories lane - ALL chosen photos with captions,
    // placed right before the birthday message
    if (photos.length > 0) {
      document.getElementById('recipient-gallery').style.display = 'block';
      const galleryGrid = document.getElementById('recipient-gallery-grid');
      let galleryHtml = '';

      for (let i = 0; i < photos.length; i++) {
        const safeUrl = Share.sanitizePhotoUrl(photos[i]);
        if (!safeUrl) continue;
        const delay = i * 140;
        galleryHtml += `<div class="recipient-gallery-item" data-index="${i}" style="transition-delay:${delay}ms">`;
        galleryHtml += `<img src="${this.escapeHtml(safeUrl)}" alt="${this.escapeHtml(t('memoryAlt', this.state.lang || data.lang || 'en', { n: i + 1 }))}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.style.display='none'">`;
        if (photoTexts[i]) {
          galleryHtml += `<div class="gallery-item-text">${this.escapeHtml(photoTexts[i])}</div>`;
        }
        galleryHtml += '</div>';
      }

      galleryGrid.innerHTML = galleryHtml;

      // Per-topic gallery heading
      const galMeta = (this.occasionMetaFor(occ) || {}).galleryHead;
      if (galMeta) {
        const lang = this.state.lang || 'en';
        const gh = galleryGrid.parentNode.querySelector('.recipient-gallery-heading');
        if (gh) gh.textContent = t(galMeta, lang);
      }
    }

    // Topic centerpiece (heart / bouquet / gift) for non-cake topics
    this.renderCenterpiece(occ, this.state.lang);

    // Closing hearts match the topic
    const closingHearts = document.querySelector('#recipient-view .recipient-closing-hearts');
    if (closingHearts) {
      closingHearts.textContent = (this.occasionMetaFor(occ) || this.occasionMeta.birthday).closing;
    }

    // Cake only suits birthdays + anniversaries - hide it for other topics
    const cakeSection = document.getElementById('recipient-cake');
    const showCake = data.occasion === 'birthday' || data.occasion === 'anniversary';
    if (cakeSection) cakeSection.style.display = showCake ? '' : 'none';
    // Interactive birthday cake (tap candles to blow them out)
    if (showCake) this.setupCake();

    // Smooth scroll-triggered reveals for the whole gift page
    setTimeout(() => {
      this.setupScrollReveals();
      // Safety fallback so nothing ever stays invisible
      setTimeout(() => {
        document.querySelectorAll('#recipient-view .recipient-gallery-item, #recipient-view .recipient-message-card, #recipient-view .recipient-details-card, #recipient-view .recipient-closing, #recipient-view .reveal').forEach(el => el.classList.add('visible'));
      }, 3000);
    }, 100);

    // Message
    document.getElementById('recipient-message').textContent = data.message;
    document.getElementById('recipient-footer').textContent = Generator.getFooter(data);

    // Birthday details with a live ticking countdown
    this.renderRecipientDetails(data);

    // Music: browsers block autoplay, so the corner toggle invites the
    // first tap. The first tap starts the song for sure.
    // Each topic gets its own recommended track; the bundled song
    // is the fallback if a stream fails.
    // Lazy: the <audio> element carries no src on page load — the track
    // is assigned here only, so no audio downloads until a gift with
    // music is actually opened.
    // Single control: the fixed corner toggle (#btn-music-toggle) is the
    // only music button — pause / resume from anywhere, including the
    // end of the gift.
    if (data.music !== false) {
      this.stopSongPreview();
      const musicEl = document.getElementById('bg-music');
      this.cleanupRecipientMusic();
      // Fresh start even when a previous gift played in this same page
      // lifetime (second gift without reload): stop old playback first so
      // the new toggle's paused/playing checks start from the truth.
      try { musicEl.pause(); } catch (e) { /* ignore */ }
      try { musicEl.currentTime = 0; } catch (e) { /* ignore */ }
      const topicTracks = {
        birthday: [],
        valentine: ['https://upload.wikimedia.org/wikipedia/commons/3/3e/Audionautix-com-ccby-furelise.mp3'],
        anniversary: ['https://upload.wikimedia.org/wikipedia/commons/e/e5/Johann_Pachelbel_Canon_P_37_1694.mp3'],
        thankYou: ['https://upload.wikimedia.org/wikipedia/commons/2/2a/Gymnopedie_No._1_%28ISRC_USUAN1100787%29.mp3'],
        justBecause: ['https://upload.wikimedia.org/wikipedia/commons/6/63/Clair_de_Lune_-_Wright_Brass_-_United_States_Air_Force_Band_of_Flight.mp3']
      };
      const tracks = []
        .concat(data.musicChoice ? [data.musicChoice] : [])
        .concat(topicTracks[data.occasion] || [])
        .concat(['assets/music/song.mp3']);
      let trackIdx = 0;
      let musicState = 'idle'; // idle | loading | playing | paused | error
      let hasPlayed = false;
      // True once the user has tapped play at least once. Distinguishes
      // "error with a gesture pending" (safe to auto-try the next
      // fallback) from "error with no gesture" (stay on the invite).
      // With lazy loading the latter should not happen, but stay safe.
      let playRequested = false;
      const toggle = document.getElementById('btn-music-toggle');
      const controls = document.getElementById('music-controls');

      const setMusicState = (next) => {
        musicState = next;
        this.recipientMusicState = next;
        const lang = this.state.lang || 'en';
        const icon = document.getElementById('btn-music-icon');
        toggle.classList.remove('playing', 'play-hint', 'loading');
        toggle.removeAttribute('disabled');
        if (next === 'playing') {
          hasPlayed = true;
          controls.style.display = 'block';
          if (icon) icon.textContent = '⏸';
          toggle.setAttribute('aria-label', t('musicPause', lang));
          toggle.setAttribute('aria-pressed', 'true');
          toggle.classList.add('playing');
        } else if (next === 'loading') {
          controls.style.display = 'block';
          if (icon) icon.textContent = '…';
          toggle.setAttribute('aria-label', t('musicLoading', lang));
          toggle.setAttribute('aria-pressed', 'false');
          toggle.classList.add('loading');
        } else if (next === 'error') {
          // Floating button shows "!" — tap it to retry the chain.
          controls.style.display = 'block';
          if (icon) icon.textContent = '!';
          toggle.setAttribute('aria-label', t('musicError', lang));
          toggle.setAttribute('aria-pressed', 'false');
        } else {
          // paused / idle: the song is ready but not playing. The corner
          // toggle stays visible with a play hint inviting the tap.
          controls.style.display = 'block';
          if (icon) icon.textContent = '▶';
          toggle.setAttribute('aria-label', t('musicPlay', lang));
          toggle.setAttribute('aria-pressed', 'false');
          toggle.classList.add('play-hint');
        }
      };

      const loadTrack = () => {
        setMusicState('loading');
        musicEl.preload = 'auto';
        try { musicEl.loop = true; } catch (e) { /* ignore */ }
        musicEl.src = tracks[trackIdx];
        musicEl.load();
      };

      // Lazy first paint: point at the first track but download nothing
      // until the user's first tap (preload none + no load() call).
      const prepareTrack = () => {
        musicEl.preload = 'none';
        try { musicEl.loop = true; } catch (e) { /* ignore */ }
        musicEl.src = tracks[trackIdx];
        setMusicState('paused');
      };

      const onWaiting = () => { if (musicState !== 'error') setMusicState('loading'); };
      const onPlaying = () => setMusicState('playing');
      const onPause = () => { if (musicState === 'playing') setMusicState('paused'); };
      const onEnded = () => setMusicState('paused');
      const onTrackError = () => {
        // No gesture yet: nothing should be downloading (lazy), so any
        // error here just points at the next fallback and stays on the
        // corner-toggle invite — never a spinner dead-end, never autoplay.
        if (!playRequested) {
          if (trackIdx < tracks.length - 1) {
            trackIdx++;
            musicEl.preload = 'none';
            musicEl.src = tracks[trackIdx];
          }
          setMusicState('paused');
          return;
        }
        // Gesture pending but nothing played yet (first track 404'd):
        // auto-try the next fallback so one tap is enough.
        if (!hasPlayed) {
          if (trackIdx < tracks.length - 1) {
            trackIdx++;
            loadTrack();
            musicEl.play().catch(() => { /* waiting/error events update UI */ });
          } else {
            setMusicState('error');
          }
          return;
        }
        // After playback started: a mid-playback stall is retried on the
        // same track; a load failure advances through the fallback chain.
        if (musicEl.currentTime > 0 && trackIdx >= tracks.length - 1) {
          musicEl.play().catch(() => setMusicState('error'));
          return;
        }
        if (trackIdx < tracks.length - 1) {
          trackIdx++;
          loadTrack();
          // Auto-try playing the next fallback so one tap is enough.
          musicEl.play().catch(() => { /* waiting/error events update UI */ });
        } else {
          setMusicState('error');
        }
      };
      musicEl.addEventListener('waiting', onWaiting);
      musicEl.addEventListener('playing', onPlaying);
      musicEl.addEventListener('pause', onPause);
      musicEl.addEventListener('ended', onEnded);
      musicEl.addEventListener('error', onTrackError);
      this.recipientMusicCleanup = () => {
        musicEl.removeEventListener('waiting', onWaiting);
        musicEl.removeEventListener('playing', onPlaying);
        musicEl.removeEventListener('pause', onPause);
        musicEl.removeEventListener('ended', onEnded);
        musicEl.removeEventListener('error', onTrackError);
        this.recipientMusicToggle = null;
        this.recipientMusicState = null;
        // Detach the stale closure so a later creator-flow button can
        // never drive the old gift's state machine.
        try {
          if (toggle) toggle.onclick = null;
        } catch (e) { /* ignore */ }
      };

      const startMusic = () => {
        if (musicState === 'playing') return;
        if (musicState === 'loading') {
          // A tap during buffering nudges playback instead of dying silent.
          musicEl.play().catch(() => {});
          return;
        }
        if (musicState === 'error') {
          // Retry from the first track on explicit tap.
          trackIdx = 0;
          loadTrack();
        } else if (!musicEl.src && !musicEl.currentSrc) {
          loadTrack();
        }
        playRequested = true;
        setMusicState('loading');
        // State flips to playing via the 'playing' event only (no .then
        // override, so a fast pause in between can't be clobbered).
        musicEl.play().catch(() => {
          // Autoplay blocked or slow network: stay resumable on the
          // corner toggle so the next tap clearly retries.
          if (musicEl.paused) {
            hasPlayed = false;
            setMusicState('paused');
          }
        });
      };

      // Single toggle: the corner button, the first-tap-anywhere
      // fallback — one source of truth so pause / resume can never
      // desync. Error state always restarts (some browsers leave
      // .paused false after a load error).
      const toggleRecipientMusic = () => {
        if (musicState === 'error' || musicEl.paused) {
          startMusic();
        } else {
          musicEl.pause();
          setMusicState('paused');
        }
      };
      this.recipientMusicToggle = toggleRecipientMusic;
      this.recipientMusicState = musicState;

      prepareTrack();
      // Ready-to-play: the corner toggle stays visible with a play
      // hint. Nothing downloads or autoplays until the user taps,
      // satisfying browser autoplay policies.

      // Fallback: any first tap anywhere also starts the music through
      // the same toggle, so UI state always stays in sync.
      // Re-armed per gift (old pending handler removed first) so every
      // gift gets the fallback without stacking duplicate listeners.
      if (this._musicKickHandler) {
        try { document.removeEventListener('click', this._musicKickHandler); } catch (e) { /* ignore */ }
      }
      this._musicKickHandler = (e) => {
        // Taps directly on the corner toggle already switch via its own
        // onclick — ignore them here or one gesture would toggle twice
        // (onclick + bubble to document = two concurrent play() calls).
        try {
          if (e && e.target && e.target.closest &&
              e.target.closest('#music-controls')) {
            return;
          }
        } catch (err) { /* ignore — fall through to toggle */ }
        if (document.getElementById('recipient-view').style.display !== 'block') return;
        const mus = document.getElementById('bg-music');
        if (mus && mus.paused && App.recipientMusicToggle) {
          App.recipientMusicToggle();
        }
      };
      document.addEventListener('click', this._musicKickHandler, { once: true });
      // Corner play / pause / retry toggle (overwrites the creator-flow
      // handler — onclick assignment, so no double-firing).
      toggle.onclick = toggleRecipientMusic;
    } else {
      // Gift without music: tear down any previous gift's controller
      // first (second gift in one page lifetime), then hide everything.
      this.cleanupRecipientMusic();
      document.getElementById('music-controls').style.display = 'none';
      const musicPrompt = document.getElementById('music-prompt');
      if (musicPrompt) musicPrompt.style.display = 'none';
    }

    // Opening celebration: heart + flower burst, petal shower,
    // then calm ambient drift while scrolling
    setTimeout(() => {
      Animations.startCelebration(recipientView);
    }, 500);

    // Phones often throttle timers while the tab is in the background,
    // which can silently eat the celebration. Restart the ambient
    // hearts + petals whenever the gift tab becomes visible again.
    // Registered once: showRecipientView can run again (language
    // switch re-renders), and the listener must not pile up.
    if (!document.documentElement.dataset.ambientWatch) {
      document.documentElement.dataset.ambientWatch = '1';
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && document.getElementById('recipient-view').style.display === 'block') {
          if (Animations.calmMode && Animations.calmMode()) return;
          Animations.stopFloatingHearts();
          Animations.startFloatingHearts(document.getElementById('recipient-view'), 1400);
          Animations.startPetalDrift(document.getElementById('recipient-view'), 2800);
          Animations.startBalloonDrift(document.getElementById('recipient-view'), 5200);
        }
      });
    }
  },

  // Detach the previous gift's audio listeners before wiring a new track
  // chain (language switch re-renders the gift on the same <audio> node).
  cleanupRecipientMusic() {
    if (this.recipientMusicCleanup) {
      try { this.recipientMusicCleanup(); } catch (e) { /* ignore */ }
      this.recipientMusicCleanup = null;
    }
    // Drop any pending first-tap fallback from the previous gift.
    if (this._musicKickHandler) {
      try { document.removeEventListener('click', this._musicKickHandler); } catch (e) { /* ignore */ }
      this._musicKickHandler = null;
    }
  },

  // Re-render translatable gift content after a language switch
  // on the gift page (sender-written texts stay untouched).
  refreshRecipientLang() {
    const data = this.lastRecipientData;
    if (!data) return;
    data.lang = this.state.lang;
    const lang = this.state.lang;
    const occ = data.occasion || 'birthday';
    document.getElementById('recipient-greeting').textContent = Generator.getGreeting(data);
    document.getElementById('recipient-footer').textContent = Generator.getFooter(data);
    const galMeta = (this.occasionMetaFor(occ) || {}).galleryHead;
    if (galMeta) {
      const gh = document.querySelector('#recipient-gallery .recipient-gallery-heading');
      if (gh) gh.textContent = t(galMeta, lang);
    }
    const closingHearts = document.querySelector('#recipient-view .recipient-closing-hearts');
    if (closingHearts) {
      closingHearts.textContent = (this.occasionMetaFor(occ) || this.occasionMeta.birthday).closing;
    }
    // Keep the corner toggle + prompt labels translated too.
    const toggle = document.getElementById('btn-music-toggle');
    if (toggle && document.getElementById('music-controls').style.display !== 'none') {
      const st = this.recipientMusicState || 'paused';
      toggle.setAttribute('aria-label', st === 'playing' ? t('musicPause', lang) : (st === 'error' ? t('musicError', lang) : (st === 'loading' ? t('musicLoading', lang) : t('musicPlay', lang))));
    }
    const musicPrompt = document.getElementById('music-prompt');
    if (musicPrompt) musicPrompt.setAttribute('aria-label', t('musicPrompt', lang));
    this.translateCandles(lang);
    this.renderCenterpiece(occ, lang);
    this.renderRecipientDetails(data);
  },

  // Arabic year/unit plural helper: سنة/سنتان/سنوات/سنة.
  arYearWord(n) {
    if (n === 1) return 'سنة';
    if (n === 2) return 'سنتان';
    if (n >= 3 && n <= 10) return 'سنوات';
    return 'سنة';
  },

  arUnitWord(n, one, two, few, many) {
    if (n === 1) return one;
    if (n === 2) return two;
    if (n >= 3 && n <= 10) return few;
    return many;
  },

  // Birthday details block (countdown or plain text)
  renderRecipientDetails(data) {
    data.lang = this.state.lang || data.lang || 'en';
    const details = Generator.getOccasionDetails(data);
    const dob = data.fields && data.fields.dob;
    const info = dob ? Generator.getBirthdayInfo(dob) : null;
    this._cdMinuteKey = null;
    if (info) {
      const lang = this.state.lang || 'en';
      const turningAge = info.age + 1;
      const turning = lang === 'ar'
        ? `${t('turningWord', lang)} ${turningAge} ${this.arYearWord(turningAge)}`
        : `${t('turningWord', lang)} ${turningAge}`;
      document.getElementById('recipient-details').style.display = 'block';
      document.getElementById('recipient-details-content').innerHTML = `
        <div class="detail-label">${t('cdLabel', lang)}</div>
        <div class="detail-value">${turning}</div>
        <div class="countdown-grid" aria-hidden="true">
          <div class="countdown-box"><div class="countdown-num" id="cd-d">--</div><div class="countdown-label">${t('cdDays', lang)}</div></div>
          <div class="countdown-box"><div class="countdown-num" id="cd-h">--</div><div class="countdown-label">${t('cdHours', lang)}</div></div>
          <div class="countdown-box"><div class="countdown-num" id="cd-m">--</div><div class="countdown-label">${t('cdMins', lang)}</div></div>
          <div class="countdown-box"><div class="countdown-num" id="cd-s">--</div><div class="countdown-label">${t('cdSecs', lang)}</div></div>
        </div>
        <div class="visually-hidden" role="status" id="cd-status"></div>
      `;
      this.startBirthdayCountdown(dob);
    } else if (details) {
      document.getElementById('recipient-details').style.display = 'block';
      document.getElementById('recipient-details-content').innerHTML = `
        <div class="detail-label">${t('specialDetails', this.state.lang)}</div>
        <div class="detail-value"></div>
      `;
      document.querySelector('#recipient-details-content .detail-value').textContent = details;
    } else {
      document.getElementById('recipient-details').style.display = 'none';
    }
  },

  // Live ticking countdown to the next birthday (updates every second).
  // Parses the date as local time (avoids UTC-midnight shift) and keeps
  // ticking across midnight so a page left open never freezes.
  startBirthdayCountdown(dob) {
    const birthDate = (Generator.parseLocalDate ? Generator.parseLocalDate(dob) : null) || null;
    if (!birthDate) return;
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this._cdMinuteKey = null;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(v).padStart(2, '0');
    };
    const update = () => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // Leap babies celebrate Feb 28 in non-leap years (construct
      // directly — mutating a rolled-over Mar 1 would land on Mar 28).
      let tDay = birthDate.getDate();
      if (birthDate.getMonth() === 1 && tDay === 29) {
        const y = now.getFullYear();
        const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
        if (!isLeap) tDay = 28;
      }
      let target = new Date(now.getFullYear(), birthDate.getMonth(), tDay);
      const isToday = target.getMonth() === now.getMonth() && target.getDate() === now.getDate();
      if (!isToday && target < startOfToday) {
        const yNext = now.getFullYear() + 1;
        let dNext = birthDate.getDate();
        if (birthDate.getMonth() === 1 && dNext === 29) {
          const isLeapNext = (yNext % 4 === 0 && yNext % 100 !== 0) || (yNext % 400 === 0);
          if (!isLeapNext) dNext = 28;
        }
        target = new Date(yNext, birthDate.getMonth(), dNext);
      }
      const diff = target - now;
      const statusEl = document.getElementById('cd-status');
      if (isToday) {
        // Birthday itself: show zeros + greeting, but keep the timer
        // running so midnight rolls into next year's countdown.
        set('cd-d', 0); set('cd-h', 0); set('cd-m', 0); set('cd-s', 0);
        const label = document.querySelector('#recipient-details-content .detail-label');
        if (label) label.textContent = t('todayText', this.state.lang);
        if (statusEl) statusEl.textContent = t('todayText', this.state.lang);
        return;
      }
      if (diff <= 0) {
        set('cd-d', 0); set('cd-h', 0); set('cd-m', 0); set('cd-s', 0);
        return;
      }
      const s = Math.floor(diff / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor(s % 86400 / 3600);
      const m = Math.floor(s % 3600 / 60);
      set('cd-d', d);
      set('cd-h', h);
      set('cd-m', m);
      set('cd-s', s % 60);
      // Screen-reader summary: announce at most once per minute, never every second.
      const minuteKey = d + ':' + h + ':' + m;
      if (statusEl && this._cdMinuteKey !== minuteKey) {
        this._cdMinuteKey = minuteKey;
        const lang = this.state.lang || 'en';
        if (lang === 'ar') {
          statusEl.textContent = `متبقي ${d} ${this.arUnitWord(d, 'يوم', 'يومان', 'أيام', 'يوم')}، ${h} ${this.arUnitWord(h, 'ساعة', 'ساعتان', 'ساعات', 'ساعة')}، ${m} ${this.arUnitWord(m, 'دقيقة', 'دقيقتان', 'دقائق', 'دقيقة')}`;
        } else {
          statusEl.textContent = `${d} day${d === 1 ? '' : 's'}, ${h} hour${h === 1 ? '' : 's'}, ${m} minute${m === 1 ? '' : 's'} left`;
        }
      }
    };
    this.countdownTimer = setInterval(update, 1000);
    update();
  },

  // Interactive birthday cake: tap a candle (or the button)
  // to blow it out with a smoke puff. All out = wish + confetti.
  setupCake() {
    const row = document.getElementById('candles-row');
    if (!row) return;
    if (row.dataset.wired) {
      // Second gift in one page lifetime: restore fresh lit candles.
      if (row._blowTimers) {
        row._blowTimers.forEach(t => clearTimeout(t));
        row._blowTimers = null;
      }
      row.querySelectorAll('.candle').forEach(c => {
        c.classList.remove('out');
        c.setAttribute('aria-pressed', 'false');
      });
      this.translateCandles();
      const wishEl = document.getElementById('wish-text');
      if (wishEl) wishEl.style.display = 'none';
      const blowEl = document.getElementById('btn-blow');
      if (blowEl) blowEl.style.display = '';
      const relightEl = document.getElementById('btn-relight');
      if (relightEl) relightEl.style.display = 'none';
      return;
    }
    row.dataset.wired = '1';
    this.translateCandles();
    const candles = Array.from(row.querySelectorAll('.candle'));
    const wish = document.getElementById('wish-text');
    const blowBtn = document.getElementById('btn-blow');
    const relightBtn = document.getElementById('btn-relight');
    const host = document.getElementById('recipient-view');

    const blowOne = (c) => {
      if (c.classList.contains('out')) return;
      c.classList.add('out');
      c.setAttribute('aria-pressed', 'true');
      if (row.querySelectorAll('.candle:not(.out)').length === 0) {
        wish.style.display = 'block';
        blowBtn.style.display = 'none';
        relightBtn.style.display = 'inline-block';
        Animations.confettiShower(host, 70, 3500);
        Animations.celebrationBurst(host, 24);
      }
    };

    candles.forEach(c => c.addEventListener('click', () => blowOne(c)));
    blowBtn.addEventListener('click', () => {
      // Track staggered timers so Relight mid-sequence cancels pending blows.
      if (row._blowTimers) row._blowTimers.forEach(t => clearTimeout(t));
      row._blowTimers = candles.map((c, i) => setTimeout(() => blowOne(c), i * 200));
    });
    relightBtn.addEventListener('click', () => {
      if (row._blowTimers) {
        row._blowTimers.forEach(t => clearTimeout(t));
        row._blowTimers = null;
      }
      candles.forEach(c => {
        c.classList.remove('out');
        c.setAttribute('aria-pressed', 'false');
      });
      wish.style.display = 'none';
      relightBtn.style.display = 'none';
      blowBtn.style.display = 'inline-block';
    });
  },

  // Smooth scroll-triggered reveals for the gift page:
  // photos, message card, details card and closing all glide in
  // as the recipient scrolls to them.
  setupScrollReveals() {
    const root = document.getElementById('recipient-view');
    if (!root) return;
    const items = root.querySelectorAll('.recipient-gallery-item, .recipient-message-card, .recipient-details-card, .recipient-closing, .reveal');
    if (!items.length) return;

    // If IntersectionObserver unavailable, show all immediately
    if (!('IntersectionObserver' in window)) {
      items.forEach(item => item.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
      // The gift page scrolls the document (viewport), not an inner
      // container — observe against the viewport (default root).
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(item => observer.observe(item));
    this.enableGalleryTilt();
  },

  // Gentle 3D tilt following the pointer over gift photos.
  // Desktop pointers only; touch devices use the tap (:active) styles.
  enableGalleryTilt() {
    if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;
    if (Animations.calmMode()) return;
    const root = document.getElementById('recipient-view');
    if (!root || root.dataset.tiltOn) return;
    root.dataset.tiltOn = '1';
    const resetAll = () => {
      root.querySelectorAll('.recipient-gallery-item').forEach(el => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    };
    root.addEventListener('mousemove', (e) => {
      const card = e.target.closest ? e.target.closest('.recipient-gallery-item') : null;
      root.querySelectorAll('.recipient-gallery-item').forEach(el => {
        if (el === card && el.classList.contains('visible')) {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          el.style.setProperty('--ry', (px * 8).toFixed(2) + 'deg');
          el.style.setProperty('--rx', (-py * 8).toFixed(2) + 'deg');
        } else {
          el.style.setProperty('--rx', '0deg');
          el.style.setProperty('--ry', '0deg');
        }
      });
    });
    root.addEventListener('mouseleave', resetAll);
  },

  // Toggle music. On the gift page this delegates to the recipient
  // track-fallback controller (floating + end-page buttons stay in
  // sync); in the creator flow it toggles whatever is loaded, if any.
  toggleMusic() {
    if (this.recipientMusicToggle &&
        document.getElementById('recipient-view').style.display === 'block') {
      this.recipientMusicToggle();
      return;
    }
    const music = document.getElementById('bg-music');
    const btn = document.getElementById('btn-music-toggle');
    const icon = document.getElementById('btn-music-icon');
    const lang = this.state.lang || 'en';
    if (!music || (!music.src && !music.currentSrc)) return;

    if (music.paused) {
      music.play().then(() => {
        if (icon) icon.textContent = '⏸';
        btn.setAttribute('aria-label', t('musicPause', lang));
        btn.setAttribute('aria-pressed', 'true');
        btn.classList.remove('play-hint');
        btn.classList.add('playing');
      }).catch(() => {});
    } else {
      music.pause();
      if (icon) icon.textContent = '▶';
      btn.setAttribute('aria-label', t('musicPlay', lang));
      btn.setAttribute('aria-pressed', 'false');
      btn.classList.remove('playing');
    }
  },

  // Reset state (keeps the creator's language; clears timers + audio)
  reset() {
    const keepLang = this.state.lang || 'en';
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.stopSongPreview();
    this.songWarmupAudio = null;
    this.songWarmupUrl = '';
    this.cleanupRecipientMusic();
    const bg = document.getElementById('bg-music');
    if (bg) {
      try { bg.pause(); } catch (e) { /* ignore */ }
      bg.removeAttribute('src');
      bg.preload = 'none';
    }
    document.getElementById('music-controls').style.display = 'none';
    const musicPrompt = document.getElementById('music-prompt');
    if (musicPrompt) {
      musicPrompt.style.display = 'none';
      try { musicPrompt.onclick = null; } catch (e) { /* ignore */ }
    }
    // Restore the creator-flow toggle (cleanup nulled the gift handler).
    const musicToggle = document.getElementById('btn-music-toggle');
    if (musicToggle) {
      musicToggle.onclick = () => {
        this.toggleMusic();
      };
    }
    Animations.stopFloatingHearts();
    // Cancel any pending staggered cake timers.
    try {
      const row = document.getElementById('candles-row');
      if (row && row._blowTimers) {
        row._blowTimers.forEach(t => clearTimeout(t));
        row._blowTimers = null;
      }
    } catch (e) { /* ignore */ }
    this.isGenerating = false;
    this.isPreviewing = false;
    this.lastRecipientData = null;
    this.lastShareNote = '';
    this.lastPreviewData = null;
    this._cdMinuteKey = null;

    this.state = {
      currentSection: 'hero',
      lang: keepLang,
      occasion: null,
      relationship: null,
      customRelationship: '',
      name: '',
      fields: {},
      messageMode: 'auto',
      customMessage: '',
      theme: 'classic',
      musicEnabled: true,
      photos: {},
      photoUrls_fromFiles: {},
      photoSlotSeq: 0,
      songChoice: '',
      songChoiceName: '',
      selectedTheme: 'classic'
    };

    // Clear any inline hiding left by the recipient view, then reset UI
    document.querySelectorAll('.section').forEach(s => { s.style.display = ''; });
    document.getElementById('recipient-view').style.display = 'none';
    document.body.style.background = '';
    document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('#relationship-grid .card').forEach(c => { c.style.display = ''; });
    document.getElementById('custom-relationship-wrap').style.display = 'none';
    document.getElementById('custom-relationship').value = '';
    document.querySelectorAll('.theme-swatch.active').forEach(s => {
      s.classList.remove('active');
      if (s.dataset.theme === 'classic') s.classList.add('active');
    });
    document.getElementById('recipient-name').value = '';
    ['birthday-date', 'anniversary-date', 'years-together', 'thank-you-reason', 'love-reason'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.querySelectorAll('.occasion-field').forEach(f => { f.style.display = 'none'; });

    // Rebuild photo slots fresh (3 starter slots, unlimited after)
    document.getElementById('photos-grid').innerHTML = '';
    this.state.photos = {};
    this.state.photoUrls_fromFiles = {};
    this.state.photoSlotSeq = 0;
    this.addPhotoSlot();
    this.addPhotoSlot();
    this.addPhotoSlot();

    this.setMessageMode('auto');
    document.getElementById('custom-message').value = '';
    document.getElementById('music-toggle').checked = true;
    this.state.songChoice = '';
    this.state.songChoiceName = '';
    this.stopSongPreview();
    const songName = document.getElementById('song-choice-name');
    if (songName) songName.textContent = t('songDefaultName', this.state.lang);
    const songPicker = document.getElementById('song-choice-picker');
    if (songPicker) songPicker.style.display = 'none';

    // Reset recipient view sections
    document.getElementById('recipient-gallery').style.display = 'none';
    document.getElementById('recipient-details').style.display = 'none';
    document.getElementById('recipient-main-photo').style.display = 'none';

    // Remove any dynamically added captions
    const mainCaption = document.getElementById('recipient-main-caption');
    if (mainCaption) mainCaption.remove();

    // Clear stale output DOM so the next gift starts fresh.
    const previewContent = document.getElementById('preview-content');
    if (previewContent) previewContent.innerHTML = '';
    const shareLink = document.getElementById('share-link');
    if (shareLink) shareLink.value = '';
    const qrImage = document.getElementById('qr-image');
    if (qrImage) qrImage.removeAttribute('src');
    const qrDownload = document.getElementById('qr-download');
    if (qrDownload) {
      qrDownload.removeAttribute('href');
      try { qrDownload.onclick = null; } catch (e) { /* ignore */ }
    }
    const galleryGrid = document.getElementById('recipient-gallery-grid');
    if (galleryGrid) galleryGrid.innerHTML = '';
    const detailsContent = document.getElementById('recipient-details-content');
    if (detailsContent) detailsContent.innerHTML = '';
    const recipientRoot = document.getElementById('recipient-view');
    if (recipientRoot) {
      try { delete recipientRoot.dataset.tiltOn; } catch (e) { recipientRoot.removeAttribute('data-tilt-on'); }
      recipientRoot.removeAttribute('data-occasion');
    }

    // Restore default theme on the page
    document.documentElement.setAttribute('data-theme', 'classic');

    // Restore base language
    this.applyLang();

    Animations.startHeroAnimation();
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
