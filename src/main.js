import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEFAULTS } from './defaults.js';
import { TEMPLATE } from './template.js';
import { FONTS, loadFont, addCustomFont } from './fonts.js';
import { PATTERNS, LAYOUTS, parseSvgPattern } from './patterns.js';
import { buildTag, bedFit } from './geometry.js';
import { extrude } from './mesh.js';
import { bambu3mf, stl, stlZip } from './export.js';

const $ = (sel) => document.querySelector(sel);
const form = $('#controls');

// ---------- state ----------

const SHARE_KEYS = Object.keys(DEFAULTS);

function readHash() {
  try {
    const raw = location.hash.slice(1);
    if (!raw) return {};
    const data = JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g, '+').replace(/_/g, '/')))));
    return Object.fromEntries(Object.entries(data).filter(([k]) => SHARE_KEYS.includes(k)));
  } catch {
    return {};
  }
}

function shareUrl() {
  const diff = {};
  for (const k of SHARE_KEYS) {
    if (JSON.stringify(state[k]) !== JSON.stringify(DEFAULTS[k])) diff[k] = state[k];
  }
  // Uploaded fonts and shapes live only in this browser.
  if (state.nameFont.startsWith('custom:')) delete diff.nameFont;
  if (state.scriptFont.startsWith('custom:')) delete diff.scriptFont;
  if (state.pattern === 'custom') delete diff.pattern;
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify(diff))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${location.origin}${location.pathname}${Object.keys(diff).length ? '#' + enc : ''}`;
}

let state = { ...structuredClone(DEFAULTS), ...readHash() };
let customPattern = null;

// ---------- form wiring ----------

const PERCENT = ['nameScale', 'letterFill', 'scriptScale', 'patternScale', 'slotScale', 'bounce'];
const DEGREES = ['tilt', 'patternRotation'];
function formatValue(name, v) {
  if (PERCENT.includes(name)) return `${Math.round(v * 100)}%`;
  if (DEGREES.includes(name)) return `${v}°`;
  if (name === 'letterBold' || name === 'scriptBold') return `${v > 0 ? '+' : ''}${(+v).toFixed(2)} mm`;
  if (name === 'width') return `${(+v).toFixed(1)} mm`;
  return `${(+v).toFixed(2)} mm`;
}

function fillFontSelects() {
  for (const sel of form.querySelectorAll('select[data-fonts]')) {
    const groups = {};
    for (const f of FONTS) (groups[f.group] ||= []).push(f);
    sel.innerHTML = Object.entries(groups)
      .map(([g, list]) =>
        `<optgroup label="${g}">${list.map((f) => `<option value="${f.id}">${f.name}</option>`).join('')}</optgroup>`)
      .join('');
    sel.value = state[sel.name];
  }
}

function patternIcon(polys) {
  const d = polys
    .map((p) => 'M' + p.map(([x, y]) => `${(x * 14 + 16).toFixed(2)} ${(16 - y * 14).toFixed(2)}`).join('L') + 'Z')
    .join('');
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="${d}"/></svg>`;
}

function fillPatternPicker() {
  const entries = Object.entries(PATTERNS).map(([id, p]) => [id, p.name, p.polys()]);
  if (customPattern) entries.push(['custom', 'Your SVG', customPattern]);
  $('#patternPicker').innerHTML = entries
    .map(([id, name, polys]) => {
      const icon = polys.length
        ? patternIcon(polys)
        : '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 6 26 26M26 6 6 26" stroke="currentColor" stroke-width="2.5" fill="none"/></svg>';
      const label = name.replace(' (original)', '');
      return `<button type="button" role="radio" data-pattern="${id}" aria-checked="${state.pattern === id}" title="${name}">${icon}<span>${label}</span></button>`;
    })
    .join('');
}

const PARTS = [
  ['slotBase', 'Base'],
  ['slotTileA', 'Tiles 1, 3, 5…'],
  ['slotTileB', 'Tiles 2, 4, 6…'],
  ['slotLetters', 'Name letters'],
  ['slotScript', 'Script text'],
];
const PART_KEYS = PARTS.map(([key]) => key);

