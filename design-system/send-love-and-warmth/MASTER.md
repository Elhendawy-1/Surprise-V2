# Send Love & Warmth — Master Design System

Source of truth for the recipient gift experience and shared tokens.
Stack: vanilla HTML / CSS / JS, no framework. Guidance stack used for
reference only: `html-tailwind` (never add Tailwind to this project).

Design intelligence: `ui-ux-pro-max` searches run 2026-10-09:
- `--design-system "entertainment gift romantic celebration mobile"` → Hero-Centric pattern (verified).
- `--domain color "romantic warm celebration gift"` → Gift & Wishlist / Dating / Wedding palettes (verified, basis for the six themes).
- `--domain typography "romantic elegant playful"` → Wedding/Romance script+serif (verified, matches Playfair/Dancing).
- `--domain gsap "scroll reveal stagger celebration"` → subtle scroll reveal + stagger (verified).
- `--domain ux "mobile touch target spacing"`, `"reduced motion animation"` (verified).
- `--stack html-tailwind "animation performance mobile"` (verified).
- Zero-result queries (explicit fallback, not DB matches): `style "romantic warm celebration"`,
  `product "entertainment celebration"`, `landing "hero celebration"` → general defaults below.

## 1. Product principles

1. Romance first, tool second. Warm gradients, script headings, hearts/petals/balloons/confetti. Never replace with generic minimalism/Swiss.
2. Hero-centric recipient page: hero greeting → cake/centerpiece → gallery → message → details/countdown → closing. One primary CTA per screen.
3. Mobile-first bilingual gift: phones on cellular, EN + AR, touch, tap-to-play audio.
4. Celebration is restrained: max 1–2 animated elements per view; motion conveys cause→effect (blow candle → smoke → wish → confetti).
5. No fake flows: Generate Link shows real loading/success/error; music button shows play/loading/pause/retry.

## 2. Semantic color tokens (`css/themes.css`)

| Token | Purpose | Notes |
|---|---|---|
| `--primary` | Brand accent, borders, button gradient start | Decorative/large use; NOT for small body text on light themes (fails 4.5:1 on classic/soft/elegant/warm) |
| `--primary-ink` | Text-safe brand color for small text on `--card-bg` | classic `#b4232e`, soft `#a4134f`, deep `#e6c84d`, dark `#c9a0dc`, elegant `#7a5c00`, warm `#8a5a2b` (all ≥4.5:1, verified) |
| `--primary-light` | Gradient end, glows | Decorative only |
| `--accent` | Photo ring, countdown ring, cake accents | Never sole information carrier |
| `--bg` / `--bg-alt` | Page / alt section wash | `--gradient-bg` = hero wash |
| `--text` | Body/heading text | All six themes ≥12:1 except checked below |
| `--text-light` | Secondary text, hints, labels | soft `#6d4c41`, elegant `#595959` (darkened to pass 4.5:1); classic `#666`, warm `#666` pass; deep/dark light-on-dark pass |
| `--card-bg` / `--card-border` / `--card-hover` | Cards, inputs, countdown boxes | |
| `--glass-bg` / `--glass-border` | Frosted message/details cards | Per-theme tuned for legibility |
| `--shadow` / `--shadow-lg` | Elevation (one scale only) | |
| `--gradient` / `--gradient-bg` | Brand gradient / page wash | Large script headings only, not body |
| `--status-success` / `--status-error` | Copy success, errors | Same across themes, never brand colors |

Exceptions (documented, not tech debt): per-occasion translucent message-card shadows
(`rgba(...)` in `styles.css`), photo letterbox `#000` behind `object-fit:contain` images,
white on-brand button text (classic 4.17:1 — see §8 remaining issues).

## 3. Typography

- EN headings: `Playfair Display` (600–700). EN body: `Lora` (400–500, 1.5–2.0 line-height). Accents: `Dancing Script` (short headings only: greeting, cake, gallery, closing).
- AR: headings/script `Aref Ruqaa`, body `Cairo` (`html[lang=ar]` override in `styles.css`). Never force Latin line-breaking on Arabic.
- Scale: greeting 3.5rem → 2.2rem ≤480px; section script 2.5rem → 2rem; message 1.2rem/2.0; labels ≥0.75rem (12px floor — countdown labels raised from 0.68rem); body base 16px (no iOS zoom).
- Numbers/countdown/URLs: `font-variant-numeric: tabular-nums`, `direction:ltr`, `unicode-bidi:isolate` on numeric runs so RTL never scrambles them.
- Measure: 35–60 chars mobile, 60–75 desktop; message `white-space:pre-wrap`, centered.

## 4. Spacing / radius / shadow / breakpoints

- Spacing scale `--space-1..7` (0.25–3rem), 4/8pt rhythm. Section padding `4rem 2rem` → `3rem 1rem` ≤480px.
- Radius `--radius-sm..2xl + pill` (8/12/16/20/24/50px). Pill for CTAs, md for inputs, lg/xl/2xl for cards.
- Shadows: `--shadow` rest, `--shadow-lg` hover/elevated. One scale, no random values.
- Breakpoints: 360 (small-phone net), 480, 768, 1024, 1440. `100dvh` with `100vh` fallback; landscape `max-height:500px` collapses `min-height:100vh→auto`.
- Container widths: creator 800/600px, recipient hero/message/closing 600px, cake/gallery 560px, details 500px. Consistent per device class.

