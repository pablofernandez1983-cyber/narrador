// Banderas en mi corazón — versión web. Es el mismo juego que la app Android
// (BanderasApp): misma lista de países, mismo corrector y los mismos récords compartidos.
'use strict';

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- Datos

const CONTINENTES = {
  sudamerica: '🌎 Sudamérica',
  norteamerica: '🌎 Norteamérica',
  centroamerica: '🌴 Centroamérica y Caribe',
  europa: '🏰 Europa',
  asia: '🏯 Asia',
  africa: '🦁 África',
  oceania: '🏝️ Oceanía',
};
let TODOS = [];
let SIN_BORDE = new Set();
const esOficial = p => p.tipo === 'onu' || p.tipo === 'observador';
const urlBandera = p => `flags/${p.code}.webp`;

function ponerBandera(img, p) {
  img.src = urlBandera(p);
  img.alt = 'Bandera';
  img.classList.toggle('borde', !SIN_BORDE.has(p.code));
}

// ---------------------------------------------------------------- Guardado local

const local = {
  get(k, def) {
    try { const v = localStorage.getItem('banderas.' + k); return v == null ? def : JSON.parse(v); } catch { return def; }
  },
  set(k, v) {
    try { localStorage.setItem('banderas.' + k, JSON.stringify(v)); } catch { /* modo privado */ }
  },
};

function cargarAjustes() {
  const a = local.get('ajustes', {});
  const nombres = a.nombres || ['Papá', 'Franco'];
  return {
    continentes: a.continentes || Object.keys(CONTINENTES),
    niveles: a.niveles || [1, 2, 3],
    noReconocidos: !!a.noReconocidos,
    territorios: !!a.territorios,
    preguntas: a.preguntas ?? 10,
    jugadores: a.jugadores || 1,
    nombres,
    jugadorSolo: a.jugadorSolo ?? '',
    conocidos: a.conocidos || nombres,
  };
}
const guardarAjustes = a => local.set('ajustes', a);
function editarAjustes(cambios) { const a = { ...cargarAjustes(), ...cambios }; guardarAjustes(a); return a; }

function conConocido(a, nombre) {
  const n = nombre.trim();
  if (!n) return a;
  return { ...a, conocidos: [n, ...a.conocidos.filter(c => c.toLowerCase() !== n.toLowerCase())].slice(0, 8) };
}

const filtrar = (todos, a) => todos.filter(p =>
  p.continentes.some(c => a.continentes.includes(c)) &&
  a.niveles.includes(p.nivel) &&
  (p.tipo === 'no_reconocido' ? a.noReconocidos : p.tipo === 'territorio' ? a.territorios : true));

// ---------------------------------------------------------------- Corrector (igual que Matcher.kt)

const RELLENO = new Set(['republica', 'rep', 'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e',
  'islas', 'isla', 'the', 'of', 'and']);
const normalizar = s => s.toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
const nucleo = n => n.split(' ').filter(w => w && !RELLENO.has(w)).join('');
const forma = t => { const n = normalizar(t); return { completa: n.replace(/ /g, ''), nucleo: nucleo(n) }; };
const formasCache = new Map();
const formas = p => {
  if (!formasCache.has(p.code)) formasCache.set(p.code, [p.nombre, ...p.alias].map(forma));
  return formasCache.get(p.code);
};
const tolerancia = l => l <= 3 ? 0 : l <= 5 ? 1 : l <= 8 ? 2 : 3;

function osa(a, b) {
  const n = a.length, m = b.length;
  if (!n) return m;
  if (!m) return n;
  const d = Array.from({ length: n + 1 }, (_, i) => { const r = new Array(m + 1).fill(0); r[0] = i; return r; });
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const costo = a[i - 1] === b[j - 1] ? 0 : 1;
    let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
    d[i][j] = v;
  }
  return d[n][m];
}

function distancia(r, p) {
  let mejor = null;
  for (const f of formas(p)) {
    const d = Math.min(osa(r.completa, f.completa),
      r.nucleo && f.nucleo ? osa(r.nucleo, f.nucleo) : Infinity);
    if (d <= tolerancia(Math.max(f.nucleo.length, 1)) && (mejor == null || d < mejor)) mejor = d;
  }
  return mejor;
}

function evaluar(respuesta, objetivo) {
  const r = forma(respuesta);
  if (!r.completa) return { correcto: false, exacto: false, confundidoCon: null };
  const dObj = distancia(r, objetivo);
  let otro = null, dOtro = Infinity;
  for (const p of TODOS) {
    if (p.code === objetivo.code) continue;
    const d = distancia(r, p);
    if (d != null && d < dOtro) { dOtro = d; otro = p; }
  }
  const correcto = dObj != null && dObj <= dOtro;
  return {
    correcto,
    exacto: correcto && dObj === 0,
    confundidoCon: !correcto && otro && (dObj == null || dOtro < dObj) ? otro : null,
  };
}