function fillColors() {
  $('#swatches').innerHTML = state.colors
    .map((c, i) => `<label class="swatch"><input type="color" data-color="${i}" value="${c}" />Filament ${i + 1}</label>`)
    .join('');
  const opts = state.colors.map((_, i) => `<option value="${i + 1}">Filament ${i + 1}</option>`).join('');
  $('#assign').innerHTML = PARTS.map(
    ([key, label]) => `<span data-part="${key}">${label}</span><select name="${key}">${opts}</select>`,
  ).join('');
  for (const [key] of PARTS) form.elements[key].value = state[key];
  refreshAssignLabels();
}

function refreshAssignLabels() {
  const tiled = state.tileStyle === 'alternating' || state.tileStyle === 'uniform';
  const sticker = state.tileStyle === 'sticker';
  const labels = {
    slotTileA: sticker ? 'Letter outline' : 'Tiles 1, 3, 5…',
    slotTileB: 'Tiles 2, 4, 6…',
  };
  for (const [key, label] of PARTS) {
    const span = form.querySelector(`[data-part="${key}"]`);
    const hide = (key === 'slotTileA' && !tiled && !sticker) || (key === 'slotTileB' && !tiled);
    span.textContent = labels[key] || label;
    span.classList.toggle('hidden', hide);
    form.elements[key].classList.toggle('hidden', hide);
    const c = state.colors[state[key] - 1];
    span.style.cssText = `border-left: 14px solid ${c}; padding-left: 8px;`;
  }
}

function syncForm() {
  for (const el of form.elements) {
    if (!el.name || !(el.name in state)) continue;
    if (el.type === 'checkbox') el.checked = !!state[el.name];
    else el.value = state[el.name];
  }
  for (const out of form.querySelectorAll('output[data-for]')) {
    out.textContent = formatValue(out.dataset.for, state[out.dataset.for]);
  }
  const tiled = state.tileStyle === 'alternating' || state.tileStyle === 'uniform';
  form.querySelectorAll('[data-show="tiles"]').forEach((el) => el.classList.toggle('hidden', !tiled));
  form.querySelectorAll('[data-show="sticker"]').forEach((el) => el.classList.toggle('hidden', state.tileStyle !== 'sticker'));
  form.querySelectorAll('[data-show="slots"]').forEach((el) => el.classList.toggle('hidden', !state.slots));
  form.elements.letterFill.closest('.field').querySelector('span').firstChild.textContent =
    tiled ? 'Letter size in tile ' : 'Letter size ';
  $('#patternPicker').querySelectorAll('button').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.pattern === state.pattern)));
}

form.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.color !== undefined) {
    state.colors[+el.dataset.color] = el.value;
    refreshAssignLabels();
    recolor();
    return;
  }
  if (!el.name || !(el.name in state)) return;
  const isPart = PART_KEYS.includes(el.name);
  const numeric = el.type === 'range' || isPart || el.name === 'bed';
  state[el.name] = el.type === 'checkbox' ? el.checked : numeric ? +el.value : el.value;
  syncForm();
  if (isPart) {
    refreshAssignLabels();
    recolor();
    return;
  }
  if (el.name === 'tileStyle') {
    // Without tiles the letters sit straight on the base, so they need their own colour.
    if (state.tileStyle === 'none' && state.slotLetters === state.slotBase) {
      state.slotLetters = state.slotTileA !== state.slotBase ? state.slotTileA : (state.slotBase % 4) + 1;
      form.elements.slotLetters.value = state.slotLetters;
    }
    refreshAssignLabels();
  }
  schedule();
});
form.addEventListener('submit', (e) => e.preventDefault());

$('#patternPicker').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-pattern]');
  if (!b) return;
  state.pattern = b.dataset.pattern;
  syncForm();
  schedule();
});

$('#svgUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    customPattern = parseSvgPattern(await file.text());
    state.pattern = 'custom';
    fillPatternPicker();
    syncForm();
    schedule();
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

form.querySelectorAll('[data-font-upload]').forEach((input) =>
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const id = await addCustomFont(file);
      state[input.dataset.fontUpload] = id;
      fillFontSelects();
      schedule();
    } catch {
      setStatus(`Couldn't read ${file.name}. Try a .ttf, .otf or .woff file.`, 'error');
    }
  }),
);

