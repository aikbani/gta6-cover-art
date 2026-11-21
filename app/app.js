/* ============================================================
   Neon Coast Cover Studio — editor logic
   One coherent program, no libraries, no network: every pixel
   of the cover is drawn on a 2D canvas so the preview and the
   exported PNG are the same drawing at different sizes.

   Sections
     1. Constants — layouts, grades, presets, export sizes
     2. State and history (undo / redo)
     3. Image loading (samples + user uploads)
     4. Rendering — panels, grades, grain, vignette, lettering
     5. Pointer interaction — select, drag to pan, wheel to zoom
     6. Controls — wiring every toolbar control to state
     7. Export — PNG at 1920x1080, 1080x1350, 1080x1080
     8. Shot mode — URL params for scripted screenshots
   ============================================================ */
"use strict";

/* ---------- 1. Constants ---------- */

/* A layout is a list of panels in normalised cover coordinates
   (0..1 across, 0..1 down) plus a title zone where the caption
   sits. `tilt` rotates a panel a few degrees for the collage
   layouts; `hero` marks the panel the fill-photo prefers. */
const LAYOUTS = {
  quad: {
    label: "Quad — four equal panels",
    hint: "The classic 2 × 2 poster grid.",
    titleZone: { x: 0.04, y: 0.78, w: 0.92, h: 0.20 },
    panels: [
      { x: 0.02, y: 0.02, w: 0.47, h: 0.36 },
      { x: 0.51, y: 0.02, w: 0.47, h: 0.36 },
      { x: 0.02, y: 0.40, w: 0.47, h: 0.36 },
      { x: 0.51, y: 0.40, w: 0.47, h: 0.36 },
    ],
  },
  heroTrio: {
    label: "Hero + trio — wide hero, three below",
    hint: "A big moment on top, three details underneath.",
    titleZone: { x: 0.04, y: 0.80, w: 0.92, h: 0.18 },
    panels: [
      { x: 0.02, y: 0.02, w: 0.96, h: 0.44, hero: true },
      { x: 0.02, y: 0.48, w: 0.31, h: 0.30 },
      { x: 0.345, y: 0.48, w: 0.31, h: 0.30 },
      { x: 0.675, y: 0.48, w: 0.305, h: 0.30 },
    ],
  },
  triptych: {
    label: "Triptych — three tall panels",
    hint: "Three vertical slices, like a folding poster.",
    titleZone: { x: 0.04, y: 0.82, w: 0.92, h: 0.16 },
    panels: [
      { x: 0.02, y: 0.02, w: 0.31, h: 0.78 },
      { x: 0.345, y: 0.02, w: 0.31, h: 0.78, hero: true },
      { x: 0.67, y: 0.02, w: 0.31, h: 0.78 },
    ],
  },
  nineGrid: {
    label: "Nine grid — 3 × 3 contact sheet",
    hint: "Nine small moments; the centre panel carries the title.",
    titleZone: { x: 0.06, y: 0.40, w: 0.88, h: 0.20 },
    panels: [
      { x: 0.015, y: 0.015, w: 0.315, h: 0.315 },
      { x: 0.3425, y: 0.015, w: 0.315, h: 0.315 },
      { x: 0.67, y: 0.015, w: 0.315, h: 0.315 },
      { x: 0.015, y: 0.3425, w: 0.315, h: 0.315 },
      { x: 0.3425, y: 0.3425, w: 0.315, h: 0.315, hero: true },
      { x: 0.67, y: 0.3425, w: 0.315, h: 0.315 },
      { x: 0.015, y: 0.67, w: 0.315, h: 0.315 },
      { x: 0.3425, y: 0.67, w: 0.315, h: 0.315 },
      { x: 0.67, y: 0.67, w: 0.315, h: 0.315 },
    ],
  },
  splitDuo: {
    label: "Split duo — two tall halves",
    hint: "Two characters, one cover, split down the middle.",
    titleZone: { x: 0.04, y: 0.80, w: 0.92, h: 0.18 },
    panels: [
      { x: 0.02, y: 0.02, w: 0.47, h: 0.76, hero: true },
      { x: 0.51, y: 0.02, w: 0.47, h: 0.76 },
    ],
  },
  tilted: {
    label: "Tilted snapshots — scattered polaroids",
    hint: "Loose, rotated snapshots taped over a sunset wash.",
    titleZone: { x: 0.05, y: 0.76, w: 0.90, h: 0.22 },
    panels: [
      { x: 0.05, y: 0.04, w: 0.42, h: 0.52, tilt: -4, hero: true },
      { x: 0.52, y: 0.10, w: 0.42, h: 0.44, tilt: 3 },
      { x: 0.28, y: 0.42, w: 0.44, h: 0.34, tilt: -2 },
    ],
  },
  marquee: {
    label: "Marquee — hero band over a tall triptych",
    hint: "NEW: a wide hero band crowns three tall panels.",
    titleZone: { x: 0.04, y: 0.60, w: 0.92, h: 0.14 },
    panels: [
      { x: 0.02, y: 0.02, w: 0.96, h: 0.30, hero: true },
      { x: 0.02, y: 0.34, w: 0.31, h: 0.58 },
      { x: 0.345, y: 0.34, w: 0.31, h: 0.58 },
      { x: 0.67, y: 0.34, w: 0.31, h: 0.58 },
    ],
  },
};

