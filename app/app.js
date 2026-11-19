// Neon Coast Cover Studio — one classic script (file:// safe: no ES modules,
// no network). Cover render engine + editor wiring + screenshot scenes.
// Draws multi-panel GTA-style posters: panels + per-panel crop, sunset/neon
// gradient-map grades, gradient Anton title with neon Pacifico subtitle,
// halftone title block, grain and vignette. All art and lettering original;
// no Rockstar logos, artwork or fonts.
"use strict";

const GRADES = [
  { id: "sunset", name: "Vice Sunset", sw: "linear-gradient(90deg,#ff5e78,#ffb347)",
    filter: "saturate(1.25) contrast(1.08)" },
  { id: "neon", name: "Neon Nights", sw: "linear-gradient(90deg,#ff2e88,#2ee6c8)",
    filter: "saturate(1.4) contrast(1.1)" },
  { id: "golden", name: "Golden Coast", sw: "linear-gradient(90deg,#ffd166,#ff8a3d)",
    filter: "saturate(1.2) contrast(1.05)" },
  { id: "heatwave", name: "Heatwave", sw: "linear-gradient(90deg,#ff3d2e,#ff7a18)",
    filter: "saturate(1.35) contrast(1.12)" },
  { id: "ink", name: "Poster Ink", sw: "linear-gradient(90deg,#2b1055,#ff4d8d)",
    filter: "grayscale(1) contrast(1.25) brightness(1.06)" },
  { id: "violet", name: "Midnight Violet", sw: "linear-gradient(90deg,#7b2ff7,#ff4d8d)",
    filter: "saturate(1.3) contrast(1.1)" },
  { id: "retro", name: "Retro Fade", sw: "linear-gradient(90deg,#d2aa6e,#f5e6c8)",
    filter: "saturate(0.75) contrast(0.95) brightness(1.04)" },
];

const LAYOUTS = [
  { id: "hero", name: "Hero Grid", panels: 4 },
  { id: "nine", name: "Nine Panel", panels: 8 },
  { id: "tilted", name: "Tilted Snaps", panels: 3 },
  { id: "full", name: "Full Bleed", panels: 1 },
  { id: "duo", name: "Duo Split", panels: 3 },
  { id: "story", name: "Story Stack", panels: 3 },
];

/** Panel rects + title zone for a layout, as fractions of (w, h). */
function layoutGeometry(layoutId, w, h) {
  const g = 0.014; // gutter, fraction of the short side
  const gs = Math.min(w, h) * g;
  const gx = gs / w, gy = gs / h;
  switch (layoutId) {
    case "nine": {
      const cw = (1 - 2 * gx) / 3, ch = (1 - 2 * gy) / 3;
      const panels = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        if (r === 1 && c === 1) continue; // centre cell is the title block
        panels.push({ x: c * (cw + gx), y: r * (ch + gy), w: cw, h: ch, rot: 0 });
      }
      return { panels, title: { x: cw + gx, y: ch + gy, w: cw, h: ch, align: "center", band: "solid" } };
    }
    case "tilted": {
      const panels = [
        { x: 0.03, y: 0.06, w: 0.44, h: 0.56, rot: -0.07 },
        { x: 0.50, y: 0.03, w: 0.46, h: 0.50, rot: 0.05 },
        { x: 0.28, y: 0.44, w: 0.46, h: 0.44, rot: -0.02 },
      ];
      return { panels, title: { x: 0.06, y: 0.80, w: 0.88, h: 0.17, align: "left", band: "scrim" } };
    }
    case "full":
      return { panels: [{ x: 0, y: 0, w: 1, h: 1, rot: 0 }],
               title: { x: 0.05, y: 0.66, w: 0.90, h: 0.30, align: "left", band: "scrim" } };
    case "duo":
      return { panels: [
        { x: 0, y: 0, w: 0.495, h: 1, rot: 0 },
        { x: 0.505, y: 0, w: 0.495, h: 0.60, rot: 0 },
        { x: 0.505, y: 0.61, w: 0.495, h: 0.39, rot: 0 },
      ], title: { x: 0.03, y: 0.76, w: 0.94, h: 0.21, align: "left", band: "scrim" } };
    case "story":
      return { panels: [
        { x: 0, y: 0, w: 1, h: 0.50, rot: 0 },
        { x: 0, y: 0.51, w: 0.495, h: 0.26, rot: 0 },
        { x: 0.505, y: 0.51, w: 0.495, h: 0.26, rot: 0 },
      ], title: { x: 0.05, y: 0.79, w: 0.90, h: 0.18, align: "left", band: "solid" } };
    case "hero":
    default:
      return { panels: [
        { x: 0, y: 0, w: 0.655, h: 0.665, rot: 0 },
        { x: 0.665, y: 0, w: 0.335, h: 0.215, rot: 0 },
        { x: 0.665, y: 0.225, w: 0.335, h: 0.215, rot: 0 },
        { x: 0.665, y: 0.45, w: 0.335, h: 0.215, rot: 0 },
      ], title: { x: 0, y: 0.685, w: 1, h: 0.315, align: "left", band: "solid" } };
  }
}

