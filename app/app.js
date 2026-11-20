/* Neon Coast Cover Studio — cover engine + editor wiring.
   One classic script, no network requests: every photo, font and pixel is local.
   Layouts: hero / nine / tilted / full / duo / story. Grades: 7 sunset-neon maps. */
'use strict';

/* ------------------------------------------------------------------ data */

var SAMPLES = [
  { name: 'Boardwalk', file: 'samples/boardwalk.png' },
  { name: 'Neon street', file: 'samples/neon-street.png' },
  { name: 'Pier', file: 'samples/pier.png' }
];

var GRADES = {
  sunset:  { label: 'Vice Sunset',   wash: 'rgba(255,110,60,0.16)',  deep: 'rgba(60,10,60,0.28)', glow: '#ff9e57', title: ['#ffd166', '#ff8c42', '#ff5e8a'] },
  neon:    { label: 'Neon Nights',   wash: 'rgba(255,60,180,0.18)',  deep: 'rgba(20,0,50,0.32)',  glow: '#ff5ea8', title: ['#7df9ff', '#ff5ea8', '#ffd166'] },
  golden:  { label: 'Golden Coast',  wash: 'rgba(255,190,60,0.18)',  deep: 'rgba(80,40,0,0.26)',  glow: '#ffe08a', title: ['#fff3b0', '#ffb347', '#ff7b54'] },
  heatwave:{ label: 'Heatwave',      wash: 'rgba(255,60,40,0.20)',   deep: 'rgba(70,0,0,0.30)',   glow: '#ff6b5e', title: ['#ffe259', '#ff7b54', '#e63b2e'] },
  ink:     { label: 'Poster Ink',    wash: 'rgba(20,10,40,0.10)',    deep: 'rgba(10,5,25,0.35)',  glow: '#ffd166', title: ['#ffffff', '#ffd166', '#ff5e8a'], duotone: ['#160b2e', '#ffd166'] },
  violet:  { label: 'Midnight Violet', wash: 'rgba(120,60,255,0.20)', deep: 'rgba(25,0,60,0.34)', glow: '#b78cff', title: ['#e0c3ff', '#8b5cf6', '#ff5ea8'] },
  retro:   { label: 'Retro Fade',    wash: 'rgba(255,200,150,0.14)', deep: 'rgba(60,40,20,0.24)', glow: '#ffb38a', title: ['#fff8e7', '#f4a261', '#e76f51'] }
};

var LAYOUTS = {
  hero:   { label: 'Hero Grid',   note: 'one big hero + two' },
  nine:   { label: 'Nine Panel',  note: 'title in the middle' },
  tilted: { label: 'Tilted Snaps', note: 'overlapping photos' },
  full:   { label: 'Full Bleed',  note: 'one photo, edge to edge' },
  duo:    { label: 'Duo Split',   note: 'two halves' },
  story:  { label: 'Story Stack', note: 'tall top + two below' }
};

var SIZES = [
  { id: 'wide',  w: 1920, h: 1080, label: '1920 × 1080', note: 'landscape · feed + wallpaper' },
  { id: 'tall',  w: 1080, h: 1350, label: '1080 × 1350', note: 'portrait · feed post' },
  { id: 'square', w: 1080, h: 1080, label: '1080 × 1080', note: 'square · profile grid' }
];

/* ------------------------------------------------------------------ state */

var photos = [];            // {name, img, uploaded}
var uploads = 0;

function defaultPanels() {
  var out = [];
  for (var i = 0; i < 9; i++) {
    out.push({ photo: i % 3, zoom: 1 + (i % 3) * 0.08, ox: 0, oy: 0 });
  }
  return out;
}

var state = {
  layout: 'hero',
  grade: 'sunset',
  sizeId: 'wide',
  title: 'NEON COAST',
  subtitle: 'two friends, one sunset',
  badge: 'NEON COAST',
  stars: 5,
  grain: true,
  vignette: true,
  halftone: true,
  fillOne: false,
  selected: 0,
  panels: defaultPanels()
};

var undoStack = [];
var redoStack = [];

function snapshot() { return JSON.stringify(state); }
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  syncUndoButtons();
}
function restore(json) {
  var keep = state.selected;
  state = JSON.parse(json);
  state.selected = Math.min(keep, panelCount() - 1);
  syncAllControls();
  renderPreview();
}
function doUndo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  syncUndoButtons();
}
function doRedo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  syncUndoButtons();
}
function syncUndoButtons() {
  $('btn-undo').disabled = undoStack.length === 0;
  $('btn-redo').disabled = redoStack.length === 0;
}