/* A grade is a duotone-friendly recipe applied after the photo
   is drawn: a tint wash, a gradient-map overlay, and a lift of
   the highlights. `duotone` grades replace the photo's colour
   almost entirely; the rest keep the photo and shift its mood. */
const GRADES = {
  viceSunset: {
    label: "Vice Sunset — orange into hot pink",
    hint: "The signature dusk: amber skies, pink neon.",
    wash: ["#ff7a1a", "#ff2e88"], washAlpha: 0.16, mapAlpha: 0.22,
    map: ["#2b1055", "#ff7a1a", "#ffd166"], lift: 0.06, duotone: false,
  },
  neonNight: {
    label: "Neon Night — pink and teal after dark",
    hint: "Wet pavement, buzzing signs, 2 a.m. energy.",
    wash: ["#ff2e88", "#19e3c2"], washAlpha: 0.18, mapAlpha: 0.24,
    map: ["#0b1035", "#ff2e88", "#19e3c2"], lift: 0.04, duotone: false,
  },
  goldenHour: {
    label: "Golden Hour — warm honey light",
    hint: "Low sun, long shadows, everything honeyed.",
    wash: ["#ffc53d", "#ff7a1a"], washAlpha: 0.18, mapAlpha: 0.14,
    map: ["#3a1c00", "#ffc53d", "#fff3c4"], lift: 0.08, duotone: false,
  },
  tealShadow: {
    label: "Teal Shadow — cool, moody, cinematic",
    hint: "Deep teal shade with a cold silver edge.",
    wash: ["#19e3c2", "#1e3a5f"], washAlpha: 0.16, mapAlpha: 0.20,
    map: ["#06121f", "#19e3c2", "#d6f5ef"], lift: 0.03, duotone: false,
  },
  monoNoir: {
    label: "Mono Noir — high-contrast black & white",
    hint: "Grainy, hard-edged, straight out of a stakeout.",
    wash: ["#000000", "#ffffff"], washAlpha: 0.0, mapAlpha: 0.0,
    map: ["#000000", "#888888", "#ffffff"], lift: 0.0, duotone: true,
  },
  pastelDusk: {
    label: "Pastel Dusk — soft lavender evening",
    hint: "Gentle lilac and peach, like the last light.",
    wash: ["#c4b5fd", "#fda4af"], washAlpha: 0.20, mapAlpha: 0.12,
    map: ["#312e81", "#fda4af", "#fef3c7"], lift: 0.10, duotone: false,
  },
  heatHaze: {
    label: "Heat Haze — scorched magenta noon",
    hint: "Midday glare pushed until the air shimmers.",
    wash: ["#ff2e88", "#ff7a1a"], washAlpha: 0.20, mapAlpha: 0.26,
    map: ["#4c0519", "#ff2e88", "#ffedd5"], lift: 0.05, duotone: false,
  },
  inkMagenta: {
    label: "Ink Magenta — NEW navy / magenta duotone",
    hint: "NEW: the photo rebuilt in two inks — deep navy and hot magenta.",
    wash: ["#141b4d", "#ff2e88"], washAlpha: 0.0, mapAlpha: 0.0,
    map: ["#0d1030", "#5b2a86", "#ff2e88", "#ffd166"], lift: 0.0, duotone: true,
  },
};

