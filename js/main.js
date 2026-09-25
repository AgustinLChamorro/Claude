// i2home — interacción del sitio

const CONFIG = {
  // Número de WhatsApp con código de país, sin "+" ni espacios. Ej.: '5491122334455'.
  // Mientras esté vacío, los botones de WhatsApp abren la app para elegir el contacto.
  whatsapp: '',
};

const waUrl = (text = '') =>
  `https://wa.me/${CONFIG.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- encabezado y menú ----------
const header = document.getElementById('header');
const menuBtn = header.querySelector('.menu-btn');

const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

function setMenu(open) {
  header.classList.toggle('is-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
}
menuBtn.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));
header.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && header.classList.contains('is-open')) {
    setMenu(false);
    menuBtn.focus();
  }
});

// ---------- WhatsApp flotante ----------
if (CONFIG.whatsapp) {
  const float = document.getElementById('wa-float');
  float.href = waUrl('Hola i2home, quiero consultar por domótica para mi casa.');
  float.target = '_blank';
  float.rel = 'noopener';
}

// ---------- la casa 3D ----------
const DEVICE_LABELS = {
  luces: 'Living · 80 %',
  clima: 'Dormitorio · 22 °C',
  cortinas: 'Cortinas · bajas',
  accesos: 'Puerta · abierta',
  alarma: 'Cámara · grabando',
  riego: 'Riego · zona 1',
};
const DEVICE_NAMES = {
  luces: 'Luces', clima: 'Clima', cortinas: 'Cortinas', accesos: 'Puerta', alarma: 'Alarma', riego: 'Riego',
};
const SCENES = {
  llegada: { luces: true, clima: true, cortinas: false, accesos: true, alarma: false, riego: false },
  noche: { luces: false, clima: true, cortinas: true, accesos: false, alarma: true, riego: false },
};
const SCENE_NAMES = { llegada: 'Llegué a casa', noche: 'Buenas noches' };

const stage = document.getElementById('stage');
const canvas = document.getElementById('casa');
const labelsEl = document.getElementById('labels');
const dock = document.getElementById('dock');
const announce = document.getElementById('announce');
const tiles = [...dock.querySelectorAll('.tile')];
const state = Object.fromEntries(tiles.map((t) => [t.dataset.device, t.getAttribute('aria-pressed') === 'true']));

const labelNodes = {};
for (const [key, text] of Object.entries(DEVICE_LABELS)) {
  const el = document.createElement('span');
  el.className = 'label';
  el.dataset.device = key;
  el.innerHTML = '<i></i>';
  el.append(text);
  labelsEl.append(el);
  labelNodes[key] = el;
}

function drawLabels(pos) {
  for (const [key, el] of Object.entries(labelNodes)) {
    const p = pos[key];
    el.classList.toggle('is-on', !!state[key] && p.visible);
    el.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y - 12).toFixed(1)}px) translate(-50%, -100%)`;
  }
}

function syncTile(tile) {
  const on = !!state[tile.dataset.device];
  tile.setAttribute('aria-pressed', String(on));
  const s = tile.querySelector('.tile-state');
  s.textContent = on ? s.dataset.on : s.dataset.off;
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function initCasa() {
  if (!hasWebGL()) {
    dock.hidden = true;
    return;
  }
  let casa;
  try {
    const { createCasa } = await import('./casa3d.js');
    casa = createCasa(canvas, { state: { ...state }, onFrame: drawLabels });
  } catch (err) {
    console.warn('No se pudo iniciar la casa 3D', err);
    dock.hidden = true;
    return;
  }

  const size = () => {
    const r = stage.getBoundingClientRect();
    casa.resize(r.width, r.height);
  };
  size();
  new ResizeObserver(size).observe(stage);
  requestAnimationFrame(() => stage.classList.add('is-live'));

  // animar solo cuando la casa está a la vista
  let visible = true;
  const updateLoop = () => {
    if (!reduceMotion && visible && !document.hidden) casa.start();
    else casa.stop();
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateLoop();
  }).observe(stage);
  document.addEventListener('visibilitychange', updateLoop);

  const apply = (key, value) => {
    state[key] = value;
    casa.set(key, value);
    const tile = tiles.find((t) => t.dataset.device === key);
    if (tile) syncTile(tile);
  };

  tiles.forEach((tile) =>
    tile.addEventListener('click', () => {
      const key = tile.dataset.device;
      apply(key, !state[key]);
      const s = tile.querySelector('.tile-state').textContent;
      announce.textContent = `${DEVICE_NAMES[key]}: ${s}`;
    }),
  );

  dock.querySelectorAll('.scene-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      const scene = SCENES[btn.dataset.scene];
      for (const [key, value] of Object.entries(scene)) apply(key, value);
      announce.textContent = `Escena ${SCENE_NAMES[btn.dataset.scene]} activada`;
    }),
  );

  // leve movimiento de cámara con el mouse
  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    let ticking = false;
    const ease = () => {
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      casa.setParallax(cur.x, cur.y);
      if (Math.abs(target.x - cur.x) > 0.002 || Math.abs(target.y - cur.y) > 0.002) requestAnimationFrame(ease);
      else ticking = false;
    };
    document.querySelector('.hero').addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      target.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(ease);
      }
    });
  }
}
initCasa();

// ---------- formulario ----------
const form = document.getElementById('form');
const result = document.getElementById('form-result');
const resultText = document.getElementById('f-resultado');
const waLink = document.getElementById('wa-link');
const copyBtn = document.getElementById('copy-btn');

function fieldCheck(input, errorId) {
  const ok = input.value.trim().length > 0;
  input.setAttribute('aria-invalid', String(!ok));
  document.getElementById(errorId).hidden = ok;
  return ok;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const nombre = form.elements.nombre;
  const contacto = form.elements.contacto;
  const okNombre = fieldCheck(nombre, 'e-nombre');
  const okContacto = fieldCheck(contacto, 'e-contacto');
  if (!okNombre || !okContacto) {
    (okNombre ? contacto : nombre).focus();
    return;
  }
  const intereses = [...form.querySelectorAll('input[name="interes"]:checked')].map((i) => i.value);
  const mensaje = form.elements.mensaje.value.trim();
  const texto = [
    `Hola i2home, soy ${nombre.value.trim()}.`,
    `Me interesa: ${intereses.length ? intereses.join(', ') : 'domotizar mi casa'}.`,
    mensaje,
    `Mi contacto: ${contacto.value.trim()}.`,
  ].filter(Boolean).join('\n');

  resultText.value = texto;
  waLink.href = waUrl(texto);
  result.hidden = false;
  result.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
});

['nombre', 'contacto'].forEach((name) =>
  form.elements[name].addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true') fieldCheck(e.target, `e-${name}`);
  }),
);

copyBtn.addEventListener('click', async () => {
  const label = copyBtn.querySelector('span');
  try {
    await navigator.clipboard.writeText(resultText.value);
    label.textContent = 'Copiado';
  } catch {
    resultText.focus();
    resultText.select();
    label.textContent = 'Seleccionado: copialo con Ctrl+C';
  }
  setTimeout(() => (label.textContent = 'Copiar mensaje'), 2500);
});
