/* Tycoon Logistica – mappa MapLibre (stile Dark Matter su dati OpenStreetMap) e furgoni animati. */

const STILE_MAPPA = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
let mappa = null, mappaPronta = false;
let anteprimaZone = null;          // zone mostrate mentre si sceglie la città, prima di iniziare
let markerDepositi = [], attesaClick = null;
function zoneAttuali() { return S ? S.zone : (anteprimaZone || []); }
const percorsi = {}; // id furgone -> { giorno, punti }
const posizioniFurgoni = {}; // id furgone -> [lng, lat] attuale

function puntoNelPoligono([x, y], poli) {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
function puntoCasuale(poli) {
  const xs = poli.map(p => p[0]), ys = poli.map(p => p[1]);
  for (let k = 0; k < 200; k++) {
    const p = [caso(Math.min(...xs), Math.max(...xs)), caso(Math.min(...ys), Math.max(...ys))];
    if (puntoNelPoligono(p, poli)) return p;
  }
  return poli[0];
}
function centroide(poli) {
  const n = poli.length; return [poli.reduce((a, p) => a + p[0], 0) / n, poli.reduce((a, p) => a + p[1], 0) / n];
}

function geoZone() {
  return { type: 'FeatureCollection', features: zoneAttuali().map(z => {
    const servita = S && S.furgoni.some(f => f.zona === z.id);
    return { type: 'Feature', properties: { id: z.id, nome: z.nome, colore: z.colore, servita: servita ? 1 : 0 },
      geometry: { type: 'Polygon', coordinates: [[...z.poligono, z.poligono[0]]] } };
  }) };
}
function geoEtichette() {
  return { type: 'FeatureCollection', features: zoneAttuali().map(z => ({ type: 'Feature',
    properties: { nome: z.nome, info: S && S.ieri && S.ieri.perZona && S.ieri.perZona[z.id] ? `${S.ieri.perZona[z.id].consegne} consegne oggi` : `${z.pacchi} pacchi/giorno` },
    geometry: { type: 'Point', coordinates: z.centro || centroide(z.poligono) } })) };
}

function avviaMappa(contenitore, quandoFallisce) {
  if (typeof maplibregl === 'undefined') { quandoFallisce('La libreria della mappa non si è caricata: controlla la connessione.'); return; }
  try {
    mappa = new maplibregl.Map({ container: contenitore, style: STILE_MAPPA, center: S ? [S.citta.lng, S.citta.lat] : [12.5, 42.5], zoom: S ? 12 : 5, attributionControl: { compact: true } });
  } catch (e) { quandoFallisce('Questo browser non riesce a disegnare la mappa (WebGL non disponibile).'); return; }
  mappa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  // avvisa solo se, dopo un po', lo stile della mappa non si è proprio caricato (un singolo tile mancante non conta)
  mappa.once('error', () => setTimeout(() => { if (!mappaPronta && !mappa.isStyleLoaded()) quandoFallisce('Non riesco a scaricare la mappa: serve internet.'); }, 4000));
  mappa.on('load', () => {
    coloriStileApple();
    mappa.addSource('zone', { type: 'geojson', data: geoZone() });
    mappa.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone',
      paint: { 'fill-color': ['get', 'colore'], 'fill-opacity': ['case', ['==', ['get', 'servita'], 1], 0.22, 0.07] } });
    mappa.addLayer({ id: 'zone-line', type: 'line', source: 'zone', filter: ['==', ['get', 'servita'], 1],
      paint: { 'line-color': ['get', 'colore'], 'line-width': 2.5, 'line-opacity': 0.9 } });
    mappa.addLayer({ id: 'zone-line-libere', type: 'line', source: 'zone', filter: ['==', ['get', 'servita'], 0],
      paint: { 'line-color': ['get', 'colore'], 'line-width': 1.5, 'line-opacity': 0.45, 'line-dasharray': [2, 2] } });
    mappa.addSource('etichette', { type: 'geojson', data: geoEtichette() });
    mappa.addLayer({ id: 'etichette', type: 'symbol', source: 'etichette',
      layout: { 'text-field': ['format', ['get', 'nome'], { 'font-scale': 1.0 }, '\n', {}, ['get', 'info'], { 'font-scale': 0.8 }],
        'text-font': ['Open Sans Bold', 'Noto Sans Bold'], 'text-size': 14, 'text-allow-overlap': false },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.6 } });
    mappa.addSource('furgoni', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    mappa.addLayer({ id: 'furgoni-alone', type: 'circle', source: 'furgoni',
      paint: { 'circle-radius': 11, 'circle-color': ['get', 'colore'], 'circle-opacity': 0.25, 'circle-blur': 0.6 } });
    mappa.addLayer({ id: 'furgoni', type: 'circle', source: 'furgoni',
      paint: { 'circle-radius': 6, 'circle-color': ['get', 'colore'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });

    aggiornaDepositiMappa();
    mappa.on('click', e => {
      if (!attesaClick) return;
      const cb = attesaClick; annullaPuntoSullaMappa(); cb([e.lngLat.lng, e.lngLat.lat]);
    });
    inquadraZone();
    const avviso = document.getElementById('avviso-mappa'); if (avviso) avviso.hidden = true;
    window.addEventListener('resize', () => { clearTimeout(inquadraZone._t); inquadraZone._t = setTimeout(inquadraZone, 250); });
    mappaPronta = true;
  });
}

// Inquadra le zone lasciando spazio al pannello. Il margine si adatta alla finestra,
// così su schermi stretti la mappa non si allontana fino a mostrare tutto il Friuli.
function inquadraZone() {
  if (!mappa) return;
  if (!zoneAttuali().length) return;
  const tutti = zoneAttuali().flatMap(z => z.poligono), xs = tutti.map(p => p[0]), ys = tutti.map(p => p[1]);
  const W = mappa.getContainer().clientWidth, H = mappa.getContainer().clientHeight;
  const stretto = W <= 760;
  const pannello = stretto ? 0 : Math.min(450, W * 0.45);
  const basso = stretto ? Math.min(H * 0.6, H - 160) : 40;
  const padding = { top: Math.min(90, H * 0.12), bottom: basso, left: pannello + 20, right: 30 };
  // se lo spazio libero è troppo piccolo, rinuncia al margine invece di allontanare la mappa
  if (W - padding.left - padding.right < 160 || H - padding.top - padding.bottom < 120) { padding.left = padding.right = 20; padding.top = padding.bottom = 20; }
  const cam = mappa.cameraForBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding, maxZoom: 13.5 });
  if (!cam) return;
  // centra le zone nello spazio libero (padding) e non allontanarti oltre lo zoom 10.5
  const centro = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  mappa.jumpTo({ center: centro, zoom: Math.max(10.5, cam.zoom), padding });
}

