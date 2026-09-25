// i2home — interacción del sitio

const CONFIG = {
  // Número de WhatsApp con código de país, sin "+" ni espacios. Ej.: '5491122334455'.
  // Mientras esté vacío, los botones de WhatsApp abren la app para elegir el contacto.
  whatsapp: '',
};

const waUrl = (text = '') =>
  `https://wa.me/${CONFIG.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#${name}"/></svg>`;
const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.round(min) % 60).padStart(2, '0')}`;

// ---------- encabezado y menú ----------
const header = $('header');
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

if (CONFIG.whatsapp) {
  const float = $('wa-float');
  float.href = waUrl('Hola i2home, quiero consultar por domótica para mi casa.');
  float.target = '_blank';
  float.rel = 'noopener';
}

// ---------- casa 3D: montaje compartido ----------
let casaModule = null;
const loadCasa = () => (casaModule ||= import('./casa3d.js'));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
const webgl = hasWebGL();

// crea la escena cuando el bloque se acerca a la pantalla
function whenNear(el, cb) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      cb();
    }
  }, { rootMargin: '500px 0px' });
  io.observe(el);
}

async function mountCasa(wrap, canvas, options) {
  const { createCasa } = await loadCasa();
  const casa = createCasa(canvas, options);
  const size = () => {
    const r = wrap.getBoundingClientRect();
    casa.resize(r.width, r.height);
  };
  size();
  new ResizeObserver(size).observe(wrap);
  requestAnimationFrame(() => wrap.classList.add('is-live'));
  let visible = false;
  const update = () => {
    if (!reduceMotion && visible && !document.hidden) casa.start();
    else casa.stop();
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(wrap);
  document.addEventListener('visibilitychange', update);
  return casa;
}

// etiquetas flotantes sobre la escena
function labelLayer(container, keys) {
  const nodes = {};
  for (const key of keys) {
    const el = document.createElement('span');
    el.className = 'label';
    el.dataset.device = key;
    el.innerHTML = '<i></i><span></span>';
    container.append(el);
    nodes[key] = el;
  }
  return (pos, textFor) => {
    for (const [key, el] of Object.entries(nodes)) {
      const p = pos[key];
      const text = textFor(key);
      el.classList.toggle('is-on', !!text && p.visible);
      if (text) el.lastChild.textContent = text;
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y - 12).toFixed(1)}px) translate(-50%, -100%)`;
    }
  };
}

// ---------- inicio: la casa que se controla con los botones ----------
(function hero() {
  const LABELS = {
    luces: 'Living · 80 %',
    clima: 'Dormitorio · 22 °C',
    cortinas: 'Cortinas · bajas',
    accesos: 'Puerta · abierta',
    alarma: 'Cámara · grabando',
    riego: 'Riego · zona 1',
  };
  const NAMES = { luces: 'Luces', clima: 'Clima', cortinas: 'Cortinas', accesos: 'Puerta', alarma: 'Alarma', riego: 'Riego' };
  const SCENES = {
    llegada: { luces: true, clima: true, cortinas: false, accesos: true, alarma: false, riego: false },
    noche: { luces: false, clima: true, cortinas: true, accesos: false, alarma: true, riego: false },
  };
  const SCENE_NAMES = { llegada: 'Llegué a casa', noche: 'Buenas noches' };

  const wrap = $('stage');
  const dock = $('dock');
  const announce = $('announce');
  const tiles = [...dock.querySelectorAll('.tile')];
  const state = Object.fromEntries(tiles.map((t) => [t.dataset.device, t.getAttribute('aria-pressed') === 'true']));
  const draw = labelLayer($('labels'), Object.keys(LABELS));

  const syncTile = (tile) => {
    const on = !!state[tile.dataset.device];
    tile.setAttribute('aria-pressed', String(on));
    const s = tile.querySelector('.tile-state');
    s.textContent = on ? s.dataset.on : s.dataset.off;
  };

  if (!webgl) {
    dock.hidden = true;
    return;
  }
  mountCasa(wrap, $('casa'), {
    state: { ...state },
    onFrame: (pos) => draw(pos, (k) => (state[k] ? LABELS[k] : '')),
  }).then((casa) => {
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
        announce.textContent = `${NAMES[key]}: ${tile.querySelector('.tile-state').textContent}`;
      }),
    );
    dock.querySelectorAll('.scene-btn').forEach((btn) =>
      btn.addEventListener('click', () => {
        for (const [key, value] of Object.entries(SCENES[btn.dataset.scene])) apply(key, value);
        announce.textContent = `Escena ${SCENE_NAMES[btn.dataset.scene]} activada`;
      }),
    );

    // leve movimiento de cámara con el mouse
    if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
      const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
      let ticking = false;
      const easeStep = () => {
        cur.x += (target.x - cur.x) * 0.08;
        cur.y += (target.y - cur.y) * 0.08;
        casa.setParallax(cur.x, cur.y);
        if (Math.abs(target.x - cur.x) > 0.002 || Math.abs(target.y - cur.y) > 0.002) requestAnimationFrame(easeStep);
        else ticking = false;
      };
      document.querySelector('.hero').addEventListener('pointermove', (e) => {
        const r = wrap.getBoundingClientRect();
        target.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
        target.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(easeStep);
        }
      });
    }
  }).catch((err) => {
    console.warn('No se pudo iniciar la casa 3D', err);
    dock.hidden = true;
  });
})();

