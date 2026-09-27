# Send Love & Warmth — Personalized Gift Website

Create a beautiful animated gift page for someone special — Birthday, Valentine, Anniversary, Thank You, or Just Because — then share it with a link or QR code. When they open it, they get a full-screen scrolling celebration: greeting, your chosen photos with captions, personal message, music, floating hearts, flower petals, balloons, and confetti.

**Live demo:** https://elhendawy-1.github.io/Surprise-V2/

No frameworks, no build step, no server — just open `index.html` or host it on GitHub Pages.

---

## How it works

**Creating a gift (6 steps):**
1. **Topic** — Birthday, Valentine, Anniversary, Thank You, or Just Because (Mom and Dad appear for birthdays; Valentine and Anniversary are for couples)
2. **Who** — pick from Husband, Wife, Boyfriend, Girlfriend, family, Friend, or Other (type anyone, e.g. Grandma)
3. **Details** — name, topic fields (birth date with age countdown, anniversary years, ...), unlimited photos with captions
4. **Message** — auto-generated text for the topic and person, or write your own
5. **Theme** — 6 romantic palettes: Classic, Soft, Deep, Dark, Elegant, Warm
6. **Share** — shortened link + QR code to send

**Opening a gift:** the link carries everything in the URL itself, so the birthday person sees the animated scrolling page with photos, message, music, and celebration — on any device, no login needed.

---

## Photos — 2 ways to add them

| Method | Reliability | Notes |
|--------|-------------|-------|
| **Upload from device** | Best effort | Tries free image hosts; if blocked, the photo is packed into the link automatically (use the Copy button for packed links, QR may be too dense) |
| **Paste Google Drive link** | Always works | Share the file in Drive as "Anyone with the link", then paste that link — links stay short, so the QR code stays scannable. A green check confirms the image loads |

Each photo gets its own caption, shown beneath it in a *Sweet Memories* lane right above the birthday message. All photos display 100% uncropped.

---

## Music

The gift plays background music after the recipient's first tap (browsers block autoplay), with a play/stop button. Each topic comes with its own recommended track that plays automatically — plus your bundled `assets/music/song.mp3` for birthdays (replace it with your own MP3 to change it). Toggle music on/off in the customize form.

**Recommended songs per topic (all free to use, tap to preview, right-click to download):**

| Topic | Track | License | Download page |
|-------|-------|---------|---------------|
| Birthday | Ode to Joy — US Air Force Band of the Rockies | Public domain | https://commons.wikimedia.org/wiki/File:Ode_to_Joy_-_Concert_Band_-_United_States_Air_Force_Band_of_the_Rockies.mp3 |
| Valentine | Für Elise — Audionautix (piano) | CC-BY | https://commons.wikimedia.org/wiki/File:Audionautix-com-ccby-furelise.mp3 |
| Anniversary | Pachelbel's Canon in D (P. 37) | Public domain | https://commons.wikimedia.org/wiki/File:Johann_Pachelbel_Canon_P_37_1694.mp3 |
| Thank You | Gymnopédie No. 1 — Kevin MacLeod | CC-BY 3.0 | https://commons.wikimedia.org/wiki/File:Gymnopedie_No._1_(ISRC_USUAN1100787).mp3 |
| Just Because | Clair de Lune (brass) — US Air Force Band of Flight | Public domain | https://commons.wikimedia.org/wiki/File:Clair_de_Lune_-_Wright_Brass_-_United_States_Air_Force_Band_of_Flight.mp3 |

To use one as the birthday default instead of your file, download it and save it as `assets/music/song.mp3`.

---

## Project structure

```
index.html                  Main page (creator flow + gift view)
css/
  styles.css                Layout and components
  themes.css                6 theme palettes (CSS variables)
  animations.css            Keyframes and scroll-reveal system
js/
  app.js                    Flow, forms, song picker, link generation
  generator.js              Birthday messages, greetings, age logic
  share.js                  Image upload, URL encode/decode, shortening, QR
  animations.js             Hearts, petals, balloons, confetti, bursts
assets/
  music/song.mp3            Background song (replace with your own)
```

---

## Deploy to GitHub Pages

**Option A — branch (simplest):** push this folder as the repo root → Settings → Pages → *Deploy from a branch* → `main` / `(root)`.

**Option B — Actions:** this repo includes `.github/workflows/pages.yml` → Settings → Pages → *GitHub Actions* instead.

Your site appears at `https://YOUR-USERNAME.github.io/REPO-NAME/`. Share links and QR codes adapt to whatever address the site runs on.

---

## Customize

- **Messages:** edit the templates, greetings, and sign-offs in `js/generator.js`
- **Gallery source:** change `siteGallery.repo` / `siteGallery.path` in `js/app.js` if you fork under a different name
- **Photo slots:** unlimited — tap Add Photo as many times as you like; each slot has file upload, URL paste, and caption
- **Link payload:** gift data is Base64 JSON in the URL hash — no database involved

---

Made with love, for every occasion.
