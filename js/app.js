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
    // Check if this is a recipient view (URL has hash data)
    if (window.location.hash && window.location.hash.length > 1) {
      const hash = window.location.hash.substring(1);
      const data = Share.decodeData(hash);
      if (data) {
        this.showRecipientView(data);
        return;
      }
      // Hash present but unreadable: the link was cut short while sharing.
      // Show a clear message instead of the empty creator page.
      this.bindEvents();
      this.applyLang();
      this.showSection('broken');
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

  // Build one photo slot (unlimited - the user adds as many as they like)
  addPhotoSlot() {
    const slot = this.state.photoSlotSeq++;
    const grid = document.getElementById('photos-grid');
    const lang = this.state.lang || 'en';
    const div = document.createElement('div');
    div.className = 'photo-slot';
    div.dataset.slot = slot;
    div.innerHTML =
      '<div class="photo-upload-area" id="photo-upload-area-' + slot + '">' +
        '<input type="file" accept="image/*" class="file-input photo-file-input" data-slot="' + slot + '" aria-label="Upload photo">' +
        '<div class="photo-preview" id="photo-preview-' + slot + '" style="display:none;">' +
          '<img id="photo-preview-img-' + slot + '" alt="Photo preview">' +
          '<button type="button" class="btn-remove photo-remove-btn" data-slot="' + slot + '" aria-label="Remove photo">&times;</button>' +
        '</div>' +
        '<div class="photo-placeholder" id="photo-placeholder-' + slot + '">' +
          '<span class="upload-icon">&#128247;</span>' +
          '<span>+ Add Photo</span>' +
        '</div>' +
      '</div>' +
      '<input type="text" class="photo-url-input" data-slot="' + slot + '" data-i18n-ph="urlPh" aria-label="Photo link" placeholder="' + this.escapeHtml(t('urlPh', lang)) + '">' +
      '<input type="text" class="photo-text-input" data-slot="' + slot + '" data-i18n-ph="captionPh" aria-label="Photo caption" placeholder="' + this.escapeHtml(t('captionPh', lang)) + '">';
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
        btn.textContent = success ? t('copiedBtn', lang) : 'Failed';
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
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n, lang);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPh, lang);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.dataset.i18nHtml;
      el.innerHTML = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || '';
    });
    const toggle = document.getElementById('lang-toggle');
    if (toggle) {
      toggle.textContent = lang === 'ar' ? 'EN' : 'عربي';
      toggle.setAttribute('aria-label', t('langSwitch', lang));
    }
    // Keep dynamic slot labels translated as well.
    document.querySelectorAll('.photo-file-input').forEach(el => {
      el.setAttribute('aria-label', lang === 'ar' ? 'ارفع صورة' : 'Upload photo');
    });
    document.querySelectorAll('.photo-url-input').forEach(el => {
      el.setAttribute('aria-label', lang === 'ar' ? 'رابط الصورة' : 'Photo link');
    });
    document.querySelectorAll('.photo-text-input').forEach(el => {
      el.setAttribute('aria-label', lang === 'ar' ? 'تعليق الصورة' : 'Photo caption');
    });
    document.querySelectorAll('.photo-remove-btn').forEach(el => {
      el.setAttribute('aria-label', lang === 'ar' ? 'إزالة الصورة' : 'Remove photo');
    });
    this.updateThemePreview();
    this.updateAutoMessage();
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
  },

  // Who each topic is for. Birthdays fit everyone; romantic topics
  // (Valentine, Anniversary) skip Mom, Dad and Aunt; gratitude and
  // spontaneous gifts fit everyone.
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
    const allowed = this.topicPeople[occasion] || this.topicPeople.birthday;
    document.querySelectorAll('#relationship-grid .card').forEach(card => {
      const ok = allowed.indexOf(card.dataset.relationship) !== -1;
      card.style.display = ok ? '' : 'none';
      card.classList.remove('selected');
    });
    this.state.relationship = null;
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
    if (!file.type.startsWith('image/')) {
      alert(t('alertNotImage', lang));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert(t('alertTooBig', lang));
      return;
    }
    if (/heic|heif/i.test(file.type) || /\.hei[c f]$/i.test(file.name || '')) {
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

  setUrlStatus(slot, ok, text) {
    const el = this.urlStatusEl(slot);
    if (!el) return;
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
    el.classList.toggle('status-ok', !!ok);
    el.classList.toggle('status-bad', !ok);
  },

  // Handle pasted URL - show live preview + clear OK / error feedback
  handlePhotoUrlInput(rawVal, slot) {
    const lang = this.state.lang || 'en';
    // Google Photos share pages are not embeddable images - explain the
    // Drive route instead of a confusing red error after a load failure.
    if (/photos\.app\.goo\.gl|photos\.google\.com\/share/i.test(rawVal || '')) {
      const img0 = document.getElementById(`photo-preview-img-${slot}`);
      const preview0 = document.getElementById(`photo-preview-${slot}`);
      const placeholder0 = document.getElementById(`photo-placeholder-${slot}`);
      if (img0) img0.removeAttribute('src');
      if (preview0) preview0.style.display = 'none';
      if (placeholder0) placeholder0.style.display = 'flex';
      this.setUrlStatus(slot, false, t('statusGooglePhotos', lang));
      return;
    }
    const val = Share.normalizeImageUrl(rawVal);
    const img = document.getElementById(`photo-preview-img-${slot}`);
    const preview = document.getElementById(`photo-preview-${slot}`);
    const placeholder = document.getElementById(`photo-placeholder-${slot}`);
    if (!img || !preview || !placeholder) return;
    // If a file is selected, file preview wins - don't override
    if (this.state.photos[slot]) return;
    if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
      this.setUrlStatus(slot, true, t('statusChecking', lang));
      img.onerror = () => {
        preview.style.display = 'none';
        placeholder.style.display = 'flex';
        // Drive links that fail almost always mean the file is not shared
        // as "Anyone with the link" - say so directly.
        const isDrive = /drive\.google\.com|drive\.usercontent\.google\.com/i.test(val);
        this.setUrlStatus(slot, false, t(isDrive ? 'statusDrivePrivate' : 'statusBad', lang));
      };
      img.onload = () => {
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        this.setUrlStatus(slot, true, t('statusOk', lang));
      };
      img.src = val;
      // Trigger load check for cached images
      if (img.complete && img.naturalWidth > 0) {
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        this.setUrlStatus(slot, true, t('statusOk', lang));
      }
    } else {
      preview.style.display = 'none';
      placeholder.style.display = 'flex';
      img.removeAttribute('src');
      this.setUrlStatus(slot, false, rawVal && rawVal.trim() ? t('statusNotLink', lang) : '');
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
    document.getElementById(`photo-preview-${slot}`).style.display = 'none';
    document.getElementById(`photo-placeholder-${slot}`).style.display = 'flex';
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

    const name = document.getElementById('recipient-name').value || 'their name';

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
    document.getElementById('song-choice-picker').style.display = 'none';
    this.renderSongChoice(this.siteGallery.musicCache || []);
  },

  // Preview the chosen song right in the form (tap again to stop).
  // Lazy: nothing downloads until the creator taps preview.
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
    audio.preload = 'none';
    audio.onerror = () => this.stopSongPreview();
    audio.onended = () => this.stopSongPreview();
    this.songPreviewAudio = audio;
    audio.src = src;
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
    const meta = this.occasionMeta[occ] || this.occasionMeta.birthday;
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
      wrap.onclick = () => {
        if (cfg.burst === 'hearts') Animations.celebrationBurst(host, 24);
        else if (cfg.burst === 'petals') Animations.petalShower(host, 3000, 220);
        else Animations.confettiShower(host, 60, 2500);
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
        ? (this.state.customRelationship || document.getElementById('custom-relationship')?.value.trim() || 'Loved One')
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
    // use the local preview dataURL so preview shows instantly
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
          continue;
        }
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
    this.isPreviewing = true;
    const btn = document.getElementById('btn-preview');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }
    try {
      const data = this.collectPreviewData();
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
      // Upload file-based photos (non-blocking - continue even if uploads fail)
      const slots = this.photoSlots();
      const uploadedUrls = {};
      const fileSlots = slots.filter(s => this.state.photos[s]);
      let done = 0;
      for (const i of fileSlots) {
        done++;
        this.setLoadingStatus(t('loadUploading', lang, { a: done, b: fileSlots.length }));
        try {
          console.log('Uploading photo ' + (i + 1) + '...');
          const url = await Share.uploadImage(this.state.photos[i]);
          if (url) {
            uploadedUrls[i] = url;
            console.log('Photo ' + (i + 1) + ' uploaded:', url);
          } else {
            console.warn('Photo ' + (i + 1) + ' upload returned null');
          }
        } catch (photoErr) {
          console.warn('Photo ' + (i + 1) + ' upload failed:', photoErr);
        }
      }
      this.state.photoUrls_fromFiles = uploadedUrls;

      // Last resort for device photos that failed to upload:
      // embed thumbnails directly in the link (no hosting needed).
      // Tries bigger thumbnails first, then smaller ones, so that
      // EVERY photo gets in whenever the link budget allows.
      let embedded = 0;
      const skipped = [];
      let heicWarned = false;
      const tiers = [{ w: 512, q: 0.6 }, { w: 384, q: 0.55 }, { w: 256, q: 0.5 }];
      for (const i of fileSlots) {
        if (!uploadedUrls[i]) {
          this.setLoadingStatus(t('loadPacking', lang, { a: i + 1 }));
          let placed = false;
          for (const tier of tiers) {
            try {
              const thumb = await Share.makeThumbnailDataUrl(this.state.photos[i], tier.w, tier.q);
              if (!thumb) continue;
              uploadedUrls[i] = thumb;
              this.state.photoUrls_fromFiles = uploadedUrls;
              const trialLength = Share.generateFullUrl(this.collectData()).length;
              if (trialLength <= (Share.imageHost.maxEmbedLinkLength || 60000)) {
                embedded++;
                placed = true;
                console.log('Photo ' + (i + 1) + ' embedded at ' + tier.w + 'px (' + thumb.length + ' chars)');
                break;
              }
              uploadedUrls[i] = null; // too big at this size - try smaller tier
            } catch (thumbErr) {
              console.warn('Photo ' + (i + 1) + ' embed failed:', thumbErr && thumbErr.message);
              if (!heicWarned && thumbErr && /HEIC/i.test(thumbErr.message || '')) {
                heicWarned = true;
                alert(t('alertHeic', lang));
              }
              break; // decode errors won't improve with smaller tiers
            }
          }
          if (!placed) {
            uploadedUrls[i] = null;
            skipped.push(i + 1);
            console.warn('Photo ' + (i + 1) + ' could not fit into the link, skipped');
          }
        }
      }
      this.state.photoUrls_fromFiles = uploadedUrls;

      // Re-collect data with uploaded / embedded URLs
      const finalData = this.collectData();
      console.log('Photo URLs for link:', finalData.photoUrls.length);

      if (fileSlots.length > 0 && finalData.photoUrls.length === 0) {
        alert(t('alertNoPhotos', lang));
      }

      this.setLoadingStatus(t('loadCreating', lang));
      const fullUrl = Share.generateFullUrl(finalData);
      console.log('Full URL length:', fullUrl.length);

      const shortUrl = await Share.shortenUrl(fullUrl);

      // Update share section
      document.getElementById('share-link').value = shortUrl;
      const subtitle = document.querySelector('#section-share .section-subtitle');
      const photoCount = finalData.photoUrls.length;
      let note = t('noteDefault', lang);
      if (embedded > 0 && skipped.length === 0) {
        note = t('noteEmbedded', lang, { a: photoCount });
      } else if (skipped.length > 0) {
        note = t('noteSkipped', lang, { a: skipped.join(', ') });
        alert(t('alertSkipped', lang, { a: skipped.join(', ') }));
      }
      // QR codes only scan when the link is short. Huge links (packed photos)
      // produce codes no camera can read, so hide the code and say so.
      const qrBox = document.getElementById('share-qr');
      if (shortUrl.length <= 2000) {
        const qrUrl = Share.getQrCodeUrl(shortUrl);
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
      if (shortUrl.length > 8000) {
        note += ' ' + t('noteTruncate', lang);
      }
      subtitle.textContent = note;

      this.showSection('share');
    } catch (err) {
      console.error('Error generating link:', err);
      alert(t('alertError', lang, { a: err.message }));
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
        html += `<img src="${this.escapeHtml(safeUrl)}" alt="Memory ${i + 1}" referrerpolicy="no-referrer" style="width: 100%; border-radius: 12px; object-fit: cover; box-shadow: 0 4px 15px var(--shadow);" onerror="this.parentNode.style.display='none'">`;
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
        galleryHtml += `<img src="${this.escapeHtml(safeUrl)}" alt="Memory ${i + 1}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.style.display='none'">`;
        if (photoTexts[i]) {
          galleryHtml += `<div class="gallery-item-text">${this.escapeHtml(photoTexts[i])}</div>`;
        }
        galleryHtml += '</div>';
      }

      galleryGrid.innerHTML = galleryHtml;

      // Per-topic gallery heading
      const galMeta = (this.occasionMeta[occ] || {}).galleryHead;
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
      closingHearts.textContent = (this.occasionMeta[occ] || this.occasionMeta.birthday).closing;
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

    // Music: browsers block autoplay, so show a clear tap-to-play
    // prompt. The first tap starts the song for sure.
    // Each topic gets its own recommended track; the bundled song
    // is the fallback if a stream fails.
    // Lazy: the <audio> element carries no src on page load — the track
    // is assigned here only, so no audio downloads until a gift with
    // music is actually opened.
    // The floating button AND the end-page (closing section) button are
    // wired to the same toggle, so pause / resume works everywhere —
    // including at the end of the gift.
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
      const prompt = document.getElementById('music-prompt');
      const toggle = document.getElementById('btn-music-toggle');
      const controls = document.getElementById('music-controls');
      const endBtn = document.getElementById('btn-music-end');

      const endLabel = (next, lang) => {
        if (next === 'playing') return '⏸ ' + t('musicPause', lang);
        if (next === 'loading') return '… ' + t('musicLoading', lang);
        if (next === 'error') return '↻ ' + t('musicError', lang);
        return '▶ ' + t('musicPlay', lang);
      };

      const setMusicState = (next) => {
        musicState = next;
        this.recipientMusicState = next;
        const lang = this.state.lang || 'en';
        const icon = document.getElementById('btn-music-icon');
        toggle.classList.remove('playing', 'play-hint', 'loading');
        toggle.removeAttribute('disabled');
        if (next === 'playing') {
          hasPlayed = true;
          if (prompt) prompt.style.display = 'none';
          controls.style.display = 'block';
          if (icon) icon.textContent = '⏸';
          toggle.setAttribute('aria-label', t('musicPause', lang));
          toggle.setAttribute('aria-pressed', 'true');
          toggle.classList.add('playing');
        } else if (next === 'loading') {
          if (prompt) prompt.style.display = 'none';
          controls.style.display = 'block';
          if (icon) icon.textContent = '…';
          toggle.setAttribute('aria-label', t('musicLoading', lang));
          toggle.setAttribute('aria-pressed', 'false');
          toggle.classList.add('loading');
        } else if (next === 'error') {
          // Keep both controls visible: floating button shows "!" and
          // the prompt stays up so a tap retries the next fallback track.
          controls.style.display = 'block';
          if (prompt) prompt.style.display = 'block';
          if (icon) icon.textContent = '!';
          toggle.setAttribute('aria-label', t('musicError', lang));
          toggle.setAttribute('aria-pressed', 'false');
        } else {
          // paused / idle: the song is ready but not playing.
          // Keep the floating + end-page buttons visible (never hide the
          // controls once music is enabled) and invite a tap.
          controls.style.display = 'block';
          // Before the first play the prompt is the main invite; after a
          // pause it stays hidden so it never covers the end of the gift.
          if (prompt) prompt.style.display = hasPlayed ? 'none' : 'block';
          if (icon) icon.textContent = '▶';
          toggle.setAttribute('aria-label', t('musicPlay', lang));
          toggle.setAttribute('aria-pressed', 'false');
          toggle.classList.add('play-hint');
        }
        if (endBtn) {
          endBtn.style.display = '';
          endBtn.textContent = endLabel(next, lang);
          endBtn.setAttribute('aria-label', next === 'playing' ? t('musicPause', lang) : (next === 'error' ? t('musicError', lang) : (next === 'loading' ? t('musicLoading', lang) : t('musicPlay', lang))));
          endBtn.setAttribute('aria-pressed', next === 'playing' ? 'true' : 'false');
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
        // play invite — never a spinner dead-end, never autoplay.
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
        this.recipientEndLabel = null;
        // Detach stale closures so a later creator-flow button can never
        // drive the old gift's state machine.
        try {
          if (toggle) toggle.onclick = null;
          if (prompt) prompt.onclick = null;
          if (endBtn) endBtn.onclick = null;
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
          // Autoplay blocked or slow network: stay resumable, and keep
          // the prompt up so the next tap clearly retries.
          if (musicEl.paused) {
            hasPlayed = false;
            setMusicState('paused');
          }
        });
      };

      // Single toggle used by the floating button, the end-page button,
      // the prompt, and the first-tap-anywhere fallback — one source of
      // truth so pause / resume can never desync. Error state always
      // restarts (some browsers leave .paused false after a load error).
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
      this.recipientEndLabel = endLabel;

      prepareTrack();
      // Ready-to-play: controls (floating + end-page) stay visible, the
      // prompt invites the first tap. Nothing downloads or autoplays
      // until the user taps, satisfying browser autoplay policies.

      if (prompt) {
        prompt.onclick = toggleRecipientMusic;
      }
      // Fallback: any first tap anywhere also starts the music through
      // the same toggle, so UI state always stays in sync.
      // Re-armed per gift (old pending handler removed first) so every
      // gift gets the fallback without stacking duplicate listeners.
      if (this._musicKickHandler) {
        try { document.removeEventListener('click', this._musicKickHandler); } catch (e) { /* ignore */ }
      }
      this._musicKickHandler = (e) => {
        // Taps directly on the music buttons already toggle via their own
        // onclick — ignore them here or one gesture would toggle twice
        // (onclick + bubble to document = two concurrent play() calls).
        try {
          if (e && e.target && e.target.closest &&
              e.target.closest('#music-controls, #music-prompt, #btn-music-end')) {
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
      // Floating play / pause / retry toggle (overwrites the creator-flow
      // handler — onclick assignment, so no double-firing).
      toggle.onclick = toggleRecipientMusic;
      // End-page play / pause / retry toggle in the closing section.
      if (endBtn) {
        endBtn.onclick = toggleRecipientMusic;
      }
    } else {
      // Gift without music: tear down any previous gift's controller
      // first (second gift in one page lifetime), then hide everything.
      this.cleanupRecipientMusic();
      document.getElementById('music-controls').style.display = 'none';
      document.getElementById('music-prompt').style.display = 'none';
      const endBtn = document.getElementById('btn-music-end');
      if (endBtn) endBtn.style.display = 'none';
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
    if (!document.dataset.ambientWatch) {
      document.dataset.ambientWatch = '1';
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && document.getElementById('recipient-view').style.display === 'block') {
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
    const galMeta = (this.occasionMeta[occ] || {}).galleryHead;
    if (galMeta) {
      const gh = document.querySelector('#recipient-gallery .recipient-gallery-heading');
      if (gh) gh.textContent = t(galMeta, lang);
    }
    const closingHearts = document.querySelector('#recipient-view .recipient-closing-hearts');
    if (closingHearts) {
      closingHearts.textContent = (this.occasionMeta[occ] || this.occasionMeta.birthday).closing;
    }
    // Keep the end-page music button translated without breaking its
    // play / pause state (single label helper, shared with setMusicState).
    const endBtn = document.getElementById('btn-music-end');
    if (endBtn && endBtn.style.display !== 'none') {
      const st = this.recipientMusicState || 'paused';
      endBtn.textContent = (this.recipientEndLabel || ((s, l) => {
        if (s === 'playing') return '⏸ ' + t('musicPause', l);
        if (s === 'loading') return '… ' + t('musicLoading', l);
        if (s === 'error') return '↻ ' + t('musicError', l);
        return '▶ ' + t('musicPlay', l);
      }))(st, lang);
      endBtn.setAttribute('aria-label', st === 'playing' ? t('musicPause', lang) : (st === 'error' ? t('musicError', lang) : (st === 'loading' ? t('musicLoading', lang) : t('musicPlay', lang))));
    }
    // Keep the floating toggle + prompt labels translated too.
    const toggle = document.getElementById('btn-music-toggle');
    if (toggle && document.getElementById('music-controls').style.display !== 'none') {
      const st = this.recipientMusicState || 'paused';
      toggle.setAttribute('aria-label', st === 'playing' ? t('musicPause', lang) : (st === 'error' ? t('musicError', lang) : (st === 'loading' ? t('musicLoading', lang) : t('musicPlay', lang))));
    }
    const prompt = document.getElementById('music-prompt');
    if (prompt && prompt.style.display !== 'none') {
      const span = prompt.querySelector('[data-i18n="musicPrompt"]');
      if (span) span.textContent = t('musicPrompt', lang);
      else prompt.textContent = '🎵 ' + t('musicPrompt', lang);
    }
    this.renderCenterpiece(occ, lang);
    this.renderRecipientDetails(data);
  },

  // Birthday details block (countdown or plain text)
  renderRecipientDetails(data) {
    data.lang = this.state.lang || data.lang || 'en';
    const details = Generator.getOccasionDetails(data);
    const dob = data.fields && data.fields.dob;
    if (dob && !isNaN(new Date(dob).getTime())) {
      const info = Generator.getBirthdayInfo(dob);
      const lang = this.state.lang || 'en';
      const turning = lang === 'ar'
        ? `${t('turningWord', lang)} ${info ? info.age + 1 : ''} سنوات`
        : `${t('turningWord', lang)} ${info ? info.age + 1 : ''}`;
      document.getElementById('recipient-details').style.display = 'block';
      document.getElementById('recipient-details-content').innerHTML = `
        <div class="detail-label">${t('cdLabel', lang)}</div>
        <div class="detail-value">${turning}</div>
        <div class="countdown-grid">
          <div class="countdown-box"><div class="countdown-num" id="cd-d">--</div><div class="countdown-label">${t('cdDays', lang)}</div></div>
          <div class="countdown-box"><div class="countdown-num" id="cd-h">--</div><div class="countdown-label">${t('cdHours', lang)}</div></div>
          <div class="countdown-box"><div class="countdown-num" id="cd-m">--</div><div class="countdown-label">${t('cdMins', lang)}</div></div>
          <div class="countdown-box"><div class="countdown-num" id="cd-s">--</div><div class="countdown-label">${t('cdSecs', lang)}</div></div>
        </div>
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

  // Live ticking countdown to the next birthday (updates every second)
  startBirthdayCountdown(dob) {
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return;
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(v).padStart(2, '0');
    };
    const update = () => {
      const now = new Date();
      let target = new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate());
      const isToday = target.getMonth() === now.getMonth() && target.getDate() === now.getDate();
      if (!isToday && target <= now) {
        target = new Date(now.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
      }
      const diff = target - new Date();
      if (diff <= 0) {
        set('cd-d', 0); set('cd-h', 0); set('cd-m', 0); set('cd-s', 0);
        const label = document.querySelector('#recipient-details-content .detail-label');
        if (label) label.textContent = t('todayText', this.state.lang);
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        return;
      }
      const s = Math.floor(diff / 1000);
      set('cd-d', Math.floor(s / 86400));
      set('cd-h', Math.floor(s % 86400 / 3600));
      set('cd-m', Math.floor(s % 3600 / 60));
      set('cd-s', s % 60);
    };
    this.countdownTimer = setInterval(update, 1000);
    update();
  },

  // Interactive birthday cake: tap a candle (or the button)
  // to blow it out with a smoke puff. All out = wish + confetti.
  setupCake() {
    const row = document.getElementById('candles-row');
    if (!row || row.dataset.wired) return;
    row.dataset.wired = '1';
    const candles = Array.from(row.querySelectorAll('.candle'));
    const wish = document.getElementById('wish-text');
    const blowBtn = document.getElementById('btn-blow');
    const relightBtn = document.getElementById('btn-relight');
    const host = document.getElementById('recipient-view');

    const blowOne = (c) => {
      if (c.classList.contains('out')) return;
      c.classList.add('out');
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
      candles.forEach((c, i) => setTimeout(() => blowOne(c), i * 200));
    });
    relightBtn.addEventListener('click', () => {
      candles.forEach(c => c.classList.remove('out'));
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
    this.cleanupRecipientMusic();
    const bg = document.getElementById('bg-music');
    if (bg) {
      try { bg.pause(); } catch (e) { /* ignore */ }
      bg.removeAttribute('src');
      bg.preload = 'none';
    }
    document.getElementById('music-controls').style.display = 'none';
    document.getElementById('music-prompt').style.display = 'none';
    const musicEnd = document.getElementById('btn-music-end');
    if (musicEnd) {
      musicEnd.style.display = 'none';
      try { musicEnd.onclick = null; } catch (e) { /* ignore */ }
    }
    const musicPrompt = document.getElementById('music-prompt');
    if (musicPrompt) {
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
    this.isGenerating = false;
    this.isPreviewing = false;
    this.lastRecipientData = null;

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
