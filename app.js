// --- Service worker registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
}

// --- Tabs ---
const tabs = document.querySelectorAll('.tabs button');
const sections = document.querySelectorAll('.tab');
tabs.forEach(btn => btn.addEventListener('click', () => {
  tabs.forEach(b => b.classList.remove('active'));
  sections.forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(btn.dataset.tab).classList.add('active');
}));

// --- Elements ---
const fileInput = document.getElementById('fileInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const exportPNG = document.getElementById('exportPNG');
const storyBtn = document.getElementById('storyBtn');
const copyHex = document.getElementById('copyHex');
const smartSort = document.getElementById('smartSort');
const namesBtn = document.getElementById('namesBtn');
const imgCanvas = document.getElementById('imgCanvas');
const swatchesEl = document.getElementById('swatches');
const hexList = document.getElementById('hexList');
const namesBox = document.getElementById('namesBox');
const moodBox = document.getElementById('moodBox');

const baseColor = document.getElementById('baseColor');
const genHarmony = document.getElementById('genHarmony');
const gradientsBtn = document.getElementById('gradientsBtn');
const wallpaperBtn = document.getElementById('wallpaperBtn');
const genOutput = document.getElementById('genOutput');
const renderCanvas = document.getElementById('renderCanvas');

const mixA = document.getElementById('mixA');
const mixB = document.getElementById('mixB');
const mixBtn = document.getElementById('mixBtn');
const mixOutput = document.getElementById('mixOutput');

const buildTheme = document.getElementById('buildTheme');
const exportCSS = document.getElementById('exportCSS');
const exportJSON = document.getElementById('exportJSON');
const themePreview = document.getElementById('themePreview');

const soundSwatches = document.getElementById('soundSwatches');

const matchBtn = document.getElementById('matchBtn');
const matchTable = document.getElementById('matchTable');

let palette = [];
let imageBitmap = null;

// --- Pyodide setup ---
let pyodideReady = (async () => {
  self.pyodide = await loadPyodide();
  await self.pyodide.loadPackage([]);
  await self.pyodide.FS.mkdir('/app');
  // Load color_engine.py
  const code = await fetch('py/color_engine.py').then(r => r.text());
  self.pyodide.FS.writeFile('/app/color_engine.py', code);
  await self.pyodide.runPythonAsync('import sys; sys.path.append("/app"); import color_engine');
  console.log('Pyodide ready');
})();

function rgbToHex([r,g,b]) {
  return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
}

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const imgURL = URL.createObjectURL(file);
  const img = await createImageBitmap(await (await fetch(imgURL)).blob());
  const { w, h } = fitSize(img.width, img.height, 720);
  imgCanvas.width = w; imgCanvas.height = h;
  imgCanvas.getContext('2d', { willReadFrequently:true }).drawImage(img, 0, 0, w, h);
  imageBitmap = img;
  analyzeBtn.disabled = false;
  exportPNG.disabled = true;
  storyBtn.disabled = true;
});

analyzeBtn.addEventListener('click', async () => {
  if (!imageBitmap) return;
  await pyodideReady;
  const ctx = imgCanvas.getContext('2d', { willReadFrequently:true });
  const data = ctx.getImageData(0, 0, imgCanvas.width, imgCanvas.height).data;
  const arr = Array.from(data);
  const result = await self.pyodide.runPythonAsync(`
import json, color_engine
palette = color_engine.extract_palette(${imgCanvas.width}, ${imgCanvas.height}, ${5}, ${8}, ${arr})
json.dumps(palette)
`);
  palette = JSON.parse(result);
  renderPalette(palette);
  exportPNG.disabled = false;
  storyBtn.disabled = false;
  soundSwatches.innerHTML = '';
  palette.forEach(rgb => soundSwatches.appendChild(colorSwatch(rgb)));
  const meta = await self.pyodide.runPythonAsync(`
import json, color_engine
json.dumps(color_engine.palette_meta(${palette}))
`);
  const metaObj = JSON.parse(meta);
  namesBox.textContent = 'Nomi: ' + metaObj.names.join(', ');
  moodBox.textContent = 'Mood: ' + metaObj.mood;
  localStorage.setItem('pp:last', JSON.stringify(palette));
});

copyHex.addEventListener('click', async () => {
  const text = hexList.value.trim();
  if (!text) return;
  try { await navigator.clipboard.writeText(text); copyHex.textContent='Copiato ✔'; setTimeout(()=>copyHex.textContent='Copia HEX',1200); }
  catch { alert('Seleziona e copia manualmente'); }
});

smartSort.addEventListener('click', async () => {
  if (!palette.length) return;
  await pyodideReady;
  const sorted = await self.pyodide.runPythonAsync(`
import json, color_engine
json.dumps(color_engine.smart_sort(${palette}))
`);
  palette = JSON.parse(sorted);
  renderPalette(palette);
});