const CAPTION_PRESETS = [
  { title: "NEON COAST", subtitle: "one last ride" },
  { title: "VICE CITY", subtitle: "lights never sleep" },
  { title: "PIER PRESSURE", subtitle: "salt air & bad decisions" },
  { title: "NIGHT SHIFT", subtitle: "the city is ours tonight" },
  { title: "GOLDEN HOUR", subtitle: "chasing the last light" },
  { title: "DOUBLE TROUBLE", subtitle: "partners in every crime" },
];

const SAMPLES = {
  boardwalk: { file: "samples/boardwalk.png", label: "Boardwalk handover" },
  neonStreet: { file: "samples/neon-street.png", label: "Neon-street ice cream" },
  pier: { file: "samples/pier.png", label: "Pier coffee" },
};

/* The three post sizes, in the order the export-all button uses. */
const EXPORT_SIZES = [
  { id: "1920x1080", w: 1920, h: 1080, label: "Landscape 1920 × 1080" },
  { id: "1080x1350", w: 1080, h: 1350, label: "Portrait 1080 × 1350" },
  { id: "1080x1080", w: 1080, h: 1080, label: "Square 1080 × 1080" },
];

const HISTORY_CAP = 40;
const DEFAULT_TITLE = "NEON COAST";
const DEFAULT_SUBTITLE = "one last ride";

/* ---------- 2. State and history ---------- */

const canvas = document.getElementById("coverCanvas");
const ctx = canvas.getContext("2d");

/* One panel's photo state. `src` is a sample key ("boardwalk",
   "neonStreet", "pier") or "upload"; `zoom` is a multiplier
   (1 = cover-fit) and `ox`/`oy` are pan offsets in fractions
   of the panel size. `dataUrl` holds an uploaded image. */
function freshPanel(src) {
  return { src, zoom: 1, ox: 0, oy: 0, dataUrl: null };
}

const state = {
  layout: "heroTrio",
  grade: "viceSunset",
  title: DEFAULT_TITLE,
  subtitle: DEFAULT_SUBTITLE,
  fillOne: false,
  fillSrc: "boardwalk",
  border: 10,
  radius: 14,
  selected: 0,
  sizeId: "1920x1080",
  /* The hero panel starts panned a touch low so its wide crop
     catches the figures' torsos, not just their heads. */
  panels: [Object.assign(freshPanel("boardwalk"), { oy: -0.2 }),
           freshPanel("neonStreet"), freshPanel("pier"), freshPanel("boardwalk")],
};

let undoStack = [];
let redoStack = [];
let images = {};          /* sample key -> HTMLImageElement */
let uploadImage = null;   /* the user's uploaded photo, if any */
let fontsReady = false;

/* A history snapshot is plain JSON: no Image objects inside. */
function snapshot() {
  return JSON.stringify({
    layout: state.layout, grade: state.grade,
    title: state.title, subtitle: state.subtitle,
    fillOne: state.fillOne, fillSrc: state.fillSrc,
    border: state.border, radius: state.radius,
    selected: state.selected, sizeId: state.sizeId,
    panels: state.panels.map((p) => ({
      src: p.src, zoom: p.zoom, ox: p.ox, oy: p.oy, dataUrl: p.dataUrl,
    })),
  });
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > HISTORY_CAP) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}

function restore(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  state.panels = s.panels.map((p) => Object.assign(freshPanel(p.src), p));
  syncControls();
  render();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  syncUndoButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  syncUndoButtons();
}

function syncUndoButtons() {
  document.getElementById("undoBtn").disabled = undoStack.length === 0;
  document.getElementById("redoBtn").disabled = redoStack.length === 0;
}

/* ---------- 3. Image loading ---------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load " + src));
    img.src = src;
  });
}

async function loadSamples() {
  const entries = Object.entries(SAMPLES);
  await Promise.all(entries.map(async ([key, meta]) => {
    try {
      images[key] = await loadImage(meta.file);
    } catch (err) {
      console.warn("Sample failed to load:", meta.file, err);
    }
  }));
}

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('90px "Anton"'),
      document.fonts.load('40px "Pacifico"'),
      document.fonts.ready,
    ]);
    fontsReady = document.fonts.check('90px "Anton"')
      && document.fonts.check('40px "Pacifico"');
  } catch (err) {
    console.warn("Font load failed, falling back:", err);
    fontsReady = false;
  }
}

/* The image a panel shows, honouring fill-one mode. */
function panelImage(panel) {
  if (state.fillOne) {
    if (state.fillSrc === "upload") return uploadImage;
    return images[state.fillSrc] || null;
  }
  if (panel.src === "upload") return uploadImage;
  return images[panel.src] || null;
}