// ---------- un día con i2home ----------
(function dayTimeline() {
  const SUNRISE = 6 * 60 + 50, SUNSET = 19 * 60 + 10;
  // de medianoche: alarma activada, cortinas bajas, aire del dormitorio y el camino del jardín tenue
  const BASE = { luces: 0, cortinas: 1, clima: 0, climaDormitorio: 1, alarma: 1, puerta: 0, riego: 0, luzExterior: 0.3 };
  const EVENTS = [
    { t: 390, icon: 'i-drop', title: 'Riego inteligente', text: 'No llovió en las últimas 24 horas: arranca el riego por zonas.', set: { riego: 1 } },
    { t: 410, icon: 'i-sun', title: 'Amanecer', text: 'Se apagan las luces del jardín.', set: { luzExterior: 0 } },
    { t: 415, icon: 'i-check', title: 'Riego terminado', text: 'Te llega un aviso al celular: 3 zonas regadas.', set: { riego: 0 } },
    { t: 420, icon: 'i-sun', title: 'Buenos días', text: 'Sube la cortina del dormitorio y la luz se prende al 40 %.', set: { cortinaDormitorio: 0, luzDormitorio: 0.4, climaDormitorio: 0 } },
    { t: 450, icon: 'i-blinds', title: 'Entra la luz del día', text: 'Suben las cortinas del living.', set: { cortinaLiving: 0, luzCocina: 0.8 } },
    { t: 495, icon: 'i-lock', title: 'Me voy de casa', text: 'Cerraste con llave: se apagan las luces y el aire, y se activa la alarma.', set: { luces: 0, clima: 0, alarma: 1 } },
    { t: 790, icon: 'i-cam', title: 'Movimiento en el jardín', text: 'La cámara detectó movimiento y te mandó una foto al celular.', set: {} },
    { t: 1095, icon: 'i-thermo', title: 'Estás llegando', text: 'Tu celular avisa que estás a 10 minutos: el aire del living se pone en 23 °C.', set: { climaLiving: 1 } },
    { t: 1110, icon: 'i-door', title: 'Llegué a casa', text: 'Abriste con la cerradura: se desactiva la alarma y se prende la luz de entrada.', set: { puerta: 1, alarma: 0, luzEntrada: 1 } },
    { t: 1114, silent: true, set: { puerta: 0 } },
    { t: 1150, icon: 'i-sun', title: 'Atardecer', text: 'Se encienden el jardín, la pileta y el living al 70 %.', set: { luzExterior: 1, luzPileta: 1, luzLiving: 0.7 } },
    { t: 1170, icon: 'i-blinds', title: 'Cae la noche', text: 'Bajan las cortinas del living y del dormitorio.', set: { cortinaLiving: 1, cortinaDormitorio: 1 } },
    { t: 1230, icon: 'i-bulb', title: 'Escena «Cena»', text: 'Tocaste el panel: cocina al 100 % y living al 40 %.', set: { luzCocina: 1, luzLiving: 0.4 } },
    { t: 1350, icon: 'i-thermo', title: 'Preparando el dormitorio', text: 'El aire del dormitorio se prende en 22 °C.', set: { climaDormitorio: 1, luzDormitorio: 0.5 } },
    { t: 1410, icon: 'i-moon', title: 'Buenas noches', text: 'Se apagan las luces, la puerta queda con llave y se activa la alarma perimetral.', set: { luces: 0, luzExterior: 0.3, climaLiving: 0, alarma: 1 } },
  ];
  const SKY = [
    [0, '#070d22', '#131e3d'], [360, '#0b1330', '#1d2d5c'], [405, '#3b4a86', '#f3a37a'], [450, '#6aaaf6', '#cfe6ff'],
    [720, '#4f9bff', '#d6ebff'], [1080, '#6aa6f5', '#e2efff'], [1140, '#4c4f93', '#f59a6b'], [1185, '#1b2455', '#3a3f7a'],
    [1260, '#0b1330', '#1d2d5c'], [1440, '#070d22', '#131e3d'],
  ];

  const section = $('un-dia');
  const stageEl = $('day-stage');
  const wrap = $('day-canvas-wrap');
  const slider = $('day-slider');
  const timeEl = $('day-time');
  const phaseEl = $('day-phase');
  const playBtn = $('day-play');
  const logbook = $('logbook');
  const orb = $('day-orb');
  const ticksEl = $('day-ticks');
  const visibleEvents = EVENTS.filter((e) => !e.silent);

  for (const e of visibleEvents) {
    const tick = document.createElement('span');
    tick.style.left = `${(e.t / 1439) * 100}%`;
    tick.title = `${hhmm(e.t)} · ${e.title}`;
    ticksEl.append(tick);
  }
  const tickNodes = [...ticksEl.children];

  const stateAt = (t) => {
    const s = { ...BASE };
    for (const e of EVENTS) if (e.t <= t) Object.assign(s, e.set);
    return s;
  };
  const mix = (a, b, k) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((pa >> sh) & 255) + ((((pb >> sh) & 255) - ((pa >> sh) & 255)) * k));
    return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
  };
  const phaseName = (t) => {
    if (t < SUNRISE - 40) return 'Madrugada';
    if (t < SUNRISE + 40) return 'Amanecer';
    if (t < 720) return 'Mañana';
    if (t < 840) return 'Mediodía';
    if (t < SUNSET - 40) return 'Tarde';
    if (t < SUNSET + 40) return 'Atardecer';
    return 'Noche';
  };

  let casa = null;
  let current = +slider.value;
  let shownCount = -1;
  let last = {};

  function renderLog(t) {
    const past = visibleEvents.filter((e) => e.t <= t);
    tickNodes.forEach((n, i) => n.classList.toggle('is-past', visibleEvents[i].t <= t));
    if (past.length === shownCount) return;
    shownCount = past.length;
    logbook.innerHTML = past.length
      ? past.slice(-5).reverse().map((e) => `
        <li class="log">
          <span class="log-icon">${icon(e.icon)}</span>
          <div><p class="log-head"><span class="log-time">${hhmm(e.t)}</span><span class="log-title">${e.title}</span></p><p class="log-text">${e.text}</p></div>
        </li>`).join('')
      : '<li class="logbook-empty">Todavía es de madrugada: la casa descansa con la alarma activada.</li>';
  }

  function render(t) {
    current = t;
    slider.value = String(Math.round(t / 5) * 5);
    const label = `${hhmm(t)}, ${phaseName(t).toLowerCase()}`;
    slider.setAttribute('aria-valuetext', label);
    timeEl.textContent = hhmm(t);
    phaseEl.textContent = phaseName(t);
    // cielo
    let i = 0;
    while (i < SKY.length - 2 && SKY[i + 1][0] <= t) i++;
    const [t0, a0, b0] = SKY[i], [t1, a1, b1] = SKY[i + 1];
    const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    stageEl.style.setProperty('--sky-top', mix(a0, a1, k));
    stageEl.style.setProperty('--sky-bottom', mix(b0, b1, k));
    const day = Math.min(1, Math.max(0, Math.min((t - SUNRISE + 30) / 60, (SUNSET + 30 - t) / 60)));
    stageEl.style.setProperty('--stars', String(1 - day));
    const isDay = t >= SUNRISE - 20 && t <= SUNSET + 20;
    const arc = isDay
      ? (t - SUNRISE + 20) / (SUNSET - SUNRISE + 40)
      : (((t - SUNSET - 20) + 1440) % 1440) / (1440 - (SUNSET - SUNRISE + 40));
    orb.classList.toggle('is-moon', !isDay);
    orb.style.left = `${8 + 84 * arc}%`;
    orb.style.top = `${46 - 34 * Math.sin(Math.PI * arc)}%`;
    renderLog(t);
    if (casa) {
      const s = stateAt(t);
      last = s;
      casa.setMany(s);
      casa.setTime(t);
    }
  }

  // reproducir el día completo en ~1 minuto
  let playing = false, raf = 0, lastNow = 0;
  function tick(now) {
    const dt = lastNow ? (now - lastNow) / 1000 : 0;
    lastNow = now;
    let t = current + dt * 24;
    if (t >= 1440) t -= 1440;
    render(t);
    if (playing) raf = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    playing = on;
    playBtn.setAttribute('aria-pressed', String(on));
    playBtn.querySelector('span').textContent = on ? 'Pausar' : 'Reproducir el día';
    cancelAnimationFrame(raf);
    if (on) {
      lastNow = 0;
      raf = requestAnimationFrame(tick);
    }
  }
  playBtn.addEventListener('click', () => setPlaying(!playing));
  slider.addEventListener('input', () => {
    setPlaying(false);
    render(+slider.value);
  });
  section.querySelectorAll('.auto-try').forEach((btn) =>
    btn.addEventListener('click', () => {
      setPlaying(false);
      render(+btn.dataset.time);
      stageEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }),
  );
  // pausar si la sección sale de la pantalla
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && playing) setPlaying(false); }).observe(section);

  render(current);

  const LABELS = {
    clima: () => (last.climaDormitorio ? 'Dormitorio · 22 °C' : ''),
    climaLiving: () => (last.climaLiving ? 'Living · 23 °C' : ''),
    riego: () => (last.riego ? 'Riego · zona 1' : ''),
    alarma: () => (last.alarma ? 'Alarma · activada' : ''),
    accesos: () => (last.puerta ? 'Puerta · abierta' : ''),
  };
  const draw = labelLayer($('day-labels'), Object.keys(LABELS));

  if (!webgl) return;
  whenNear(section, () => {
    mountCasa(wrap, $('casa-dia'), {
      preset: 'dia',
      state: stateAt(current),
      onFrame: (pos) => draw(pos, (k) => LABELS[k]()),
    }).then((c) => {
      casa = c;
      render(current);
    }).catch((err) => console.warn('No se pudo iniciar la casa del día', err));
  });
})();