function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

/** Draws one photo cover-fitting a rect, honouring zoom / pan crop.
 *  ox/oy are normalised pan in [-1, 1]: -1 shows one edge of the overflow,
 *  +1 the other, 0 centres — so any crop of any photo is reachable. */
function drawPhotoCover(ctx, img, rx, ry, rw, rh, crop) {
  if (!img) return;
  const zoom = crop && crop.zoom != null ? crop.zoom : 1.15;
  const ox = crop && crop.ox != null ? crop.ox : 0;
  const oy = crop && crop.oy != null ? crop.oy : 0;
  const scale = Math.max(rw / img.naturalWidth, rh / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  const dx = rx + (rw - dw) / 2 + ox * (dw - rw) / 2;
  const dy = ry + (rh - dh) / 2 + oy * (dh - rh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Gradient-map / tint overlays for a grade, clipped to the panel rect. */
function applyGradeOverlays(ctx, grade, rx, ry, rw, rh) {
  const grad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
  switch (grade.id) {
    case "neon":
      grad.addColorStop(0, "rgba(255,46,136,0.28)");
      grad.addColorStop(1, "rgba(46,230,200,0.22)");
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = grad; ctx.fillRect(rx, ry, rw, rh);
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "rgba(255,80,170,0.10)"; ctx.fillRect(rx, ry, rw, rh);
      break;
    case "golden":
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = "rgba(255,190,80,0.30)"; ctx.fillRect(rx, ry, rw, rh);
      break;
    case "heatwave": {
      const hot = ctx.createLinearGradient(rx, ry + rh * 0.4, rx, ry + rh);
      hot.addColorStop(0, "rgba(255,60,40,0)");
      hot.addColorStop(1, "rgba(255,40,20,0.42)");
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(255,110,30,0.22)"; ctx.fillRect(rx, ry, rw, rh);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = hot; ctx.fillRect(rx, ry, rw, rh);
      break;
    }
    case "ink": {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(70,30,120,0.55)"; ctx.fillRect(rx, ry, rw, rh);
      ctx.globalCompositeOperation = "screen";
      grad.addColorStop(0, "rgba(255,77,141,0.30)");
      grad.addColorStop(1, "rgba(46,230,200,0.18)");
      ctx.fillStyle = grad; ctx.fillRect(rx, ry, rw, rh);
      break;
    }
    case "violet":
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = "rgba(123,47,247,0.32)"; ctx.fillRect(rx, ry, rw, rh);
      break;
    case "retro":
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(210,170,110,0.30)"; ctx.fillRect(rx, ry, rw, rh);
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = "rgba(255,240,210,0.20)"; ctx.fillRect(rx, ry, rw, rh);
      break;
    case "sunset":
    default: {
      const sun = ctx.createLinearGradient(rx, ry + rh * 0.3, rx, ry + rh);
      sun.addColorStop(0, "rgba(255,120,80,0)");
      sun.addColorStop(1, "rgba(220,40,120,0.34)");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = sun; ctx.fillRect(rx, ry, rw, rh);
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = "rgba(255,120,40,0.16)"; ctx.fillRect(rx, ry, rw, rh);
      break;
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

let noiseTile = null;
function getNoiseTile() {
  if (noiseTile) return noiseTile;
  noiseTile = document.createElement("canvas");
  noiseTile.width = 140; noiseTile.height = 140;
  const nctx = noiseTile.getContext("2d");
  const img = nctx.createImageData(140, 140);
  let seed = 1234567;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const v = seed % 256;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  return noiseTile;
}

/** Halftone dot field inside a band: dots grow toward one corner. */
function drawHalftone(ctx, x, y, w, h) {
  const step = Math.max(10, Math.min(w, h) / 26);
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  for (let yy = y + step / 2; yy < y + h; yy += step) {
    for (let xx = x + step / 2; xx < x + w; xx += step) {
      const t = (xx - x) / w; // grows to the right
      const r = step * 0.10 + t * step * 0.30;
      ctx.beginPath(); ctx.arc(xx, yy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function fitFont(ctx, text, maxWidth, startSize, family) {
  let size = startSize;
  ctx.font = size + "px " + family;
  try { ctx.letterSpacing = "0.03em"; } catch (_) { /* older canvas */ }
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = size + "px " + family;
  }
  return size;
}

/** The title block: gradient Anton title, neon Pacifico subtitle, heat stars. */
function drawTitleBlock(ctx, state, zone, W, H) {
  const zx = zone.x * W, zy = zone.y * H, zw = zone.w * W, zh = zone.h * H;
  const pad = Math.min(zw, zh) * 0.08 + 8;
  if (zone.band === "solid") {
    const band = ctx.createLinearGradient(zx, zy, zx, zy + zh);
    band.addColorStop(0, "#1c0b33"); band.addColorStop(1, "#2b0f45");
    ctx.fillStyle = band; ctx.fillRect(zx, zy, zw, zh);
    ctx.fillStyle = "#ff4d8d"; ctx.fillRect(zx, zy, zw, Math.max(3, H * 0.006));
    if (state.halftone) drawHalftone(ctx, zx + zw * 0.72, zy + zh * 0.08, zw * 0.26, zh * 0.84);
  } else {
    const scrim = ctx.createLinearGradient(zx, zy, zx, zy + zh);
    scrim.addColorStop(0, "rgba(12,4,24,0)");
    scrim.addColorStop(1, "rgba(12,4,24,0.88)");
    ctx.fillStyle = scrim; ctx.fillRect(zx, zy, zw, zh);
  }
  const align = zone.align === "center" ? "center" : "left";
  const tx = align === "center" ? zx + zw / 2 : zx + pad;
  ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  const title = (state.title || "NEON COAST").toUpperCase();
  const titleSize = fitFont(ctx, title, zw - pad * 2, Math.min(zh * 0.52, W * 0.085), "Anton, 'Arial Black', sans-serif");
  const titleY = zy + zh * 0.52;
  const titleWidth = ctx.measureText(title).width;
  if (state.titleStyle === "gradient") {
    const gx0 = align === "center" ? tx - titleWidth / 2 : tx;
    const tg = ctx.createLinearGradient(gx0, titleY, gx0 + titleWidth, titleY);
    tg.addColorStop(0, "#ffc93d"); tg.addColorStop(0.45, "#ff8a3d");
    tg.addColorStop(0.75, "#ff4d8d"); tg.addColorStop(1, "#ff2e88");
    ctx.fillStyle = tg;
  } else if (state.titleStyle === "outline") {
    ctx.fillStyle = "rgba(0,0,0,0)";
  } else {
    ctx.fillStyle = "#ffffff";
  }
  ctx.lineWidth = Math.max(2, titleSize * 0.07);
  ctx.strokeStyle = "rgba(16,5,28,0.92)";
  ctx.lineJoin = "round";
  ctx.strokeText(title, tx, titleY);
  if (state.titleStyle === "outline") {
    ctx.lineWidth = Math.max(2, titleSize * 0.045);
    ctx.strokeStyle = "#2ee6c8";
    ctx.shadowColor = "#ff2e88"; ctx.shadowBlur = titleSize * 0.35;
    ctx.strokeText(title, tx, titleY);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillText(title, tx, titleY);
  }
  // Neon script subtitle.
  const sub = (state.subtitle || "").trim();
  if (sub) {
    const subSize = fitFont(ctx, sub, zw - pad * 2, Math.min(zh * 0.26, W * 0.032), "Pacifico, cursive");
    ctx.font = subSize + "px Pacifico, cursive";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ff2e88"; ctx.shadowBlur = subSize * 0.6;
    ctx.fillText(sub, tx, zy + zh * 0.86);
    ctx.shadowBlur = 0;
  }
  // Heat meter stars, top-right of the title zone.
  const heat = state.heat != null ? state.heat : 5;
  const starSize = Math.max(12, Math.min(zh * 0.16, W * 0.02));
  ctx.font = starSize + "px sans-serif";
  ctx.fillStyle = "#ffc93d";
  ctx.textAlign = "right";
  ctx.fillText("★".repeat(heat) + "☆".repeat(5 - heat), zx + zw - pad, zy + starSize + 6);
  ctx.textAlign = align;
}

/** Rotated badge ribbon in the cover's top-right corner. */
function drawBadgeRibbon(ctx, state, W, H) {
  const text = (state.badge || "").trim();
  if (!text) return;
  const size = Math.max(13, W * 0.016);
  ctx.save();
  ctx.font = "400 " + size + "px Anton, 'Arial Black', sans-serif";
  try { ctx.letterSpacing = "0.12em"; } catch (_) {}
  const tw = ctx.measureText(text).width + size * 2.2;
  const th = size * 2.1;
  ctx.translate(W - tw / 2 - W * 0.02, th * 0.9);
  ctx.rotate(0.05);
  const bg = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0);
  bg.addColorStop(0, "#ff2e88"); bg.addColorStop(1, "#ff8a3d");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -th / 2, tw, th, th / 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), 0, 1);
  ctx.restore();
}

/** Main entry: draws the whole cover onto `canvas` at its own pixel size. */
function drawCover(canvas, state) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const grade = gradeById(state.grade);
  // Backdrop: deep plum with a diagonal sunset wash.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#170b2b"); bg.addColorStop(0.55, "#241040"); bg.addColorStop(1, "#3a1040");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (state.layout === "tilted") {
    const wash = ctx.createRadialGradient(W * 0.8, H * 0.15, 10, W * 0.8, H * 0.15, W * 0.7);
    wash.addColorStop(0, "rgba(255,140,60,0.55)");
    wash.addColorStop(0.5, "rgba(255,77,141,0.28)");
    wash.addColorStop(1, "rgba(255,77,141,0)");
    ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);
  }
  const geo = layoutGeometry(state.layout, W, H);
  const photos = state.photos || [];
  geo.panels.forEach((p, i) => {
    const rx = p.x * W, ry = p.y * H, rw = p.w * W, rh = p.h * H;
    const crop = (state.panels && state.panels[i]) || { zoom: 1.15, ox: 0, oy: 0 };
    let photo = null;
    if (photos.length) {
      // Per-panel assignment (thumbnail click) wins; otherwise round-robin.
      const pick = state.fillOne ? 0 : ((crop.photo != null ? crop.photo : i) % photos.length);
      photo = photos[pick];
    }
    ctx.save();
    // All panel-local drawing happens at (0,0): move the origin to the
    // panel's centre, rotate there for tilted panels, then back to its corner.
    ctx.translate(rx + rw / 2, ry + rh / 2);
    if (p.rot) ctx.rotate(p.rot);
    ctx.translate(-rw / 2, -rh / 2);
    const rad = Math.min(rw, rh) * 0.03;
    ctx.beginPath();
    ctx.roundRect(0, 0, rw, rh, rad);
    ctx.clip();
    if (photo && photo.img) {
      ctx.filter = grade.filter;
      drawPhotoCover(ctx, photo.img, 0, 0, rw, rh, crop);
      ctx.filter = "none";
    } else {
      const ph = ctx.createLinearGradient(0, 0, rw, rh);
      ph.addColorStop(0, "#3a1a5e"); ph.addColorStop(1, "#57204a");
      ctx.fillStyle = ph; ctx.fillRect(0, 0, rw, rh);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = Math.max(14, rw * 0.05) + "px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Add a photo", rw / 2, rh / 2);
    }
    applyGradeOverlays(ctx, grade, 0, 0, rw, rh);
    ctx.restore();
    // Panel frame (drawn after restore so rotation does not shear the stroke).
    ctx.save();
    ctx.translate(rx + rw / 2, ry + rh / 2);
    if (p.rot) ctx.rotate(p.rot);
    ctx.translate(-rw / 2, -rh / 2);
    if (p.rot) {
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = Math.min(W, H) * 0.025;
      ctx.shadowOffsetY = Math.min(W, H) * 0.01;
    }
    ctx.beginPath();
    ctx.roundRect(0, 0, rw, rh, Math.min(rw, rh) * 0.03);
    ctx.lineWidth = Math.max(2, Math.min(W, H) * 0.004);
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.stroke();
    ctx.restore();
  });
  drawTitleBlock(ctx, state, geo.title, W, H);
  if (state.layout !== "nine") drawBadgeRibbon(ctx, state, W, H);
  // Finish: grain, then vignette.
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = ctx.createPattern(getNoiseTile(), "repeat");
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(10,4,20,0)");
    vg.addColorStop(1, "rgba(10,4,20,0.42)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
}

/** Renders a fresh cover canvas at an exact export size. */
function renderCover(width, height, state) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  drawCover(canvas, state);
  return canvas;
}

/** Panel index hit-test for pointer dragging (fractions of the preview). */
function pickPanel(layoutId, w, h, fx, fy) {
  const geo = layoutGeometry(layoutId, w, h);
  for (let i = geo.panels.length - 1; i >= 0; i--) {
    const p = geo.panels[i];
    if (fx >= p.x && fx <= p.x + p.w && fy >= p.y && fy <= p.y + p.h) return i;
  }
  return -1;
}

// ---- editor state ------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const canvas = $("cover");
const statusEl = $("status");

const SAMPLES = [
  { name: "boardwalk", label: "Boardwalk sunset", src: "samples/boardwalk.png" },
  { name: "neon-street", label: "Neon street", src: "samples/neon-street.png" },
  { name: "pier", label: "Pier sunrise", src: "samples/pier.png" },
];

// One evocative default: two friends, one helmet handed over at sunset.
function defaultPanels() {
  // Crops tuned (overflow-normalised pan) so each panel's window lands on
  // the figures and the prop, not on empty sky.
  const crops = [
    { zoom: 1.05, ox: 0.0, oy: -0.40, photo: 0 },
    { zoom: 2.0, ox: 0.0, oy: -0.50, photo: 1 },
    { zoom: 1.8, ox: 0.0, oy: -0.46, photo: 2 },
    { zoom: 2.0, ox: -0.07, oy: -0.53, photo: 0 },
    { zoom: 1.3, ox: 0.0, oy: -0.70, photo: 1 },
    { zoom: 1.3, ox: 0.0, oy: -0.70, photo: 2 },
    { zoom: 1.15, ox: 0.0, oy: -1.0, photo: 0 },
    { zoom: 1.15, ox: -0.2, oy: -1.0, photo: 1 },
    { zoom: 1.15, ox: 0.2, oy: -1.0, photo: 2 },
  ];
  return crops.map((c) => ({ zoom: c.zoom, ox: c.ox, oy: c.oy, photo: c.photo }));
}

const state = {
  layout: "hero",
  grade: "sunset",
  title: "NEON COAST",
  subtitle: "one helmet, two sunsets",
  badge: "NEON COAST • EST. 2026",
  heat: 5,
  titleStyle: "gradient",
  halftone: true,
  grain: true,
  vignette: true,
  size: "1920x1080",
  fillOne: false,
  photos: [],
  panels: defaultPanels(),
};

let selectedPanel = 0;
let undoStack = [];
let redoStack = [];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load " + src));
    img.src = src;
  });
}