/* Keep the panel list the same length as the layout needs. */
function syncPanelCount() {
  const need = LAYOUTS[state.layout].panels.length;
  while (state.panels.length < need) {
    const cycle = ["boardwalk", "neonStreet", "pier"];
    state.panels.push(freshPanel(cycle[state.panels.length % 3]));
  }
  state.panels.length = need;
  if (state.selected >= need) state.selected = 0;
}

/* ---------- 4. Rendering ---------- */

/* Cover-fit draw: scale the photo to cover the rect, then pan. */
function drawCoverFit(c, img, rect, panel) {
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * panel.zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = rect.x + (rect.w - dw) / 2 + panel.ox * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + panel.oy * rect.h;
  c.drawImage(img, dx, dy, dw, dh);
}

/* A gradient map: sample the drawn pixels' luminance through a
   small offscreen canvas and repaint them through the grade's
   colour ramp. Only used by the duotone grades. */
function applyGradientMap(c, rect, ramp) {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const w = Math.min(c.canvas.width - x, Math.ceil(rect.w));
  const h = Math.min(c.canvas.height - y, Math.ceil(rect.h));
  if (w <= 0 || h <= 0) return;
  const data = c.getImageData(x, y, w, h);
  const px = data.data;
  const stops = ramp.map((hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  for (let i = 0; i < px.length; i += 4) {
    const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    const pos = lum * (stops.length - 1);
    const idx = Math.min(stops.length - 2, Math.floor(pos));
    const t = pos - idx;
    const a = stops[idx];
    const b = stops[idx + 1];
    px[i] = a[0] + (b[0] - a[0]) * t;
    px[i + 1] = a[1] + (b[1] - a[1]) * t;
    px[i + 2] = a[2] + (b[2] - a[2]) * t;
  }
  c.putImageData(data, x, y);
}

/* The photographic grades: a soft tint wash, a gradient overlay
   at low alpha, and a gentle highlight lift. */
function applyPhotoGrade(c, rect, grade) {
  const [c1, c2] = grade.wash;
  const grad = c.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  c.save();
  c.globalAlpha = grade.washAlpha;
  c.globalCompositeOperation = "overlay";
  c.fillStyle = grad;
  c.fillRect(rect.x, rect.y, rect.w, rect.h);
  c.restore();

  if (grade.mapAlpha > 0) {
    const map = c.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grade.map.forEach((hex, i) => map.addColorStop(i / (grade.map.length - 1), hex));
    c.save();
    c.globalAlpha = grade.mapAlpha;
    c.globalCompositeOperation = "soft-light";
    c.fillStyle = map;
    c.fillRect(rect.x, rect.y, rect.w, rect.h);
    c.restore();
  }

  if (grade.lift > 0) {
    c.save();
    c.globalAlpha = grade.lift;
    c.globalCompositeOperation = "screen";
    c.fillStyle = "#ffffff";
    c.fillRect(rect.x, rect.y, rect.w, rect.h);
    c.restore();
  }
}

/* A rounded-rectangle path, reused for panels and the title. */
function roundRectPath(c, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function drawPanel(c, rect, panel, grade, W, H) {
  const img = panelImage(panel);
  /* Border and radius are authored in px at a 1080 reference
     edge, then scaled with the cover so exports match the UI. */
  const unit = Math.min(W, H) / 1080;
  const borderPx = state.border * unit;
  const radiusPx = state.radius * unit;
  c.save();
  roundRectPath(c, rect.x, rect.y, rect.w, rect.h, radiusPx);
  c.clip();
  if (img) {
    drawCoverFit(c, img, rect, panel);
  } else {
    const g = c.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    g.addColorStop(0, "#241a4e");
    g.addColorStop(1, "#120e2a");
    c.fillStyle = g;
    c.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  if (grade.duotone) {
    applyGradientMap(c, rect, grade.map);
  } else {
    applyPhotoGrade(c, rect, grade);
  }
  c.restore();

  /* Inked poster border, with a thin neon inner line. */
  if (borderPx > 0.5) {
    c.save();
    roundRectPath(c, rect.x, rect.y, rect.w, rect.h, radiusPx);
    c.lineWidth = borderPx;
    c.strokeStyle = "#0d0a1e";
    c.stroke();
    c.lineWidth = Math.max(1, borderPx * 0.18);
    c.strokeStyle = "rgba(255, 255, 255, 0.55)";
    c.stroke();
    c.restore();
  }
}

/* Halftone dots along the bottom edge — the print-poster touch. */
function drawHalftone(c, W, H) {
  const spacing = Math.max(14, W / 110);
  const y = H * 0.985;
  c.save();
  c.fillStyle = "rgba(255, 255, 255, 0.20)";
  for (let x = spacing / 2; x < W; x += spacing) {
    const r = (spacing * 0.22) * (0.6 + 0.4 * Math.sin(x * 0.05));
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function drawVignette(c, W, H) {
  const g = c.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.35,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(5,2,20,0.42)");
  c.save();
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.restore();
}

/* Film grain, seeded per render so exports are stable. */
function drawGrain(c, W, H) {
  const gw = 320;
  const gh = Math.max(1, Math.round(320 * (H / W)));
  const off = document.createElement("canvas");
  off.width = gw;
  off.height = gh;
  const oc = off.getContext("2d");
  const data = oc.createImageData(gw, gh);
  let seed = 20261121;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 22;
  }
  oc.putImageData(data, 0, 0);
  c.save();
  c.globalAlpha = 0.32;
  c.globalCompositeOperation = "overlay";
  c.imageSmoothingEnabled = true;
  c.drawImage(off, 0, 0, W, H);
  c.restore();
}

/* ---------- Lettering ---------- */

/* The title: a sunset gradient in Anton, inked with a dark
   outline and a soft pink glow. Shrinks until it fits its zone. */
function drawTitle(c, zone, W, H) {
  const title = (state.title || "").toUpperCase();
  if (!title) return;
  const maxW = zone.w;
  let size = Math.min(zone.h * 0.62, W * 0.085);
  c.save();
  c.textBaseline = "middle";
  c.textAlign = "center";
  const font = (s) => `${s}px "Anton", "Arial Narrow", sans-serif`;
  c.font = font(size);
  while (size > 18 && c.measureText(title).width > maxW) {
    size -= 2;
    c.font = font(size);
  }
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h * 0.42;
  const grad = c.createLinearGradient(cx - maxW / 2, cy, cx + maxW / 2, cy);
  grad.addColorStop(0, "#ffc53d");
  grad.addColorStop(0.45, "#ff7a1a");
  grad.addColorStop(0.75, "#ff2e88");
  grad.addColorStop(1, "#8b5cf6");
  c.shadowColor = "rgba(255, 46, 136, 0.65)";
  c.shadowBlur = size * 0.28;
  c.lineWidth = Math.max(2, size * 0.09);
  c.lineJoin = "round";
  c.strokeStyle = "#0d0a1e";
  c.strokeText(title, cx, cy);
  c.fillStyle = grad;
  c.fillText(title, cx, cy);
  c.restore();

  /* The neon-script subtitle, in Pacifico, under the title. */
  const sub = state.subtitle || "";
  if (sub) {
    c.save();
    c.textBaseline = "middle";
    c.textAlign = "center";
    const subSize = Math.max(16, size * 0.34);
    c.font = `${subSize}px "Pacifico", cursive`;
    const sy = cy + size * 0.62;
    c.shadowColor = "rgba(25, 227, 194, 0.9)";
    c.shadowBlur = subSize * 0.5;
    c.lineWidth = Math.max(2, subSize * 0.08);
    c.strokeStyle = "#0d0a1e";
    c.strokeText(sub, cx, sy);
    c.fillStyle = "#e8fff8";
    c.fillText(sub, cx, sy);
    c.restore();
  }
}

/* ---------- Main render ---------- */

/* Draw the whole cover onto `c` at W × H. The same function
   feeds the live preview and every export, so they agree. */
function renderCover(c, W, H) {
  const layout = LAYOUTS[state.layout];
  const grade = GRADES[state.grade];

  /* Sunset-wash backdrop behind the panels. */
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1b1145");
  bg.addColorStop(0.5, "#5b2a86");
  bg.addColorStop(0.78, "#ff2e88");
  bg.addColorStop(1, "#ff7a1a");
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  /* A soft sun disc glowing behind the panels. */
  const sun = c.createRadialGradient(W * 0.78, H * 0.22, 0, W * 0.78, H * 0.22, W * 0.45);
  sun.addColorStop(0, "rgba(255, 213, 102, 0.55)");
  sun.addColorStop(0.5, "rgba(255, 122, 26, 0.22)");
  sun.addColorStop(1, "rgba(255, 122, 26, 0)");
  c.fillStyle = sun;
  c.fillRect(0, 0, W, H);

  const panels = layout.panels.map((p, i) => ({
    x: p.x * W, y: p.y * H, w: p.w * W, h: p.h * H,
    tilt: p.tilt || 0, panel: state.panels[i],
  }));
  for (const p of panels) {
    if (p.tilt) {
      c.save();
      c.translate(p.x + p.w / 2, p.y + p.h / 2);
      c.rotate((p.tilt * Math.PI) / 180);
      c.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));
      drawPanel(c, p, p.panel, grade, W, H);
      c.restore();
    } else {
      drawPanel(c, p, p.panel, grade, W, H);
    }
  }

  drawVignette(c, W, H);
  drawGrain(c, W, H);
  drawHalftone(c, W, H);

  const zone = {
    x: layout.titleZone.x * W, y: layout.titleZone.y * H,
    w: layout.titleZone.w * W, h: layout.titleZone.h * H,
  };
  /* A dark plate behind the caption keeps it readable over any
     photo, except on the nine-grid where the title floats over
     the centre panel with a soft shadow instead. */
  if (state.layout !== "nineGrid") {
    c.save();
    c.fillStyle = "rgba(10, 6, 24, 0.55)";
    roundRectPath(c, zone.x - W * 0.01, zone.y, zone.w + W * 0.02, zone.h, H * 0.02);
    c.fill();
    c.restore();
  }
  drawTitle(c, zone, W, H);
}

/* Render the live preview at the chosen export aspect. */
function render() {
  syncPanelCount();
  const size = EXPORT_SIZES.find((s) => s.id === state.sizeId) || EXPORT_SIZES[0];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  renderCover(ctx, size.w, size.h);
  const readout = document.getElementById("sizeReadout");
  if (readout) readout.textContent = `Preview · ${size.w} × ${size.h}`;
}

/* ---------- 5. Pointer interaction ---------- */

/* Panel rects in CSS pixels, for hit-testing pointer events. */
function panelRectsCss() {
  const r = canvas.getBoundingClientRect();
  const layout = LAYOUTS[state.layout];
  const scaleX = r.width / canvas.width;
  const scaleY = r.height / canvas.height;
  return layout.panels.map((p) => ({
    x: p.x * canvas.width * scaleX,
    y: p.y * canvas.height * scaleY,
    w: p.w * canvas.width * scaleX,
    h: p.h * canvas.height * scaleY,
    tilt: p.tilt || 0,
  }));
}

function panelAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = clientX - r.left;
  const y = clientY - r.top;
  const rects = panelRectsCss();
  for (let i = rects.length - 1; i >= 0; i--) {
    const p = rects[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

let drag = null;

canvas.addEventListener("pointerdown", (ev) => {
  const idx = panelAt(ev.clientX, ev.clientY);
  if (idx < 0) return;
  pushHistory();
  state.selected = idx;
  syncControls();
  const panel = state.panels[idx];
  drag = { idx, startX: ev.clientX, startY: ev.clientY, ox: panel.ox, oy: panel.oy };
  canvas.setPointerCapture(ev.pointerId);
});

canvas.addEventListener("pointermove", (ev) => {
  if (!drag) return;
  const r = canvas.getBoundingClientRect();
  const rect = panelRectsCss()[drag.idx];
  const panel = state.panels[drag.idx];
  panel.ox = drag.ox + (ev.clientX - drag.startX) / rect.w;
  panel.oy = drag.oy + (ev.clientY - drag.startY) / rect.h;
  panel.ox = Math.max(-1, Math.min(1, panel.ox));
  panel.oy = Math.max(-1, Math.min(1, panel.oy));
  render();
});

canvas.addEventListener("pointerup", () => { drag = null; });
canvas.addEventListener("pointercancel", () => { drag = null; });

canvas.addEventListener("wheel", (ev) => {
  const idx = panelAt(ev.clientX, ev.clientY);
  if (idx < 0) return;
  ev.preventDefault();
  if (!drag) pushHistory();
  const panel = state.panels[idx];
  state.selected = idx;
  const factor = ev.deltaY < 0 ? 1.08 : 1 / 1.08;
  panel.zoom = Math.max(0.6, Math.min(2.6, panel.zoom * factor));
  syncControls();
  render();
}, { passive: false });

/* ---------- 6. Controls ---------- */

const $ = (id) => document.getElementById(id);

function fillSelect(select, entries, current) {
  select.innerHTML = "";
  for (const [value, meta] of entries) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = meta.label;
    if (value === current) opt.selected = true;
    select.appendChild(opt);
  }
}

function buildControls() {
  fillSelect($("layoutSelect"), Object.entries(LAYOUTS), state.layout);
  fillSelect($("gradeSelect"), Object.entries(GRADES), state.grade);

  const presets = $("captionPresets");
  CAPTION_PRESETS.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = p.title;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => {
      pushHistory();
      state.title = p.title;
      state.subtitle = p.subtitle;
      presets.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      syncControls();
      render();
    });
    presets.appendChild(btn);
  });

  $("layoutSelect").addEventListener("change", (ev) => {
    pushHistory();
    state.layout = ev.target.value;
    syncPanelCount();
    syncControls();
    render();
  });
  $("gradeSelect").addEventListener("change", (ev) => {
    pushHistory();
    state.grade = ev.target.value;
    syncControls();
    render();
  });
  $("titleInput").addEventListener("input", (ev) => {
    state.title = ev.target.value;
    render();
  });
  $("titleInput").addEventListener("change", () => pushHistory());
  $("subtitleInput").addEventListener("input", (ev) => {
    state.subtitle = ev.target.value;
    render();
  });
  $("subtitleInput").addEventListener("change", () => pushHistory());
  $("photoSelect").addEventListener("change", (ev) => {
    pushHistory();
    const value = ev.target.value;
    if (state.fillOne) {
      state.fillSrc = value;
    } else {
      state.panels[state.selected].src = value;
    }
    if (value === "upload") $("uploadInput").click();
    render();
  });
  $("fillToggle").addEventListener("change", (ev) => {
    pushHistory();
    state.fillOne = ev.target.checked;
    syncControls();
    render();
  });
  $("uploadInput").addEventListener("change", async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      pushHistory();
      uploadImage = await loadImage(dataUrl);
      if (state.fillOne) {
        state.fillSrc = "upload";
      } else {
        state.panels[state.selected].src = "upload";
        state.panels[state.selected].dataUrl = dataUrl;
      }
      render();
    } catch (err) {
      console.warn("Upload failed:", err);
    }
    ev.target.value = "";
  });
  $("borderRange").addEventListener("input", (ev) => {
    state.border = Number(ev.target.value);
    $("borderOut").textContent = `${state.border} px`;
    render();
  });
  $("borderRange").addEventListener("change", () => pushHistory());
  $("radiusRange").addEventListener("input", (ev) => {
    state.radius = Number(ev.target.value);
    $("radiusOut").textContent = `${state.radius} px`;
    render();
  });
  $("radiusRange").addEventListener("change", () => pushHistory());
  $("zoomRange").addEventListener("input", (ev) => {
    state.panels[state.selected].zoom = Number(ev.target.value) / 100;
    $("zoomOut").textContent = `${ev.target.value}%`;
    render();
  });
  $("zoomRange").addEventListener("change", () => pushHistory());
  $("undoBtn").addEventListener("click", undo);
  $("redoBtn").addEventListener("click", redo);
  $("randomBtn").addEventListener("click", randomize);
  $("exportAllBtn").addEventListener("click", exportAll);
  document.querySelectorAll("[data-export]").forEach((btn) => {
    btn.addEventListener("click", () => exportSize(btn.dataset.export));
  });
  document.addEventListener("keydown", (ev) => {
    const mod = ev.ctrlKey || ev.metaKey;
    if (!mod) return;
    if (ev.key.toLowerCase() === "z" && !ev.shiftKey) {
      ev.preventDefault();
      undo();
    } else if ((ev.key.toLowerCase() === "y")
      || (ev.key.toLowerCase() === "z" && ev.shiftKey)) {
      ev.preventDefault();
      redo();
    }
  });
}

