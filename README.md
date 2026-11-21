[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/aikbani/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/aikbani/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

# Neon Coast Cover Studio

Turn any photo and a caption into GTA-style multi-panel cover art —
the iconic poster / loading-screen look with a Vice City neon-sunset
grade — exported as a PNG to share. It runs **entirely offline** in a
desktop browser: no uploads, no accounts, no network requests. Your
photos never leave your machine.

Built for the [make.fun](https://make.fun/bounty/gta6-cover-art-01)
**Make GTA 6 Cover Art** competition (`gta6-cover-art-01`).

## What it does

- **Seven layouts** — six classic multi-panel arrangements (quad,
  hero + trio, triptych, nine grid, split duo, tilted snapshots)
  plus a new **Marquee** layout: a wide hero band crowning a tall
  triptych.
- **Eight colour grades** — seven photographic grades (Vice Sunset,
  Neon Night, Golden Hour, Teal Shadow, Mono Noir, Pastel Dusk,
  Heat Haze) plus a new **Ink Magenta** duotone that rebuilds the
  photo in deep navy and hot magenta.
- **Any photo, any panel** — drag a panel to pan its photo, scroll
  (or use the zoom slider) to zoom it, pick a different photo per
  panel, or fill every panel with one photo. Upload your own photo
  from your machine; three procedural sample illustrations ship
  with the app so it works out of the box.
- **Caption lettering in the genre's style** — a sunset-gradient
  title in Anton with an inked outline and neon glow, and a glowing
  script subtitle in Pacifico. Six one-tap caption presets, or type
  your own.
- **Poster craft** — panel border width and corner radius controls,
  a halftone dot strip, film grain and a vignette on every cover.
- **Undo / redo** — full history (up to 40 steps) with buttons and
  `Ctrl/⌘+Z` / `Ctrl/⌘+Shift+Z` shortcuts.
- **Surprise me** — one button randomises layout, grade, caption,
  borders and photo assignment.
- **Pixel-exact PNG export** — the preview and the export are the
  same canvas drawing at different sizes, so what you see is what
  you get.

## Quick start

No build step, no install. Serve the `app/` folder with any static
server and open `index.html` in a desktop browser:

```sh
# from the repository root
node serve.ts            # serves this repo on http://localhost:8080
# then open http://localhost:8080/app/index.html
```

Or with any static server, for example:

```sh
python3 -m http.server 8080
```

## How to use the editor

1. **Pick a layout** — the layout picker changes the panel
   arrangement live; the hint under it describes the look.
2. **Pick a grade** — the colour grade re-tints every panel.
3. **Write your caption** — title (up to 28 characters) and
   subtitle (up to 48). Try the preset chips for instant ideas.
4. **Choose photos** — click a panel to select it, then choose one
   of the three samples or upload your own. Leave **Fill every
   panel with one photo** on to use one photo across the cover, or
   turn it off to mix photos panel by panel.
5. **Crop each photo** — drag inside a panel to pan, scroll over it
   (or move the zoom slider) to zoom.
6. **Tune the frame** — border width and corner radius sliders
   shape the panels.
7. **Export** — one size, or **Export all three sizes** for the
   whole set in one click.

## Layouts

| Layout | Panels | Best for |
| --- | --- | --- |
| Quad | 4 equal | The classic poster grid |
| Hero + trio | 1 wide hero + 3 | One big moment, three details |
| Triptych | 3 tall | A folding-poster feel |
| Nine grid | 9 | A contact sheet of moments |
| Split duo | 2 tall halves | Two characters, one cover |
| Tilted snapshots | 3 rotated | Loose, taped-up polaroids |
| **Marquee** (new) | 1 hero band + 3 tall | A premiere-night billboard |

## Colour grades

| Grade | Mood |
| --- | --- |
| Vice Sunset | Amber skies, pink neon — the signature dusk |
| Neon Night | Pink and teal after dark |
| Golden Hour | Warm honey light |
| Teal Shadow | Cool, moody, cinematic |
| Mono Noir | High-contrast black & white |
| Pastel Dusk | Soft lavender evening |
| Heat Haze | Scorched magenta noon |
| **Ink Magenta** (new) | Navy / magenta duotone |

## Export sizes

| Button | Size | Use |
| --- | --- | --- |
| 1920 × 1080 | Landscape | Desktop wallpaper, video thumbnail, X / YouTube |
| 1080 × 1350 | Portrait | Instagram feed (4:5) |
| 1080 × 1080 | Square | Instagram, profile posts, avatars |

**Export all three sizes** downloads all three PNGs in one go.
Exports are drawn on canvas at full resolution — no upscaling, no
compression artefacts beyond PNG itself.

## Samples

Three procedural GTA-poster-style illustrations ship in
`app/samples/` so the app works with no photo of your own:

- `boardwalk.png` — a boardwalk helmet handover at golden hour
- `neon-street.png` — friends sharing ice cream on a neon street
- `pier.png` — morning coffee on a wooden pier

They are original illustrations drawn with code (Pillow), not
photographs of real people and not game artwork.

## Screenshots

| Shot | What it shows |
| --- | --- |
| `screenshots/1-cover.jpg` | Hero cover, 1920 × 1080 landscape |
| `screenshots/2-editor.jpg` | The editor with a photo loaded |
| `screenshots/3-cover.jpg` | Nine-grid cover, 1080 × 1350 portrait |
| `screenshots/4-cover.jpg` | Tilted-snapshots cover, 1080 × 1080 square |

The shot list lives in `shots.json`. Cover shots are staged with
the app's own `?shot=cover` mode (`?shot=cover&size=…&layout=…`
picks the scene), so every screenshot is the app drawing its own
cover — never edited or composited afterwards.

## How it works

- `app/index.html` — the editor page: toolbar, live preview
  canvas, footer. Every control has an accessible label.
- `app/app.js` — all editor logic: seven layouts, eight grades,
  per-panel pan/zoom, undo/redo history, caption presets,
  randomiser, and canvas PNG export at all three sizes.
- `app/styles.css` — the Neon Coast theme: indigo night, hot pink
  neon, sunset orange, palm teal; responsive, with visible focus
  styles for keyboard users.
- `app/fonts/` — Anton (display) and Pacifico (script), vendored
  as TTF files under the SIL Open Font License (`OFL.txt`).
- `main.ts` — the entrypoint: copies `app/` and `screenshots/`
  into the output directory and writes `dossier.json` with the
  kit's `buildDossier`, plus a `manifest.json` listing every file
  with its byte size and sha256.
- `serve.ts` — a small static file server for local preview
  (`PORT` env var, default `8080`).

The app makes **zero network requests**: every script, font and
image it loads is a local file. The only files it reads at runtime
are its own samples, fonts and stylesheet.

## Privacy

Photos you upload are read with `FileReader` in your browser tab
and are never sent anywhere — there is no server, no analytics,
no beacon. Close the tab and they are gone.

## Originality

Everything here is original: the illustrations are drawn with
code, the lettering uses Anton and Pacifico (SIL Open Font
License), and no Rockstar Games logo, artwork, character or font
is used anywhere.

## License

MIT — see `LICENSE`. Fonts under the SIL Open Font License 1.1 —
see `app/fonts/OFL.txt`.