/* ------------------------------------------------------------------ helpers */

function $(id) { return document.getElementById(id); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function fitFont(ctx, text, maxW, startPx, family) {
  var px = startPx;
  ctx.font = px + 'px ' + family;
  while (px > 12 && ctx.measureText(text).width > maxW) {
    px -= 2;
    ctx.font = px + 'px ' + family;
  }
  return px;
}

var grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  var c = document.createElement('canvas');
  c.width = 140; c.height = 140;
  var g = c.getContext('2d');
  var data = g.createImageData(140, 140);
  for (var i = 0; i < data.data.length; i += 4) {
    var v = 110 + Math.floor(Math.random() * 90);
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  grainTile = c;
  return grainTile;
}

/* ------------------------------------------------------- layout geometry */

/* Every layout returns { panels: [{x,y,w,h,rot}], title: {x,y,w,h,align}, badge: {x,y} }
   in cover pixels. Panels map to state.panels[0..n) in order. */
function layoutGeometry(id, W, H) {
  var g = Math.max(6, Math.round(W * 0.008));
  var third = (H - g * 2) / 3;
  if (id === 'hero') {
    var lw = Math.round(W * 0.60);
    return {
      panels: [
        { x: 0, y: 0, w: lw, h: H, rot: 0 },
        { x: lw + g, y: 0, w: W - lw - g, h: Math.round((H - g) / 2), rot: 0 },
        { x: lw + g, y: Math.round((H + g) / 2), w: W - lw - g, h: Math.round((H - g) / 2), rot: 0 }
      ],
      title: { x: Math.round(W * 0.03), y: Math.round(H * 0.68), w: Math.round(W * 0.55), h: Math.round(H * 0.28), align: 'left' },
      badge: { x: W - g - 10, y: g + 26 }
    };
  }
  if (id === 'nine') {
    var cw = (W - g * 2) / 3;
    var ch = (H - g * 2) / 3;
    var cells = [];
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) {
        if (r === 1 && c === 1) continue;
        cells.push({ x: Math.round(c * (cw + g)), y: Math.round(r * (ch + g)), w: Math.round(cw), h: Math.round(ch), rot: 0 });
      }
    }
    return {
      panels: cells,
      title: { x: Math.round(cw + g), y: Math.round(ch + g), w: Math.round(cw), h: Math.round(ch), align: 'center' },
      badge: { x: W - g - 10, y: g + 26 }
    };
  }
  if (id === 'tilted') {
    var pw = Math.round(W * 0.52);
    var ph = Math.round(H * 0.60);
    var top = Math.round(H * 0.06);
    return {
      panels: [
        { x: Math.round(W * 0.02), y: top, w: pw, h: ph, rot: -0.11 },
        { x: Math.round(W * 0.26), y: top + Math.round(H * 0.05), w: pw, h: ph, rot: 0.06 },
        { x: Math.round(W * 0.48), y: top, w: pw, h: ph, rot: -0.04 }
      ],
      title: { x: Math.round(W * 0.05), y: Math.round(H * 0.78), w: Math.round(W * 0.90), h: Math.round(H * 0.19), align: 'center' },
      badge: { x: Math.round(W * 0.94), y: Math.round(H * 0.06) + 26 }
    };
  }
  if (id === 'full') {
    return {
      panels: [{ x: 0, y: 0, w: W, h: H, rot: 0 }],
      title: { x: Math.round(W * 0.04), y: Math.round(H * 0.70), w: Math.round(W * 0.80), h: Math.round(H * 0.26), align: 'left' },
      badge: { x: W - 16, y: 40 }
    };
  }
  if (id === 'duo') {
    var hw = Math.round((W - g) / 2);
    return {
      panels: [
        { x: 0, y: 0, w: hw, h: H, rot: 0 },
        { x: hw + g, y: 0, w: hw, h: H, rot: 0 }
      ],
      title: { x: Math.round(W * 0.05), y: Math.round(H * 0.72), w: Math.round(W * 0.90), h: Math.round(H * 0.24), align: 'center' },
      badge: { x: W - g - 10, y: g + 26 }
    };
  }
  /* story */
  var topH = Math.round(H * 0.60);
  var bw = Math.round((W - g) / 2);
  return {
    panels: [
      { x: 0, y: 0, w: W, h: topH, rot: 0 },
      { x: 0, y: topH + g, w: bw, h: H - topH - g, rot: 0 },
      { x: bw + g, y: topH + g, w: bw, h: H - topH - g, rot: 0 }
    ],
    title: { x: Math.round(W * 0.04), y: Math.round(H * 0.40), w: Math.round(W * 0.72), h: Math.round(H * 0.18), align: 'left' },
    badge: { x: W - g - 10, y: g + 26 }
  };
}