namesBtn.addEventListener('click', async () => {
  if (!palette.length) return;
  await pyodideReady;
  const names = await self.pyodide.runPythonAsync(`
import json, color_engine
json.dumps(color_engine.color_names(${palette}))
`);
  const arr = JSON.parse(names);
  namesBox.textContent = 'Nomi: ' + arr.join(', ');
});

exportPNG.addEventListener('click', () => {
  if (!palette.length) return;
  const png = palettePNG(palette, 1500, 360);
  const a = document.createElement('a'); a.href=png; a.download='palette.png'; a.click();
});

storyBtn.addEventListener('click', async () => {
  if (!palette.length) return;
  await pyodideReady;
  const meta = await self.pyodide.runPythonAsync(`
import json, color_engine
json.dumps(color_engine.story_meta(${palette}))
`);
  const m = JSON.parse(meta);
  const poster = storyPoster(palette, m.title, m.mood, m.names);
  const a = document.createElement('a'); a.href = poster; a.download='palette_story.png'; a.click();
});

// Generator
genHarmony.addEventListener('click', async () => {
  await pyodideReady;
  const pal = await self.pyodide.runPythonAsync(`
import json, color_engine
json.dumps(color_engine.harmony_from_hex("${baseColor.value}", 5))
`);
  const cols = JSON.parse(pal);
  genOutput.innerHTML = ''; cols.forEach(rgb => genOutput.appendChild(colorSwatch(rgb)));
});

gradientsBtn.addEventListener('click', () => {
  if (!palette.length) return;
  renderCanvas.width = 1600; renderCanvas.height = 400;
  drawGradient(renderCanvas, palette);
  downloadCanvas(renderCanvas, 'gradient.png');
});

wallpaperBtn.addEventListener('click', () => {
  if (!palette.length) return;
  renderCanvas.width = 1440; renderCanvas.height = 3120;
  drawWallpaper(renderCanvas, palette);
  downloadCanvas(renderCanvas, 'wallpaper.png');
});

// Mixer
mixBtn.addEventListener('click', async () => {
  await pyodideReady;
  const res = await self.pyodide.runPythonAsync(`
import json, color_engine
json.dumps(color_engine.mix_hex("${mixA.value}", "${mixB.value}", 5))
`);
  const arr = JSON.parse(res);
  mixOutput.innerHTML=''; arr.forEach(rgb => mixOutput.appendChild(colorSwatch(rgb)));
});

// Theme
buildTheme.addEventListener('click', async () => {
  if (!palette.length) return;
  await pyodideReady;
  const theme = await self.pyodide.runPythonAsync(`
import json, color_engine
json.dumps(color_engine.build_theme(${palette}))
`);
  const t = JSON.parse(theme);
  applyThemePreview(t);
});
exportCSS.addEventListener('click', async () => {
  await pyodideReady;
  const theme = await self.pyodide.runPythonAsync(`
import json, color_engine
json.dumps(color_engine.build_theme(${palette}))
`);
  const t = JSON.parse(theme);
  const css = themeToCSS(t);
  downloadText(css, 'theme.css');
});
exportJSON.addEventListener('click', async () => {
  await pyodideReady;
  const theme = await self.pyodide.runPythonAsync(`
import json, color_engine
json.dumps(color_engine.build_theme(${palette}))
`);
  const t = JSON.parse(theme);
  downloadText(JSON.stringify(t, null, 2), 'theme.json');
});

// Match brands
matchBtn.addEventListener('click', async () => {
  if (!palette.length) return;
  await pyodideReady;
  const res = await self.pyodide.runPythonAsync(`
import json, color_engine
json.dumps(color_engine.brand_matches(${palette}))
`);
  const arr = JSON.parse(res);
  const table = document.createElement('table');
  table.innerHTML = '<tr><th>Colore</th><th>Brand vicino</th><th>HEX Brand</th></tr>';
  arr.forEach(row => {
    const tr = document.createElement('tr');
    const hc = rgbToHex(row.input);
    tr.innerHTML = `<td>${hc}</td><td>${row.brand}</td><td>${row.hex}</td>`;
    table.appendChild(tr);
  });
  matchTable.innerHTML = ''; matchTable.appendChild(table);
});

// Sound tab
soundSwatches.addEventListener('click', (e) => {
  const sw = e.target.closest('.swatch');
  if (!sw) return;
  const hex = sw.dataset.hex;
  playToneFromHex(hex, 0.3);
});