// magazzini: un segnaposto numerato per ciascuno
function aggiornaDepositiMappa() {
  if (!mappaPronta) return;
  markerDepositi.forEach(m => m.remove()); markerDepositi = [];
  (S ? S.depositi : []).forEach((d, i) => {
    const el = document.createElement('div'); el.className = 'marker-deposito'; el.title = d.nome; el.textContent = i + 1;
    markerDepositi.push(new maplibregl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(mappa));
  });
}
// modalità "clicca sulla mappa" per mettere un magazzino
function chiediPuntoSullaMappa(cb) { attesaClick = cb; if (mappa) mappa.getCanvas().style.cursor = 'crosshair'; }
function annullaPuntoSullaMappa() { attesaClick = null; if (mappa) mappa.getCanvas().style.cursor = ''; }
function mostraCitta(citta) {
  anteprimaZone = generaZone(citta);
  if (!mappaPronta) return anteprimaZone;
  aggiornaZoneMappa(); inquadraZone();
  return anteprimaZone;
}

// Ricolora lo stile Dark Matter con una palette scura in stile Apple Maps:
// terra grigio antracite, acqua blu notte, parchi verde scuro, strade grigie più chiare.
function coloriStileApple() {
  const imposta = (id, prop, val) => { try { mappa.setPaintProperty(id, prop, val); } catch (e) { /* livello senza questa proprietà */ } };
  mappa.getStyle().layers.forEach(l => {
    const id = l.id.toLowerCase();
    if (l.type === 'background') imposta(l.id, 'background-color', '#242426');
    else if (/water/.test(id) && l.type === 'fill') imposta(l.id, 'fill-color', '#16263a');
    else if (/water/.test(id) && l.type === 'line') imposta(l.id, 'line-color', '#1d3049');
    else if (/park|wood|grass|forest|landcover|landuse/.test(id) && l.type === 'fill') imposta(l.id, 'fill-color', '#22302a');
    else if (/building/.test(id) && l.type === 'fill') { imposta(l.id, 'fill-color', '#303033'); imposta(l.id, 'fill-outline-color', '#38383b'); }
    else if (/highway|motorway|major|trunk|primary/.test(id) && l.type === 'line') imposta(l.id, 'line-color', '#5a5a60');
    else if (/road|street|minor|secondary|tertiary|path|service/.test(id) && l.type === 'line') imposta(l.id, 'line-color', '#3f3f44');
    else if (l.type === 'symbol') { imposta(l.id, 'text-color', '#c7c7cc'); imposta(l.id, 'text-halo-color', 'rgba(20,20,22,0.9)'); }
  });
}

