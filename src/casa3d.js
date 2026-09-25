// Casa i2home: diorama 3D de una casa, con dispositivos que se encienden y
// apagan por ambiente, hora del día y cámara que recorre la casa. Se usa en
// vivo en el sitio y para renderizar las imágenes fijas (tools/render-stills.mjs).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const F = 0.12; // nivel del piso interior (losa)
const T = 0.16; // espesor de muros
const H = 2.6; // altura de muros completos
const L = 1.0; // altura de muros cortados

const WARM = 0xffb877;
const TEAL = 0x5fc4ff; // estados activos, en la familia de azules de la marca

// Cada canal es un dispositivo de la casa. Los valores van de 0 a 1.
export const CHANNELS = [
  'luzLiving', 'luzDormitorio', 'luzCocina', 'luzEntrada', 'luzExterior', 'luzPileta',
  'cortinaLiving', 'cortinaDormitorio', 'climaLiving', 'climaDormitorio',
  'puerta', 'cerradura', 'videoportero', 'alarma', 'riego',
  'sensorPresencia', 'sensorApertura', 'sensorGas', 'sensorAgua', 'enchufes', 'botonNoche',
];

// Grupos que usa el inicio del sitio (un botón maneja varios canales).
export const ALIASES = {
  luces: ['luzLiving', 'luzDormitorio', 'luzCocina', 'luzEntrada', 'luzExterior', 'luzPileta'],
  cortinas: ['cortinaLiving', 'cortinaDormitorio'],
  clima: ['climaLiving', 'climaDormitorio'],
  accesos: ['puerta'],
  alarma: ['alarma'],
  riego: ['riego'],
};
export const DEVICES = Object.keys(ALIASES);

export const ROOMS = ['living', 'dormitorio', 'cocina', 'entrada', 'exterior'];

const HERO_POINTS = [];
for (const x of [-6.7, 8.7]) for (const z of [-5.4, 7.4]) for (const y of [-0.8, 0]) HERO_POINTS.push([x, y, z]);
HERO_POINTS.push([0.6, 3.1, 3.9], [-5.4, 3.0, 5.9], [-5, 3.1, -3.5], [7.9, 2.9, -4.5]);

const box = (x0, x1, y0, y1, z0, z1) => {
  const pts = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push([x, y, z]);
  return pts;
};

export const PRESETS = {
  hero: { type: 'ortho', az: 34, el: 36, target: [1.2, 0.2, 1.2], margin: 1.06, points: HERO_POINTS },
  dia: { type: 'ortho', az: 30, el: 38, target: [1.2, 0.2, 1.2], margin: 1.04, points: HERO_POINTS },
  living: { type: 'ortho', az: 40, el: 48, target: [-2.5, 0.8, 0], margin: 1.12, points: box(-5.2, 0.3, 0, 2.7, -3.7, 3.7) },
  dormitorio: { type: 'ortho', az: 28, el: 44, target: [2.5, 0.8, -1.8], margin: 1.15, points: box(-0.2, 5.2, 0, 2.7, -3.7, 0.2) },
  cocina: { type: 'ortho', az: 36, el: 48, target: [3.1, 0.6, 1.8], margin: 1.2, points: box(1.0, 5.2, 0, 2.2, -0.2, 3.8) },
  entrada: { type: 'ortho', az: 20, el: 30, target: [0.6, 1.1, 3.6], margin: 1.2, points: box(-1.2, 2.4, 0, 2.7, 2.2, 5.2) },
  exterior: { type: 'ortho', az: 34, el: 36, target: [1.2, 0.2, 1.2], margin: 1.02, points: HERO_POINTS },
  plano: { type: 'ortho', az: 0, el: 89.9, target: [1, 0, 1], margin: 1.0, points: HERO_POINTS },
  amplia: { type: 'persp', pos: [10.5, 3.6, 12.5], target: [0.4, 0.9, 0.8], fov: 36 },
  iluminacion: { type: 'persp', pos: [0.9, 2.7, 2.9], target: [-3.4, 0.9, -1.1], fov: 52 },
  clima: { type: 'persp', pos: [2.6, 2.3, 1.9], target: [2.0, 1.3, -3.2], fov: 44 },
  seguridad: { type: 'persp', pos: [8.5, 3.6, 10.5], target: [3.2, 0.8, 4.2], fov: 36 },
  accesos: { type: 'persp', pos: [3.4, 1.9, 7.6], target: [0.5, 1.1, 3.6], fov: 36 },
  cortinas: { type: 'persp', pos: [-1.2, 2.2, 1.6], target: [-3.0, 1.4, -3.4], fov: 46 },
  cocinaFoto: { type: 'persp', pos: [4.1, 2.15, 3.35], target: [1.6, 0.95, 0.9], fov: 50 },
  riego: { type: 'persp', pos: [-0.4, 1.5, 7.8], target: [-3.2, 0.5, 4.6], fov: 48 },
};