// ---------------------------------------------------------------- Récords (igual que Records.kt + Nube.kt)

const TOP = 5;
const CATEGORIAS = ['10', '20', '30', 'todas'];
const nombreCategoria = c => c === 'todas' ? 'Todas' : `${c} banderas`;
const pct = m => m.total ? m.aciertos / m.total : 0;
const orden = (x, y) => pct(y) - pct(x) || x.ms - y.ms;
const ordenar = l => l.map((m, i) => [m, i]).sort((a, b) => orden(a[0], b[0]) || a[1] - b[1]).map(x => x[0]);

function formatoTiempo(ms) {
  const s = Math.floor(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

function categoria(tamRonda, preguntasAjuste, esRepaso) {
  if (esRepaso) return null;
  if (preguntasAjuste === 0) return 'todas';
  if (tamRonda === preguntasAjuste && CATEGORIAS.includes(String(tamRonda))) return String(tamRonda);
  return null;
}

const uuid = () => crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  });

const Nube = {
  URL: 'https://zqwkznlgbkofsrygqezk.supabase.co/rest/v1/rpc/',
  KEY: 'sb_publishable_m7ZBGHpqSq-URme1Nc9JHw_b4EfF0-_',
  clave: () => local.get('clave', null),
  conectado: () => Nube.clave() != null,
  top: () => local.get('top', {}),
  desconectar() { local.set('clave', null); local.set('top', {}); local.set('subidos', []); },
  async rpc(fn, cuerpo) {
    const r = await fetch(Nube.URL + fn, {
      method: 'POST',
      headers: { apikey: Nube.KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    if (r.status === 403) { const e = new Error('clave incorrecta'); e.clave = true; throw e; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  },
  origen() {
    let id = local.get('dispositivo', null);
    if (!id) { id = uuid().slice(0, 6); local.set('dispositivo', id); }
    const ua = navigator.userAgent;
    const que = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac'
      : /Windows/.test(ua) ? 'Windows' : 'otro';
    return `web · ${que} · ${id}`;
  },
  enCurso: null,
  /** Sube lo que falte de este navegador y baja el top de todos. */
  sincronizar(clave = Nube.clave()) {
    if (clave == null) return Promise.resolve();
    const anterior = Nube.enCurso || Promise.resolve();
    const tarea = anterior.catch(() => {}).then(async () => {
      const subidos = new Set(local.get('subidos', []));
      const pendientes = Records.locales().filter(([, m]) => !subidos.has(m.id) && m.ms >= 1000 && m.total >= 1 && m.total <= 400);
      if (pendientes.length) {
        await Nube.rpc('banderas_subir', {
          p_clave: clave,
          p_marcas: pendientes.map(([mc, m]) => {
            const [modo, cat] = mc.split('_');
            return { id: m.id, modo, categoria: cat, nombre: m.nombre || '?', aciertos: m.aciertos,
              total: m.total, ms: m.ms, fecha: m.fecha, origen: Nube.origen() };
          }),
        });
      }
      const filas = await Nube.rpc('banderas_top', { p_clave: clave });
      const top = {};
      for (const f of filas) {
        (top[`${f.modo}_${f.categoria}`] ||= []).push({
          aciertos: f.aciertos, total: f.total, ms: f.ms, fecha: Date.parse(f.fecha), nombre: f.nombre, id: f.id,
        });
      }
      local.set('clave', clave);
      local.set('top', top);
      local.set('subidos', [...subidos, ...pendientes.map(([, m]) => m.id)]);
    });
    Nube.enCurso = tarea;
    return tarea;
  },
};

const Records = {
  listaLocal: (modo, cat) => ordenar(local.get(`records.${modo}_${cat}`, [])),
  locales: () => ['escribir', 'opciones'].flatMap(modo =>
    CATEGORIAS.flatMap(cat => Records.listaLocal(modo, cat).map(m => [`${modo}_${cat}`, m]))),
  lista(modo, cat) {
    const propias = Records.listaLocal(modo, cat);
    if (!Nube.conectado()) return propias;
    const vistos = new Set();
    return ordenar([...(Nube.top()[`${modo}_${cat}`] || []), ...propias])
      .filter(m => !vistos.has(m.id) && vistos.add(m.id)).slice(0, TOP);
  },
  /** Guarda la marca (y la sube si hay nube) y devuelve su puesto (1 = récord), o null si no entró. */
  registrar(modo, cat, m) {
    const p = ordenar([...Records.lista(modo, cat), m]).indexOf(m) + 1;
    const nueva = ordenar([...Records.listaLocal(modo, cat), m]);
    if (nueva.indexOf(m) < TOP) {
      local.set(`records.${modo}_${cat}`, nueva.slice(0, TOP));
      Nube.sincronizar().catch(() => {});
    }
    return p <= TOP ? p : null;
  },
};

// ---------------------------------------------------------------- Navegación

function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach(s => s.classList.toggle('activa', s.id === id));
  document.body.classList.toggle('fondo-juego', id !== 'inicio');
  window.scrollTo(0, 0);
}
function ir(id) {
  if (location.hash !== '#' + id) history.pushState(null, '', id === 'inicio' ? location.pathname : '#' + id);
  abrir(id);
}
function abrir(id) {
  if (id !== 'juego') Juego.salir();
  if (id === 'ajustes') Ajustes.abrir();
  else if (id === 'records') RecordsUI.abrir();
  else if (id === 'juego' && !Juego.ronda.length) id = 'inicio';
  if (id === 'inicio') Inicio.abrir();
  mostrarPantalla(id);
}
window.addEventListener('popstate', () => abrir(location.hash.slice(1) || 'inicio'));
document.querySelectorAll('.volver').forEach(b => b.addEventListener('click', () => history.back()));

function saltar(el, demora = 0) {
  el.classList.remove('saltar');
  void el.offsetWidth;
  el.style.animationDelay = demora + 'ms';
  el.classList.add('saltar');
}
function ponerTitulo(el, texto) {
  const s = document.createElement('span');
  s.textContent = texto;
  el.replaceChildren(s);
  el.dataset.t = texto;
}
function sacudir(el) { el.classList.remove('sacudir'); void el.offsetWidth; el.classList.add('sacudir'); }
function chip(texto, on, alTocar) {
  const c = document.createElement('button');
  c.className = 'chip' + (on ? ' on' : '');
  c.textContent = texto;
  c.addEventListener('click', alTocar);
  return c;
}
function segmentos(el, valor) {
  el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(valor)));
}

// ---------------------------------------------------------------- Inicio

const Inicio = {
  init() {
    $('segJugadores').addEventListener('click', e => {
      const v = e.target.closest('button')?.dataset.v;
      if (!v) return;
      editarAjustes({ jugadores: +v });
      Inicio.abrir();
    });
    $('edtSolo').addEventListener('input', () => { editarAjustes({ jugadorSolo: $('edtSolo').value.trim() }); Inicio.marcarChipSolo(); });
    const nombres = () => editarAjustes({
      nombres: [$('edtNombre1').value.trim() || 'Jugador 1', $('edtNombre2').value.trim() || 'Jugador 2'],
    });
    $('edtNombre1').addEventListener('input', nombres);
    $('edtNombre2').addEventListener('input', nombres);
    $('btnTodos').addEventListener('click', () => {
      const a = cargarAjustes();
      const todos = Object.keys(CONTINENTES);
      editarAjustes({ continentes: a.continentes.length === todos.length ? [] : todos });
      Inicio.abrir();
    });
    $('btnEscribir').addEventListener('click', () => Inicio.jugar('escribir'));
    $('btnOpciones').addEventListener('click', () => Inicio.jugar('opciones'));
    $('btnRecords').addEventListener('click', () => ir('records'));
    $('btnAjustes').addEventListener('click', () => ir('ajustes'));
  },
  abrir() {
    const a = cargarAjustes();
    segmentos($('segJugadores'), a.jugadores);
    $('filaSolo').hidden = a.jugadores === 2;
    $('filaNombres').hidden = a.jugadores !== 2;
    $('edtSolo').value = a.jugadorSolo;
    $('edtNombre1').value = a.nombres[0];
    $('edtNombre2').value = a.nombres[1];
    $('avisoInicio').hidden = true;

    const cj = $('chipsJugadores');
    cj.replaceChildren(...a.conocidos.map(n => chip(n, false, () => {
      $('edtSolo').value = n;
      editarAjustes({ jugadorSolo: n });
      Inicio.marcarChipSolo();
    })));
    Inicio.marcarChipSolo();

    $('chipsContinentes').replaceChildren(...Object.entries(CONTINENTES).map(([id, nombre]) =>
      chip(nombre, a.continentes.includes(id), () => {
        const sel = cargarAjustes().continentes;
        editarAjustes({ continentes: sel.includes(id) ? sel.filter(c => c !== id) : [...sel, id] });
        Inicio.abrir();
      })));

    const n = filtrar(TODOS, a).length;
    const niveles = [[1, 'Fáciles'], [2, 'Medios'], [3, 'Difíciles']]
      .filter(([k]) => a.niveles.includes(k)).map(x => x[1]).join(', ') || 'ninguno';
    const porJugador = a.jugadores === 2 ? ' por jugador' : '';
    const preguntas = a.preguntas === 0 || a.preguntas * a.jugadores > n ? `todas (${n})` : `${a.preguntas}${porJugador}`;
    const extras = [a.noReconocidos && 'no reconocidos', a.territorios && 'territorios'].filter(Boolean);
    $('resumen').textContent = `🏳️ Hay ${n} banderas en juego\n❓ Preguntas por partida: ${preguntas}\n📊 Países: ${niveles}` +
      (extras.length ? `\n➕ Incluye ${extras.join(' y ')}` : '');
  },
  marcarChipSolo() {
    const actual = $('edtSolo').value.trim().toLowerCase();
    $('chipsJugadores').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.textContent.toLowerCase() === actual));
  },
  jugar(modo) {
    let a = cargarAjustes();
    const aviso = t => { $('avisoInicio').textContent = t; $('avisoInicio').hidden = false; };
    if (a.jugadores === 1 && !a.jugadorSolo.trim()) {
      aviso('Escribí quién juega, así el récord queda a su nombre.');
      $('edtSolo').focus();
      return;
    }
    if (!filtrar(TODOS, a).length) {
      aviso('No hay banderas con esta selección. Elegí al menos un continente y un nivel.');
      return;
    }
    a = a.jugadores === 1 ? conConocido(a, a.jugadorSolo) : a.nombres.reduce(conConocido, a);
    guardarAjustes(a);
    Juego.empezar(modo, filtrar(TODOS, a));
    ir('juego');
  },
};

