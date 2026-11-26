/* Tycoon Logistica – città qualsiasi: ricerca (OpenStreetMap Nominatim) e zone generate in automatico.
   Le zone sono cerchi e spicchi intorno al centro: un cerchio centrale, un anello diviso in 4
   e, per le città più grandi, un anello esterno diviso in 8. */

const COLORI_ZONE = ['#ff9f0a', '#0a84ff', '#30d158', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a',
  '#5e5ce6', '#ff6961', '#66d4cf', '#ffb340', '#ac8e68', '#da8fff'];
const PUNTI4 = ['Nord', 'Est', 'Sud', 'Ovest'];
const PUNTI8 = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ovest', 'Ovest', 'Nord-Ovest'];

// distanza in km tra due punti [lng, lat]
function distanzaKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// sposta un punto di dx, dy km (est, nord)
function spostaKm([lng, lat], dx, dy) {
  return [lng + dx / (111.32 * Math.cos(lat * Math.PI / 180)), lat + dy / 110.574];
}
// spicchio di anello: angoli in gradi, 0 = nord, in senso orario
function spicchio(centro, r1, r2, a1, a2) {
  const passi = Math.max(8, Math.round((a2 - a1) / 3)), pt = (r, a) => {
    const t = a * Math.PI / 180; return spostaKm(centro, r * Math.sin(t), r * Math.cos(t));
  };
  const fuori = [], dentro = [];
  for (let i = 0; i <= passi; i++) { const a = a1 + (a2 - a1) * i / passi; fuori.push(pt(r2, a)); if (r1 > 0) dentro.push(pt(r1, a)); }
  return r1 > 0 ? [...fuori, ...dentro.reverse()] : fuori;
}

// uno spicchio è "in mare" se più di metà della sua apertura cade nelle direzioni d'acqua della città
function inMare(citta, a1, a2) {
  const mare = citta.mare || (CAPOLUOGHI_REGIONE.find(c => c.nome === citta.nome) || {}).mare;
  if (!mare) return false;
  const dentro = a => mare.some(([da, a_]) => { const x = ((a % 360) + 360) % 360; return da <= a_ ? x >= da && x <= a_ : x >= da || x <= a_; });
  let n = 0; for (let k = 0; k < 10; k++) if (dentro(a1 + (a2 - a1) * (k + 0.5) / 10)) n++;
  return n > 5;
}

/* citta = { nome, lng, lat, raggio } (raggio in km). Restituisce le zone con poligono, pacchi e km. */
function generaZone(citta) {
  const c = [citta.lng, citta.lat], R = citta.raggio;
  const f = limita(Math.pow(R / 4, 0.4), 0.7, 1.4);   // città più grandi: più pacchi
  const zone = [];
  const aggiungi = (id, nome, r1, r2, a1, a2, pacchiBase) => {
    const area = Math.PI * (r2 * r2 - r1 * r1) * (a2 - a1) / 360;   // pacchi e km restano quelli di prima
    const am = (a1 + a2) / 2 * Math.PI / 180, rm = a2 - a1 >= 360 ? 0 : (r1 + r2) / 2;
    zone.push({ id, nome, colore: COLORI_ZONE[zone.length % COLORI_ZONE.length], ...disegnoZona(c, r1, r2, a1, a2),
      centro: spostaKm(c, rm * Math.sin(am), rm * Math.cos(am)),
      pacchi: Math.round(pacchiBase * f * (0.9 + Math.random() * 0.2)),
      kmGiro: Math.round(40 + 12 * Math.sqrt(area)) });
  };
  const r0 = 0.3 * R, r1 = 0.7 * R, r2 = 1.15 * R;
  aggiungi('centro', 'Centro', 0, r0, 0, 360, 150);
  PUNTI4.forEach((n, i) => { if (!inMare(citta, i * 90 - 45, i * 90 + 45)) aggiungi('a1-' + i, n, r0, r1, i * 90 - 45, i * 90 + 45, 100); });
  if (R >= 4) PUNTI8.forEach((n, i) => { if (!inMare(citta, i * 45 - 22.5, i * 45 + 22.5)) aggiungi('a2-' + i, 'Periferia ' + n, r1, r2, i * 45 - 22.5, i * 45 + 22.5, 70); });
  return zone;
}

/* Solo grafica: le zone si disegnano più grandi (SCALA_DISEGNO) così coprono bene la città sulla mappa.
   Pacchi, km dei giri e distanze dal magazzino non cambiano. */