// Salida y puesta del sol (minutos desde las 00:00), primavera en Buenos Aires.
export const SUNRISE = 6 * 60 + 50;
export const SUNSET = 19 * 60 + 10;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Generador pseudoaleatorio con semilla: la casa sale siempre igual.
function seeded(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function makeTextures() {
  const rnd = seeded(11);
  const wood = canvasTexture(1024, (g, s) => {
    const rows = 8, h = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * s * 0.6;
      while (x < s) {
        const len = s * (0.3 + rnd() * 0.45);
        const k = 0.9 + rnd() * 0.18;
        g.fillStyle = `rgb(${(164 * k) | 0},${(122 * k) | 0},${(88 * k) | 0})`;
        g.fillRect(x, r * h, len, h);
        g.globalAlpha = 0.1;
        g.strokeStyle = '#3b2412';
        for (let i = 0; i < 7; i++) {
          const y = r * h + rnd() * h;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + (rnd() - 0.5) * 8, x + len * 0.7, y + (rnd() - 0.5) * 8, x + len, y);
          g.stroke();
        }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(50,30,15,0.55)';
        g.fillRect(x, r * h, 2, h);
        x += len;
      }
      g.fillStyle = 'rgba(50,30,15,0.5)';
      g.fillRect(0, r * h, s, 2);
    }
  });
  const tile = canvasTexture(512, (g, s) => {
    g.fillStyle = '#d9d5cd';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = rnd();
      g.fillStyle = v < 0.5 ? 'rgba(90,90,90,0.25)' : v < 0.8 ? 'rgba(160,120,90,0.25)' : 'rgba(255,255,255,0.5)';
      const r = 0.6 + rnd() * 2.2;
      g.beginPath(); g.arc(rnd() * s, rnd() * s, r, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(60,60,60,0.28)';
    g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s);
    g.fillRect(0, s / 2, s, 2); g.fillRect(s / 2, 0, 2, s);
  });
  const grass = canvasTexture(512, (g, s) => {
    g.fillStyle = '#4d6b4c';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const k = 0.7 + rnd() * 0.6;
      g.fillStyle = `rgba(${(70 * k) | 0},${(104 * k) | 0},${(66 * k) | 0},0.7)`;
      g.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 2, 2 + rnd() * 5);
    }
  });
  const rug = canvasTexture(512, (g, s) => {
    g.fillStyle = '#c9baa2';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#8e7a5e';
    g.lineWidth = 10;
    g.strokeRect(26, 26, s - 52, s - 52);
    g.lineWidth = 3;
    g.strokeRect(48, 48, s - 96, s - 96);
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(80,60,40,0.1)';
      g.fillRect(rnd() * s, rnd() * s, 2, 2);
    }
  });
  const rugBlue = canvasTexture(512, (g, s) => {
    g.fillStyle = '#7f8e99';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 2;
    for (let x = 0; x < s; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke(); }
  });
  const water = canvasTexture(512, (g, s) => {
    const grd = g.createLinearGradient(0, 0, s, s);
    grd.addColorStop(0, '#1b8ea6');
    grd.addColorStop(1, '#0f6f88');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(190,245,255,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const x = rnd() * s, y = rnd() * s, w = 20 + rnd() * 60;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + w * 0.3, y - 8, x + w * 0.6, y + 8, x + w, y);
      g.stroke();
    }
  });
  const glow = canvasTexture(128, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
  glow.colorSpace = THREE.NoColorSpace;
  const blob = canvasTexture(256, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.75)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
  const ring = canvasTexture(128, (g, s) => {
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.lineWidth = 7;
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 8, 0, Math.PI * 2); g.stroke();
  });
  ring.colorSpace = THREE.NoColorSpace;
  return { wood, tile, grass, rug, rugBlue, water, glow, blob, ring };
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#0b1330');
  grd.addColorStop(0.55, '#131e3d');
  grd.addColorStop(1, '#1d2d5c');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCasa(canvas, options = {}) {
  const opts = {
    transparent: true,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    shadowSize: 2048,
    intro: false,
    preset: 'hero',
    state: {},
    onFrame: null,
    ...options,
  };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: opts.transparent,
    preserveDrawingBuffer: !!opts.still,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(opts.pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  if (opts.transparent) renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.1;
  if (!opts.transparent) scene.background = skyTexture();

  const tex = makeTextures();
  const root = new THREE.Group();
  scene.add(root);
  const rnd = seeded(5);

  // ---------- materiales ----------
  const std = (color, roughness = 0.8, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  const M = {
    plinth: std('#17202a', 0.9),
    slab: std('#6c7682', 0.9),
    wall: std('#ebe6dd', 0.92),
    cap: std('#262d36', 0.7),
    woodFloor: std('#ffffff', 0.62, { map: tex.wood }),
    tileFloor: std('#ffffff', 0.4, { map: tex.tile }),
    grass: std('#ffffff', 1, { map: tex.grass }),
    oak: std('#a67a52', 0.6),
    walnut: std('#5e3f2a', 0.55),
    fabric: std('#4d5d6d', 0.95),
    fabricLight: std('#d9d3c8', 0.95),
    linen: std('#ece8e1', 0.95),
    mustard: std('#bf8a3b', 0.9),
    upholstery: std('#6f6254', 0.95),
    cabinet: std('#2a3743', 0.55),
    counter: std('#ece9e3', 0.35),
    steel: std('#a8b0b8', 0.3, { metalness: 0.8 }),
    black: std('#16191d', 0.35),
    white: std('#f2f1ee', 0.5),
    stone: std('#a9a59d', 0.9),
    coping: std('#d1ccc2', 0.8),
    leaf: std('#3f6a46', 0.9, { flatShading: true }),
    leafDark: std('#2f5238', 0.9, { flatShading: true }),
    trunk: std('#5a4232', 0.9),
    pot: std('#cfc8bc', 0.8),
    glass: new THREE.MeshStandardMaterial({ color: '#a9c9dc', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false }),
    frame: std('#1d2229', 0.5),
    blind: std('#d8d0c2', 0.95),
    rug: std('#ffffff', 1, { map: tex.rug }),
    rugBlue: std('#ffffff', 1, { map: tex.rugBlue }),
    tv: std('#0c0e11', 0.18, { metalness: 0.2 }),
  };

  // ---------- ayudantes de geometría ----------
  function place(mesh, x, y, z, cast = true, receive = true) {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    root.add(mesh);
    return mesh;
  }
  // caja por extremos
  function bx(x1, x2, y1, y2, z1, z2, mat, cast = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, y2 - y1, z2 - z1), mat);
    return place(m, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, cast);
  }
  // caja redondeada por centro (base apoyada en yb)
  function rb(w, h, d, r, mat, x, yb, z) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
    return place(m, x, yb + h / 2, z);
  }
  function cyl(rt, rbt, h, mat, x, yb, z, seg = 28) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rbt, h, seg), mat);
    return place(m, x, yb + h / 2, z);
  }
  // piso con UV en escala de mundo
  function floor(x1, x2, z1, z2, mat, tile, y = F + 0.001) {
    const w = x2 - x1, d = z2 - z1;
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile), uv.getY(i) * (d / tile));
    const m = new THREE.Mesh(g, mat);
    return place(m, (x1 + x2) / 2, y, (z1 + z2) / 2, false, true);
  }
  // muro recto sobre eje x o z, con aberturas {s, e, y0, y1}
  function wall(axis, a1, a2, c, h, openings = []) {
    const mats = [M.wall, M.wall, M.cap, M.wall, M.wall, M.wall];
    const pieces = [];
    let cursor = a1;
    const sorted = [...openings].sort((p, q) => p.s - q.s);
    for (const o of sorted) {
      if (o.s > cursor) pieces.push([cursor, o.s, 0, h]);
      if (o.y0 > 0) pieces.push([o.s, o.e, 0, o.y0]);
      if (o.y1 < h) pieces.push([o.s, o.e, o.y1, h]);
      cursor = o.e;
    }
    if (cursor < a2) pieces.push([cursor, a2, 0, h]);
    for (const [s, e, y0, y1] of pieces) {
      const len = e - s, hh = y1 - y0;
      const geo = axis === 'x' ? new THREE.BoxGeometry(len, hh, T) : new THREE.BoxGeometry(T, hh, len);
      const m = new THREE.Mesh(geo, mats);
      if (axis === 'x') place(m, (s + e) / 2, F + y0 + hh / 2, c);
      else place(m, c, F + y0 + hh / 2, (s + e) / 2);
    }
  }

  // ---------- luces y efectos, por canal ----------
  const lamps = Object.fromEntries(CHANNELS.map((c) => [c, []]));
  function lamp(channel, pos, color, intensity, distance = 6) {
    const light = new THREE.PointLight(color, 0, distance, 2);
    light.position.set(...pos);
    root.add(light);
    const entry = { light, base: intensity, mats: [], sprites: [] };
    lamps[channel].push(entry);
    return entry;
  }
  function glowMat(color) {
    return new THREE.SpriteMaterial({ map: tex.glow, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  }
  function addGlow(entry, pos, size, color, opacity) {
    const s = new THREE.Sprite(glowMat(color));
    s.scale.set(size, size, 1);
    s.position.set(...pos);
    root.add(s);
    entry.sprites.push({ s, base: opacity });
  }
  function emissiveMat(color, emissive, base, entry, roughness = 0.6) {
    const m = std(color, roughness, { emissive, emissiveIntensity: 0 });
    entry.mats.push({ m, base });
    return m;
  }
  function setLevel(entry, v) {
    entry.light.intensity = entry.base * v;
    for (const { m, base } of entry.mats) m.emissiveIntensity = base * v;
    for (const { s, base } of entry.sprites) s.material.opacity = base * v;
  }

  // ---------- luz ambiente: luna de noche, sol de día ----------
  const hemi = new THREE.HemisphereLight(0x4a6a8f, 0x0e141a, 0.9);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xa8bcff, 1.1);
  const MOON_POS = new THREE.Vector3(-7, 14, 9);
  keyLight.position.copy(MOON_POS);
  keyLight.target.position.set(1, 0, 1);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(opts.shadowSize, opts.shadowSize);
  Object.assign(keyLight.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.03;
  keyLight.shadow.radius = 3;
  scene.add(keyLight, keyLight.target);

  // ---------- terreno ----------
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(15.4, 0.8, 12.8, 4, 0.14), M.plinth);
  place(plinth, 1.0, -0.4, 1.0, false, true);
  floor(-6.62, 8.62, -5.32, 7.32, M.grass, 2.2, 0.002);
  const shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(24, 20), new THREE.MeshBasicMaterial({ map: tex.blob, transparent: true, depthWrite: false, opacity: 0.6 }));
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.set(1.4, -0.82, 1.6);
  root.add(shadowBlob);

  // losa y pisos
  bx(-5.14, 5.14, 0, F, -3.64, 3.64, M.slab, false);
  floor(-5, 0, -3.5, 3.5, M.woodFloor, 1.6);
  floor(0, 5, -3.5, 0, M.woodFloor, 1.6);
  floor(0, 1.2, 0, 3.5, M.woodFloor, 1.6);
  floor(1.2, 5, 0, 3.5, M.tileFloor, 1.2);

  // ---------- muros ----------
  const LIVING_WIN = { s: -4.3, e: -1.7, y0: 0.35, y1: 2.25 };
  const BED_WIN = { s: 3.7, e: 4.7, y0: 0.9, y1: 2.2 };
  wall('x', -5.08, 5.08, -3.5, H, [LIVING_WIN, BED_WIN]);
  wall('z', -3.58, 3.58, -5, H);
  wall('z', -3.58, 3.58, 5, L);
  wall('x', -5.08, -0.3, 3.5, L);
  wall('x', -0.3, 1.5, 3.5, H, [{ s: 0.15, e: 1.05, y0: 0, y1: 2.15 }]);
  wall('x', 1.5, 5.08, 3.5, L);
  wall('z', -3.5, 0, 0, L);
  wall('x', 0, 5, 0, L, [{ s: 0.2, e: 1.05, y0: 0, y1: L }]);

  // ventanas: vidrio, marcos, cortinas roller
  const blinds = [];
  function windowOn(win, mullions, channel) {
    const zi = -3.5;
    bx(win.s, win.e, F + win.y0, F + win.y1, zi - 0.01, zi + 0.01, M.glass, false);
    const fr = 0.035;
    bx(win.s, win.e, F + win.y0, F + win.y0 + fr, zi - 0.04, zi + 0.04, M.frame);
    bx(win.s, win.e, F + win.y1 - fr, F + win.y1, zi - 0.04, zi + 0.04, M.frame);
    bx(win.s, win.s + fr, F + win.y0, F + win.y1, zi - 0.04, zi + 0.04, M.frame);
    bx(win.e - fr, win.e, F + win.y0, F + win.y1, zi - 0.04, zi + 0.04, M.frame);
    for (let i = 1; i <= mullions; i++) {
      const x = win.s + ((win.e - win.s) * i) / (mullions + 1);
      bx(x - fr / 2, x + fr / 2, F + win.y0, F + win.y1, zi - 0.04, zi + 0.04, M.frame);
    }
    const zc = zi + T / 2 + 0.05;
    bx(win.s - 0.06, win.e + 0.06, F + win.y1 + 0.02, F + win.y1 + 0.12, zc - 0.05, zc + 0.05, M.white);
    const hgt = win.y1 - win.y0 + 0.04;
    const pivot = new THREE.Group();
    pivot.position.set((win.s + win.e) / 2, F + win.y1 + 0.02, zc);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(win.e - win.s + 0.08, hgt, 0.015), M.blind);
    panel.position.y = -hgt / 2;
    panel.castShadow = true;
    panel.receiveShadow = true;
    pivot.add(panel);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(win.e - win.s + 0.1, 0.03, 0.03), M.frame);
    bar.position.y = -hgt;
    pivot.add(bar);
    root.add(pivot);
    blinds.push({ panel, bar, hgt, channel });
  }
  windowOn(LIVING_WIN, 2, 'cortinaLiving');
  windowOn(BED_WIN, 0, 'cortinaDormitorio');

  // ---------- living ----------
  const slatGeo = new THREE.BoxGeometry(0.03, 2.3, 0.045);
  const slats = new THREE.InstancedMesh(slatGeo, M.oak, 42);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 42; i++) {
    dummy.position.set(-4.905, F + 1.15, -1.6 + i * 0.09);
    dummy.updateMatrix();
    slats.setMatrixAt(i, dummy.matrix);
  }
  slats.castShadow = slats.receiveShadow = true;
  root.add(slats);
  bx(-4.89, -4.45, F + 0.08, F + 0.48, -1.1, 1.9, M.walnut);
  bx(-4.88, -4.84, F + 1.0, F + 1.74, -0.4, 1.1, M.tv);
  rb(0.08, 0.34, 0.08, 0.02, M.black, -4.62, F + 0.48, 1.55);

  bx(-4.1, -1.25, F, F + 0.012, -1.15, 1.95, M.rug, false);
  rb(0.98, 0.3, 2.7, 0.06, M.fabric, -1.55, F + 0.06, 0.3);
  rb(0.74, 0.14, 1.3, 0.06, M.fabric, -1.66, F + 0.34, -0.35);
  rb(0.74, 0.14, 1.3, 0.06, M.fabric, -1.66, F + 0.34, 0.95);
  rb(0.22, 0.52, 2.7, 0.08, M.fabric, -1.16, F + 0.34, 0.3);
  rb(0.98, 0.22, 0.2, 0.07, M.fabric, -1.55, F + 0.34, -1.05);
  rb(0.98, 0.22, 0.2, 0.07, M.fabric, -1.55, F + 0.34, 1.65);
  rb(0.14, 0.36, 0.42, 0.06, M.mustard, -1.36, F + 0.48, -0.55);
  rb(0.14, 0.34, 0.4, 0.06, M.fabricLight, -1.36, F + 0.48, 1.25);
  cyl(0.46, 0.46, 0.04, M.oak, -2.95, F + 0.34, 0.35, 40);
  cyl(0.06, 0.2, 0.34, M.walnut, -2.95, F, 0.35);
  rb(0.28, 0.05, 0.2, 0.01, M.mustard, -2.85, F + 0.38, 0.25);
  rb(0.8, 0.36, 0.8, 0.08, M.fabricLight, -3.6, F + 0.08, -2.45).rotation.y = 0.5;
  rb(0.8, 0.5, 0.18, 0.07, M.fabricLight, -3.82, F + 0.4, -2.78).rotation.y = 0.5;

  function plant(x, z, s = 1) {
    cyl(0.2 * s, 0.15 * s, 0.4 * s, M.pot, x, F, z);
    for (let i = 0; i < 4; i++) {
      const g = new THREE.IcosahedronGeometry((0.26 + rnd() * 0.12) * s, 0);
      const m = new THREE.Mesh(g, i % 2 ? M.leaf : M.leafDark);
      place(m, x + (rnd() - 0.5) * 0.3 * s, F + (0.6 + i * 0.22) * s, z + (rnd() - 0.5) * 0.3 * s);
    }
  }
  plant(-4.55, -3.05, 1.1);
  plant(4.55, -0.55, 0.9);

  const floorLamp = lamp('luzLiving', [-1.2, F + 1.35, -1.45], WARM, 7, 7);
  cyl(0.15, 0.15, 0.03, M.black, -1.2, F, -1.45);
  cyl(0.012, 0.012, 1.3, M.black, -1.2, F, -1.45);
  cyl(0.17, 0.21, 0.3, emissiveMat('#f3e3c8', WARM, 2.2, floorLamp), -1.2, F + 1.25, -1.45);
  addGlow(floorLamp, [-1.2, F + 1.4, -1.45], 1.6, WARM, 0.55);

  const sideLamp = lamp('luzLiving', [-1.5, F + 0.95, 2.15], WARM, 3.5, 5);
  cyl(0.2, 0.2, 0.5, M.oak, -1.5, F, 2.15);
  cyl(0.05, 0.07, 0.2, M.black, -1.5, F + 0.5, 2.15);
  cyl(0.11, 0.14, 0.18, emissiveMat('#f3e3c8', WARM, 2.2, sideLamp), -1.5, F + 0.7, 2.15);
  addGlow(sideLamp, [-1.5, F + 0.8, 2.15], 1.0, WARM, 0.5);

  const cove = lamp('luzLiving', [-3.2, F + 2.2, -3.05], WARM, 5, 6);
  lamp('luzLiving', [-4.55, F + 2.2, 0.4], WARM, 4, 6);
  const coveMat = emissiveMat('#fff3e0', WARM, 3, cove);
  bx(-4.92, -0.1, F + 2.44, F + 2.47, -3.42, -3.39, coveMat, false);
  bx(-4.92, -4.89, F + 2.44, F + 2.47, -3.4, 3.35, coveMat, false);

  // ---------- dormitorio ----------
  bx(1.05, 2.95, F, F + 1.15, -3.42, -3.33, M.upholstery);
  bx(1.15, 2.85, F, F + 0.28, -3.33, -1.3, M.walnut);
  rb(1.64, 0.22, 2.0, 0.05, M.linen, 2.0, F + 0.26, -2.32);
  rb(1.72, 0.08, 1.42, 0.04, M.fabricLight, 2.0, F + 0.46, -1.98);
  rb(1.76, 0.05, 0.42, 0.02, M.mustard, 2.0, F + 0.52, -1.6);
  rb(0.62, 0.14, 0.36, 0.07, M.linen, 1.62, F + 0.48, -3.08);
  rb(0.62, 0.14, 0.36, 0.07, M.linen, 2.38, F + 0.48, -3.08);
  bx(0.8, 3.2, F, F + 0.012, -2.95, -0.45, M.rugBlue, false);
  rb(1.2, 0.42, 0.38, 0.04, M.upholstery, 2.0, F, -0.9);
  bx(4.45, 4.92, F, F + 0.8, -2.8, -1.3, M.oak);
  rb(0.2, 0.26, 0.2, 0.03, M.pot, 4.68, F + 0.8, -2.45);
  for (const nx of [0.745, 3.255]) {
    bx(nx - 0.23, nx + 0.23, F, F + 0.5, -3.4, -2.98, M.oak);
    const l = lamp('luzDormitorio', [nx, F + 0.85, -3.1], WARM, 2.6, 4);
    cyl(0.05, 0.07, 0.18, M.black, nx, F + 0.5, -3.19);
    cyl(0.1, 0.13, 0.17, emissiveMat('#f3e3c8', WARM, 2.2, l), nx, F + 0.68, -3.19);
    addGlow(l, [nx, F + 0.78, -3.19], 0.9, WARM, 0.5);
  }

  // aires acondicionados (split), con flujo de aire animado
  const acUnits = [];
  function acUnit(channel, x) {
    const light = lamp(channel, [x, F + 1.9, -2.9], TEAL, 1.6, 3.5);
    rb(0.95, 0.3, 0.24, 0.05, M.white, x, F + 2.02, -3.3);
    bx(x - 0.42, x + 0.42, F + 2.03, F + 2.06, -3.19, -3.175, M.frame, false);
    bx(x + 0.22, x + 0.38, F + 2.16, F + 2.2, -3.185, -3.17, emissiveMat('#1a2a2a', TEAL, 4, light), false);
    const count = 70;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xa9dcff, map: tex.glow, size: 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    root.add(pts);
    acUnits.push({ channel, x, geo, pos, mat, pts, seed: Array.from({ length: count }, () => [rnd(), rnd(), rnd()]) });
  }
  acUnit('climaDormitorio', 2.0);
  acUnit('climaLiving', -0.95);

  // ---------- cocina ----------
  bx(4.28, 4.92, F, F + 2.05, 0.1, 0.78, M.steel);
  bx(4.3, 4.92, F, F + 0.86, 0.8, 3.3, M.cabinet);
  bx(4.26, 4.92, F + 0.86, F + 0.9, 0.78, 3.34, M.counter);
  bx(4.45, 4.8, F + 0.9, F + 0.903, 1.0, 1.55, M.steel, false);
  cyl(0.015, 0.015, 0.32, M.steel, 4.84, F + 0.9, 1.27);
  bx(4.4, 4.85, F + 0.9, F + 0.906, 2.2, 2.8, M.black, false);
  bx(2.5, 3.3, F, F + 0.86, 1.0, 2.8, M.cabinet);
  bx(2.35, 3.36, F + 0.86, F + 0.9, 0.92, 2.88, M.counter);
  cyl(0.15, 0.1, 0.07, M.white, 2.95, F + 0.9, 2.1);
  for (const [ox, oz] of [[0, 0], [0.07, 0.05], [-0.05, 0.06]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), std('#e38a2f', 0.6));
    place(m, 2.95 + ox, F + 0.99, 2.1 + oz);
  }
  for (const sz of [1.3, 1.9, 2.5]) {
    cyl(0.025, 0.025, 0.62, M.black, 2.08, F, sz);
    cyl(0.17, 0.15, 0.02, M.black, 2.08, F, sz);
    cyl(0.18, 0.17, 0.06, M.upholstery, 2.08, F + 0.62, sz);
  }
  const islandLed = lamp('luzCocina', [2.3, F + 0.5, 1.9], WARM, 1.6, 2.5);
  bx(2.48, 2.5, F + 0.8, F + 0.83, 1.0, 2.8, emissiveMat('#fff3e0', WARM, 3, islandLed), false);
  for (const pz of [1.45, 2.35]) {
    const l = lamp('luzCocina', [2.9, F + 1.45, pz], WARM, 4, 5);
    cyl(0.004, 0.004, 0.85, M.black, 2.9, F + 1.72, pz, 6);
    cyl(0.05, 0.19, 0.2, emissiveMat('#1f242a', WARM, 0.2, l, 0.4), 2.9, F + 1.52, pz);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), emissiveMat('#fff4e0', WARM, 6, l));
    place(bulb, 2.9, F + 1.53, pz, false, false);
    addGlow(l, [2.9, F + 1.5, pz], 1.3, WARM, 0.6);
  }

  // ---------- entrada ----------
  bx(0.1, 0.15, F, F + 2.15, 3.42, 3.58, M.frame);
  bx(1.05, 1.1, F, F + 2.15, 3.42, 3.58, M.frame);
  bx(0.1, 1.1, F + 2.1, F + 2.15, 3.42, 3.58, M.frame);
  const doorPivot = new THREE.Group();
  doorPivot.position.set(0.15, F, 3.5);
  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.05), M.walnut);
  doorLeaf.position.set(0.45, 1.05, 0);
  doorLeaf.castShadow = doorLeaf.receiveShadow = true;
  doorPivot.add(doorLeaf);
  for (let i = 1; i < 5; i++) {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.008, 1.9, 0.004), M.frame);
    groove.position.set(i * 0.18, 1.05, 0.027);
    doorPivot.add(groove);
  }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.6, 0.03), M.steel);
  handle.position.set(0.8, 1.05, 0.05);
  doorPivot.add(handle);
  const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.025), M.black);
  lockBody.position.set(0.8, 1.48, 0.04);
  doorPivot.add(lockBody);
  const lockLedMat = std('#101418', 0.4, { emissive: TEAL, emissiveIntensity: 3 });
  const lockLed = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.004), lockLedMat);
  lockLed.position.set(0.8, 1.52, 0.054);
  doorPivot.add(lockLed);
  root.add(doorPivot);
  // panel táctil de la casa, junto a la puerta (lado interior)
  const panelLight = lamp('cerradura', [1.3, F + 1.25, 3.2], 0x8fc2ff, 0.3, 1.2);
  bx(1.22, 1.38, F + 1.16, F + 1.34, 3.405, 3.42, emissiveMat('#0c1216', 0x8fc2ff, 1.6, panelLight), false);
  // umbral, alero, aplique exterior y videoportero
  bx(-0.25, 1.45, 0, F, 3.58, 4.0, M.stone);
  bx(-0.4, 1.6, F + 2.28, F + 2.36, 3.42, 4.32, M.cap);
  const porch = lamp('luzEntrada', [1.34, F + 1.9, 3.85], WARM, 3, 5);
  bx(1.3, 1.38, F + 1.8, F + 2.0, 3.58, 3.64, emissiveMat('#f5ead6', WARM, 3, porch), false);
  addGlow(porch, [1.34, F + 1.9, 3.7], 1.1, WARM, 0.6);
  const bell = lamp('videoportero', [1.33, F + 1.32, 3.75], 0x8fc2ff, 0.4, 1.2);
  bx(1.27, 1.39, F + 1.2, F + 1.44, 3.58, 3.61, M.black);
  cyl(0.025, 0.025, 0.006, emissiveMat('#10151c', 0x8fc2ff, 4, bell), 1.33, F + 1.26, 3.612, 20).rotation.x = Math.PI / 2;

  // ---------- jardín ----------
  for (let z = 4.1; z < 7.1; z += 0.62) bx(0.12, 1.08, 0, 0.03, z, z + 0.42, M.stone, false);
  for (const [bxp, bzp] of [[-0.3, 4.7], [1.5, 4.7], [-0.3, 6.3], [1.5, 6.3]]) cyl(0.045, 0.05, 0.46, M.black, bxp, 0, bzp, 16);
  const path1 = lamp('luzExterior', [0.6, 0.55, 4.7], WARM, 1.5, 3);
  const path2 = lamp('luzExterior', [0.6, 0.55, 6.3], WARM, 1.5, 3);
  const bollardMat = emissiveMat('#fff1dc', WARM, 3, path1);
  for (const [bxp, bzp] of [[-0.3, 4.7], [1.5, 4.7], [-0.3, 6.3], [1.5, 6.3]]) {
    cyl(0.05, 0.05, 0.05, bollardMat, bxp, 0.44, bzp, 16);
    addGlow(bzp < 5 ? path1 : path2, [bxp, 0.5, bzp], 0.55, WARM, 0.6);
  }

  function tree(x, z, s = 1) {
    cyl(0.07 * s, 0.11 * s, 1.3 * s, M.trunk, x, 0, z, 10);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.IcosahedronGeometry((0.75 - i * 0.12) * s, 1);
      const m = new THREE.Mesh(g, i === 1 ? M.leafDark : M.leaf);
      place(m, x + (rnd() - 0.5) * 0.5 * s, (1.5 + i * 0.45) * s, z + (rnd() - 0.5) * 0.5 * s);
    }
  }
  tree(-5.4, 5.9, 1.15);
  tree(7.9, -4.5, 1.0);
  tree(-5.9, -4.6, 0.9);
  tree(8.0, 6.6, 0.7);
  const uplight = lamp('luzExterior', [-5.1, 0.25, 5.4], WARM, 3.5, 4);
  addGlow(uplight, [-5.1, 0.12, 5.4], 0.6, WARM, 0.6);
  for (let x = -6.3; x < -0.9; x += 0.55) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26 + rnd() * 0.1, 1), M.leafDark);
    place(m, x, 0.2, 7.0 + (rnd() - 0.5) * 0.1);
  }

  bx(4.6, 7.4, 0, 0.22, 5.2, 6.1, M.oak);
  bx(4.66, 7.34, 0.2, 0.23, 5.26, 6.04, std('#3a2a1e', 1), false);
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09 + rnd() * 0.05, 0), i % 3 ? M.leaf : M.leafDark);
    place(m, 4.8 + (i % 8) * 0.34 + (rnd() - 0.5) * 0.08, 0.32, 5.45 + Math.floor(i / 8) * 0.4);
  }

  // pileta con luz
  bx(5.65, 8.15, 0, 0.05, -3.15, -2.95, M.coping);
  bx(5.65, 8.15, 0, 0.05, 1.55, 1.75, M.coping);
  bx(5.65, 5.85, 0, 0.05, -2.95, 1.55, M.coping);
  bx(7.95, 8.15, 0, 0.05, -2.95, 1.55, M.coping);
  const pool = lamp('luzPileta', [6.9, 0.35, -0.7], 0x4fd6e8, 4, 5);
  const waterMat = std('#ffffff', 0.08, { map: tex.water, emissive: 0x1aa6c0, emissiveIntensity: 0, emissiveMap: tex.water });
  pool.mats.push({ m: waterMat, base: 1.4 });
  floor(5.85, 7.95, -2.95, 1.55, waterMat, 2.2, 0.025);
  addGlow(pool, [6.9, 0.1, -0.7], 4.2, 0x4fd6e8, 0.16);
  for (const lx of [6.3, 7.4]) {
    rb(0.6, 0.12, 1.5, 0.04, M.linen, lx, 0.18, 2.75);
    bx(lx - 0.28, lx + 0.28, 0, 0.18, 2.1, 2.14, M.frame);
    bx(lx - 0.28, lx + 0.28, 0, 0.18, 3.36, 3.4, M.frame);
  }

  // cámara de seguridad en poste
  cyl(0.04, 0.05, 2.5, M.black, 5.4, 0, 3.9, 12);
  const camHead = new THREE.Group();
  camHead.position.set(5.4, 2.55, 3.9);
  const camBody = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.13, 0.32, 3, 0.03), M.white);
  camBody.castShadow = true;
  camHead.add(camBody);
  const camLedMat = std('#200808', 0.4, { emissive: 0xff4d4d, emissiveIntensity: 0 });
  const camLed = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), camLedMat);
  camLed.position.set(0, 0.04, 0.165);
  camHead.add(camLed);
  root.add(camHead);
  const coneLen = 5.6;
  const coneGeo = new THREE.ConeGeometry(1.9, coneLen, 40, 1, true);
  coneGeo.translate(0, -coneLen / 2, 0);
  const coneFade = canvasTexture(64, (g, s) => {
    const grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(1, '#000000');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
  coneFade.colorSpace = THREE.NoColorSpace;
  const coneMat = new THREE.MeshBasicMaterial({ color: TEAL, alphaMap: coneFade, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.copy(camHead.position);
  root.add(cone);
  const camAim = new THREE.Vector3(1.6, 0, 6.4);
  const alarmLamp = lamp('alarma', [5.4, 2.5, 4.1], 0xff5a5a, 0.5, 1.5);
  alarmLamp.mats.push({ m: camLedMat, base: 5 });

  // aspersores
  const heads = [[-3.1, 4.9], [3.3, 5.7], [6.1, 4.6]];
  for (const [hx, hz] of heads) cyl(0.03, 0.035, 0.08, M.black, hx, 0, hz, 10);
  const perHead = 420;
  const waterGeo = new THREE.BufferGeometry();
  const wPos = new Float32Array(heads.length * perHead * 3);
  const wSeed = Array.from({ length: heads.length * perHead }, () => [rnd(), rnd(), rnd()]);
  waterGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
  const sprayMat = new THREE.PointsMaterial({ color: 0xcdeeff, map: tex.glow, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const spray = new THREE.Points(waterGeo, sprayMat);
  spray.frustumCulled = false;
  root.add(spray);

  // ---------- sensores: balizas que laten donde va cada equipo ----------
  const markers = [];
  function marker(channel, pos) {
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: 0x2f7dff, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    dot.scale.set(0.6, 0.6, 1);
    dot.position.set(...pos);
    dot.renderOrder = 10;
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.ring, color: 0x2f7dff, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    ring.position.set(...pos);
    ring.renderOrder = 10;
    root.add(dot, ring);
    markers.push({ channel, dot, ring, phase: rnd() });
  }
  marker('sensorPresencia', [-4.75, F + 2.3, -3.25]);
  marker('enchufes', [-4.55, F + 0.75, 0.9]);
  marker('sensorApertura', [0.6, F + 2.3, 3.62]);
  marker('cerradura', [0.95, F + 1.5, 3.66]);
  marker('videoportero', [1.33, F + 1.32, 3.7]);
  marker('sensorGas', [4.62, F + 1.3, 2.5]);
  marker('sensorAgua', [4.55, F + 0.25, 1.28]);
  marker('botonNoche', [3.255, F + 0.75, -2.95]);

  // ---------- resaltado del ambiente elegido ----------
  const ROOM_RECTS = {
    living: [[-5, 0, -3.5, 3.5, F + 0.016]],
    dormitorio: [[0, 5, -3.5, 0, F + 0.016]],
    cocina: [[1.2, 5, 0, 3.5, F + 0.016]],
    entrada: [[0, 1.2, 0, 3.5, F + 0.016], [-0.25, 1.45, 3.58, 4.0, F + 0.004]],
    exterior: [[-6.6, 8.6, 4.0, 7.3, 0.06], [5.25, 8.6, -5.3, 4.0, 0.06], [-6.6, -5.2, -5.3, 4.0, 0.06]],
  };
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0x3d8bff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x6aa8ff, transparent: true, opacity: 0.95, depthWrite: false });
  const highlights = {};
  const flat = (w, d, mat, x, y, z, parent) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    parent.add(m);
  };
  for (const [room, rects] of Object.entries(ROOM_RECTS)) {
    const g = new THREE.Group();
    for (const [x0, x1, z0, z1, y] of rects) {
      const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, b = 0.07;
      flat(w, d, highlightMat, cx, y, cz, g);
      flat(w, b, outlineMat, cx, y + 0.002, z0 + b / 2, g);
      flat(w, b, outlineMat, cx, y + 0.002, z1 - b / 2, g);
      flat(b, d, outlineMat, x0 + b / 2, y + 0.002, cz, g);
      flat(b, d, outlineMat, x1 - b / 2, y + 0.002, cz, g);
    }
    g.visible = false;
    root.add(g);
    highlights[room] = g;
  }
  let highlighted = null;

  // ---------- anclas para etiquetas y botones sobre la escena ----------
  const anchors = {
    luces: [-2.4, F + 2.0, 0.2],
    clima: [2.0, F + 2.75, -3.3],
    accesos: [0.6, F + 2.75, 3.9],
    alarma: [5.4, 3.05, 3.9],
    riego: [-3.1, 0.9, 5.3],
    cortinas: [-3.0, F + 2.75, -3.45],
    climaLiving: [-0.95, F + 2.75, -3.3],
    luzExterior: [0.6, 0.9, 5.4],
    luzPileta: [6.9, 0.7, -0.7],
    'room:living': [-2.9, F + 1.4, -0.6],
    'room:dormitorio': [2.6, F + 1.6, -2.4],
    'room:cocina': [3.9, F + 1.0, 2.6],
    'room:entrada': [0.6, 0.1, 6.0],
    'room:exterior': [7.0, 0.3, 3.0],
  };
  for (const [k, v] of Object.entries(anchors)) anchors[k] = new THREE.Vector3(...v);

  // ---------- cámara con transiciones ----------
  let camera;
  let preset = PRESETS[opts.preset] || PRESETS.hero;
  const parallax = { x: 0, y: 0 };
  let width = 1, height = 1;
  let view = null; // vista ortográfica actual
  let tween = null;

  const tmpCam = new THREE.OrthographicCamera();
  function orient(cam, az, el, target) {
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(Math.min(89.9, el));
    const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
    cam.position.copy(target).addScaledVector(dir, 40);
    cam.up.set(0, 1, 0);
    if (el > 89) cam.up.set(0, 0, -1);
    cam.lookAt(target);
    cam.updateMatrixWorld();
  }
  function viewFor(p) {
    const target = new THREE.Vector3(...p.target);
    orient(tmpCam, p.az, p.el, target);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const pt of p.points) {
      v.set(...pt).applyMatrix4(tmpCam.matrixWorldInverse);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const aspect = width / height;
    let hw = ((maxX - minX) / 2) * p.margin, hh = ((maxY - minY) / 2) * p.margin;
    if (hw / hh < aspect) hw = hh * aspect; else hh = hw / aspect;
    return { az: p.az, el: p.el, target, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, hw, hh };
  }
  function pointSize() {
    const px = renderer.getPixelRatio() * Math.max(0.6, height / 800);
    // en las vistas de cerca las partículas crecen un poco
    const zoom = view ? Math.min(2.2, Math.max(1, 9 / view.hh)) : 1;
    for (const u of acUnits) { u.mat.size = 3.2 * px * zoom; u.mat.sizeAttenuation = false; u.mat.needsUpdate = true; }
    sprayMat.size = 4 * px * zoom;
    sprayMat.sizeAttenuation = false;
    sprayMat.needsUpdate = true;
  }
  function applyView(v) {
    if (!camera || !camera.isOrthographicCamera) camera = new THREE.OrthographicCamera();
    orient(camera, v.az + parallax.x * 4, v.el + parallax.y * 2, v.target);
    Object.assign(camera, { left: v.cx - v.hw, right: v.cx + v.hw, top: v.cy + v.hh, bottom: v.cy - v.hh, near: 1, far: 90 });
    camera.updateProjectionMatrix();
  }
  function setupCamera() {
    if (preset.type === 'ortho') {
      if (!tween) view = viewFor(preset);
      applyView(view);
      pointSize();
    } else {
      if (!camera || !camera.isPerspectiveCamera) camera = new THREE.PerspectiveCamera();
      camera.fov = preset.fov;
      camera.aspect = width / height;
      camera.near = 0.1;
      camera.far = 120;
      camera.position.set(...preset.pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(new THREE.Vector3(...preset.target));
      camera.updateProjectionMatrix();
      for (const u of acUnits) { u.mat.size = 0.07; u.mat.sizeAttenuation = true; u.mat.needsUpdate = true; }
      sprayMat.size = 0.07;
      sprayMat.sizeAttenuation = true;
      sprayMat.needsUpdate = true;
    }
  }
  function stepTween(now) {
    if (!tween) return false;
    const k = ease(Math.min(1, (now - tween.t0) / tween.dur));
    const a = tween.from, b = tween.to;
    const lerp = (x, y) => x + (y - x) * k;
    view = {
      az: lerp(a.az, b.az), el: lerp(a.el, b.el),
      target: a.target.clone().lerp(b.target, k),
      cx: lerp(a.cx, b.cx), cy: lerp(a.cy, b.cy), hw: lerp(a.hw, b.hw), hh: lerp(a.hh, b.hh),
    };
    applyView(view);
    if (k >= 1) { tween = null; pointSize(); }
    return true;
  }

  // ---------- estado, hora del día y animación ----------
  const state = Object.fromEntries(CHANNELS.map((c) => [c, 0]));
  const anim = { ...state };
  const toLevel = (v) => (typeof v === 'number' ? Math.max(0, Math.min(1, v)) : v ? 1 : 0);
  function assign(key, value) {
    const targets = ALIASES[key] || (key in state ? [key] : []);
    for (const c of targets) state[c] = toLevel(value);
  }
  const initial = { luces: true, clima: true, ...opts.state };
  for (const [k, v] of Object.entries(initial)) assign(k, v);
  for (const c of CHANNELS) anim[c] = state[c];

  let timeOfDay = null; // null: noche fija
  let dayMix = 0, goldMix = 0;
  const NIGHT = { sky: new THREE.Color(0x4a6a8f), ground: new THREE.Color(0x0e141a), key: new THREE.Color(0xa8bcff) };
  const DAY = { sky: new THREE.Color(0xcfe2ff), ground: new THREE.Color(0x6e604c), key: new THREE.Color(0xfff2e0) };
  const GOLD = { sky: new THREE.Color(0xffc9a3), key: new THREE.Color(0xffa860) };
  const sunPos = new THREE.Vector3();
  function applyTime() {
    if (timeOfDay === null) { dayMix = 0; goldMix = 0; }
    else {
      const t = timeOfDay;
      dayMix = smooth(SUNRISE - 35, SUNRISE + 45, t) * (1 - smooth(SUNSET - 45, SUNSET + 35, t));
      goldMix = Math.max(Math.exp(-(((t - SUNRISE - 20) / 45) ** 2)), Math.exp(-(((t - SUNSET + 10) / 45) ** 2)));
    }
    const arc = Math.min(1, Math.max(0, ((timeOfDay ?? 0) - SUNRISE + 30) / (SUNSET - SUNRISE + 60)));
    sunPos.set(14 - 28 * arc, 3 + 13 * Math.sin(Math.PI * arc), -3 + 11 * arc);
    keyLight.position.copy(MOON_POS).lerp(sunPos, dayMix);
    const keyDay = DAY.key.clone().lerp(GOLD.key, goldMix * 0.85);
    keyLight.color.copy(NIGHT.key).lerp(keyDay, dayMix);
    keyLight.intensity = 1.1 + (3.1 - 1.1) * dayMix - goldMix * dayMix * 0.8;
    const skyDay = DAY.sky.clone().lerp(GOLD.sky, goldMix * 0.6);
    hemi.color.copy(NIGHT.sky).lerp(skyDay, dayMix);
    hemi.groundColor.copy(NIGHT.ground).lerp(DAY.ground, dayMix);
    hemi.intensity = 0.9 + 0.7 * dayMix;
    scene.environmentIntensity = 0.1 + 0.3 * dayMix;
    renderer.toneMappingExposure = 1.05 - 0.1 * dayMix;
  }

  const lockClosed = new THREE.Color(TEAL), lockOpen = new THREE.Color(0xffb35c);
  const aimDir = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const up = new THREE.Vector3(0, 1, 0);

  function applyState(t) {
    for (const c of CHANNELS) for (const e of lamps[c]) setLevel(e, anim[c]);
    for (const b of blinds) {
      const s = 0.04 + 0.96 * anim[b.channel];
      b.panel.scale.y = s;
      b.panel.position.y = (-b.hgt * s) / 2;
      b.bar.position.y = -b.hgt * s;
    }
    doorPivot.rotation.y = 1.25 * anim.puerta;
    lockLedMat.emissive.copy(lockClosed).lerp(lockOpen, anim.puerta);

    coneMat.opacity = 0.22 * anim.alarma;
    cone.visible = anim.alarma > 0.01;
    const sweep = Math.sin(t * 0.6) * 0.45;
    aimDir.copy(camAim).sub(camHead.position);
    aimDir.applyAxisAngle(up, sweep * anim.alarma).normalize();
    camHead.lookAt(camHead.position.clone().add(aimDir));
    cone.quaternion.setFromUnitVectors(down, aimDir);

    for (const u of acUnits) {
      const v = anim[u.channel];
      u.mat.opacity = 0.55 * v;
      u.pts.visible = v > 0.01;
      if (!u.pts.visible) continue;
      for (let i = 0; i < u.seed.length; i++) {
        const [a, b, c] = u.seed[i];
        const p = (t * 0.3 + a) % 1;
        u.pos[i * 3] = u.x - 0.38 + b * 0.76 + Math.sin(t * 1.3 + c * 6) * 0.04;
        u.pos[i * 3 + 1] = F + 2.0 - p * 0.55 - p * p * 0.45;
        u.pos[i * 3 + 2] = -3.16 + p * 1.7;
      }
      u.geo.attributes.position.needsUpdate = true;
    }

    sprayMat.opacity = 0.85 * anim.riego;
    spray.visible = anim.riego > 0.01;
    if (spray.visible) {
      heads.forEach(([hx, hz], h) => {
        for (let i = 0; i < perHead; i++) {
          const idx = h * perHead + i;
          const [a, b, c] = wSeed[idx];
          const life = (t * 0.8 + a) % 1;
          const stream = i % 3;
          const ang = t * 0.9 * (stream === 1 ? -1 : 1) + h * 2.1 + stream * 2.09 + (b - 0.5) * 0.35;
          const speed = 3.1 + c * 0.9;
          const tt = life * 0.8;
          const r = speed * 0.72 * tt;
          const y = speed * 0.72 * tt - 4.9 * tt * tt;
          wPos[idx * 3] = hx + Math.cos(ang) * r;
          wPos[idx * 3 + 1] = Math.max(0.02, 0.08 + y);
          wPos[idx * 3 + 2] = hz + Math.sin(ang) * r;
        }
      });
      waterGeo.attributes.position.needsUpdate = true;
    }
    tex.water.offset.set(Math.sin(t * 0.2) * 0.05, t * 0.02);

    const markerScale = view ? Math.max(0.55, Math.min(1.2, view.hh / 6)) : 1;
    for (const m of markers) {
      const v = anim[m.channel];
      const p = (t * 0.7 + m.phase) % 1;
      m.dot.material.opacity = 0.95 * v;
      m.ring.material.opacity = (1 - p) * 0.9 * v;
      const r = (0.25 + p * 0.75) * markerScale;
      m.ring.scale.set(r, r, 1);
      m.dot.scale.set(0.6 * markerScale, 0.6 * markerScale, 1);
      m.dot.visible = m.ring.visible = v > 0.01;
    }
    for (const [room, g] of Object.entries(highlights)) {
      g.visible = room === highlighted;
    }
    highlightMat.opacity = 0.16 + 0.08 * Math.sin(t * 2.4);
    applyTime();
  }

  function continuous() {
    return anim.climaLiving > 0.01 || anim.climaDormitorio > 0.01 || anim.alarma > 0.01 || anim.riego > 0.01
      || highlighted !== null || markers.some((m) => anim[m.channel] > 0.01);
  }

  const projected = new THREE.Vector3();
  function labels() {
    const out = {};
    for (const [k, v] of Object.entries(anchors)) {
      projected.copy(v).project(camera);
      out[k] = { x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height, visible: projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05 };
    }
    return out;
  }

  let running = false, raf = 0, last = 0, clock = 0, dirty = true, lastDraw = 0;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    clock += dt;
    if (running) raf = requestAnimationFrame(frame);
    let moving = stepTween(now);
    for (const c of CHANNELS) {
      const target = state[c];
      const speed = c === 'puerta' ? 1.6 : 2.2;
      if (Math.abs(anim[c] - target) > 0.001) {
        anim[c] += Math.sign(target - anim[c]) * Math.min(Math.abs(target - anim[c]), dt * speed);
        moving = true;
      } else anim[c] = target;
    }
    // los efectos continuos se dibujan a ~30 cuadros por segundo para cuidar la batería
    const idleEffect = !moving && !dirty && continuous() && now - lastDraw > 32;
    if (moving || dirty || idleEffect) {
      applyState(clock);
      renderer.render(scene, camera);
      if (opts.onFrame) opts.onFrame(labels());
      dirty = false;
      lastDraw = now;
    }
  }

  function renderNow() {
    applyState(clock);
    renderer.render(scene, camera);
    if (opts.onFrame) opts.onFrame(labels());
  }

  function settle() {
    if (!running) {
      for (const c of CHANNELS) anim[c] = state[c];
      if (tween) { view = tween.to; tween = null; setupCamera(); }
      renderNow();
    }
  }

  return {
    state,
    set(key, value) {
      assign(key, value);
      dirty = true;
      settle();
    },
    setMany(values) {
      for (const [k, v] of Object.entries(values)) assign(k, v);
      dirty = true;
      settle();
    },
    setTime(minutes) {
      timeOfDay = minutes;
      dirty = true;
      if (!running) renderNow();
    },
    focus(name, animate = true) {
      const next = PRESETS[name];
      if (!next || next.type !== 'ortho' || preset.type !== 'ortho') return;
      const to = viewFor(next);
      if (animate && view && running) tween = { from: view, to, t0: performance.now(), dur: 900 };
      else { tween = null; view = to; }
      preset = next;
      applyView(view);
      dirty = true;
      if (!running) renderNow();
    },
    highlight(room) {
      highlighted = room && highlights[room] ? room : null;
      dirty = true;
      if (!running) renderNow();
    },
    setParallax(x, y) {
      parallax.x = x;
      parallax.y = y;
      if (view) applyView(view);
      dirty = true;
    },
    setPreset(name) {
      preset = PRESETS[name] || PRESETS.hero;
      tween = null;
      setupCamera();
      dirty = true;
    },
    resize(w, h) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      renderer.setSize(width, height, false);
      tween = null;
      setupCamera();
      dirty = true;
      if (!running) renderNow();
    },
    labels,
    start() {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    renderStill(t = 2.0) {
      for (const c of CHANNELS) anim[c] = state[c];
      clock = t;
      renderNow();
    },
    dispose() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      Object.values(tex).forEach((t) => t.dispose());
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
    renderer,
  };
}