// ---------------------------------------------------------------- Configuración

const OPCIONES_PREGUNTAS = [10, 20, 30, 0];

const Ajustes = {
  init() {
    $('chkNoRec').addEventListener('change', e => editarAjustes({ noReconocidos: e.target.checked }));
    $('chkTerr').addEventListener('change', e => editarAjustes({ territorios: e.target.checked }));
    $('formClave').addEventListener('submit', e => { e.preventDefault(); Ajustes.conectar(); });
    $('btnNube').addEventListener('click', () => {
      if (Nube.conectado()) { Nube.desconectar(); Ajustes.mostrarNube(); } else Ajustes.conectar();
    });
  },
  abrir() {
    const a = cargarAjustes();
    const cuantos = n => TODOS.filter(p => p.nivel === n && esOficial(p)).length;
    const textos = {
      1: `Fáciles (${cuantos(1)}) — Argentina, Brasil, Japón…`,
      2: `Medios (${cuantos(2)}) — Noruega, Kenia, Vietnam…`,
      3: `Difíciles (${cuantos(3)}) — Turkmenistán, Burundi, Tuvalu…`,
    };
    $('checksNivel').replaceChildren(...[1, 2, 3].map(n => {
      const l = document.createElement('label');
      l.className = 'check';
      const i = document.createElement('input');
      i.type = 'checkbox';
      i.checked = a.niveles.includes(n);
      i.addEventListener('change', () => {
        const sel = cargarAjustes().niveles.filter(x => x !== n);
        editarAjustes({ niveles: i.checked ? [...sel, n].sort() : sel });
      });
      l.append(i, ' ' + textos[n]);
      return l;
    }));
    $('chkNoRec').checked = a.noReconocidos;
    $('chkTerr').checked = a.territorios;
    $('chipsPreguntas').replaceChildren(...OPCIONES_PREGUNTAS.map(n =>
      chip(n === 0 ? 'Todas' : String(n), n === a.preguntas, () => { editarAjustes({ preguntas: n }); Ajustes.abrir(); })));
    Ajustes.mostrarNube();
  },
  mostrarNube(error = '') {
    const on = Nube.conectado();
    $('txtNube').textContent = on
      ? '✅ Conectado: los récords son los mismos acá, en los celulares y en cualquier compu conectada.'
      : 'Con la clave de la familia, los récords se comparten entre la app del celu y la web. Sin clave quedan solo en este navegador.';
    $('formClave').hidden = on;
    $('errClave').textContent = error;
    $('btnNube').disabled = false;
    $('btnNube').textContent = on ? 'Desconectar' : 'Conectar';
    $('btnNube').className = 'boton ' + (on ? 'rojo' : 'verde');
  },
  async conectar() {
    const clave = $('edtClave').value.trim().toLowerCase();
    if (!clave) return;
    $('btnNube').disabled = true;
    $('btnNube').textContent = 'Conectando…';
    try {
      await Nube.sincronizar(clave);
      $('edtClave').value = '';
      Ajustes.mostrarNube();
    } catch (e) {
      Ajustes.mostrarNube(e.clave ? 'Esa no es la clave' : 'No hay conexión, probá de nuevo');
    }
  },
};