/* Mirror the state back into every control. */
function syncControls() {
  $("layoutSelect").value = state.layout;
  $("gradeSelect").value = state.grade;
  $("layoutHint").textContent = LAYOUTS[state.layout].hint;
  $("gradeHint").textContent = GRADES[state.grade].hint;
  $("titleInput").value = state.title;
  $("subtitleInput").value = state.subtitle;
  $("fillToggle").checked = state.fillOne;
  const panel = state.panels[state.selected];
  $("photoSelect").value = state.fillOne ? state.fillSrc : panel.src;
  $("borderRange").value = state.border;
  $("borderOut").textContent = `${state.border} px`;
  $("radiusRange").value = state.radius;
  $("radiusOut").textContent = `${state.radius} px`;
  $("zoomRange").value = Math.round(panel.zoom * 100);
  $("zoomOut").textContent = `${Math.round(panel.zoom * 100)}%`;
  syncUndoButtons();
}

/* ---------- Randomize ---------- */

function randomize() {
  pushHistory();
  const keys = (obj) => Object.keys(obj);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  state.layout = pick(keys(LAYOUTS));
  state.grade = pick(keys(GRADES));
  const preset = pick(CAPTION_PRESETS);
  state.title = preset.title;
  state.subtitle = preset.subtitle;
  state.border = Math.floor(Math.random() * 20);
  state.radius = Math.floor(Math.random() * 36);
  const sampleKeys = ["boardwalk", "neonStreet", "pier"];
  state.fillOne = Math.random() < 0.5;
  state.fillSrc = pick(sampleKeys);
  syncPanelCount();
  state.panels.forEach((p) => {
    p.src = pick(sampleKeys);
    p.zoom = 0.9 + Math.random() * 0.5;
    p.ox = (Math.random() - 0.5) * 0.3;
    p.oy = (Math.random() - 0.5) * 0.3;
  });
  syncControls();
  render();
}