const SCALA_DISEGNO = 1.35;
function disegnoZona(c, r1, r2, a1, a2) {
  const k = SCALA_DISEGNO, pieno = a2 - a1 >= 360;
  const poligono = pieno ? spicchio(c, 0, r2 * k, 0, 360).slice(0, -1) : spicchio(c, r1 * k, r2 * k, a1, a2);
  const am = (a1 + a2) / 2 * Math.PI / 180, rm = pieno ? 0 : (r1 + r2) / 2 * k;
  return { poligono, etichetta: spostaKm(c, rm * Math.sin(am), rm * Math.cos(am)) };
}
// ridisegna le zone di una partita già iniziata con la grafica nuova (stessi id, pacchi e km)
function ridisegnaZone(zone, citta) {
  const nuove = generaZone(citta);
  zone.forEach(z => { const base = z.id.replace(/^c\d+-/, ''), n = nuove.find(x => x.id === base); if (n) { z.poligono = n.poligono; z.etichetta = n.etichetta; } });
}

// raggio della città stimato dal riquadro che restituisce Nominatim (km, tra 2,5 e 10)
function raggioDaRiquadro(bbox) {
  const [s, n, o, e] = bbox.map(Number);
  const diag = distanzaKm([o, s], [e, n]);
  return Math.round(limita(diag / 2 * 0.8, 2.5, 10) * 10) / 10;
}

// Ricerca della città con Nominatim (gratuito, dati OpenStreetMap). Una richiesta per ricerca.
const ABITANTI_MINIMI = 100000;   // sedi e filiali: città grandi...
// ...oppure capoluoghi di provincia, dove ha una sede la rete dei corrieri come GLS (oltre 160 sedi in Italia)
const CAPOLUOGHI = ('agrigento alessandria ancona andria aosta arezzo ascoli piceno asti avellino bari barletta belluno benevento bergamo biella bologna ' +
  'bolzano brescia brindisi cagliari caltanissetta campobasso carbonia caserta catania catanzaro chieti como cosenza cremona crotone cuneo enna fermo ' +
  'ferrara firenze foggia forli frosinone genova gorizia grosseto imperia isernia la spezia l aquila latina lecce lecco livorno lodi lucca macerata ' +
  'mantova massa matera messina milano modena monza napoli novara nuoro oristano padova palermo parma pavia perugia pesaro pescara piacenza pisa ' +
  'pistoia pordenone potenza prato ragusa ravenna reggio calabria reggio emilia rieti rimini roma rovigo salerno sassari savona siena siracusa sondrio ' +
  'taranto teramo terni torino trani trapani trento treviso trieste udine urbino varese venezia verbania vercelli verona vibo valentia vicenza viterbo')
  .split(' ');
const NOMI_DOPPI = ['ascoli piceno', 'la spezia', 'l aquila', 'reggio calabria', 'reggio emilia', 'vibo valentia'];
// le parole dei nomi doppi non valgono da sole (es. "Reggio", "Piceno")
const PEZZI_DOPPI = NOMI_DOPPI.flatMap(n => n.split(' '));
CAPOLUOGHI.splice(0, CAPOLUOGHI.length, ...CAPOLUOGHI.filter(n => !PEZZI_DOPPI.includes(n)));
function normalizzaNome(n) {
  return n.split(/ - |\//)[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
    .replace(/^reggio nell emilia$/, 'reggio emilia').replace(/^reggio di calabria$/, 'reggio calabria').replace(/^monza.*/, 'monza').replace(/^pesaro.*/, 'pesaro');
}
function eCapoluogo(nome) { const n = normalizzaNome(nome); return NOMI_DOPPI.includes(n) || CAPOLUOGHI.includes(n); }
function abitanti(d) { const p = d.extratags && d.extratags.population; const n = parseInt(String(p || '').replace(/[^0-9]/g, ''), 10); return n > 0 ? n : null; }
async function cercaCitta(testo) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&extratags=1&accept-language=it&q=' + encodeURIComponent(testo);
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('ricerca non disponibile');
  const dati = await r.json();
  return dati.filter(d => ['place', 'boundary'].includes(d.category) || ['city', 'town', 'village', 'administrative'].includes(d.type))
    .map(d => {
      const ab = abitanti(d);
      return { nome: d.name || d.display_name.split(',')[0], dettaglio: d.display_name.split(',').slice(1, 4).join(',').trim(),
        lng: +d.lon, lat: +d.lat, raggio: raggioDaRiquadro(d.boundingbox), abitanti: ab,
        troppoPiccola: eCapoluogo(d.name || '') || (ab && ab >= ABITANTI_MINIMI) ? null
          : ab ? `${ab.toLocaleString(LOCALE)} abitanti e non è capoluogo` : 'non è capoluogo di provincia' };
    })
    .sort((a, b) => (!!a.troppoPiccola - !!b.troppoPiccola) || (b.abitanti || 0) - (a.abitanti || 0));
}

