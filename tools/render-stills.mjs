// Renderiza las imágenes fijas del sitio a partir de la escena 3D.
// Uso: npm run build && npm run dev (en otra terminal) && npm run renders
// Opcional: node tools/render-stills.mjs <nombre> para renderizar solo una.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const OUT = process.env.OUT_DIR || 'assets/render';

export const SHOTS = [
  { name: 'hero', preset: 'hero', on: 'luces,clima', w: 1400, h: 1050, bg: 0 },
  { name: 'iluminacion', preset: 'iluminacion', on: 'luces', w: 1200, h: 900 },
  { name: 'clima', preset: 'clima', on: 'luces,clima', w: 1200, h: 900 },
  { name: 'seguridad', preset: 'seguridad', on: 'luces,alarma', w: 1200, h: 900, t: 1.4 },
  { name: 'accesos', preset: 'accesos', on: 'luces,accesos', w: 1200, h: 900 },
  { name: 'cortinas', preset: 'cortinas', on: 'luces,cortinas:0.62', w: 1200, h: 900 },
  { name: 'riego', preset: 'riego', on: 'luces,riego', w: 1200, h: 900, t: 3.1 },
  { name: 'cocina', preset: 'cocinaFoto', on: 'luces', w: 1200, h: 900 },
  { name: 'amplia', preset: 'amplia', on: 'luces,clima', w: 1800, h: 900 },
  { name: 'plano', preset: 'plano', on: 'luces', w: 1400, h: 1200, bg: 0 },
];

const only = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const s of SHOTS.filter((s) => !only.length || only.includes(s.name))) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
  page.on('console', (m) => m.type() !== 'log' && console.log(`[${s.name}] ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => console.log(`[${s.name}] error: ${e.message}`));
  const qs = new URLSearchParams({ preset: s.preset, on: s.on, w: s.w, h: s.h, bg: s.bg ?? 1, t: s.t ?? 2.2 });
  await page.goto(`${BASE}/tools/still.html?${qs}`);
  await page.waitForFunction(() => window.__done === true, null, { timeout: 180000 });
  await page.locator('canvas').screenshot({ path: `${OUT}/${s.name}.png`, omitBackground: true });
  console.log('ok', s.name);
  await page.close();
}
await browser.close();
