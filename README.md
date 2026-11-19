# Neon Coast Cover Studio

[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn any photo and a caption into GTA-style multi-panel cover art, exported as a PNG to share. Runs 100% offline in a desktop browser — photos never leave your machine, no network requests, no uploads.

**Try it:** open `app/index.html` in Chrome (or `node serve.ts`, then http://localhost:8080).

## What it does

- **6 panel layouts** — Hero Grid, Nine Panel (title in the centre cell), Tilted Snaps (overlapping rotated snapshots), Full Bleed, Duo Split, Story Stack
- **7 sunset / neon grades** — Vice Sunset, Neon Nights, Golden Coast, Heatwave, Poster Ink (duotone), Midnight Violet, Retro Fade — gradient-map tints applied per panel
- **Any photo** — upload up to 4 of your own, or use the 3 built-in samples; fill several panels with one photo (different crops) or several photos; click a panel, then **drag to pan, scroll to zoom**, or use the Zoom / Shift sliders
- **Lettering** — sunset-gradient Anton title, neon-script Pacifico subtitle, heat-meter stars (★★★★★), badge ribbon, halftone title block
- **Finish** — film grain, vignette, undo/redo
- **Export PNG in one click** — 1920×1080, 1080×1350, 1080×1080, or all three at once

## The default cover

The app opens on a real cover, not an empty state: two friends on a boardwalk at sunset, one handing the other a white helmet — one small act of care, one concrete prop — graded Vice Sunset with the title **NEON COAST**. The three sample photos are original flat-illustration art made for this entry (no real people, no Rockstar artwork):

- `app/samples/boardwalk.png` — the helmet handover at sunset
- `app/samples/neon-street.png` — the last ice cream on a neon street
- `app/samples/pier.png` — a hot coffee for the early-morning fisherman

## Originality

Everything is original: the art, the layouts, the lettering. No Rockstar Games logo, wordmark, official artwork, character or font. The only fonts are **Anton** and **Pacifico**, both under the SIL Open Font License (see `app/fonts/OFL.txt`).

## Layout

```
repo/
  main.ts            # hands app/ + screenshots/ to /output with a dossier
  vendor/makefun-app.ts   # kit library, unchanged
  serve.ts           # local static server for trying the app
  app/
    index.html       # editor shell
    styles.css       # studio UI
    app.js           # cover engine (layouts, grades, lettering) + editor wiring
    fonts/           # Anton + Pacifico (OFL)
    samples/         # 3 original sample photos
  screenshots/       # 1 exported cover, the editor, 2 more exported covers
```

## License

MIT — see [LICENSE](LICENSE).
