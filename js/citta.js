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
  PUNTI4.forEach((n, i) => aggiungi('a1-' + i, n, r0, r1, i * 90 - 45, i * 90 + 45, 100));
  if (R >= 4) PUNTI8.forEach((n, i) => aggiungi('a2-' + i, 'Periferia ' + n, r1, r2, i * 45 - 22.5, i * 45 + 22.5, 70));
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
const ABITANTI_MINIMI = 100000;   // sedi e filiali solo nelle città grandi
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
        troppoPiccola: !ab ? 'abitanti non noti' : ab < ABITANTI_MINIMI ? `${ab.toLocaleString('it-IT')} abitanti` : null };
    })
    .sort((a, b) => (!!a.troppoPiccola - !!b.troppoPiccola) || (b.abitanti || 0) - (a.abitanti || 0));
}

const CITTA_SUGGERITE = [
  { nome: 'Milano', dettaglio: 'Lombardia', lng: 9.1900, lat: 45.4642, raggio: 9 },
  { nome: 'Trieste', dettaglio: 'Friuli-Venezia Giulia', lng: 13.7768, lat: 45.6495, raggio: 5 },
  { nome: 'Venezia', dettaglio: 'Veneto (Mestre)', lng: 12.2389, lat: 45.4920, raggio: 5.5 },
  { nome: 'Bologna', dettaglio: 'Emilia-Romagna', lng: 11.3426, lat: 44.4949, raggio: 6 },
  { nome: 'Roma', dettaglio: 'Lazio', lng: 12.4964, lat: 41.9028, raggio: 10 },
  { nome: 'Napoli', dettaglio: 'Campania', lng: 14.2681, lat: 40.8518, raggio: 7 },
];