function aggiornaZoneMappa() {
  if (!mappaPronta) return;
  aggiornaDepositiMappa();
  mappa.getSource('zone').setData(geoZone());
  mappa.getSource('etichette').setData(geoEtichette());
}

// progresso: 0..1 della giornata in corso
function aggiornaFurgoniMappa(progresso) {
  if (!mappaPronta || !S) return;
  const primo = S.depositi[0], dep0 = [primo.lng, primo.lat];
  const lavora = feriale(S.giorno);
  const features = S.furgoni.map((f, i) => {
    let pos = [dep0[0] + 0.0012 + (i % 4) * 0.0006, dep0[1] - 0.0004 - Math.floor(i / 4) * 0.0005];
    let colore = '#8a96a3';
    // un jolly va nella zona che gli è toccata oggi (se nessuna, resta in deposito)
    const idZona = f.zona === ZONA_JOLLY ? (S.inCorso && S.inCorso.jolly && S.inCorso.jolly[f.id]) : f.zona;
    const z = idZona && zona(idZona);
    if (z && furgoneOperativo(f) && lavora) {
      colore = f.zona === ZONA_JOLLY ? '#ffd60a' : z.colore;
      const m = magazzinoVicino(z.centro).magazzino, dep = [m.lng, m.lat];
      if (!percorsi[f.id] || percorsi[f.id].giorno !== S.giorno || percorsi[f.id].dep !== m.id) {
        percorsi[f.id] = { giorno: S.giorno, dep: m.id, punti: [dep, ...Array.from({ length: 6 }, () => puntoCasuale(z.poligono)), dep] };
      }
      // fuori dal deposito dalle 8 alle 17 circa (dal 15% all'85% della giornata)
      const t = limita((progresso - 0.15) / 0.7, 0, 1);
      const p = percorsi[f.id].punti, tratto = t * (p.length - 1), k = Math.min(p.length - 2, Math.floor(tratto)), r = tratto - k;
      pos = [p[k][0] + (p[k + 1][0] - p[k][0]) * r, p[k][1] + (p[k + 1][1] - p[k][1]) * r];
    } else if (f.fermo > 0) colore = '#ff5c5c';
    posizioniFurgoni[f.id] = pos;
    return { type: 'Feature', properties: { colore }, geometry: { type: 'Point', coordinates: pos } };
  });
  mappa.getSource('furgoni').setData({ type: 'FeatureCollection', features });
}

// "+X €" che sale dai furgoni mentre consegnano: ogni furgone mostra quanto ha incassato negli ultimi secondi
const ultimoSoldi = {};
function soldiSullaMappa(t, progresso) {
  if (!mappaPronta || !S || !S.inCorso || !S.inCorso.perFurgone || !feriale(S.giorno)) return;
  if (progresso < 0.15 || progresso > 0.85) return;          // fuori orario i furgoni sono in deposito
  const passo = 2500, durataGiro = COSTANTI.secondiPerGiorno * 0.7 * 1000;
  const canvas = mappa.getCanvas().getBoundingClientRect();
  S.furgoni.forEach(f => {
    const n = S.inCorso.perFurgone[f.id]; if (!n || !furgoneOperativo(f)) return;
    if (t - (ultimoSoldi[f.id] || 0) < passo) return;
    ultimoSoldi[f.id] = t + Math.random() * 400;               // sfasati, non tutti insieme
    const pos = posizioniFurgoni[f.id]; if (!pos) return;
    const p = mappa.project(pos);
    if (p.x < 0 || p.y < 0 || p.x > canvas.width || p.y > canvas.height) return;
    const euro = n * tariffa() * passo / durataGiro;
    const el = document.createElement('div');
    el.className = 'soldi'; el.textContent = '+' + Math.round(euro) + ' €';
    el.style.left = (canvas.left + p.x) + 'px'; el.style.top = (canvas.top + p.y - 14) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  });
}