// ---------- armá tu casa ----------
const builderSelection = new Set(['luzLiving']);
const BUILDER_ROOMS = [
  { id: 'living', name: 'Living', options: [
    ['luzLiving', 'i-bulb', 'Iluminación inteligente', 'Escenas, dimmer y horarios automáticos'],
    ['cortinaLiving', 'i-blinds', 'Cortinas motorizadas', 'Suben y bajan solas con la luz del día'],
    ['climaLiving', 'i-thermo', 'Aire acondicionado', 'Lo prendés desde el celular antes de llegar'],
    ['sensorPresencia', 'i-sensor', 'Sensor de presencia', 'Las luces se encienden cuando entrás'],
    ['enchufes', 'i-plug', 'Medición de consumo', 'Sabés cuánto gasta cada equipo'],
  ] },
  { id: 'dormitorio', name: 'Dormitorio', options: [
    ['luzDormitorio', 'i-bulb', 'Iluminación inteligente', 'Despertador con luz gradual'],
    ['cortinaDormitorio', 'i-blinds', 'Cortinas motorizadas', 'Se abren solas a la mañana'],
    ['climaDormitorio', 'i-thermo', 'Aire acondicionado', 'Programado para la hora de dormir'],
    ['botonNoche', 'i-moon', 'Botón «Buenas noches»', 'Apaga toda la casa con un toque'],
  ] },
  { id: 'cocina', name: 'Cocina', options: [
    ['luzCocina', 'i-bulb', 'Iluminación inteligente', 'Colgantes y tira LED de la isla'],
    ['sensorGas', 'i-flame', 'Detector de gas', 'Aviso inmediato al celular'],
    ['sensorAgua', 'i-drop', 'Sensor de pérdida de agua', 'Detecta pérdidas bajo la bacha'],
  ] },
  { id: 'entrada', name: 'Entrada', options: [
    ['cerradura', 'i-lock', 'Cerradura inteligente', 'Abrís con código, huella o desde la app'],
    ['videoportero', 'i-bell', 'Videoportero', 'Atendés el timbre desde el celular'],
    ['luzEntrada', 'i-bulb', 'Luz de entrada', 'Se prende sola cuando llegás'],
    ['sensorApertura', 'i-door', 'Sensor de apertura', 'Te avisa si se abre la puerta'],
  ] },
  { id: 'exterior', name: 'Exterior', options: [
    ['alarma', 'i-cam', 'Cámaras de seguridad', 'Grabación y avisos al celular'],
    ['riego', 'i-drop', 'Riego automático', 'Por zonas y según el clima'],
    ['luzExterior', 'i-bulb', 'Luces de jardín', 'Se encienden al atardecer'],
    ['luzPileta', 'i-bulb', 'Luz de pileta', 'Control de color y horario desde la app'],
  ] },
];
const BUILDER_PRESETS = {
  seguridad: ['cerradura', 'videoportero', 'sensorApertura', 'alarma', 'luzExterior', 'sensorPresencia', 'luzEntrada'],
  confort: ['luzLiving', 'luzDormitorio', 'luzCocina', 'cortinaLiving', 'cortinaDormitorio', 'climaLiving', 'climaDormitorio'],
  completa: BUILDER_ROOMS.flatMap((r) => r.options.map((o) => o[0])),
  limpiar: [],
};
const FORM_INTERESTS = {
  Iluminación: ['luzLiving', 'luzDormitorio', 'luzCocina', 'luzEntrada', 'luzExterior', 'luzPileta'],
  Climatización: ['climaLiving', 'climaDormitorio'],
  Seguridad: ['alarma', 'sensorPresencia', 'sensorApertura', 'sensorGas', 'sensorAgua'],
  Accesos: ['cerradura', 'videoportero'],
  Cortinas: ['cortinaLiving', 'cortinaDormitorio'],
  Riego: ['riego'],
};
const OPTION_INDEX = Object.fromEntries(
  BUILDER_ROOMS.flatMap((r) => r.options.map(([ch, , name]) => [ch, { room: r, name }])),
);