async function loadSample(name) {
  const sample = SAMPLES.find((s) => s.name === name);
  if (!sample) return null;
  const img = await loadImage(sample.src);
  return { name: sample.name, label: sample.label, src: sample.src, img };
}

async function loadDefaultPhotos() {
  if (state.photos.length) return;
  for (const s of SAMPLES) {
    try { state.photos.push(await loadSample(s.name)); }
    catch (e) { console.warn("sample failed", s.name, e); }
  }
  renderPhotoTray();
}

function renderPhotoTray() {
  const tray = $("photoTray");
  tray.innerHTML = "";
  state.photos.forEach((p, i) => {
    const thumb = document.createElement("img");
    thumb.src = p.src;
    thumb.alt = p.label || p.name;
    thumb.title = (p.label || p.name) + " — click to put in the selected panel";
    if (i === ((state.panels[selectedPanel] && state.panels[selectedPanel].photo) || 0)) thumb.classList.add("active");
    thumb.addEventListener("click", () => {
      pushUndo();
      state.panels[selectedPanel].photo = i;
      renderPhotoTray(); redraw();
    });
    tray.appendChild(thumb);
  });
}

function sizeDims() {
  const parts = state.size.split("x").map(Number);
  return { w: parts[0], h: parts[1] };
}

function redraw() {
  const dims = sizeDims();
  if (canvas.width !== dims.w || canvas.height !== dims.h) {
    canvas.width = dims.w; canvas.height = dims.h;
  }
  drawCover(canvas, state);
  syncPanelControls();
}

