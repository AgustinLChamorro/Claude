// Casa i2home: diorama 3D de una casa de noche, con dispositivos que se
// encienden y apagan. Se usa en vivo en el inicio del sitio y también para
// renderizar las imágenes fijas de cada servicio (tools/render-stills.mjs).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const F = 0.12; // nivel del piso interior (losa)
const T = 0.16; // espesor de muros
const H = 2.6; // altura de muros completos
const L = 1.0; // altura de muros cortados

const WARM = 0xffb877;
const TEAL = 0x5fc4ff; // estados activos, en la familia de azules de la marca

export const DEVICES = ['luces', 'cortinas', 'clima', 'accesos', 'alarma', 'riego'];

export const PRESETS = {
  hero: { type: 'ortho', az: 34, el: 36, target: [1.2, 0.2, 1.2], margin: 1.06 },
  plano: { type: 'ortho', az: 0, el: 89.9, target: [1, 0, 1], margin: 1.0 },
  amplia: { type: 'persp', pos: [10.5, 3.6, 12.5], target: [0.4, 0.9, 0.8], fov: 36 },
  iluminacion: { type: 'persp', pos: [0.9, 2.7, 2.9], target: [-3.4, 0.9, -1.1], fov: 52 },
  clima: { type: 'persp', pos: [2.6, 2.3, 1.9], target: [2.0, 1.3, -3.2], fov: 44 },
  seguridad: { type: 'persp', pos: [8.5, 3.6, 10.5], target: [3.2, 0.8, 4.2], fov: 36 },
  accesos: { type: 'persp', pos: [3.4, 1.9, 7.6], target: [0.5, 1.1, 3.6], fov: 36 },
  cortinas: { type: 'persp', pos: [-1.2, 2.2, 1.6], target: [-3.0, 1.4, -3.4], fov: 46 },
  cocina: { type: 'persp', pos: [4.1, 2.15, 3.35], target: [1.6, 0.95, 0.9], fov: 50 },
  riego: { type: 'persp', pos: [-0.4, 1.5, 7.8], target: [-3.2, 0.5, 4.6], fov: 48 },
};

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
  return { wood, tile, grass, rug, rugBlue, water, glow, blob };
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

  // ---------- luces agrupadas por dispositivo ----------
  const lamps = { luces: [], clima: [], alarma: [], accesos: [] };
  function lamp(group, pos, color, intensity, distance = 6) {
    const light = new THREE.PointLight(color, 0, distance, 2);
    light.position.set(...pos);
    root.add(light);
    const entry = { light, base: intensity, mats: [], sprites: [] };
    lamps[group].push(entry);
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

  // ---------- ambiente de noche ----------
  scene.add(new THREE.HemisphereLight(0x4a6a8f, 0x0e141a, 0.9));
  const moon = new THREE.DirectionalLight(0xa8bcff, 1.1);
  moon.position.set(-7, 14, 9);
  moon.target.position.set(1, 0, 1);
  moon.castShadow = true;
  moon.shadow.mapSize.set(opts.shadowSize, opts.shadowSize);
  Object.assign(moon.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.03;
  moon.shadow.radius = 3;
  scene.add(moon, moon.target);

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

  // ventanas: vidrio, marcos, cortinas
  const blinds = [];
  function windowOn(win, mullions) {
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
    // cortina roller: cassette + paño que baja desde arriba
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
    blinds.push({ pivot, panel, bar, hgt });
  }
  windowOn(LIVING_WIN, 2);
  windowOn(BED_WIN, 0);

  // ---------- living ----------
  // revestimiento de listones y TV sobre el muro izquierdo
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
  rb(0.08, 0.34, 0.08, 0.02, M.black, -4.62, F + 0.48, 1.55); // parlante

  // alfombra, sofá, mesa
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
  // sillón junto a la ventana
  rb(0.8, 0.36, 0.8, 0.08, M.fabricLight, -3.6, F + 0.08, -2.45).rotation.y = 0.5;
  rb(0.8, 0.5, 0.18, 0.07, M.fabricLight, -3.82, F + 0.4, -2.78).rotation.y = 0.5;

  // planta en la esquina
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

  // lámpara de pie del living
  const floorLamp = lamp('luces', [-1.2, F + 1.35, -1.45], WARM, 7, 7);
  cyl(0.15, 0.15, 0.03, M.black, -1.2, F, -1.45);
  cyl(0.012, 0.012, 1.3, M.black, -1.2, F, -1.45);
  cyl(0.17, 0.21, 0.3, emissiveMat('#f3e3c8', WARM, 2.2, floorLamp), -1.2, F + 1.25, -1.45);
  addGlow(floorLamp, [-1.2, F + 1.4, -1.45], 1.6, WARM, 0.55);

  // mesa auxiliar con velador
  const sideLamp = lamp('luces', [-1.5, F + 0.95, 2.15], WARM, 3.5, 5);
  cyl(0.2, 0.2, 0.5, M.oak, -1.5, F, 2.15);
  cyl(0.05, 0.07, 0.2, M.black, -1.5, F + 0.5, 2.15);
  cyl(0.11, 0.14, 0.18, emissiveMat('#f3e3c8', WARM, 2.2, sideLamp), -1.5, F + 0.7, 2.15);
  addGlow(sideLamp, [-1.5, F + 0.8, 2.15], 1.0, WARM, 0.5);

  // luz de cortesía (tira LED) en lo alto del muro trasero e izquierdo
  const cove = lamp('luces', [-3.2, F + 2.2, -3.05], WARM, 5, 6);
  const cove2 = lamp('luces', [-4.55, F + 2.2, 0.4], WARM, 4, 6);
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
    const l = lamp('luces', [nx, F + 0.85, -3.1], WARM, 2.6, 4);
    cyl(0.05, 0.07, 0.18, M.black, nx, F + 0.5, -3.19);
    cyl(0.1, 0.13, 0.17, emissiveMat('#f3e3c8', WARM, 2.2, l), nx, F + 0.68, -3.19);
    addGlow(l, [nx, F + 0.78, -3.19], 0.9, WARM, 0.5);
  }

  // aire acondicionado (split) sobre la cama
  const ac = lamp('clima', [2.0, F + 1.9, -2.9], TEAL, 1.6, 3.5);
  rb(0.95, 0.3, 0.24, 0.05, M.white, 2.0, F + 2.02, -3.3);
  bx(1.58, 2.42, F + 2.03, F + 2.06, -3.19, -3.175, M.frame, false);
  bx(2.22, 2.38, F + 2.16, F + 2.2, -3.185, -3.17, emissiveMat('#1a2a2a', TEAL, 4, ac), false);
  const airCount = 70;
  const airGeo = new THREE.BufferGeometry();
  const airPos = new Float32Array(airCount * 3);
  const airSeed = Array.from({ length: airCount }, () => [rnd(), rnd(), rnd()]);
  airGeo.setAttribute('position', new THREE.BufferAttribute(airPos, 3));
  const airMat = new THREE.PointsMaterial({ color: 0xa9dcff, map: tex.glow, size: 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const air = new THREE.Points(airGeo, airMat);
  air.frustumCulled = false;
  root.add(air);

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
  // tira LED bajo la isla
  const islandLed = lamp('luces', [2.3, F + 0.5, 1.9], WARM, 1.6, 2.5);
  bx(2.48, 2.5, F + 0.8, F + 0.83, 1.0, 2.8, emissiveMat('#fff3e0', WARM, 3, islandLed), false);
  // colgantes sobre la isla
  for (const pz of [1.45, 2.35]) {
    const l = lamp('luces', [2.9, F + 1.45, pz], WARM, 4, 5);
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
  const panel = lamp('accesos', [1.3, F + 1.25, 3.2], 0x8fc2ff, 0.3, 1.2);
  bx(1.22, 1.38, F + 1.16, F + 1.34, 3.405, 3.42, emissiveMat('#0c1216', 0x8fc2ff, 1.6, panel), false);
  // umbral, alero y aplique exterior
  bx(-0.25, 1.45, 0, F, 3.58, 4.0, M.stone);
  bx(-0.4, 1.6, F + 2.28, F + 2.36, 3.42, 4.32, M.cap);
  const porch = lamp('luces', [1.34, F + 1.9, 3.85], WARM, 3, 5);
  bx(1.3, 1.38, F + 1.8, F + 2.0, 3.58, 3.64, emissiveMat('#f5ead6', WARM, 3, porch), false);
  addGlow(porch, [1.34, F + 1.9, 3.7], 1.1, WARM, 0.6);

  // ---------- jardín ----------
  for (let z = 4.1; z < 7.1; z += 0.62) bx(0.12, 1.08, 0, 0.03, z, z + 0.42, M.stone, false);
  for (const [bxp, bzp] of [[-0.3, 4.7], [1.5, 4.7], [-0.3, 6.3], [1.5, 6.3]]) {
    cyl(0.045, 0.05, 0.46, M.black, bxp, 0, bzp, 16);
  }
  const path1 = lamp('luces', [0.6, 0.55, 4.7], WARM, 1.5, 3);
  const path2 = lamp('luces', [0.6, 0.55, 6.3], WARM, 1.5, 3);
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
  const uplight = lamp('luces', [-5.1, 0.25, 5.4], WARM, 3.5, 4);
  addGlow(uplight, [-5.1, 0.12, 5.4], 0.6, WARM, 0.6);
  for (let x = -6.3; x < -0.9; x += 0.55) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26 + rnd() * 0.1, 1), M.leafDark);
    place(m, x, 0.2, 7.0 + (rnd() - 0.5) * 0.1);
  }

  // cantero de huerta
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
  const pool = lamp('luces', [6.9, 0.35, -0.7], 0x4fd6e8, 4, 5);
  const waterMat = std('#ffffff', 0.08, { map: tex.water, emissive: 0x1aa6c0, emissiveIntensity: 0, emissiveMap: tex.water });
  pool.mats.push({ m: waterMat, base: 1.4 });
  floor(5.85, 7.95, -2.95, 1.55, waterMat, 2.2, 0.025);
  addGlow(pool, [6.9, 0.1, -0.7], 4.2, 0x4fd6e8, 0.16);
  // reposeras
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

  // ---------- etiquetas (anclas en 3D para la interfaz) ----------
  const anchors = {
    luces: new THREE.Vector3(-2.4, F + 2.0, 0.2),
    clima: new THREE.Vector3(2.0, F + 2.75, -3.3),
    accesos: new THREE.Vector3(0.6, F + 2.75, 3.9),
    alarma: new THREE.Vector3(5.4, 3.05, 3.9),
    riego: new THREE.Vector3(-3.1, 0.9, 5.3),
    cortinas: new THREE.Vector3(-3.0, F + 2.75, -3.45),
  };

  // ---------- cámara ----------
  let camera;
  let preset = PRESETS[opts.preset] || PRESETS.hero;
  const parallax = { x: 0, y: 0 };
  const fitPoints = [];
  for (const x of [-6.7, 8.7]) for (const z of [-5.4, 7.4]) for (const y of [-0.8, 0]) fitPoints.push(new THREE.Vector3(x, y, z));
  fitPoints.push(new THREE.Vector3(0.6, 3.1, 3.9), new THREE.Vector3(-5.4, 3.0, 5.9), new THREE.Vector3(-5, 3.1, -3.5), new THREE.Vector3(7.9, 2.9, -4.5));

  let width = 1, height = 1;
  function setupCamera() {
    const aspect = width / height;
    if (preset.type === 'ortho') {
      if (!camera || !camera.isOrthographicCamera) camera = new THREE.OrthographicCamera();
      const az = THREE.MathUtils.degToRad(preset.az + parallax.x * 4);
      const el = THREE.MathUtils.degToRad(Math.min(89.9, preset.el + parallax.y * 2));
      const target = new THREE.Vector3(...preset.target);
      const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      camera.position.copy(target).addScaledVector(dir, 40);
      camera.up.set(0, 1, 0);
      if (preset.el > 89) camera.up.set(0, 0, -1);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const v = new THREE.Vector3();
      for (const p of fitPoints) {
        v.copy(p).applyMatrix4(camera.matrixWorldInverse);
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      }
      let hw = ((maxX - minX) / 2) * preset.margin, hh = ((maxY - minY) / 2) * preset.margin;
      if (hw / hh < aspect) hw = hh * aspect; else hh = hw / aspect;
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      Object.assign(camera, { left: cx - hw, right: cx + hw, top: cy + hh, bottom: cy - hh, near: 1, far: 90 });
      camera.updateProjectionMatrix();
      airMat.size = 3.2 * renderer.getPixelRatio() * Math.max(0.6, height / 800);
      sprayMat.size = 4 * renderer.getPixelRatio() * Math.max(0.6, height / 800);
      airMat.sizeAttenuation = sprayMat.sizeAttenuation = false;
    } else {
      if (!camera || !camera.isPerspectiveCamera) camera = new THREE.PerspectiveCamera();
      camera.fov = preset.fov;
      camera.aspect = aspect;
      camera.near = 0.1;
      camera.far = 120;
      camera.position.set(...preset.pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(new THREE.Vector3(...preset.target));
      camera.updateProjectionMatrix();
      airMat.size = sprayMat.size = 0.07;
      airMat.sizeAttenuation = sprayMat.sizeAttenuation = true;
    }
    airMat.needsUpdate = sprayMat.needsUpdate = true;
  }

  // ---------- estado y animación ----------
  const state = { luces: true, cortinas: false, clima: true, accesos: false, alarma: false, riego: false, ...opts.state };
  const anim = {};
  const level = (k) => (typeof state[k] === 'number' ? state[k] : state[k] ? 1 : 0);
  for (const k of DEVICES) anim[k] = level(k);
  if (opts.intro) anim.luces = 0;

  const lockClosed = new THREE.Color(TEAL), lockOpen = new THREE.Color(0xffb35c);
  const aimDir = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);

  function applyState(t) {
    for (const e of lamps.luces) setLevel(e, anim.luces);
    for (const b of blinds) {
      const s = 0.04 + 0.96 * anim.cortinas;
      b.panel.scale.y = s;
      b.panel.position.y = (-b.hgt * s) / 2;
      b.bar.position.y = -b.hgt * s;
    }
    for (const e of lamps.clima) setLevel(e, anim.clima);
    for (const e of lamps.accesos) setLevel(e, 1);
    doorPivot.rotation.y = 1.25 * anim.accesos;
    lockLedMat.emissive.copy(lockClosed).lerp(lockOpen, anim.accesos);
    for (const e of lamps.alarma) setLevel(e, anim.alarma);
    coneMat.opacity = 0.22 * anim.alarma;
    cone.visible = anim.alarma > 0.01;
    const sweep = Math.sin(t * 0.6) * 0.45;
    aimDir.copy(camAim).sub(camHead.position);
    aimDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), sweep * anim.alarma).normalize();
    camHead.lookAt(camHead.position.clone().add(aimDir));
    cone.quaternion.setFromUnitVectors(down, aimDir);

    // flujo de aire del split
    airMat.opacity = 0.55 * anim.clima;
    air.visible = anim.clima > 0.01;
    if (air.visible) {
      for (let i = 0; i < airCount; i++) {
        const [a, b, c] = airSeed[i];
        const p = (t * 0.3 + a) % 1;
        airPos[i * 3] = 1.62 + b * 0.76 + Math.sin(t * 1.3 + c * 6) * 0.04;
        airPos[i * 3 + 1] = F + 2.0 - p * 0.55 - p * p * 0.45;
        airPos[i * 3 + 2] = -3.16 + p * 1.7;
      }
      airGeo.attributes.position.needsUpdate = true;
    }

    // riego: arcos de agua
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
  }

  // efectos que necesitan animarse aunque nadie toque nada
  function continuous() {
    return anim.clima > 0.01 || anim.alarma > 0.01 || anim.riego > 0.01;
  }

  const projected = new THREE.Vector3();
  function labels() {
    const out = {};
    for (const [k, v] of Object.entries(anchors)) {
      projected.copy(v).project(camera);
      out[k] = { x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height, visible: projected.z < 1 };
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
    let moving = false;
    for (const k of DEVICES) {
      const target = level(k);
      const speed = k === 'luces' && opts.intro ? 1.1 : 2.2;
      if (Math.abs(anim[k] - target) > 0.001) {
        anim[k] += Math.sign(target - anim[k]) * Math.min(Math.abs(target - anim[k]), dt * speed);
        moving = true;
      } else anim[k] = target;
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

  function resize(w, h) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    renderer.setSize(width, height, false);
    setupCamera();
    dirty = true;
    if (!running) renderNow();
  }

  function renderNow() {
    applyState(clock);
    renderer.render(scene, camera);
    if (opts.onFrame) opts.onFrame(labels());
  }

  return {
    state,
    set(key, value) {
      state[key] = typeof value === 'number' ? value : !!value;
      dirty = true;
      if (!running) {
        for (const k of DEVICES) anim[k] = level(k);
        renderNow();
      }
    },
    setParallax(x, y) {
      parallax.x = x;
      parallax.y = y;
      setupCamera();
      dirty = true;
    },
    setPreset(name) {
      preset = PRESETS[name] || PRESETS.hero;
      setupCamera();
      dirty = true;
    },
    resize,
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
      for (const k of DEVICES) anim[k] = level(k);
      clock = t;
      renderNow();
    },
    renderer,
  };
}
