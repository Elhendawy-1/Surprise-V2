# Send Love & Warmth — Personalized Gift Website 💝

Create a beautiful animated gift page for someone special — Birthday, Valentine, Anniversary, Thank You, or Just Because — then share it with a link or QR code.

When they open it, they get a full-screen scrolling celebration: greeting, interactive cake or centerpiece, your chosen photos with captions, personal message, live countdown, background music, floating hearts, flower petals, balloons, and confetti.

**Live demo:** [https://elhendawy-1.github.io/Surprise-V2/](https://elhendawy-1.github.io/Surprise-V2/) ✨

No frameworks, no build step, no server, no database — just open `index.html` or host it on GitHub Pages. Bilingual English / العربية, mobile-friendly.

---

## Features

- **5 occasions:** Birthday 🎂, Valentine 💘, Anniversary 🥂, Thank You 🙏, Just Because 💌
- **11 relationships + custom:** Mom, Dad, Sister, Brother, Aunt, Friend, Husband, Wife, Boyfriend, Girlfriend, Other (type anyone, e.g. Grandma)
- **Unlimited photos with captions** — upload from device (with auto-compress) or paste Google Drive / Dropbox / image links, live load check per photo
- **Auto or custom message** — 55 message templates per language (11 relationships × 5 occasions), in English + Arabic, or write your own
- **6 romantic themes:** Classic, Soft, Deep, Dark, Elegant, Warm (CSS variables, instant preview)
- **Background music** — bundled MP3 picker (lists `assets/music/` via GitHub API) + per-topic streaming fallback, tap-to-play safe for mobile browsers
- **Recipient celebration page:** greeting, blow-out-the-candles cake (birthday/anniversary), animated centerpiece (valentine/thank-you/just-because), Sweet Memories gallery, message card, live birthday/anniversary countdown, ambient hearts + petals + balloons + confetti
- **Share via link + QR** — gift data lives in the URL hash (Base64 JSON), optional URL shortening (TinyURL / is.gd / CleanURI), QR via goqr.me API with download button
- **Bilingual UI** — full English / Arabic toggle, Arabic fonts included

---

## How it works

### Creating a gift

1. **Topic** — pick Birthday, Valentine, Anniversary, Thank You, or Just Because
2. **Who** — pick one of the 11 relationships, or Other → type any name (e.g. Grandma)
3. **Details** — recipient name + topic fields:
   - Birthday: date of birth (age + countdown)
   - Valentine: what you love about them
   - Anniversary: anniversary date + years together
   - Thank You: what you are thanking them for
   - Unlimited photos, each with its own caption
4. **Message, theme, music** — auto-generated message or your own text, 6 theme palettes, music on/off + song picker with preview
5. **Preview** — see exactly what they will see before sending
6. **Share** — get a shortened link + QR code (Copy, Open in New Tab, Download QR)

### Opening a gift

The link carries everything in the URL hash itself — no login, no server. The recipient opens it on any device and sees the animated scrolling gift page with photos, message, music, and celebration.

If a link was cut short while sharing, a friendly “link looks broken” notice is shown instead.

---

## Photos — 2 ways to add them

| Method | Reliability | Notes |
|--------|-------------|-------|
| **Upload from device** | Best effort | Images are compressed in-browser, then tried on free hosts (optional GitHub repo upload via personal token, ImgBB, picrd, catbox). If all fail, a thumbnail is packed into the link automatically — use the Copy button for packed links, QR may get too dense |
| **Paste image / Drive link** | Always works | Share the Drive file as “Anyone with the link can view”, then paste it — links stay short so the QR stays scannable. A green check confirms the image loads. GitHub `blob` links, Dropbox links, and direct image URLs are normalized automatically |

- Unlimited slots — tap **Add Photo** as many times as you like
- 10 MB per-file limit, HEIC is detected with a hint to screenshot it
- Gallery shows photos 100% uncropped in the *Sweet Memories* lane with scroll-reveal + tilt

---

## Music

- Default background track: `assets/music/song.mp3` (replace it with your own MP3 to change the default)
- **Song picker:** lists every `assets/music/*.{mp3,wav,ogg,m4a}` in the repo via the GitHub API — tap to preview, tap a track to select it
- **Per-topic streaming fallback** (Wikimedia Commons, plays if no custom song is chosen):
  - Valentine → Für Elise (Audionautix, piano)
  - Anniversary → Pachelbel’s Canon in D
  - Thank You → Gymnopédie No. 1 (Kevin MacLeod, CC-BY 3.0)
  - Just Because → Clair de Lune (brass, US Air Force Band of Flight)
  - Birthday → bundled `song.mp3`
- Plays after the recipient’s first tap (browsers block autoplay), with play/pause button + tap-to-play prompt. Loops continuously.

Bundled tracks in `assets/music/`: `song.mp3`, Für Elise, Canon in D, Gymnopédie No. 1, Clair de Lune, plus calm piano extras. To add a track to the picker, just drop the MP3 into `assets/music/` and push.

---

## Project structure

```
index.html                  Main page (creator flow + recipient gift view)
.nojekyll                   Disables Jekyll on GitHub Pages
.gitignore                  OS / editor / log ignores
css/
  styles.css                Layout, components, design tokens
  themes.css                6 theme palettes (CSS variables)
  animations.css            Keyframes + scroll-reveal system
js/
  app.js                    Creator flow, forms, song picker, link generation, recipient render
  generator.js              55 message templates + greetings + footers per language, age/countdown logic
  share.js                  Image upload, URL encode/decode, shortening, QR
  i18n.js                   English / Arabic UI strings (~130 keys each)
  animations.js             Hearts, petals, balloons, confetti, bursts, particles
assets/
  images/og-preview.png     Social preview (og:image / twitter:image, 1200×630)
  music/*.mp3               Bundled songs + song-picker source (7 tracks)
  photos/.gitkeep           Upload target for optional GitHub-token photo uploads
.github/workflows/pages.yml GitHub Pages deploy (Actions, on push to main)
```

---

## Run locally

No install needed — just open `index.html`. For full features (song picker, share links, QR), serve over HTTP:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open `http://localhost:8000` (or `:3000` for `serve`).

---

## Deploy to GitHub Pages

This repo is already configured for **Surprise-V2**:

- Live URL: [https://elhendawy-1.github.io/Surprise-V2/](https://elhendawy-1.github.io/Surprise-V2/)
- Workflow: `.github/workflows/pages.yml` (deploys `main` on every push via `actions/deploy-pages`)

To enable / verify: GitHub → repo **Settings → Pages → Source: GitHub Actions**, then push to `main`.

To fork under a different name:

1. Update `siteGallery.repo` in `js/app.js` and `imageHost.githubRepo` in `js/share.js` to `YOUR-USERNAME/YOUR-REPO`
2. Update `og:image` / `twitter:image` / `canonical` / `og:url` in `index.html`
3. Update the **Live demo** link at the top of this README

Share links and QR codes adapt to whatever address the site runs on (including `file://`).

---

## Customize

- **Messages:** templates, greetings, and sign-offs in `js/generator.js` (`templates` / `templatesAr`, `greetings` / `greetingsAr`, `footers` / `footersAr`)
- **Languages:** UI strings in `js/i18n.js` (`I18N.en` / `I18N.ar`)
- **Songs:** add/remove MP3s in `assets/music/` — the picker updates automatically
- **Link payload:** gift data is Base64 JSON in the URL hash — no database involved

---

## Tech stack

Vanilla HTML / CSS / JS — no frameworks, no build, no npm. Scripts load as globals in order: `animations → generator → share → i18n → app`.

- Fonts (Google Fonts CDN): Playfair Display + Lora + Dancing Script (Latin), Cairo + Aref Ruqaa (Arabic)
- QR codes: goqr.me API (`api.qrserver.com`)
- Optional APIs: GitHub REST/Contents (music list + photo upload), ImgBB / picrd / catbox (images), TinyURL / is.gd / CleanURI (short links), Wikimedia Commons (streaming songs), Google Drive thumbnails
- Hosting: GitHub Pages static (`.nojekyll` + Actions workflow)

---

Made with love, for every occasion. 💖