function syncPanelControls() {
  const geo = layoutGeometry(state.layout, canvas.width, canvas.height);
  const count = geo.panels.length;
  if (selectedPanel >= count) selectedPanel = 0;
  const crop = state.panels[selectedPanel];
  $("zoomSlider").value = crop.zoom;
  $("panXSlider").value = crop.ox;
  $("panYSlider").value = crop.oy;
  $("panelHint").textContent =
    "Panel " + (selectedPanel + 1) + " of " + count + " selected — drag the photo, scroll to zoom";
  document.querySelectorAll("#panelPicker button").forEach((b, i) => {
    b.classList.toggle("active", i === selectedPanel);
  });
  document.querySelectorAll("#photoTray img").forEach((t, i) => {
    t.classList.toggle("active", i === crop.photo);
  });
}

// ---- undo / redo: snapshots of the editable cover settings only ------------
function snapshot() {
  const s = state;
  return JSON.stringify({ layout: s.layout, grade: s.grade, title: s.title,
    subtitle: s.subtitle, badge: s.badge, heat: s.heat, titleStyle: s.titleStyle,
    halftone: s.halftone, grain: s.grain, vignette: s.vignette, size: s.size,
    fillOne: s.fillOne, panels: s.panels });
}
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}
function applySnapshot(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  syncInputsFromState();
  buildPickers();
  redraw();
}
function updateUndoButtons() {
  $("undoBtn").disabled = undoStack.length === 0;
  $("redoBtn").disabled = redoStack.length === 0;
}
$("undoBtn").addEventListener("click", () => {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  applySnapshot(undoStack.pop());
  updateUndoButtons();
});
$("redoBtn").addEventListener("click", () => {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  applySnapshot(redoStack.pop());
  updateUndoButtons();
});