## 5. Components

- **Buttons:** `.btn-primary` (gradient), `.btn-secondary` (outline), `.btn-copy`, `.btn-music` (58px circle, min 48px), `.music-prompt` (pill). `min-height:3rem`, pill radius, 600 weight. Press: `scale(.96-.98)` / translate, restore on release; `:disabled` 0.55 opacity + `not-allowed`; `cursor:pointer`; `aria-busy` + real loading overlay on Generate.
- **Cards:** `.card`, `.theme-swatch`, `.recipient-message-card`, `.recipient-details-card`, `.countdown-box` — token bg/border/shadow, hover `translateY(-2..-8px)` + border to primary/accent. One primary CTA per screen.
- **Icons:** one outline family (Phosphor/Lucide-style), token sizes, 1.5–2px consistent stroke. Decorative beside text → `aria-hidden="true"` (scroll arrow, closing hearts, centerpiece visual). Standalone meaningful → text alternative. Icon buttons → accessible name + `aria-pressed`/state. Never emoji as structural nav/system icons (creator card grid is the known exception being migrated).
- **Forms (creator, unchanged here):** visible `<label>`, helper text, error at field + `aria-describedby`, validate on blur, `≥44px` inputs, semantic `inputmode`/`autocomplete`.

## 6. Motion

- Tokens: `--transition-fast .18s`, `--transition-base .3s`, `--ease cubic-bezier(.4,0,.2,1)`. Enter 300–600ms `power1.out`-like; exit ~60–70% of enter.
- Scroll reveal (recipient): fade + `translateY(16px)`, ~0.55–0.6s, `cubic-bezier(.22,1,.36,1)`, threshold 0.12, unobserve after reveal. Gallery stagger capped: +0.06s / +0.12s by position, never cumulative chains.
- Gallery hover (fine pointers only): `translateY(-8px) scale(1.01)` + image `scale(1.09)` + sheen; touch uses `:active`. Tilt ≤8deg via `--rx/--ry`, disabled on touch and calm mode.
- `transform/opacity` only; never animate width/height/top/left. `will-change` on reveal/gallery only.
- Candle: flicker infinite (decorative), blow → 0.25s scale-out + 1.4s smoke + wish + confetti (cause→effect). Relight restores explicitly.
- Music button: `musicInvite` pulse as play hint; spinning `::after` ring while playing; dotted ring while loading. Glyph changes shape (▶/⏸/…/!) so state never relies on color alone.

## 7. Accessibility rules

- Contrast: normal text ≥4.5:1, large (≥24px / 18.66px bold) ≥3:1. Small brand text uses `--primary-ink`, never `--primary`, on light cards. Gradient script text is large-display only.
- Focus: `:focus-visible` 3px `var(--primary)` + 2–3px offset globally; inputs keep border+ring. Focus never hidden behind fixed bars (`scroll-margin`, `scroll-padding-bottom:7rem` on `.recipient-view`).
- Countdown: ticking grid `aria-hidden="true"` (updates every second, never announced); separate `role="status"` `#cd-status` updated only on minute change / today. Numbers `tabular-nums` + LTR-isolated.
- Music: corner toggle is the single control; `aria-label` Play/Pause/Loading/Error + `aria-pressed`; icon `aria-hidden`; prompt button labelled.
- Candles: real `<button>`s with labels + `aria-pressed`; Blow/Relight are real buttons; wish is text (not announced aggressively).
- Toasts/status: `aria-live="polite"`, never steal focus. Form errors: inline + linked summary pattern.
- Dynamic type: no fixed heights that clip at 200% text; countdown boxes `min-width` + wrap allowed.

## 8. RTL / LTR

- `documentElement.lang/dir` set on language switch (`ar` → `rtl`). Logical properties (`inset-inline-start/end`) for lang toggle + music controls, with physical fallback + explicit `html[dir=rtl]` mirror.
- Recipient stays centered; gallery/cake/actions wrap and mirror safely.
- Never mirror: countdown grid (`direction:ltr` in RTL), numeric runs, URLs/HEX (`direction:ltr`, `unicode-bidi:isolate`), music glyphs ▶/⏸.
- Arabic font override + `text-align:right` only for creator forms; recipient message stays centered by design.

## 9. Mobile-first / safe-area / overlap

- Design 375px first, scale up. `viewport-fit=cover` content + `env(safe-area-inset-*)` on fixed bars (music, lang, prompt). Closing section reserves `calc(6rem + safe-area)` so fixed pills never cover the farewell. `overflow-x:hidden` + `max-width:100%` media + 320px safety net. Touch targets ≥44×44 CSS px for candles, music, prompts, previews, closers (measured, not visual-only). 8px+ gaps.

## 10. What NOT to do (anti-patterns)

Cluttered hero + slow load; emoji as system icons; raw hex per screen; one duration for all motion; animating layout props; hover-only interactions; placeholder-only labels; errors only at top; overloaded nav; color-only meaning; invisible-by-default content without no-JS/IntersectionObserver fallback (we add `.visible` when IO missing).