/* ---------- 7. Export ---------- */

function renderToCanvas(w, h) {
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  renderCover(off.getContext("2d"), w, h);
  return off;
}

function downloadCanvas(off, name) {
  return new Promise((resolve, reject) => {
    off.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Export produced no image"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve(blob.size);
    }, "image/png");
  });
}

async function exportSize(sizeId) {
  const size = EXPORT_SIZES.find((s) => s.id === sizeId);
  if (!size) return;
  if (!fontsReady) await loadFonts();
  const off = renderToCanvas(size.w, size.h);
  const slug = (state.title || "cover").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cover";
  await downloadCanvas(off, `neon-coast-${slug}-${size.id}.png`);
}

async function exportAll() {
  for (const size of EXPORT_SIZES) {
    await exportSize(size.id);
    /* A breath between downloads so the browser queues them. */
    await new Promise((r) => setTimeout(r, 250));
  }
}

/* ---------- 8. Shot mode ---------- */

/* URL params let a screenshot script stage a scene without
   clicking: ?shot=cover renders the cover full-frame;
   ?size=, ?layout=, ?grade=, ?title= and ?subtitle= stage it. */
function applyShotParams() {
  const params = new URLSearchParams(location.search);
  if (params.get("layout") && LAYOUTS[params.get("layout")]) {
    state.layout = params.get("layout");
  }
  if (params.get("grade") && GRADES[params.get("grade")]) {
    state.grade = params.get("grade");
  }
  if (params.get("title")) state.title = params.get("title");
  if (params.get("subtitle") !== null) state.subtitle = params.get("subtitle") || "";
  if (params.get("size")) {
    const hit = EXPORT_SIZES.find((s) => s.id === params.get("size"));
    if (hit) state.sizeId = hit.id;
  }
  if (params.get("shot") === "cover") {
    document.body.classList.add("shot-mode");
  }
  syncPanelCount();
}

/* ---------- Init ---------- */

window.__coverApp = {
  state,
  LAYOUTS,
  GRADES,
  EXPORT_SIZES,
  render,
  renderToCanvas,
  exportSize,
  exportAll,
  undo,
  redo,
  randomize,
  get fontsReady() { return fontsReady; },
};

(async function init() {
  applyShotParams();
  buildControls();
  syncControls();
  await Promise.all([loadSamples(), loadFonts()]);
  render();
  /* Fonts can arrive after the first paint; redraw once ready. */
  if (fontsReady) render();
})();