// ---- pickers ---------------------------------------------------------------
function buildPickers() {
  const layoutRow = $("layoutRow");
  layoutRow.innerHTML = "";
  for (const l of LAYOUTS) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = l.name;
    b.setAttribute("aria-pressed", String(state.layout === l.id));
    b.classList.toggle("active", state.layout === l.id);
    b.addEventListener("click", () => { pushUndo(); state.layout = l.id; buildPickers(); redraw(); });
    layoutRow.appendChild(b);
  }
  const gradeRow = $("gradeRow");
  gradeRow.innerHTML = "";
  for (const g of GRADES) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-pressed", String(state.grade === g.id));
    b.classList.toggle("active", state.grade === g.id);
    const sw = document.createElement("span");
    sw.className = "sw"; sw.style.background = g.sw;
    b.appendChild(sw);
    b.appendChild(document.createTextNode(g.name));
    b.addEventListener("click", () => { pushUndo(); state.grade = g.id; buildPickers(); redraw(); });
    gradeRow.appendChild(b);
  }
  const picker = $("panelPicker");
  picker.innerHTML = "";
  const count = layoutGeometry(state.layout, canvas.width, canvas.height).panels.length;
  for (let i = 0; i < count; i++) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = String(i + 1);
    b.classList.toggle("active", i === selectedPanel);
    b.addEventListener("click", () => { selectedPanel = i; syncPanelControls(); });
    picker.appendChild(b);
  }
}