$('#reset').addEventListener('click', () => {
  state = structuredClone(DEFAULTS);
  history.replaceState(null, '', location.pathname);
  fillFontSelects();
  fillColors();
  syncForm();
  schedule(true);
});

$('#share').addEventListener('click', async () => {
  const url = shareUrl();
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    setStatus('Link copied. Anyone who opens it gets these settings.');
  } catch {
    setStatus('Link is in the address bar. Copy it from there.');
  }
  setTimeout(() => setStatus(currentWarnings), 3500);
});

// ---------- 3D preview ----------

const viewer = $('#viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;

scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f80, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(-200, -300, 500);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.5);
fill.position.set(300, 200, 200);
scene.add(fill);

const bedGroup = new THREE.Group();
scene.add(bedGroup);
const tagGroup = new THREE.Group();
scene.add(tagGroup);

function drawBed(size, deg) {
  bedGroup.clear();
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ color: dark ? 0x22242f : 0xe7ddcd }),
  );
  plate.position.z = -0.05;
  bedGroup.add(plate);
  const grid = new THREE.GridHelper(size, size / 16, dark ? 0x353849 : 0xd6cab6, dark ? 0x2b2e3b : 0xddd2c0);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -0.02;
  bedGroup.add(grid);
  bedGroup.rotation.z = (-deg * Math.PI) / 180;
}

function resize() {
  const { clientWidth: w, clientHeight: h } = viewer;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewer);

let view = 'angle';
function frame(margin = 1.18) {
  const w = state.width;
  const fov = (camera.fov * Math.PI) / 180;
  const fitW = w / 2 / Math.tan(fov / 2) / Math.max(camera.aspect, 0.3);
  const dist = Math.max(fitW, (w * 0.42) / 2 / Math.tan(fov / 2)) * margin;
  if (view === 'top') camera.position.set(0, -0.001, dist);
  else camera.position.set(0, -dist * 0.62, dist * 0.8);
  controls.target.set(0, 0, 0);
  controls.update();
}

document.querySelectorAll('[data-view]').forEach((b) =>
  b.addEventListener('click', () => {
    view = b.dataset.view;
    document.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('active', x === b));
    frame();
  }),
);

const materials = new Map();
function materialFor(slot) {
  if (!materials.has(slot)) {
    materials.set(slot, new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 }));
  }
  const m = materials.get(slot);
  m.color.set(state.colors[slot - 1]);
  return m;
}

function recolor() {
  for (const mesh of tagGroup.children) {
    if (mesh.userData.part) mesh.material = materialFor(state[slotKey(mesh.userData.part)]);
  }
}

const slotKey = (id) =>
  ({ base: 'slotBase', tilesA: 'slotTileA', tilesB: 'slotTileB', letters: 'slotLetters', script: 'slotScript' })[id];

(function loop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
})();

// ---------- building ----------

let result = null;
let meshes = null;
let currentWarnings = '';
let timer = 0;
let buildId = 0;
let lastWidth = 0;

function setStatus(msg, kind = '') {
  const el = $('#status');
  el.textContent = Array.isArray(msg) ? msg.join(' ') : msg || '';
  el.className = `status ${kind}`;
}

function schedule(reframe = false) {
  clearTimeout(timer);
  timer = setTimeout(() => rebuild(reframe), 120);
}