function builderMessage() {
  const lines = BUILDER_ROOMS
    .map((r) => [r.name, r.options.filter((o) => builderSelection.has(o[0])).map((o) => o[2])])
    .filter(([, items]) => items.length)
    .map(([name, items]) => `• ${name}: ${items.join(', ')}`);
  return lines.join('\n');
}

(function builder() {
  const section = $('arma-tu-casa');
  const wrap = $('builder-canvas-wrap');
  const tabsEl = $('room-tabs');
  const optionsEl = $('options');
  const hotspotsEl = $('hotspots');
  const countEl = $('summary-count');
  const listEl = $('summary-list');
  const toForm = $('builder-to-form');
  const waLink = $('builder-wa');
  let room = 'living';
  let casa = null;

  const countIn = (r) => r.options.filter((o) => builderSelection.has(o[0])).length;

  // pestañas de ambientes y botones sobre la casa
  const tabs = {}, hotspots = {};
  for (const r of BUILDER_ROOMS) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'room-tab';
    tab.innerHTML = `${r.name} <b></b>`;
    tab.addEventListener('click', () => selectRoom(r.id));
    tabsEl.append(tab);
    tabs[r.id] = tab;

    const hs = document.createElement('button');
    hs.type = 'button';
    hs.className = 'hotspot is-hidden';
    hs.innerHTML = `<i></i><span class="hs-name">${r.name}</span><b></b>`;
    hs.setAttribute('aria-label', `Ver ${r.name}`);
    hs.addEventListener('click', () => selectRoom(r.id));
    hotspotsEl.append(hs);
    hotspots[r.id] = hs;
  }

  function renderOptions() {
    const r = BUILDER_ROOMS.find((x) => x.id === room);
    $('options-legend').textContent = `Dispositivos para ${r.name}`;
    optionsEl.querySelectorAll('.opt').forEach((n) => n.remove());
    for (const [ch, ic, name, desc] of r.options) {
      const div = document.createElement('div');
      div.className = 'opt';
      div.innerHTML = `
        <input type="checkbox" id="opt-${ch}" value="${ch}" ${builderSelection.has(ch) ? 'checked' : ''}>
        <label for="opt-${ch}">
          <span class="opt-icon">${icon(ic)}</span>
          <span class="opt-text"><span class="opt-name">${name}</span><span class="opt-desc">${desc}</span></span>
          <span class="opt-check">${icon('i-check')}</span>
        </label>`;
      div.querySelector('input').addEventListener('change', (e) => toggle(ch, e.target.checked));
      optionsEl.append(div);
    }
  }

  function renderSummary() {
    for (const r of BUILDER_ROOMS) {
      const n = countIn(r);
      tabs[r.id].querySelector('b').textContent = n || '';
      tabs[r.id].querySelector('b').hidden = !n;
      tabs[r.id].setAttribute('aria-pressed', String(r.id === room));
      tabs[r.id].setAttribute('aria-label', `${r.name}${n ? `, ${n} elegidos` : ''}`);
      hotspots[r.id].querySelector('b').textContent = n || '';
      hotspots[r.id].querySelector('b').hidden = !n;
      hotspots[r.id].setAttribute('aria-pressed', String(r.id === room));
    }
    const total = builderSelection.size;
    const rooms = BUILDER_ROOMS.filter((r) => countIn(r) > 0).length;
    countEl.textContent = total
      ? `${total} ${total === 1 ? 'dispositivo' : 'dispositivos'} en ${rooms} ${rooms === 1 ? 'ambiente' : 'ambientes'}`
      : 'Todavía no elegiste dispositivos';
    listEl.innerHTML = BUILDER_ROOMS
      .map((r) => [r.name, r.options.filter((o) => builderSelection.has(o[0])).map((o) => o[2])])
      .filter(([, items]) => items.length)
      .map(([name, items]) => `<li><b>${name}</b>${items.join(' · ')}</li>`)
      .join('');
    const msg = builderMessage();
    waLink.href = waUrl(`Hola i2home, armé mi casa en su web y me interesa:\n${msg}`);
    for (const el of [toForm, waLink]) el.setAttribute('aria-disabled', String(!total));
  }

  function selectRoom(id) {
    room = id;
    renderOptions();
    renderSummary();
    if (casa) {
      casa.focus(id);
      casa.highlight(id);
    }
  }

  function toggle(ch, on) {
    if (on) builderSelection.add(ch); else builderSelection.delete(ch);
    if (casa) casa.set(ch, on);
    renderSummary();
  }

  section.querySelectorAll('.preset-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      builderSelection.clear();
      for (const ch of BUILDER_PRESETS[btn.dataset.preset]) builderSelection.add(ch);
      if (casa) {
        casa.setMany(Object.fromEntries(Object.keys(OPTION_INDEX).map((ch) => [ch, builderSelection.has(ch)])));
        casa.focus('hero');
        casa.highlight(null);
      }
      renderOptions();
      renderSummary();
    }),
  );
  $('builder-overview').addEventListener('click', () => {
    if (casa) {
      casa.focus('hero');
      casa.highlight(null);
    }
  });

  toForm.addEventListener('click', () => {
    if (!builderSelection.size) return;
    const form = $('form');
    form.elements.mensaje.value = `Armé mi casa en la web y me interesa:\n${builderMessage()}`;
    form.querySelectorAll('input[name="interes"]').forEach((i) => {
      i.checked = (FORM_INTERESTS[i.value] || []).some((ch) => builderSelection.has(ch));
    });
    $('contacto').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    setTimeout(() => form.elements.nombre.focus({ preventScroll: true }), reduceMotion ? 0 : 600);
  });
  waLink.addEventListener('click', (e) => { if (!builderSelection.size) e.preventDefault(); });

  renderOptions();
  renderSummary();

  const drawHotspots = (pos) => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    for (const [id, hs] of Object.entries(hotspots)) {
      const p = pos[`room:${id}`];
      const inside = p.visible && p.x > 56 && p.x < w - 56 && p.y > 64 && p.y < h - 24;
      hs.classList.toggle('is-hidden', !inside);
      hs.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
    }
  };

  if (!webgl) {
    wrap.closest('.builder-stage').querySelector('.builder-reset').hidden = true;
    return;
  }
  whenNear(section, () => {
    const initial = { luces: false, clima: false };
    for (const ch of builderSelection) initial[ch] = true;
    mountCasa(wrap, $('casa-builder'), { preset: room, state: initial, onFrame: drawHotspots })
      .then((c) => {
        casa = c;
        casa.highlight(room);
      })
      .catch((err) => console.warn('No se pudo iniciar el configurador', err));
  });
})();

// ---------- formulario ----------
const form = $('form');
const result = $('form-result');
const resultText = $('f-resultado');
const waLink = $('wa-link');
const copyBtn = $('copy-btn');

function fieldCheck(input, errorId) {
  const ok = input.value.trim().length > 0;
  input.setAttribute('aria-invalid', String(!ok));
  $(errorId).hidden = ok;
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