function syncInputsFromState() {
  $("titleInput").value = state.title;
  $("subtitleInput").value = state.subtitle;
  $("badgeInput").value = state.badge;
  $("titleStyle").value = state.titleStyle;
  $("heatSelect").value = String(state.heat);
  $("sizeSelect").value = state.size;
  $("fillOne").checked = state.fillOne;
  $("grainCheck").checked = state.grain;
  $("halftoneCheck").checked = state.halftone;
  $("vignetteCheck").checked = state.vignette;
}

// ---- text + option inputs ---------------------------------------------------
function bindText(id, key) {
  $(id).addEventListener("input", (e) => { state[key] = e.target.value; redraw(); });
  $(id).addEventListener("change", () => pushUndo());
}
bindText("titleInput", "title");
bindText("subtitleInput", "subtitle");
bindText("badgeInput", "badge");
$("titleStyle").addEventListener("change", (e) => { pushUndo(); state.titleStyle = e.target.value; redraw(); });
$("heatSelect").addEventListener("change", (e) => { pushUndo(); state.heat = Number(e.target.value); redraw(); });
$("sizeSelect").addEventListener("change", (e) => { pushUndo(); state.size = e.target.value; redraw(); });
$("fillOne").addEventListener("change", (e) => { pushUndo(); state.fillOne = e.target.checked; redraw(); });
$("grainCheck").addEventListener("change", (e) => { pushUndo(); state.grain = e.target.checked; redraw(); });
$("halftoneCheck").addEventListener("change", (e) => { pushUndo(); state.halftone = e.target.checked; redraw(); });
$("vignetteCheck").addEventListener("change", (e) => { pushUndo(); state.vignette = e.target.checked; redraw(); });

