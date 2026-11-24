/* Tycoon Logistica – livelli dell'azienda e licenze di zona.
   Ogni pacco consegnato vale 1 punto esperienza. A ogni livello si sblocca qualcosa.
   La periferia richiede una licenza per zona, acquistabile dopo il secondo magazzino. */

const LIVELLI = [
  { n: 1,  nome: 'Corriere di quartiere', xp: 0,      sblocca: ['Centro e primo anello della città', 'Furgoni Pacato Fiatt, Ford Trancit e Renò Mastre'] },
  { n: 2,  nome: 'Corriere cittadino',    xp: 2000,   sblocca: ['Furgone elettrico e-Pacato', 'Navigatore intelligente'] },
  { n: 3,  nome: 'Rete locale',           xp: 6000,   sblocca: ['Ivecco Daylì', 'Pubblicità in città'] },
  { n: 4,  nome: 'Logistica urbana',      xp: 15000,  sblocca: ['Mercedez Sprinta', 'Officina nel magazzino', 'Corso di guida sicura'] },
  { n: 5,  nome: 'Operatore regionale',   xp: 30000,  sblocca: ['Furgone elettrico grande e-Daylì', 'Nastro trasportatore'] },
  { n: 6,  nome: 'Gruppo logistico',      xp: 55000,  sblocca: ['Filiali in altre città', 'Gestionale automatizzato (100.000 €, per sempre): fa "Organizza" da solo ogni mattina'] },
  { n: 7,  nome: 'Rete interregionale',   xp: 90000,  sblocca: ['Contratti dei clienti pagati il 20% in più'] },
  { n: 8,  nome: 'Big della logistica',   xp: 140000, sblocca: ['Accordo flotta: −10% sui furgoni nuovi'] },
  { n: 9,  nome: 'Network nazionale',     xp: 210000, sblocca: ['Licenze di zona a metà prezzo'] },
  { n: 10, nome: 'Leader nazionale',      xp: 300000, sblocca: ['Il titolo più alto e una medaglia d\'oro'] },
];
// a che livello si sblocca cosa
const SBLOCCO = {
  modelli: { pacato: 1, trancit: 1, mastre: 1, epacato: 2, daily: 3, sprinta: 4, edaily: 5 },
  miglioramenti: { software: 2, pubblicita: 3, officina: 4, formazione: 4, nastro: 5 },
  filiali: 6, capoturno: 6, contrattiPiu: 7, scontoFurgoni: 8, licenzeMeta: 9,
};

function livelloAzienda() { let l = LIVELLI[0]; LIVELLI.forEach(x => { if ((S.xp || 0) >= x.xp) l = x; }); return l; }
function prossimoLivello() { return LIVELLI.find(x => x.xp > (S.xp || 0)) || null; }
function sbloccato(cosa, id) { const n = id === undefined ? SBLOCCO[cosa] : (SBLOCCO[cosa] || {})[id]; return !n || livelloAzienda().n >= n; }
function livelloPer(cosa, id) { return id === undefined ? SBLOCCO[cosa] : (SBLOCCO[cosa] || {})[id]; }

// chiamata a fine giornata con le consegne del giorno
function aggiungiEsperienza(consegne) {
  const prima = livelloAzienda().n;
  S.xp = (S.xp || 0) + Math.max(0, Math.round(consegne));
  const dopo = livelloAzienda().n;
  if (dopo > prima) {
    S.livelliNuovi = (S.livelliNuovi || []).concat(LIVELLI.filter(l => l.n > prima && l.n <= dopo).map(l => l.n));
    notizia(`Nuovo livello: ${livelloAzienda().nome} (${dopo})!`, 'buono', 'livello');
  }
}

/* ---------- licenze di zona ---------- */
const LICENZA = { euroPerPacco: 150 };
function ePeriferia(z) { return /(^|-)a2-/.test(z.id); }
function haLicenza(z) { return !ePeriferia(z) || !!(S.licenze && S.licenze[z.id]); }
function prezzoLicenza(z) { return Math.round(z.pacchi * LICENZA.euroPerPacco * (sbloccato('licenzeMeta') ? 0.5 : 1) / 500) * 500; }
function puoComprareLicenze() { return S.depositi.length >= 2; }
function compraLicenza(idZona) {
  const z = zona(idZona); if (!z) return 'Zona non trovata.';
  if (haLicenza(z)) return 'Hai già la licenza per questa zona.';
  if (!puoComprareLicenze()) return 'Le licenze per la periferia si comprano dopo aver aperto il secondo magazzino.';
  const p = prezzoLicenza(z); if (S.cassa < p) return `Servono ${p.toLocaleString('it-IT')} €.`;
  movimento('licenze', -p); S.licenze = S.licenze || {}; S.licenze[z.id] = true;
  notizia(`Licenza comprata: ora puoi consegnare in ${nomeZona(z)}.`, 'buono');
  return null;
}