async function rebuild(reframe) {
  const id = ++buildId;
  let fonts;
  try {
    const slow = setTimeout(() => setStatus('Loading font…'), 250);
    const [name, script] = await Promise.all([loadFont(state.nameFont), loadFont(state.scriptFont)]);
    clearTimeout(slow);
    fonts = { name, top: script, bottom: script };
  } catch (err) {
    setStatus(err.message, 'error');
    return;
  }
  if (id !== buildId) return;

  const opts = { ...state, customPattern };
  try {
    result = buildTag(opts, fonts);
  } catch (err) {
    console.error(err);
    setStatus('Something went wrong building the tag. Try different settings.', 'error');
    return;
  }

  meshes = result.bodies.map((b) => ({ id: b.id, name: b.label, slot: b.slot, ...extrude(b.polys, b.z0, b.z1) }));
  tagGroup.traverse((o) => o.geometry?.dispose());
  tagGroup.clear();
  for (const m of meshes) {
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    g = g.toNonIndexed();
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, materialFor(m.slot));
    mesh.userData.part = m.id;
    tagGroup.add(mesh);
  }

  const k = state.width / TEMPLATE.width;
  const fit = bedFit(TEMPLATE.outline.map(([x, y]) => [x * k, y * k]), state.bed);
  result.fit = fit;
  drawBed(state.bed, fit.deg);

  const total = state.baseThickness + Math.max(
    state.tileStyle === 'none' ? state.letterThickness : state.tileThickness + state.letterThickness,
    state.scriptThickness,
  );
  $('#dims').innerHTML =
    `<strong>${result.width.toFixed(1)} × ${result.height.toFixed(1)} mm</strong>, ${total.toFixed(1)} mm thick · ` +
    `${new Set(meshes.map((m) => m.slot)).size} colours`;
  $('#sizeReadout').textContent = `Height follows automatically: ${result.height.toFixed(1)} mm.`;
  $('#bedReadout').textContent = !fit.fits
    ? `Too big for a ${state.bed} mm bed even at an angle. Reduce the width to about ${Math.floor((state.width * state.bed) / fit.worst)} mm.`
    : fit.deg
      ? `Fits when turned ${fit.deg}° on the bed. The 3MF is already placed that way.`
      : `Fits the bed straight.`;

  const warnings = [...result.warnings];
  if (!fit.fits) warnings.push(`Too big for a ${state.bed} mm bed.`);
  currentWarnings = warnings;
  setStatus(warnings, warnings.length ? 'warn' : '');

  if (reframe || Math.abs(lastWidth - state.width) > 20 || !lastWidth) {
    lastWidth = state.width;
    frame();
  }
}

// ---------- downloads ----------

function fileBase() {
  const n = state.name.trim() || 'Family';
  return `${n} Stroller Tag`.replace(/[\\/:*?"<>|]/g, '');
}

function save(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function thumbnail() {
  // Render once at a fixed angle and copy into a square PNG for the slicer.
  const saved = camera.position.clone();
  const savedTarget = controls.target.clone();
  const prevView = view;
  view = 'angle';
  bedGroup.visible = false;
  frame(0.8);
  renderer.render(scene, camera);
  const src = renderer.domElement;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const s = Math.min(512 / src.width, 512 / src.height);
  const w = src.width * s, h = src.height * s;
  ctx.drawImage(src, (512 - w) / 2, (512 - h) / 2, w, h);
  view = prevView;
  bedGroup.visible = true;
  camera.position.copy(saved);
  controls.target.copy(savedTarget);
  controls.update();
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

async function withButton(btn, fn) {
  if (!meshes) return;
  btn.disabled = true;
  try {
    await fn();
  } catch (err) {
    console.error(err);
    setStatus('Download failed. Please try again.', 'error');
  } finally {
    btn.disabled = false;
  }
}

$('#dl3mf').addEventListener('click', (e) =>
  withButton(e.currentTarget, async () => {
    const blob = await bambu3mf(meshes, {
      title: fileBase(),
      colors: state.colors,
      bed: state.bed,
      rotation: result.fit.deg,
      thumbnail: await thumbnail(),
    });
    save(blob, `${fileBase()}.3mf`);
  }),
);
$('#dlZip').addEventListener('click', (e) =>
  withButton(e.currentTarget, async () => save(await stlZip(meshes, state.colors, fileBase()), `${fileBase()} (STL by colour).zip`)),
);
$('#dlStl').addEventListener('click', (e) =>
  withButton(e.currentTarget, async () => save(stl(meshes), `${fileBase()}.stl`)),
);

// ---------- start ----------

form.elements.layout.innerHTML = Object.entries(LAYOUTS)
  .map(([id, l]) => `<option value="${id}">${l.name}</option>`)
  .join('');
fillFontSelects();
fillPatternPicker();
fillColors();
syncForm();
resize();
rebuild(true);