// ---- per-panel crop sliders -------------------------------------------------
$("zoomSlider").addEventListener("input", (e) => {
  state.panels[selectedPanel].zoom = Number(e.target.value); redraw();
});
$("zoomSlider").addEventListener("change", () => pushUndo());
$("panXSlider").addEventListener("input", (e) => {
  state.panels[selectedPanel].ox = Number(e.target.value); redraw();
});
$("panXSlider").addEventListener("change", () => pushUndo());
$("panYSlider").addEventListener("input", (e) => {
  state.panels[selectedPanel].oy = Number(e.target.value); redraw();
});
$("panYSlider").addEventListener("change", () => pushUndo());

// ---- drag to pan, wheel to zoom, click to select a panel --------------------
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, r };
}
canvas.addEventListener("pointerdown", (e) => {
  const pt = canvasPoint(e);
  const hit = pickPanel(state.layout, canvas.width, canvas.height, pt.fx, pt.fy);
  if (hit < 0) return;
  selectedPanel = hit;
  syncPanelControls();
  drag = { x: e.clientX, y: e.clientY, ox: state.panels[hit].ox, oy: state.panels[hit].oy };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const pt = canvasPoint(e);
  const crop = state.panels[selectedPanel];
  // Pan in overflow-normalised units: dragging across the panel's overflow
  // moves the crop from one edge to the other.
  const geo = layoutGeometry(state.layout, canvas.width, canvas.height);
  const p = geo.panels[selectedPanel];
  const photo = state.photos[crop.photo];
  const rw = p.w * canvas.width, rh = p.h * canvas.height;
  let dw = rw * 2, dh = rh * 2;
  if (photo && photo.img) {
    const scale = Math.max(rw / photo.img.naturalWidth, rh / photo.img.naturalHeight) * crop.zoom;
    dw = photo.img.naturalWidth * scale; dh = photo.img.naturalHeight * scale;
  }
  const dxCanvas = (e.clientX - drag.x) * (canvas.width / pt.r.width);
  const dyCanvas = (e.clientY - drag.y) * (canvas.height / pt.r.height);
  crop.ox = Math.max(-1, Math.min(1, drag.ox + 2 * dxCanvas / Math.max(1, dw - rw)));
  crop.oy = Math.max(-1, Math.min(1, drag.oy + 2 * dyCanvas / Math.max(1, dh - rh)));
  redraw();
});
canvas.addEventListener("pointerup", () => { if (drag) { pushUndo(); drag = null; } });
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const crop = state.panels[selectedPanel];
  crop.zoom = Math.max(1, Math.min(3, crop.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  redraw();
}, { passive: false });