// --- Helpers ---
function fitSize(w,h,max){ if(Math.max(w,h)<=max) return {w,h}; if(w>=h) return {w:max,h:Math.round(h*(max/w))}; return {w:Math.round(w*(max/h)),h:max}; }
function renderPalette(cols){
  swatchesEl.innerHTML='';
  const hexes = cols.map(rgbToHex);
  hexList.value = hexes.join('\n');
  cols.forEach(rgb => swatchesEl.appendChild(colorSwatch(rgb)));
  soundSwatches.innerHTML=''; cols.forEach(rgb => soundSwatches.appendChild(colorSwatch(rgb)));
}
function colorSwatch(rgb){
  const hex = rgbToHex(rgb);
  const div = document.createElement('div');
  div.className='swatch'; div.dataset.hex = hex;
  div.innerHTML = `<div class="colorbox" style="background:${hex}"></div><div class="hex">${hex}</div>`;
  return div;
}
function palettePNG(cols,w,h){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d');
  const bw=Math.floor(w/cols.length);
  cols.forEach((rgb,i)=>{ ctx.fillStyle=rgbToHex(rgb); ctx.fillRect(i*bw,0,bw,h); ctx.fillStyle='#fff'; ctx.font='bold 28px ui-monospace,monospace'; ctx.fillText(rgbToHex(rgb), i*bw+16, h-18); });
  return c.toDataURL('image/png');
}
function downloadCanvas(canvas, name){ const a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download=name; a.click(); }
function downloadText(text, name){ const blob=new Blob([text], {type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); }
function drawGradient(canvas, cols){
  const ctx=canvas.getContext('2d');
  const g=ctx.createLinearGradient(0,0,canvas.width,canvas.height);
  cols.forEach((rgb,i)=>g.addColorStop(i/(cols.length-1), rgbToHex(rgb)));
  ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);
}
function drawWallpaper(canvas, cols){
  const ctx=canvas.getContext('2d');
  for(let i=0;i<cols.length;i++){
    const r = Math.max(canvas.width, canvas.height)*(1 - i/cols.length);
    const g = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, r);
    g.addColorStop(0, rgbToHex(cols[i]));
    g.addColorStop(1, '#000000');
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(canvas.width/2,canvas.height/2,r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function themeToCSS(t){
  const vars = Object.entries(t.variables).map(([k,v])=>`--${k}: ${v};`).join('\n  ');
  return `:root{\n  ${vars}\n}\n`;
}
function applyThemePreview(t){
  const surface = themePreview.querySelector('.surface');
  const btnP = themePreview.querySelector('.btn.primary');
  const btnS = themePreview.querySelector('.btn.secondary');
  const btnD = themePreview.querySelector('.btn.danger');
  const text = themePreview.querySelector('.text');
  surface.style.background = t.variables['surface'];
  surface.style.color = t.variables['text'];
  btnP.style.background = t.variables['primary']; btnP.style.color = t.variables['on-primary'];
  btnS.style.background = t.variables['secondary']; btnS.style.color = t.variables['on-secondary'];
  btnD.style.background = t.variables['danger']; btnD.style.color = t.variables['on-danger'];
  text.style.color = t.variables['text'];
}
function storyPoster(cols, title, mood, names){
  const w=1500,h=900, c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d');
  ctx.fillStyle='#121212'; ctx.fillRect(0,0,w,h);
  const bw=Math.floor((w-200)/cols.length);
  cols.forEach((rgb,i)=>{ ctx.fillStyle=rgbToHex(rgb); ctx.fillRect(100+i*bw, 180, bw-20, 420); });
  ctx.fillStyle='#fff'; ctx.font='bold 60px system-ui, sans-serif'; ctx.fillText(title, 100, 80);
  ctx.font='24px system-ui, sans-serif'; ctx.fillText(mood, 100, 120);
  ctx.font='20px ui-monospace, monospace'; ctx.fillText(names.join(', '), 100, 150);
  return c.toDataURL('image/png');
}
// Audio
function playToneFromHex(hex, dur=0.25){
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const hue = hexToHue(hex); const freq = 220 + (hue/360)*660;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type='sine'; osc.frequency.value = freq; gain.gain.value=0.15;
  osc.connect(gain).connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + dur);
}
function hexToHue(hex){
  const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b); let h=0; const d=max-min;
  if(d===0) h=0; else if(max===r) h=((g-b)/d)%6; else if(max===g) h=(b-r)/d+2; else h=(r-g)/d+4;
  h=Math.round(h*60); if(h<0) h+=360; return h;
}
function fitSize(w,h,max){ if(Math.max(w,h)<=max) return {w,h}; if(w>=h) return {w:max,h:Math.round(h*(max/w))}; return {w:Math.round(w*(max/h)),h:max}; }

// Restore last
(() => {
  try {
    const last = JSON.parse(localStorage.getItem('pp:last')||'[]');
    if (last.length){ palette=last; renderPalette(palette); analyzeBtn.disabled=false; exportPNG.disabled=false; storyBtn.disabled=false; }
  } catch {}
})();