function panelCount() { return layoutGeometry(state.layout, 100, 100).panels.length; }

/* ------------------------------------------------------------- grade work */

function applyDuotone(img, w, h, dark, light) {
  var c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  var g = c.getContext('2d');
  drawCoverFit(g, img, { zoom: 1, ox: 0, oy: 0 }, 0, 0, c.width, c.height);
  var data = g.getImageData(0, 0, c.width, c.height);
  var d = data.data;
  var dk = hexRgb(dark);
  var lt = hexRgb(light);
  for (var i = 0; i < d.length; i += 4) {
    var lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    d[i] = dk[0] + (lt[0] - dk[0]) * lum;
    d[i + 1] = dk[1] + (lt[1] - dk[1]) * lum;
    d[i + 2] = dk[2] + (lt[2] - dk[2]) * lum;
  }
  g.putImageData(data, 0, 0);
  return c;
}

function hexRgb(hex) {
  var n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* Draw img cover-fitting rect (x,y,w,h) with a panel's zoom + pan. */
function drawCoverFit(ctx, img, panel, x, y, w, h) {
  var iw = img.naturalWidth || img.width;
  var ih = img.naturalHeight || img.height;
  var base = Math.max(w / iw, h / ih) * panel.zoom;
  var dw = iw * base;
  var dh = ih * base;
  var dx = x + (w - dw) / 2 + panel.ox * w;
  var dy = y + (h - dh) / 2 + panel.oy * h;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawPhotoPanel(ctx, panel, rect, grade, W, H) {
  var photo = photos[panel.photo] || photos[0];
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate(rect.rot || 0);
  ctx.translate(-rect.w / 2, -rect.h / 2);
  if (rect.rot) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.round(W * 0.012);
    ctx.shadowOffsetY = Math.round(H * 0.008);
  }
  ctx.fillStyle = '#241338';
  ctx.fillRect(0, 0, rect.w, rect.h);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (photo && photo.img && photo.img.complete && photo.img.naturalWidth) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, rect.w, rect.h);
    ctx.clip();
    if (grade.duotone) {
      var duo = applyDuotone(photo.img, rect.w, rect.h, grade.duotone[0], grade.duotone[1]);
      ctx.drawImage(duo, 0, 0, rect.w, rect.h);
    } else {
      drawCoverFit(ctx, photo.img, panel, 0, 0, rect.w, rect.h);
    }
    /* sunset wash + bottom shade */
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grade.wash;
    ctx.fillRect(0, 0, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
    var shade = ctx.createLinearGradient(0, rect.h * 0.55, 0, rect.h);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, grade.deep);
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, rect.w, rect.h);
    ctx.restore();
  } else {
    /* photo still loading: warm placeholder with its name */
    var ph = ctx.createLinearGradient(0, 0, rect.w, rect.h);
    ph.addColorStop(0, '#ff8c42');
    ph.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = ph;
    ctx.fillRect(0, 0, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = Math.round(rect.h * 0.07) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(photo ? photo.name : 'photo', rect.w / 2, rect.h / 2);
  }
  /* white poster border */
  ctx.lineWidth = Math.max(3, Math.round(W * 0.004));
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(0, 0, rect.w, rect.h);
  ctx.restore();
}

/* ---------------------------------------------------------------- lettering */