// Le 20 città dove si possono aprire nuovi magazzini: i capoluoghi di regione.
// mag = dove sta il magazzino (zona industriale o interporto vicino alla città).
// mare = direzioni dove c'è acqua (gradi, 0 = nord, in senso orario): lì non si creano zone.
const CAPOLUOGHI_REGIONE = [
  { nome: 'Torino', dettaglio: 'Piemonte', lng: 7.6869, lat: 45.0703, raggio: 7, mag: [7.6150, 45.0350] },
  { nome: 'Aosta', dettaglio: "Valle d'Aosta", lng: 7.3201, lat: 45.7375, raggio: 3, mag: [7.3500, 45.7300] },
  { nome: 'Milano', dettaglio: 'Lombardia', lng: 9.1900, lat: 45.4642, raggio: 9, mag: [9.1100, 45.5050] },
  { nome: 'Trento', dettaglio: 'Trentino-Alto Adige', lng: 11.1217, lat: 46.0748, raggio: 4, mag: [11.1100, 46.0950] },
  { nome: 'Venezia', dettaglio: 'Veneto (Mestre)', lng: 12.2389, lat: 45.4920, raggio: 5.5, mag: [12.2350, 45.4600], mare: [[95, 215]] },
  { nome: 'Trieste', dettaglio: 'Friuli-Venezia Giulia', lng: 13.7768, lat: 45.6495, raggio: 5, mag: [13.8000, 45.6150], mare: [[200, 345]] },
  { nome: 'Genova', dettaglio: 'Liguria', lng: 8.9463, lat: 44.4056, raggio: 6, mag: [8.8900, 44.4300], mare: [[100, 265]] },
  { nome: 'Bologna', dettaglio: 'Emilia-Romagna', lng: 11.3426, lat: 44.4949, raggio: 6, mag: [11.4000, 44.5050] },
  { nome: 'Firenze', dettaglio: 'Toscana', lng: 11.2558, lat: 43.7696, raggio: 6, mag: [11.1900, 43.8000] },
  { nome: 'Perugia', dettaglio: 'Umbria', lng: 12.3888, lat: 43.1107, raggio: 4, mag: [12.3600, 43.0850] },
  { nome: 'Ancona', dettaglio: 'Marche', lng: 13.5189, lat: 43.6158, raggio: 4, mag: [13.5200, 43.5750], mare: [[255, 80]] },
  { nome: 'Roma', dettaglio: 'Lazio', lng: 12.4964, lat: 41.9028, raggio: 10, mag: [12.5900, 41.9200] },
  { nome: "L'Aquila", dettaglio: 'Abruzzo', lng: 13.3995, lat: 42.3498, raggio: 4, mag: [13.4500, 42.3400] },
  { nome: 'Campobasso', dettaglio: 'Molise', lng: 14.6568, lat: 41.5603, raggio: 3, mag: [14.6800, 41.5700] },
  { nome: 'Napoli', dettaglio: 'Campania', lng: 14.2681, lat: 40.8518, raggio: 7, mag: [14.3050, 40.8550], mare: [[150, 255]] },
  { nome: 'Potenza', dettaglio: 'Basilicata', lng: 15.8056, lat: 40.6404, raggio: 3.5, mag: [15.7700, 40.6250] },
  { nome: 'Bari', dettaglio: 'Puglia', lng: 16.8719, lat: 41.1171, raggio: 6, mag: [16.8100, 41.1000], mare: [[285, 75]] },
  { nome: 'Catanzaro', dettaglio: 'Calabria', lng: 16.5877, lat: 38.9098, raggio: 4, mag: [16.5600, 38.8850] },
  { nome: 'Palermo', dettaglio: 'Sicilia', lng: 13.3615, lat: 38.1157, raggio: 6, mag: [13.4000, 38.0980], mare: [[15, 115]] },
  { nome: 'Cagliari', dettaglio: 'Sardegna', lng: 9.1217, lat: 39.2238, raggio: 5, mag: [9.0750, 39.2450], mare: [[115, 250]] },
];

const CITTA_SUGGERITE = [
  { nome: 'Udine', dettaglio: 'Friuli-Venezia Giulia', lng: 13.2350, lat: 46.0626, raggio: 4.5 },
  { nome: 'Milano', dettaglio: 'Lombardia', lng: 9.1900, lat: 45.4642, raggio: 9 },
  { nome: 'Trieste', dettaglio: 'Friuli-Venezia Giulia', lng: 13.7768, lat: 45.6495, raggio: 5 },
  { nome: 'Venezia', dettaglio: 'Veneto (Mestre)', lng: 12.2389, lat: 45.4920, raggio: 5.5 },
  { nome: 'Bologna', dettaglio: 'Emilia-Romagna', lng: 11.3426, lat: 44.4949, raggio: 6 },
  { nome: 'Roma', dettaglio: 'Lazio', lng: 12.4964, lat: 41.9028, raggio: 10 },
  { nome: 'Napoli', dettaglio: 'Campania', lng: 14.2681, lat: 40.8518, raggio: 7 },
];