// ---------------------------------------------------------------- Juego

const PAUSA_ACIERTO_MS = 750, PAUSA_CASI_MS = 1500, PAUSA_ERROR_MS = 2200;

const Juego = {
  modo: 'escribir', pool: [], ronda: [], idx: 0, jugadores: 1, jugadorSolo: '', nombres: ['', ''],
  puntos: [0, 0], rachas: [0, 0], mejorRacha: [0, 0], errores: [],
  respondida: false, respondidaEn: 0, terminado: false, esRepaso: false,
  tiempoMs: 0, inicioPregunta: 0, timers: [], reloj: null,

  init() {
    $('btnSalir').addEventListener('click', () => history.back());
    $('formRespuesta').addEventListener('submit', e => {
      e.preventDefault();
      // El Enter puede llegar repetido: que el mismo toque no responda y además saltee.
      if (!Juego.respondida) Juego.comprobar();
      else if (performance.now() - Juego.respondidaEn > 700) Juego.siguiente();
    });
    $('btnComprobar').addEventListener('click', () => Juego.comprobar());
    $('btnNoSe').addEventListener('click', () => {
      if (!Juego.respondida) Juego.responder(null, { correcto: false, exacto: false, confundidoCon: null });
    });
    document.querySelectorAll('.op').forEach(b => b.addEventListener('click', () => Juego.elegir(b)));
    $('overlay').addEventListener('click', () => Juego.siguiente());
    document.addEventListener('keydown', e => {
      if (!$('juego').classList.contains('activa') || Juego.terminado) return;
      if (Juego.respondida && (e.key === 'Enter' || e.key === ' ') && performance.now() - Juego.respondidaEn > 700) {
        e.preventDefault();
        Juego.siguiente();
      } else if (Juego.modo === 'opciones' && !Juego.respondida && /^[1-4]$/.test(e.key)) {
        Juego.elegir(document.querySelectorAll('.op')[+e.key - 1]);
      }
    });
    $('btnOtraVez').addEventListener('click', () => Juego.empezar(Juego.modo, Juego.pool));
    $('btnInicio').addEventListener('click', () => history.back());
    $('btnRepasar').addEventListener('click', () => Juego.empezar(Juego.modo, Juego.errores.map(e => e.pais), true));
  },

  get actual() { return this.ronda[this.idx]; },
  get turno() { return this.idx % this.jugadores; },
  tiempoActual() { return this.tiempoMs + (this.respondida || this.terminado ? 0 : performance.now() - this.inicioPregunta); },
  limpiarTimers() { this.timers.forEach(clearTimeout); this.timers = []; },
  despues(ms, f) { this.timers.push(setTimeout(f, ms)); },

  salir() {
    this.limpiarTimers();
    clearInterval(this.reloj);
    cerrarOverlay(true);
  },

  empezar(modo, fuente, todas = false) {
    const a = cargarAjustes();
    this.modo = modo;
    if (!todas) this.pool = fuente;
    this.jugadores = a.jugadores;
    this.nombres = a.nombres;
    this.jugadorSolo = a.jugadorSolo;
    const n = a.preguntas * this.jugadores;
    let r = fuente.map(p => [Math.random(), p]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    if (!todas && n !== 0) r = r.slice(0, n);
    // Con dos jugadores, misma cantidad de banderas para cada uno.
    if (this.jugadores === 2 && r.length % 2 === 1 && r.length > 1) r = r.slice(0, -1);
    this.ronda = r;
    this.idx = 0;
    this.puntos = [0, 0]; this.rachas = [0, 0]; this.mejorRacha = [0, 0];
    this.errores = [];
    this.terminado = false;
    this.esRepaso = todas;
    this.tiempoMs = 0;
    $('panelEscribir').hidden = modo !== 'escribir';
    $('panelOpciones').hidden = modo === 'escribir';
    $('zonaResultado').hidden = true;
    $('zonaPregunta').hidden = false;
    $('barra').hidden = false;
    this.mostrarPregunta();
  },

  mostrarPregunta() {
    this.respondida = false;
    this.limpiarTimers();
    const p = this.actual;
    ponerBandera($('imgBandera'), p);
    // Precarga la siguiente para que no haya parpadeo.
    if (this.ronda[this.idx + 1]) new Image().src = urlBandera(this.ronda[this.idx + 1]);
    $('txtProgreso').textContent = (this.jugadores === 1 && this.jugadorSolo ? `${this.jugadorSolo} · ` : '') +
      `Bandera ${this.idx + 1} de ${this.ronda.length}`;
    const t = $('txtTurno');
    if (this.jugadores === 2) {
      t.hidden = false;
      t.textContent = `🎯 Turno de ${this.nombres[this.turno]}`;
      t.className = 'turno j' + this.turno;
      saltar(t);
    } else t.hidden = true;
    $('barra').firstElementChild.style.width = (100 * this.idx / this.ronda.length) + '%';
    this.inicioPregunta = performance.now();
    clearInterval(this.reloj);
    this.reloj = setInterval(() => this.actualizarPuntaje(), 500);
    this.actualizarPuntaje();

    if (this.modo === 'escribir') {
      $('edtRespuesta').value = '';
      $('filaBotones').hidden = false;
      $('edtRespuesta').focus({ preventScroll: true });
    } else {
      const ops = [...this.distractores(p), p].map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
      document.querySelectorAll('.op').forEach((b, i) => {
        b.textContent = ops[i].nombre;
        b.dataset.code = ops[i].code;
        b.className = 'boton op';
      });
    }
  },

  /** 3 países falsos, preferentemente del mismo continente para que no sea obvio. */
  distractores(p) {
    const mezclar = l => l.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const candidatos = TODOS.filter(c => c.code !== p.code && (esOficial(c) || c.tipo === p.tipo));
    const mismo = mezclar(candidatos.filter(c => c.continentes.some(x => p.continentes.includes(x))));
    const resto = mezclar(candidatos.filter(c => !mismo.includes(c)));
    const vistos = new Set();
    return [...mismo, ...resto].filter(c => !vistos.has(c.nombre) && vistos.add(c.nombre)).slice(0, 3);
  },

  actualizarPuntaje() {
    if (this.terminado) clearInterval(this.reloj);
    $('txtPuntaje').textContent = this.jugadores === 2
      ? `${this.nombres[0]} ${this.puntos[0]} · ${this.nombres[1]} ${this.puntos[1]}`
      : `✔ ${this.puntos[0]}` + (this.rachas[0] >= 2 ? `  🔥${this.rachas[0]}` : '') + `  ⏱ ${formatoTiempo(this.tiempoActual())}`;
  },

  comprobar() {
    if (this.respondida) return;
    const texto = $('edtRespuesta').value;
    if (!texto.trim()) return;
    this.responder(texto, evaluar(texto, this.actual));
  },

  elegir(b) {
    if (this.respondida) return;
    const elegido = TODOS.find(p => p.code === b.dataset.code);
    const bien = elegido.code === this.actual.code;
    document.querySelectorAll('.op').forEach(o => {
      if (o.dataset.code === this.actual.code) o.classList.add('verde');
      else if (o === b) o.classList.add('rojo');
    });
    this.responder(elegido.nombre, { correcto: bien, exacto: bien, confundidoCon: bien ? null : elegido });
  },

  responder(respuesta, r) {
    this.tiempoMs += performance.now() - this.inicioPregunta;
    this.respondida = true;
    this.respondidaEn = performance.now();
    clearInterval(this.reloj);
    const p = this.actual;
    if (this.modo === 'escribir') $('filaBotones').hidden = true;
    const j = this.turno;
    if (r.correcto) {
      this.puntos[j]++;
      this.rachas[j]++;
      this.mejorRacha[j] = Math.max(this.mejorRacha[j], this.rachas[j]);
      // En opciones, un instante para ver el botón en verde antes del festejo.
      const espera = this.modo === 'opciones' ? 180 : 0;
      this.despues(espera, () => r.exacto
        ? mostrarCartel(p, true, '¡Correcto!', `Es ${p.nombre}`, null)
        : mostrarCartel(p, true, '¡Bien!', `Se escribe:\n${p.nombre}`, null));
      this.despues(espera + (r.exacto ? PAUSA_ACIERTO_MS : PAUSA_CASI_MS), () => this.siguiente());
    } else {
      this.rachas[j] = 0;
      this.errores.push({ pais: p, respuesta, jugador: j });
      sacudir($('tarjetaBandera'));
      const detalle = respuesta == null ? null
        : this.modo === 'escribir' && r.confundidoCon ? `${r.confundidoCon.nombre} es otro país`
        : `Pusiste: ${respuesta}`;
      // Un momento para ver la sacudida (y en opciones, cuál era la verde) antes del cartel.
      this.despues(380, () => mostrarCartel(p, false, '¡Uy!', `Era ${p.nombre}`, detalle));
      this.despues(380 + PAUSA_ERROR_MS, () => this.siguiente());
    }
    this.actualizarPuntaje();
  },

  siguiente() {
    this.limpiarTimers();
    if (!this.respondida || this.terminado) return;
    cerrarOverlay();
    this.idx++;
    if (this.idx >= this.ronda.length) this.mostrarResultado(); else this.mostrarPregunta();
  },

  registrarRecord(total) {
    const quien = m => m.nombre ? `${m.nombre}, ` : '';
    const cat = categoria(total, cargarAjustes().preguntas, this.esRepaso);
    if (!cat) return '';
    const previo = Records.lista(this.modo, cat)[0];
    const marca = { aciertos: this.puntos[0], total, ms: Math.round(this.tiempoMs), fecha: Date.now(), nombre: this.jugadorSolo, id: uuid() };
    const puesto = Records.registrar(this.modo, cat, marca);
    if (puesto === 1) return `🏆 ¡Nuevo récord de ${this.jugadorSolo} en ${nombreCategoria(cat).toLowerCase()}!`;
    if (puesto) return `🏅 Puesto ${puesto} de ${TOP} · récord: ${quien(previo)}${previo.aciertos}/${previo.total} en ${formatoTiempo(previo.ms)}`;
    if (previo) return `Récord: ${quien(previo)}${previo.aciertos}/${previo.total} en ${formatoTiempo(previo.ms)}`;
    return '';
  },

  mostrarResultado() {
    this.terminado = true;
    clearInterval(this.reloj);
    document.activeElement?.blur();
    $('zonaPregunta').hidden = true;
    $('zonaResultado').hidden = false;
    $('barra').hidden = true;
    $('txtProgreso').textContent = 'Resultado';
    this.actualizarPuntaje();
    window.scrollTo(0, 0);

    const titulo = $('txtResultadoTitulo');
    let t, detalle;
    if (this.jugadores === 2) {
      const cadaUno = this.ronda.length / 2;
      const [a, b] = this.puntos;
      t = a > b ? `¡Ganó ${this.nombres[0]}!` : b > a ? `¡Ganó ${this.nombres[1]}!` : '¡Empate!';
      detalle = [0, 1].map(j => `${this.nombres[j]}: ${this.puntos[j]} de ${cadaUno}` +
        (this.mejorRacha[j] >= 2 ? `  (racha de ${this.mejorRacha[j]} 🔥)` : '')).join('\n') +
        `\n⏱ ${formatoTiempo(this.tiempoMs)}`;
    } else {
      const total = this.ronda.length;
      const pc = total ? Math.floor(this.puntos[0] * 100 / total) : 0;
      t = pc === 100 ? '¡Perfecto!' : pc >= 80 ? '¡Muy bien!' : pc >= 50 ? '¡Bien!' : '¡A practicar!';
      const record = this.registrarRecord(total);
      detalle = `Acertaste ${this.puntos[0]} de ${total} en ${formatoTiempo(this.tiempoMs)}` +
        (this.mejorRacha[0] >= 2 ? `\nMejor racha: ${this.mejorRacha[0]} seguidas 🔥` : '') +
        (record ? `\n${record}` : '');
    }
    ponerTitulo(titulo, t);
    $('txtResultadoDetalle').textContent = detalle;
    saltar($('mascotaResultado'));
    saltar(titulo, 120);

    const n = this.errores.length;
    $('btnRepasar').hidden = !n;
    $('btnRepasar').textContent = this.jugadores === 2 ? `📚 Repasar las ${n} que no salieron`
      : n === 1 ? '📚 Repasar la que fallé' : `📚 Repasar las ${n} que fallé`;
    $('panelErrores').hidden = !n;
    $('listaErrores').replaceChildren(...this.errores.map(e => {
      const fila = document.createElement('div');
      fila.className = 'error-item';
      const img = document.createElement('img');
      ponerBandera(img, e.pais);
      const txt = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = e.pais.nombre;
      const s = document.createElement('span');
      const quien = this.jugadores === 2 ? this.nombres[e.jugador] : 'pusiste';
      s.textContent = e.respuesta != null ? `${quien}: ${e.respuesta}` : this.jugadores === 2 ? `${quien}: no sabía` : 'no sabía';
      txt.append(b, s);
      fila.append(img, txt);
      return fila;
    }));
  },
};

// ---------------------------------------------------------------- Cartel y confeti

function mostrarCartel(p, bien, titulo, nombre, detalle) {
  document.activeElement?.blur();
  const t = $('overlayTitulo');
  ponerTitulo(t, titulo);
  t.style.setProperty('--degrade', bien ? 'linear-gradient(#FFE55C, #FF9F1A)' : 'linear-gradient(#FF9A9A, #E03131)');
  t.style.setProperty('--contorno', bien ? '#1D3A8A' : '#5C1010');
  ponerBandera($('overlayBandera'), p);
  const n = $('overlayNombre');
  n.textContent = nombre;
  n.style.color = bien ? 'var(--primario)' : 'var(--mal)';
  if (detalle) { const s = document.createElement('small'); s.textContent = detalle; n.append(s); }
  $('overlayMascota').hidden = !bien;
  const o = $('overlay');
  o.style.opacity = 1;
  o.classList.add('visible');
  saltar(t, 0);
  saltar(o.querySelector('.tarjeta'), 40);
  saltar(n, 80);
  if (bien) { saltar($('overlayMascota'), 120); Confeti.disparar(); }
}

function cerrarOverlay(ya = false) {
  const o = $('overlay');
  if (!o.classList.contains('visible')) return;
  Confeti.parar();
  if (ya) { o.classList.remove('visible'); return; }
  o.style.opacity = 0;
  setTimeout(() => { o.classList.remove('visible'); o.style.opacity = 1; if (Juego.modo === 'escribir' && !Juego.terminado) $('edtRespuesta').focus({ preventScroll: true }); }, 120);
}

const Confeti = {
  piezas: [], anim: null,
  disparar() {
    const c = $('confeti');
    c.width = innerWidth * devicePixelRatio;
    c.height = innerHeight * devicePixelRatio;
    const colores = ['#FFD43B', '#FF6B6B', '#4DABF7', '#69DB7C', '#B07CFF', '#FF922B'];
    this.piezas = Array.from({ length: 90 }, () => ({
      x: innerWidth / 2, y: innerHeight * .35,
      vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - .5) * .4,
      w: 6 + Math.random() * 6, h: 10 + Math.random() * 8, color: colores[Math.random() * colores.length | 0],
    }));
    cancelAnimationFrame(this.anim);
    const ctx = c.getContext('2d');
    const paso = () => {
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of this.piezas) {
        p.x += p.vx; p.y += p.vy; p.vy += .45; p.vx *= .99; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      this.piezas = this.piezas.filter(p => p.y < innerHeight + 40);
      if (this.piezas.length) this.anim = requestAnimationFrame(paso);
    };
    paso();
  },
  parar() {
    cancelAnimationFrame(this.anim);
    this.piezas = [];
    const c = $('confeti');
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  },
};