function drawHalftone(ctx, zone) {
  var step = Math.max(10, Math.round(zone.w / 46));
  ctx.save();
  ctx.fillStyle = 'rgba(20,8,30,0.16)';
  for (var y = zone.y + step / 2; y < zone.y + zone.h; y += step) {
    for (var x = zone.x + step / 2; x < zone.x + zone.w; x += step) {
      var r = step * 0.16 + ((x + y) % (step * 3)) / (step * 3) * step * 0.14;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawTitleBlock(ctx, geo, grade, W, H) {
  var z = geo.title;
  var title = (state.title || 'NEON COAST').toUpperCase();
  var sub = state.subtitle || '';
  if (state.halftone) drawHalftone(ctx, z);

  var pad = Math.round(W * 0.012);
  var boxX = z.x - pad;
  var boxY = z.y - pad;
  var boxW = z.w + pad * 2;
  var boxH = z.h + pad * 2;
  if (state.layout === 'nine') {
    ctx.save();
    ctx.fillStyle = 'rgba(18,8,31,0.88)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.lineWidth = Math.max(3, Math.round(W * 0.004));
    ctx.strokeStyle = '#ffd166';
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = z.align;
  var tx = z.align === 'center' ? z.x + z.w / 2 : z.x;
  var titlePx = fitFont(ctx, title, z.w, Math.round(z.h * 0.44), "'Anton', sans-serif");
  var grad = ctx.createLinearGradient(tx - z.w / 2, 0, tx + z.w / 2, 0);
  grad.addColorStop(0, grade.title[0]);
  grad.addColorStop(0.55, grade.title[1]);
  grad.addColorStop(1, grade.title[2]);
  ctx.font = titlePx + "px 'Anton', sans-serif";
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(10,4,20,0.85)';
  ctx.shadowBlur = Math.round(titlePx * 0.10);
  ctx.shadowOffsetY = Math.round(titlePx * 0.045);
  ctx.strokeStyle = 'rgba(24,8,32,0.92)';
  ctx.lineWidth = Math.max(2, Math.round(titlePx / 14));
  var titleY = z.y + titlePx * 0.98;
  ctx.strokeText(title, tx, titleY);
  ctx.fillStyle = grad;
  ctx.fillText(title, tx, titleY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (sub) {
    var subPx = Math.max(14, Math.round(titlePx * 0.34));
    ctx.font = subPx + "px 'Pacifico', cursive";
    ctx.shadowColor = grade.glow;
    ctx.shadowBlur = Math.round(subPx * 0.7);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, tx, titleY + subPx * 1.25);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  /* heat-meter stars under the lettering */
  var starY = titleY + Math.round(titlePx * 0.34) + Math.round(titlePx * 0.62);
  var starPx = Math.max(13, Math.round(titlePx * 0.26));
  ctx.font = starPx + 'px system-ui, sans-serif';
  var stars = '';
  for (var i = 0; i < 5; i++) stars += i < state.stars ? '★' : '☆';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(stars, tx, starY);
  ctx.restore();

  /* badge ribbon, top corner */
  if (state.badge) {
    var b = geo.badge;
    var bPx = Math.max(13, Math.round(W * 0.016));
    ctx.save();
    ctx.font = bPx + "px 'Anton', sans-serif";
    var bw = ctx.measureText(state.badge.toUpperCase()).width + bPx * 2.4;
    /* keep the whole ribbon on-canvas: pull its centre left when it would clip */
    var bx = Math.min(b.x, W - bw / 2 - 12);
    var by = Math.max(b.y, bPx + 8);
    ctx.translate(bx, by);
    ctx.rotate(-0.10);
    ctx.font = bPx + "px 'Anton', sans-serif";
    var bg = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    bg.addColorStop(0, '#ff8c42');
    bg.addColorStop(1, '#ff5e8a');
    ctx.fillStyle = bg;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.moveTo(-bw / 2, -bPx * 0.95);
    ctx.lineTo(bw / 2, -bPx * 0.95);
    ctx.lineTo(bw / 2 + bPx * 0.5, 0);
    ctx.lineTo(bw / 2, bPx * 0.95);
    ctx.lineTo(-bw / 2, bPx * 0.95);
    ctx.lineTo(-bw / 2 - bPx * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.badge.toUpperCase(), 0, 1);
    ctx.restore();
  }
}

/* ------------------------------------------------------------ the render */

function renderCover(ctx, W, H, opts) {
  opts = opts || {};
  var grade = GRADES[state.grade] || GRADES.sunset;
  var geo = layoutGeometry(state.layout, W, H);

  /* sky backdrop */
  var sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#ff8c42');
  sky.addColorStop(0.45, '#ff5e8a');
  sky.addColorStop(0.75, '#7b2f8e');
  sky.addColorStop(1, '#2b1055');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  /* sun glow behind the panels */
  var glow = ctx.createRadialGradient(W * 0.72, H * 0.30, 10, W * 0.72, H * 0.30, W * 0.42);
  glow.addColorStop(0, 'rgba(255,241,168,0.55)');
  glow.addColorStop(1, 'rgba(255,241,168,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  var n = geo.panels.length;
  for (var i = 0; i < n; i++) {
    var p = state.panels[i];
    if (state.fillOne) p = { photo: state.panels[0].photo, zoom: p.zoom, ox: p.ox, oy: p.oy };
    drawPhotoPanel(ctx, p, geo.panels[i], grade, W, H);
  }

  drawTitleBlock(ctx, geo, grade, W, H);

  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette) {
    var vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(10,4,20,0)');
    vig.addColorStop(1, 'rgba(10,4,20,0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  if (opts.preview) {
    var sel = geo.panels[state.selected];
    if (sel) {
      ctx.save();
      ctx.translate(sel.x + sel.w / 2, sel.y + sel.h / 2);
      ctx.rotate(sel.rot || 0);
      ctx.translate(-sel.w / 2, -sel.h / 2);
      ctx.setLineDash([10, 7]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffd166';
      ctx.strokeRect(-2, -2, sel.w + 4, sel.h + 4);
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------------ preview */

var stage = null;
var previewSize = { w: 1920, h: 1080 };
var shotMode = null;

function renderShotCover() {
  if (!stage) return;
  stage.width = window.innerWidth;
  stage.height = window.innerHeight;
  renderCover(stage.getContext('2d'), stage.width, stage.height, {});
}

function renderPreview() {
  if (!stage) return;
  if (shotMode === 'cover') { renderShotCover(); return; }
  var scale = 960 / Math.max(previewSize.w, previewSize.h);
  var pw = Math.round(previewSize.w * scale);
  var ph = Math.round(previewSize.h * scale);
  if (stage.width !== pw || stage.height !== ph) {
    stage.width = pw;
    stage.height = ph;
  }
  var ctx = stage.getContext('2d');
  renderCover(ctx, pw, ph, { preview: true });
  $('stage-size').textContent = previewSize.w + ' × ' + previewSize.h;
}

function currentSize() {
  for (var i = 0; i < SIZES.length; i++) if (SIZES[i].id === state.sizeId) return SIZES[i];
  return SIZES[0];
}

function setPreviewSize(sizeId) {
  state.sizeId = sizeId;
  var s = currentSize();
  previewSize = { w: s.w, h: s.h };
  syncSizePick();
  renderPreview();
}

/* ------------------------------------------------------------------ export */

function exportCover(size, done) {
  var c = document.createElement('canvas');
  c.width = size.w;
  c.height = size.h;
  var ctx = c.getContext('2d');
  renderCover(ctx, size.w, size.h, {});
  c.toBlob(function (blob) {
    if (!blob) {
      $('export-status').textContent = 'Export failed — open the app over HTTP (node serve.ts) and try again.';
      if (done) done(false);
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'neon-coast-cover-' + size.w + 'x' + size.h + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    $('export-status').textContent = 'Exported ' + size.w + ' × ' + size.h + ' PNG (' + Math.round(blob.size / 1024) + ' KiB).';
    if (done) done(true);
  }, 'image/png');
}

function exportAll() {
  var i = 0;
  var ok = 0;
  var step = function () {
    if (i >= SIZES.length) {
      $('export-status').textContent = 'Exported all three sizes (' + ok + '/3).';
      return;
    }
    exportCover(SIZES[i], function (good) {
      if (good) ok++;
      i++;
      setTimeout(step, 350);
    });
  };
  step();
}

/* ------------------------------------------------------------- photo intake */

function loadPhoto(def, done) {
  var img = new Image();
  img.onload = function () { done({ name: def.name, img: img, uploaded: !!def.uploaded }); };
  img.onerror = function () { done({ name: def.name, img: null, uploaded: !!def.uploaded }); };
  img.src = def.file;
}

function loadSamples(next) {
  var left = SAMPLES.length;
  SAMPLES.forEach(function (s) {
    loadPhoto(s, function (p) {
      photos.push(p);
      if (--left === 0) { photos.sort(function (a, b) { return a.name < b.name ? -1 : 1; }); next(); }
    });
  });
}

function addUploads(files) {
  var list = Array.prototype.slice.call(files).filter(function (f) { return f.type.indexOf('image/') === 0; });
  if (!list.length) return;
  if (uploads + list.length > 4) {
    $('export-status').textContent = 'Only 4 uploads at a time — the first ' + (4 - uploads) + ' were added.';
    list = list.slice(0, 4 - uploads);
  }
  if (!list.length) return;
  list.forEach(function (file) {
    var reader = new FileReader();
    reader.onload = function () {
      loadPhoto({ name: file.name.replace(/\.[^.]+$/, ''), file: reader.result, uploaded: true }, function (p) {
        photos.push(p);
        uploads++;
        syncPhotoStrip();
        syncPhotoSelect();
        renderPreview();
      });
    };
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------ editor wiring */

function panelPhotoIndex(i) {
  return state.fillOne ? state.panels[0].photo : state.panels[i].photo;
}

function syncPhotoStrip() {
  var strip = $('photo-strip');
  strip.innerHTML = '';
  photos.forEach(function (p, i) {
    var t = document.createElement('img');
    t.className = 'thumb' + (panelPhotoIndex(state.selected) === i ? ' active' : '') + (p.uploaded ? ' uploaded' : '');
    t.src = p.img ? p.img.src : '';
    t.alt = p.name;
    t.title = p.name;
    t.addEventListener('click', function () {
      pushHistory();
      state.panels[state.selected].photo = i;
      if (state.fillOne) state.panels[0].photo = i;
      syncPhotoStrip();
      syncPhotoSelect();
      renderPreview();
    });
    strip.appendChild(t);
  });
}

function syncPhotoSelect() {
  var sel = $('sel-photo');
  sel.innerHTML = '';
  photos.forEach(function (p, i) {
    var o = document.createElement('option');
    o.value = String(i);
    o.textContent = p.name;
    sel.appendChild(o);
  });
  sel.value = String(panelPhotoIndex(state.selected));
}

function syncInspector() {
  var p = state.panels[state.selected];
  $('inspector-title').textContent = 'Panel ' + (state.selected + 1) + ' of ' + panelCount();
  $('in-zoom').value = String(p.zoom);
  $('in-ox').value = String(p.ox);
  $('in-oy').value = String(p.oy);
  syncPhotoSelect();
  syncPhotoStrip();
}

function syncLayoutPick() {
  var box = $('layout-pick');
  box.innerHTML = '';
  Object.keys(LAYOUTS).forEach(function (id) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (state.layout === id ? ' active' : '');
    b.innerHTML = '<span></span><small></small>';
    b.querySelector('span').textContent = LAYOUTS[id].label;
    b.querySelector('small').textContent = LAYOUTS[id].note;
    b.addEventListener('click', function () {
      if (state.layout === id) return;
      pushHistory();
      state.layout = id;
      state.selected = 0;
      syncLayoutPick();
      syncInspector();
      renderPreview();
    });
    box.appendChild(b);
  });
}

function syncGradePick() {
  var box = $('grade-pick');
  box.innerHTML = '';
  Object.keys(GRADES).forEach(function (id) {
    var gr = GRADES[id];
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (state.grade === id ? ' active' : '');
    var sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = 'linear-gradient(90deg,' + gr.title.join(',') + ')';
    b.appendChild(sw);
    var lbl = document.createElement('span');
    lbl.textContent = gr.label;
    b.appendChild(lbl);
    b.addEventListener('click', function () {
      if (state.grade === id) return;
      pushHistory();
      state.grade = id;
      syncGradePick();
      renderPreview();
    });
    box.appendChild(b);
  });
}

function syncSizePick() {
  var box = $('size-pick');
  box.innerHTML = '';
  SIZES.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (state.sizeId === s.id ? ' active' : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', state.sizeId === s.id ? 'true' : 'false');
    b.innerHTML = '<span></span><small></small>';
    b.querySelector('span').textContent = s.label;
    b.querySelector('small').textContent = s.note;
    b.addEventListener('click', function () { setPreviewSize(s.id); });
    box.appendChild(b);
  });
}

function syncAllControls() {
  $('in-title').value = state.title;
  $('in-subtitle').value = state.subtitle;
  $('in-badge').value = state.badge;
  $('in-stars').value = String(state.stars);
  $('out-stars').textContent = starText();
  $('opt-grain').checked = state.grain;
  $('opt-vignette').checked = state.vignette;
  $('opt-halftone').checked = state.halftone;
  $('opt-fill-one').checked = state.fillOne;
  syncLayoutPick();
  syncGradePick();
  syncSizePick();
  syncInspector();
}

function starText() {
  var s = '';
  for (var i = 0; i < 5; i++) s += i < state.stars ? '★' : '☆';
  return s;
}

function selectPanelAt(clientX, clientY) {
  var rect = stage.getBoundingClientRect();
  var x = (clientX - rect.left) * (stage.width / rect.width);
  var y = (clientY - rect.top) * (stage.height / rect.height);
  var geo = layoutGeometry(state.layout, stage.width, stage.height);
  for (var i = geo.panels.length - 1; i >= 0; i--) {
    var r = geo.panels[i];
    var dx = x - (r.x + r.w / 2);
    var dy = y - (r.y + r.h / 2);
    var rot = -(r.rot || 0);
    var lx = dx * Math.cos(rot) - dy * Math.sin(rot);
    var ly = dx * Math.sin(rot) + dy * Math.cos(rot);
    if (Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2) return { index: i, x: x, y: y, rect: r };
  }
  return null;
}

function wireStage() {
  var dragging = null;
  stage.addEventListener('pointerdown', function (ev) {
    var hit = selectPanelAt(ev.clientX, ev.clientY);
    if (!hit) return;
    pushHistory();
    state.selected = hit.index;
    dragging = { x: hit.x, y: hit.y, rect: hit.rect, panel: state.panels[hit.index] };
    stage.setPointerCapture(ev.pointerId);
    syncInspector();
    renderPreview();
  });
  stage.addEventListener('pointermove', function (ev) {
    if (!dragging) return;
    var rect = stage.getBoundingClientRect();
    var x = (ev.clientX - rect.left) * (stage.width / rect.width);
    var y = (ev.clientY - rect.top) * (stage.height / rect.height);
    var p = dragging.panel;
    p.ox = clamp(p.ox + (x - dragging.x) / dragging.rect.w, -0.5, 0.5);
    p.oy = clamp(p.oy + (y - dragging.y) / dragging.rect.h, -0.5, 0.5);
    dragging.x = x;
    dragging.y = y;
    $('in-ox').value = String(p.ox);
    $('in-oy').value = String(p.oy);
    renderPreview();
  });
  stage.addEventListener('pointerup', function () { dragging = null; });
  stage.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var p = state.panels[state.selected];
    pushHistory();
    p.zoom = clamp(p.zoom * (ev.deltaY < 0 ? 1.08 : 0.93), 1, 3);
    $('in-zoom').value = String(p.zoom);
    renderPreview();
  }, { passive: false });
  stage.addEventListener('dragover', function (ev) { ev.preventDefault(); });
  stage.addEventListener('drop', function (ev) {
    ev.preventDefault();
    var hit = selectPanelAt(ev.clientX, ev.clientY);
    if (hit) state.selected = hit.index;
    if (ev.dataTransfer && ev.dataTransfer.files.length) addUploads(ev.dataTransfer.files);
  });
}

function wireControls() {
  $('file-input').addEventListener('change', function (ev) {
    addUploads(ev.target.files);
    ev.target.value = '';
  });
  $('opt-fill-one').addEventListener('change', function (ev) {
    pushHistory();
    state.fillOne = ev.target.checked;
    renderPreview();
  });
  $('in-title').addEventListener('input', function (ev) { state.title = ev.target.value; renderPreview(); });
  $('in-title').addEventListener('change', function () { pushHistory(); });
  $('in-subtitle').addEventListener('input', function (ev) { state.subtitle = ev.target.value; renderPreview(); });
  $('in-subtitle').addEventListener('change', function () { pushHistory(); });
  $('in-badge').addEventListener('input', function (ev) { state.badge = ev.target.value; renderPreview(); });
  $('in-badge').addEventListener('change', function () { pushHistory(); });
  $('in-stars').addEventListener('input', function (ev) {
    state.stars = parseInt(ev.target.value, 10);
    $('out-stars').textContent = starText();
    renderPreview();
  });
  $('in-stars').addEventListener('change', function () { pushHistory(); });
  [['opt-grain', 'grain'], ['opt-vignette', 'vignette'], ['opt-halftone', 'halftone']].forEach(function (pair) {
    $(pair[0]).addEventListener('change', function (ev) {
      pushHistory();
      state[pair[1]] = ev.target.checked;
      renderPreview();
    });
  });
  $('sel-photo').addEventListener('change', function (ev) {
    pushHistory();
    state.panels[state.selected].photo = parseInt(ev.target.value, 10);
    if (state.fillOne) state.panels[0].photo = parseInt(ev.target.value, 10);
    syncPhotoStrip();
    renderPreview();
  });
  $('in-zoom').addEventListener('input', function (ev) {
    state.panels[state.selected].zoom = parseFloat(ev.target.value);
    renderPreview();
  });
  $('in-zoom').addEventListener('change', function () { pushHistory(); });
  $('in-ox').addEventListener('input', function (ev) {
    state.panels[state.selected].ox = parseFloat(ev.target.value);
    renderPreview();
  });
  $('in-ox').addEventListener('change', function () { pushHistory(); });
  $('in-oy').addEventListener('input', function (ev) {
    state.panels[state.selected].oy = parseFloat(ev.target.value);
    renderPreview();
  });
  $('in-oy').addEventListener('change', function () { pushHistory(); });
  $('btn-shuffle').addEventListener('click', function () {
    pushHistory();
    var order = photos.map(function (_, i) { return i; });
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = order[i]; order[i] = order[j]; order[j] = t;
    }
    for (var k = 0; k < state.panels.length; k++) state.panels[k].photo = order[k % order.length];
    syncPhotoStrip();
    syncPhotoSelect();
    renderPreview();
  });
  $('btn-magic').addEventListener('click', function () {
    pushHistory();
    var layouts = Object.keys(LAYOUTS);
    var grades = Object.keys(GRADES);
    state.layout = layouts[Math.floor(Math.random() * layouts.length)];
    state.grade = grades[Math.floor(Math.random() * grades.length)];
    state.selected = 0;
    var order = photos.map(function (_, i) { return i; });
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = order[i]; order[i] = order[j]; order[j] = t;
    }
    for (var k = 0; k < state.panels.length; k++) {
      state.panels[k].photo = order[k % order.length];
      state.panels[k].zoom = 1 + Math.random() * 0.35;
      state.panels[k].ox = (Math.random() - 0.5) * 0.2;
      state.panels[k].oy = (Math.random() - 0.5) * 0.2;
    }
    state.stars = 4 + Math.floor(Math.random() * 2);
    syncAllControls();
    renderPreview();
    $('export-status').textContent = 'Made your cover: ' + LAYOUTS[state.layout].label + ' · ' + GRADES[state.grade].label + '.';
  });
  $('btn-undo').addEventListener('click', doUndo);
  $('btn-redo').addEventListener('click', doRedo);
  $('btn-export').addEventListener('click', function () { exportCover(currentSize()); });
  $('btn-export-all').addEventListener('click', exportAll);
}

/* -------------------------------------------------------------- shot mode */

/* ?shot=cover renders the cover full-frame for a screenshot; ?shot=editor
   opens the editor pre-set. Params: photo, caption, subtitle, layout, grade,
   size=WxH, multi=1|0. */
function applyShotParams() {
  var q = new URLSearchParams(window.location.search);
  var shot = q.get('shot');
  if (!shot) return null;
  var photo = q.get('photo');
  if (photo) {
    var idx = -1;
    for (var i = 0; i < SAMPLES.length; i++) {
      if (SAMPLES[i].file.indexOf(photo) !== -1) idx = i;
    }
    if (idx >= 0) {
      state.panels[0].photo = idx;
      state.panels[1].photo = (idx + 1) % 3;
      state.panels[2].photo = (idx + 2) % 3;
    }
  }
  if (q.get('caption')) state.title = q.get('caption');
  if (q.get('subtitle')) state.subtitle = q.get('subtitle');
  if (q.get('layout') && LAYOUTS[q.get('layout')]) state.layout = q.get('layout');
  if (q.get('grade') && GRADES[q.get('grade')]) state.grade = q.get('grade');
  var size = q.get('size');
  if (size) {
    var parts = size.split('x');
    var w = parseInt(parts[0], 10);
    var h = parseInt(parts[1], 10);
    for (var s = 0; s < SIZES.length; s++) {
      if (SIZES[s].w === w && SIZES[s].h === h) state.sizeId = SIZES[s].id;
    }
    previewSize = { w: w || 1920, h: h || 1080 };
  }
  if (q.get('multi') === '0') state.fillOne = true;
  if (q.get('multi') === '1') state.fillOne = false;
  return shot;
}

/* -------------------------------------------------------------------- boot */

function boot() {
  stage = $('stage');
  shotMode = applyShotParams();
  wireStage();
  wireControls();
  syncAllControls();
  syncUndoButtons();
  loadSamples(function () {
    syncPhotoStrip();
    syncPhotoSelect();
    renderPreview();
  });
  var renderFonts = function () {
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load("100px 'Anton'"),
        document.fonts.load("40px 'Pacifico'")
      ]).then(function () { renderPreview(); }).catch(function () {});
    }
  };
  renderFonts();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { renderPreview(); });
  renderPreview();

  if (shotMode === 'cover') {
    document.body.classList.add('shot-cover');
    /* full-frame cover at the viewport size (same aspect as the export size) */
    window.addEventListener('resize', renderShotCover);
    /* draw again once fonts + samples arrive */
    setTimeout(renderShotCover, 300);
    setTimeout(renderShotCover, 1000);
    renderShotCover();
  }
}

document.addEventListener('DOMContentLoaded', boot);
