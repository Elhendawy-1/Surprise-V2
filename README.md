# Send Love & Warmth — Personalized Gift Website

Create a beautiful animated gift page for someone special — Birthday, Valentine, Anniversary, Thank You, or Just Because — then share it with a link or QR code. When they open it, they get a full-screen scrolling celebration: greeting, your chosen photos with captions, personal message, music, floating hearts, flower petals, balloons, and confetti.

**Live demo:** https://elhendawy-1.github.io/Surprise-V2/

**Repo:** https://github.com/Elhendawy-1/Surprise-V2

No frameworks, no build step, no server — just open `index.html` or host it on GitHub Pages. Bilingual (English / العربية), mobile-friendly.

---

## How it works

**Creating a gift (5 steps):**
1. **Topic** — Birthday, Valentine, Anniversary, Thank You, or Just Because
2. **Who** — Mom, Dad, Sister, Brother, Aunt, Friend, Husband, Wife, Boyfriend, Girlfriend, or Other (type anyone, e.g. Grandma)
3. **Details** — name, topic fields (birth date, anniversary date + years together, love reason, thank-you reason…), unlimited photos with captions
4. **Message + Theme + Music** — auto-generated text or write your own, 6 romantic palettes (Classic, Soft, Deep, Dark, Elegant, Warm), background music on/off with song picker
5. **Share** — shortened link + QR code to send (Copy, Open in New Tab, Download QR)

**Opening a gift:** the link carries everything in the URL hash itself (Base64 JSON, no database), so the recipient sees the animated scrolling page with photos, message, music, and celebration — on any device, no login needed.

---

## Photos — 2 ways to add them

| Method | Reliability | Notes |
|--------|-------------|-------|
| **Upload from device** | Best effort | Tries free image hosts; if blocked, the photo is packed into the link automatically (use the Copy button for packed links, QR may be too dense) |
| **Paste Google Drive link** | Always works | Share the file in Drive as "Anyone with the link can view", then paste that link — links stay short, so the QR code stays scannable. A green check confirms the image loads |

Each photo gets its own caption, shown beneath it in a *Sweet Memories* gallery right above the message. All photos display 100% uncropped.

---

## Music

The gift plays background music after the recipient's first tap (browsers block autoplay), with a play/stop button. Pick any bundled track from `assets/music/` via the song picker, or keep the topic default. Toggle music on/off in the customize form.

Bundled tracks in `assets/music/`:

- `song.mp3` — default background song (replace it with your own MP3 to change the default)
- `clavier-music-fur-elise-beethoven-216331.mp3` — Für Elise
- `Kevin_MacLeod_-_Canon_in_D_Major(chosic.com).mp3` — Pachelbel's Canon in D
- `Gymnopedie_No._1_(ISRC_USUAN1100787).mp3` — Gymnopédie No. 1 (Kevin MacLeod, CC-BY 3.0)
- `anneliese-von-koenig-clairedelune-faure-anneliese-von-koenig-mezzo-125019.mp3` — Clair de Lune
- `alex-morgan-calm-piano-541028.mp3` / `leberch-piano-513745.mp3` — calm piano extras

**More free classical tracks (tap to preview, right-click to download):**

| Topic idea | Track | License | Download page |
|-------|-------|---------|---------------|
| Birthday | Ode to Joy — US Air Force Band of the Rockies | Public domain | https://commons.wikimedia.org/wiki/File:Ode_to_Joy_-_Concert_Band_-_United_States_Air_Force_Band_of_the_Rockies.mp3 |
| Valentine | Für Elise — Audionautix (piano) | CC-BY | https://commons.wikimedia.org/wiki/File:Audionautix-com-ccby-furelise.mp3 |
| Anniversary | Pachelbel's Canon in D (P. 37) | Public domain | https://commons.wikimedia.org/wiki/File:Johann_Pachelbel_Canon_P_37_1694.mp3 |
| Thank You | Gymnopédie No. 1 — Kevin MacLeod | CC-BY 3.0 | https://commons.wikimedia.org/wiki/File:Gymnopedie_No._1_(ISRC_USUAN1100787).mp3 |
| Just Because | Clair de Lune (brass) — US Air Force Band of Flight | Public domain | https://commons.wikimedia.org/wiki/File:Clair_de_Lune_-_Wright_Brass_-_United_States_Air_Force_Band_of_Flight.mp3 |

To add a track to the picker, just drop the MP3 into `assets/music/` and push — the picker lists the folder via the GitHub API.

---

## Project structure

```
index.html                  Main page (creator flow + gift view)
.nojekyll                   Tells GitHub Pages not to use Jekyll
css/
  styles.css                Layout and components
  themes.css                6 theme palettes (CSS variables)
  animations.css            Keyframes and scroll-reveal system
js/
  app.js                    Flow, forms, song picker, link generation
  generator.js              Messages, greetings, age logic
  share.js                  Image upload, URL encode/decode, shortening, QR
  animations.js             Hearts, petals, balloons, confetti, bursts
  i18n.js                   English / Arabic strings
assets/
  images/og-preview.png     Social preview image (og:image / twitter:image)
  music/*.mp3               Bundled background songs + song picker source
  photos/.gitkeep           User-uploaded photos land here (via optional GitHub token)
.github/workflows/pages.yml GitHub Pages deploy workflow
```

---

## Run locally

Just open `index.html` in a browser — no build needed. For full features (song picker via GitHub API, share links), serve over HTTP:

```bash
npx serve .
# or
python -m http.server 8000
```

---

## Deploy to GitHub Pages

This repo is already configured for **Surprise-V2**:

- Live URL: `https://elhendawy-1.github.io/Surprise-V2/`
- Workflow: `.github/workflows/pages.yml` (deploys `main` on every push)

To enable / verify:
1. GitHub → repo **Settings → Pages** → **Source: GitHub Actions**
2. Push to `main` — the site updates automatically

To fork under a different name:
1. Update `siteGallery.repo` in `js/app.js` and `imageHost.githubRepo` in `js/share.js` to `YOUR-USERNAME/YOUR-REPO`
2. Update `og:image` / `twitter:image` URLs in `index.html`
3. Update the **Live demo** link at the top of this README

Share links and QR codes adapt to whatever address the site runs on.

---

## Customize

- **Messages:** edit the templates, greetings, and sign-offs in `js/generator.js`
- **Languages:** edit strings in `js/i18n.js` (English + Arabic)
- **Gallery / songs source:** change `siteGallery.repo` in `js/app.js` if you fork under a different name
- **Photo slots:** unlimited — tap Add Photo as many times as you like; each slot has file upload, URL paste, and caption
- **Link payload:** gift data is Base64 JSON in the URL hash — no database involved

---

Made with love, for every occasion.
