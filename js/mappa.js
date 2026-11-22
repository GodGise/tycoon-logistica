/* Tycoon Logistica – mappa MapLibre (stile Dark Matter su dati OpenStreetMap) e furgoni animati. */

const STILE_MAPPA = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
let mappa = null, mappaPronta = false;
const percorsi = {}; // id furgone -> { giorno, punti }

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
  return { type: 'FeatureCollection', features: ZONE.map(z => {
    const servita = S && S.furgoni.some(f => f.zona === z.id);
    return { type: 'Feature', properties: { id: z.id, nome: z.nome, colore: z.colore, servita: servita ? 1 : 0 },
      geometry: { type: 'Polygon', coordinates: [[...z.poligono, z.poligono[0]]] } };
  }) };
}
function geoEtichette() {
  return { type: 'FeatureCollection', features: ZONE.map(z => ({ type: 'Feature',
    properties: { nome: z.nome, info: S && S.ieri && S.ieri.perZona && S.ieri.perZona[z.id] ? `${S.ieri.perZona[z.id].consegne} consegne ieri` : `${z.pacchi} pacchi/giorno` },
    geometry: { type: 'Point', coordinates: centroide(z.poligono) } })) };
}

function avviaMappa(contenitore, quandoFallisce) {
  if (typeof maplibregl === 'undefined') { quandoFallisce('La libreria della mappa non si è caricata: controlla la connessione.'); return; }
  try {
    mappa = new maplibregl.Map({ container: contenitore, style: STILE_MAPPA, center: [13.236, 46.062], zoom: 12.6, attributionControl: { compact: true } });
  } catch (e) { quandoFallisce('Questo browser non riesce a disegnare la mappa (WebGL non disponibile).'); return; }
  mappa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  // avvisa solo se, dopo un po', lo stile della mappa non si è proprio caricato (un singolo tile mancante non conta)
  mappa.once('error', () => setTimeout(() => { if (!mappaPronta && !mappa.isStyleLoaded()) quandoFallisce('Non riesco a scaricare la mappa: serve internet.'); }, 4000));
  mappa.on('load', () => {
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

    const el = document.createElement('div'); el.className = 'marker-deposito'; el.title = DEPOSITO.nome; el.textContent = 'D';
    new maplibregl.Marker({ element: el }).setLngLat([DEPOSITO.lng, DEPOSITO.lat]).addTo(mappa);
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
  const tutti = ZONE.flatMap(z => z.poligono), xs = tutti.map(p => p[0]), ys = tutti.map(p => p[1]);
  const W = mappa.getContainer().clientWidth, H = mappa.getContainer().clientHeight;
  const stretto = W <= 760;
  const pannello = stretto ? 0 : Math.min(450, W * 0.45);
  const basso = stretto ? Math.min(H * 0.6, H - 160) : 40;
  const padding = { top: Math.min(90, H * 0.12), bottom: basso, left: pannello + 20, right: 30 };
  // se lo spazio libero è troppo piccolo, rinuncia al margine invece di allontanare la mappa
  if (W - padding.left - padding.right < 160 || H - padding.top - padding.bottom < 120) { padding.left = padding.right = 20; padding.top = padding.bottom = 20; }
  const cam = mappa.cameraForBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding, maxZoom: 13.5 });
  if (!cam) return;
  // centra le zone nello spazio libero (padding) e non allontanarti oltre lo zoom 11.5
  const centro = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  mappa.jumpTo({ center: centro, zoom: Math.max(11.5, cam.zoom), padding });
}

function aggiornaZoneMappa() {
  if (!mappaPronta) return;
  mappa.getSource('zone').setData(geoZone());
  mappa.getSource('etichette').setData(geoEtichette());
}

// progresso: 0..1 della giornata in corso
function aggiornaFurgoniMappa(progresso) {
  if (!mappaPronta || !S) return;
  const dep = [DEPOSITO.lng, DEPOSITO.lat];
  const lavora = feriale(S.giorno);
  const features = S.furgoni.map((f, i) => {
    let pos = [dep[0] + 0.0012 + (i % 4) * 0.0006, dep[1] - 0.0004 - Math.floor(i / 4) * 0.0005];
    let colore = '#8a96a3';
    const z = f.zona && zona(f.zona);
    if (z && furgoneOperativo(f) && lavora) {
      colore = z.colore;
      if (!percorsi[f.id] || percorsi[f.id].giorno !== S.giorno) {
        percorsi[f.id] = { giorno: S.giorno, punti: [dep, ...Array.from({ length: 6 }, () => puntoCasuale(z.poligono)), dep] };
      }
      // fuori dal deposito dalle 8 alle 17 circa (dal 15% all'85% della giornata)
      const t = limita((progresso - 0.15) / 0.7, 0, 1);
      const p = percorsi[f.id].punti, tratto = t * (p.length - 1), k = Math.min(p.length - 2, Math.floor(tratto)), r = tratto - k;
      pos = [p[k][0] + (p[k + 1][0] - p[k][0]) * r, p[k][1] + (p[k + 1][1] - p[k][1]) * r];
    } else if (f.fermo > 0) colore = '#ff5c5c';
    return { type: 'Feature', properties: { colore }, geometry: { type: 'Point', coordinates: pos } };
  });
  mappa.getSource('furgoni').setData({ type: 'FeatureCollection', features });
}