// ---- photos: upload + samples ----------------------------------------------
$("photoInput").addEventListener("change", async (e) => {
  for (const file of e.target.files) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      state.photos.push({ name: file.name, label: file.name, src: url, img });
    } catch (err) { console.warn("photo failed", file.name, err); }
  }
  e.target.value = "";
  renderPhotoTray(); redraw();
  statusEl.textContent = state.photos.length + " photo(s) loaded — click a panel, then a thumbnail to place it.";
});
document.querySelectorAll("[data-sample]").forEach((b) => {
  b.addEventListener("click", async () => {
    const p = await loadSample(b.dataset.sample);
    if (!p) return;
    const existing = state.photos.findIndex((x) => x.name === p.name);
    if (existing < 0) state.photos.push(p);
    pushUndo();
    state.panels[selectedPanel].photo = existing < 0 ? state.photos.length - 1 : existing;
    renderPhotoTray(); redraw();
  });
});

// ---- export ------------------------------------------------------------------
function downloadCanvas(c, filename) {
  return new Promise((resolve) => {
    c.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, "image/png");
  });
}
async function exportSize(size, quiet) {
  const parts = size.split("x").map(Number);
  const c = renderCover(parts[0], parts[1], state);
  await downloadCanvas(c, "neon-coast-cover-" + parts[0] + "x" + parts[1] + ".png");
  if (!quiet) statusEl.textContent = "Saved neon-coast-cover-" + parts[0] + "x" + parts[1] + ".png — " + parts[0] + " × " + parts[1] + " PNG.";
}
$("exportBtn").addEventListener("click", () => exportSize(state.size));
$("exportAllBtn").addEventListener("click", async () => {
  for (const s of ["1920x1080", "1080x1350", "1080x1080"]) await exportSize(s, true);
  statusEl.textContent = "Saved all 3 sizes: 1920×1080, 1080×1350 and 1080×1080 PNG.";
});
$("makeCover").addEventListener("click", async () => {
  await loadDefaultPhotos();
  pushUndo();
  state.layout = "hero"; state.grade = "sunset";
  buildPickers(); redraw();
  document.querySelector(".stage").scrollIntoView({ behavior: "smooth", block: "nearest" });
  statusEl.textContent = "Your cover is ready — pick a size and hit Export PNG.";
});

// ---- screenshot scenes -------------------------------------------------------
// ?shot=cover draws one exported cover alone; ?shot=editor shows the full
// editor with a sample photo loaded. Query: photo, caption, subtitle, layout,
// grade, size, multi=1. window.__shotReady is set once painted.
async function runShot(shot, query) {
  const photo = query.get("photo") || "boardwalk";
  const caption = query.get("caption") || "NEON COAST";
  const subtitle = query.get("subtitle") || "one helmet, two sunsets";
  state.title = caption;
  state.subtitle = subtitle;
  state.layout = query.get("layout") || "hero";
  state.grade = query.get("grade") || "sunset";
  state.size = query.get("size") || "1920x1080";
  await loadDefaultPhotos();
  const picked = state.photos.findIndex((p) => p.name === photo);
  if (picked >= 0) state.panels.forEach((p) => { p.photo = picked; });
  if (query.get("multi") === "1") {
    state.fillOne = false;
    state.panels.forEach((p, i) => { p.photo = i % state.photos.length; });
  }
  try {
    await document.fonts.load("100px Anton");
    await document.fonts.load("40px Pacifico");
    await document.fonts.ready;
  } catch (_) { /* system fallbacks still draw */ }
  if (shot === "cover") document.body.classList.add("shot-cover");
  buildPickers();
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

// ---- boot --------------------------------------------------------------------
async function boot() {
  buildPickers();
  syncInputsFromState();
  updateUndoButtons();
  const params = new URLSearchParams(location.search);
  if (params.get("shot")) {
    await runShot(params.get("shot"), params);
  } else {
    await loadDefaultPhotos();
    try {
      await document.fonts.load("100px Anton");
      await document.fonts.load("40px Pacifico");
    } catch (_) { /* system fallbacks still draw */ }
    redraw();
  }
}
boot();