// ---------------------------------------------------------------- Récords

const RecordsUI = {
  modo: 'escribir',
  init() {
    $('segModo').addEventListener('click', e => {
      const v = e.target.closest('button')?.dataset.v;
      if (v) { RecordsUI.modo = v; RecordsUI.mostrar(); }
    });
  },
  abrir() {
    RecordsUI.mostrar();
    if (Nube.conectado()) Nube.sincronizar().then(() => RecordsUI.mostrar(), () => {});
  },
  mostrar() {
    segmentos($('segModo'), RecordsUI.modo);
    $('txtAlcance').textContent = Nube.conectado()
      ? '🌎 Récords de todos: celulares y web.'
      : '📱 Solo los de este navegador. Para compartirlos con los demás, poné la clave en Configuración.';
    const fecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
    $('listaRecords').replaceChildren(...CATEGORIAS.map(cat => {
      const panel = document.createElement('div');
      panel.className = 'panel';
      const h = document.createElement('h2');
      h.className = 'seccion';
      h.textContent = nombreCategoria(cat);
      panel.append(h);
      const marcas = Records.lista(RecordsUI.modo, cat);
      if (!marcas.length) {
        const v = document.createElement('div');
        v.className = 'vacio';
        v.textContent = 'Todavía no hay partidas';
        panel.append(v);
      }
      marcas.forEach((m, i) => {
        const fila = document.createElement('div');
        fila.className = 'marca';
        const celdas = [
          ['', ['🥇', '🥈', '🥉'][i] || `${i + 1}.`],
          ['n', m.nombre || '—'],
          ['t', `${m.aciertos}/${m.total}`],
          ['', `⏱ ${formatoTiempo(m.ms)}`],
          ['f', fecha.format(new Date(m.fecha)).replace('.', '')],
        ];
        for (const [cls, txt] of celdas) {
          const s = document.createElement('span');
          s.className = cls;
          s.textContent = txt;
          fila.append(s);
        }
        panel.append(fila);
      });
      return panel;
    }));
  },
};

// ---------------------------------------------------------------- Arranque

(async () => {
  const [paises, sinBorde] = await Promise.all([
    fetch('paises.json').then(r => r.json()),
    fetch('sin_borde.json').then(r => r.json()).catch(() => []),
  ]);
  TODOS = paises;
  SIN_BORDE = new Set(sinBorde);
  Inicio.init();
  Ajustes.init();
  Juego.init();
  RecordsUI.init();
  history.replaceState(null, '', location.pathname);
  abrir('inicio');
  Nube.sincronizar().catch(() => {});
})();

// Para probar el corrector desde la consola o los tests.
window.Banderas = { evaluar, todos: () => TODOS };
