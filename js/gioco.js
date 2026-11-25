/* Tycoon Logistica – motore di simulazione (nessun accesso al DOM). */

const DATA_INIZIO = new Date(2027, 0, 4); // lunedì 4 gennaio 2027
const CHIAVE_SALVATAGGIO = 'tycoon-logistica-v02';
const VOCI = {
  incassi: 'Consegne', contratti: 'Contratti', premi: 'Premi obiettivi', vendite: 'Vendite (mezzi e magazzini)',
  personale: 'Personale', carburante: 'Carburante', ricarica: 'Ricarica',
  manutenzione: 'Manutenzione', assicurazione: 'Assicurazione', mezzi: 'Acquisto mezzi',
  magazzini: 'Acquisto magazzini', licenze: 'Licenze di zona', miglioramenti: 'Miglioramenti', penali: 'Penali contratti', eventi: 'Imprevisti', annunci: 'Annunci di lavoro',
};
// zona speciale: il furgone va ogni giorno dove ci sono più pacchi in attesa
const ZONA_JOLLY = 'jolly';
const VOCI_ENTRATA = ['incassi', 'contratti', 'premi', 'vendite'];

let S = null; // stato della partita

const caso = (a, b) => a + Math.random() * (b - a);
const casoInt = (a, b) => Math.floor(caso(a, b + 1));
const limita = (x, a, b) => Math.max(a, Math.min(b, x));
const scegli = arr => arr[Math.floor(Math.random() * arr.length)];

function dataDelGiorno(g) { const d = new Date(DATA_INIZIO); d.setDate(d.getDate() + g); return d; }
function chiaveMese(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function feriale(g) { const w = dataDelGiorno(g).getDay(); return w !== 0 && w !== 6; }
function modello(id) { return CATALOGO.find(m => m.id === id); }
function zona(id) { return id && String(id).startsWith(ZONA_JOLLY) ? { id, nome: 'Jolly', colore: '#ffffff' } : S.zone.find(z => z.id === id); }
// jolly: 'jolly' per la città principale, 'jolly:c2' per una filiale
function isJolly(f) { return typeof f.zona === 'string' && f.zona.startsWith(ZONA_JOLLY); }
function cittaJolly(f) { return (f.zona.split(':')[1]) || 'c1'; }

/* ---------- città: la principale (S.citta) e le filiali ---------- */
function tutteCitta() { return [S.citta, ...(S.filiali || [])]; }
function cittaDi(id) { return tutteCitta().find(c => c.id === (id || 'c1')) || S.citta; }
function idCitta(o) { return (o && o.cittaId) || 'c1'; }
function cittaVicina(lngLat) {
  let best = S.citta, d = Infinity;
  tutteCitta().forEach(c => { const k = distanzaKm([c.lng, c.lat], lngLat); if (k < d) { d = k; best = c; } });
  return { citta: best, km: d };
}
function nomeZona(z) { return (S.filiali && S.filiali.length) ? `${z.nome} · ${cittaDi(z.cittaId).nome}` : z.nome; }
// magazzino più vicino a un punto e km stradali del giro giornaliero di una zona
function magazzinoVicino(punto, cittaId) {
  let m = null, d = Infinity;
  const propri = cittaId ? S.depositi.filter(x => idCitta(x) === cittaId) : [];
  (propri.length ? propri : S.depositi).forEach(x => { const k = distanzaKm([x.lng, x.lat], punto); if (k < d) { d = k; m = x; } });
  return { magazzino: m, km: d };
}
// prezzo di un magazzino: 300.000 € in centro, scende fino a 200.000 € al bordo della città
// ogni magazzino in più costa il 20% più del precedente (2° ×1,2 · 3° ×1,44 · 4° ×1,73 · 5° ×2,07)
const RINCARO_MAGAZZINO = 1.2;
function rincaroMagazzini() { return S ? Math.pow(RINCARO_MAGAZZINO, S.depositi.length) : 1; }
function prezzoMagazzinoMin() { return Math.round(COSTANTI.prezzoMagazzinoMin * rincaroMagazzini() / 5000) * 5000; }
function prezzoMagazzinoMax() { return Math.round(COSTANTI.prezzoMagazzinoMax * rincaroMagazzini() / 5000) * 5000; }
function prezzoMagazzino(citta, lngLat, primo) {
  const t = limita(distanzaKm([citta.lng, citta.lat], lngLat) / (citta.raggio * 1.15), 0, 1);
  const p = (COSTANTI.prezzoMagazzinoMax - (COSTANTI.prezzoMagazzinoMax - COSTANTI.prezzoMagazzinoMin) * t) * (primo ? 1 : rincaroMagazzini());
  return Math.round(p / 5000) * 5000;
}
function kmGiro(z) {
  // i km partono dal magazzino a cui appartiene la zona (o dal più vicino)
  const m = z.mag && S.depositi.find(x => x.id === z.mag);
  return Math.round(z.kmGiro + 2 * COSTANTI.fattoreStrada * (m ? distanzaKm([m.lng, m.lat], z.centro) : magazzinoVicino(z.centro, idCitta(z)).km));
}
function dipendente(id) { return S.dipendenti.find(d => d.id === id); }
function nuovoId(pref) { S.seq += 1; return pref + S.seq; }

function vociVuote() { const v = {}; Object.keys(VOCI).forEach(k => v[k] = 0); return v; }

function nuovaPartita(prezzi, citta, primoMagazzino, zonePronte, nomeAzienda) {
  S = {
    citta: Object.assign(citta, { id: 'c1' }), filiali: [], versioneZone: 2, xp: 0, licenze: {}, capoturno: false, zone: (zonePronte || generaZone(citta)).map(z => Object.assign(z, { cittaId: 'c1' })),
    depositi: [{ id: 'm1', cittaId: 'c1', nome: 'Magazzino 1', lng: primoMagazzino[0], lat: primoMagazzino[1], valore: prezzoMagazzino(citta, primoMagazzino, true), migl: {} }], magAttivo: 'm1',
    versione: 1, seq: 0, giorno: 0,
    nomeAzienda: nomeAzienda || ('Logistica ' + citta.nome),
    cassa: COSTANTI.cassaIniziale, reputazione: 70, servizio: 0.94, fama: 0,
    furgoni: [], dipendenti: [],
    offerta: { autista: RUOLI.autista.stipDefault, magazziniere: RUOLI.magazziniere.stipDefault },
    candidati: { autista: [], magazziniere: [] }, annunciInArrivo: {},
    giacenze: {}, ieri: null,
    conti: { mese: chiaveMese(DATA_INIZIO), voci: vociVuote() }, storico: [],
    feed: [], prezzi: prezzi || PREZZI_RISERVA, tempoGiorno: 0,
    offertaContratto: null, contrattiAttivi: [], obiettivo: null, miglioramenti: {}, effetti: {}, evento: null,
  };
  S.zone.forEach(z => { S.giacenze[z.id] = 0; z.mag = 'm1'; });
  movimento('magazzini', -S.depositi[0].valore);
  generaCandidati('autista'); generaCandidati('magazziniere');
  notizia(`Benvenuto, ${S.nomeAzienda}! Sei a ${citta.nome}. Compra un furgone, assumi un autista e un magazziniere, poi assegna il furgone a una zona.`, 'info');
  return S;
}

/* ---------- conti e feed ---------- */
function movimento(voce, importo) {
  // importo positivo = entrata, negativo = uscita
  S.cassa += importo;
  // (|| 0): le partite salvate prima di una nuova voce dei conti non ce l'hanno ancora
  S.conti.voci[voce] = (S.conti.voci[voce] || 0) + Math.abs(importo);
}
function notizia(testo, tipo = 'info', chiave = testo) {
  const ultimo = S.feed.find(f => f.giorno === S.giorno && f.chiave === chiave);
  if (ultimo) { ultimo.n += 1; return; }
  S.feed.unshift({ giorno: S.giorno, testo, tipo, chiave, n: 1 });
  if (S.feed.length > 120) S.feed.length = 120;
}
function utileMese(voci) {
  let u = 0;
  for (const k in voci) u += VOCI_ENTRATA.includes(k) ? voci[k] : -voci[k];
  return u;
}

/* ---------- prezzi ---------- */
function prezzoRicaricaDeposito() { return S.prezzi.pun_eur_kwh + COSTANTI.oneriDeposito; }
function tariffa() { return COSTANTI.euroPerConsegna * (0.85 + S.reputazione / 100 * 0.3); }
function costoKm(m, usato) {
  const energia = m.tipo === 'diesel'
    ? m.consumo / 100 * S.prezzi.diesel_eur_litro
    : m.consumo / 100 * prezzoRicaricaDeposito();
  return { energia, manutenzione: m.manutKm * (usato ? 1.5 : 1) };
}
// Settimane di gioco perché l'elettrico (nuovo) recuperi la differenza rispetto al diesel di riferimento.
function ammortamento(idElettrico = 'epacato', idDiesel = 'pacato') {
  const e = modello(idElettrico), d = modello(idDiesel);
  const kmSettimana = 5 * 100;
  const ce = costoKm(e, false), cd = costoKm(d, false);
  const risparmio = ((cd.energia + cd.manutenzione) - (ce.energia + ce.manutenzione)) * kmSettimana;
  const differenza = e.prezzo - d.prezzo;
  return { settimane: risparmio > 0 ? Math.ceil(differenza / risparmio) : Infinity, risparmio, differenza, kmSettimana };
}

/* ---------- personale ---------- */
function generaCandidati(ruolo) {
  const r = RUOLI[ruolo], stip = S.offerta[ruolo];
  const t = (stip - r.stipMin) / (r.stipMax - r.stipMin);
  const n = limita(Math.round(1 + t * 4 + caso(-0.5, 0.5)), 1, 5);
  S.candidati[ruolo] = Array.from({ length: n }, () => ({
    id: nuovoId('c'), nome: scegli(NOMI) + ' ' + scegli(COGNOMI), ruolo, stipendio: stip,
    esperienza: ruolo === 'autista' ? Math.round(limita(10 + t * 65 + caso(-15, 15), 0, 95)) : null,
    indole: indoleCasuale(),   // nascosto: non dipende dall'esperienza
  }));
}
function pubblicaAnnuncio(ruolo, stipendio) {
  if (S.cassa < COSTANTI.costoAnnuncio) return 'Non hai abbastanza soldi per l\'annuncio.';
  S.offerta[ruolo] = stipendio;
  movimento('annunci', -COSTANTI.costoAnnuncio);
  S.candidati[ruolo] = [];
  S.annunciInArrivo[ruolo] = S.giorno + 1;
  notizia(`Annuncio pubblicato: ${RUOLI[ruolo].nome.toLowerCase()} a ${stipendio} €/mese. I candidati arrivano domani.`, 'info');
  return null;
}
function assumi(candId, ruolo) {
  const i = S.candidati[ruolo].findIndex(c => c.id === candId);
  if (i < 0) return 'Candidato non più disponibile.';
  const c = S.candidati[ruolo].splice(i, 1)[0];
  S.dipendenti.push({ id: nuovoId('d'), nome: c.nome, ruolo, stipendio: c.stipendio, esperienza: c.esperienza, assuntoGiorno: S.giorno, indole: c.indole, reg: [], mag: magAttivo() });
  notizia(`Assunto ${c.nome} come ${RUOLI[ruolo].nome.toLowerCase()}.`, 'buono');
  return null;
}
function licenzia(id) {
  const d = dipendente(id); if (!d) return;
  pagaPersonaleParziale(d);
  const liquidazione = costoLicenziamento(d);
  if (liquidazione) { movimento('personale', -liquidazione); notizia(`Liquidazione a ${d.nome}: ${liquidazione.toLocaleString('it-IT')} € (era fuori dal periodo di prova).`, 'info'); }
  S.dipendenti = S.dipendenti.filter(x => x.id !== id);
  S.furgoni.forEach(f => { if (f.autistaId === id) f.autistaId = null; });
  notizia(`${d.nome} non lavora più per te.`, 'male');
}

/* ---------- flotta ---------- */
function prezzoAcquisto(m, usato) { return Math.round(m.prezzo * (usato ? SCONTO_USATO : 1) * (!usato && S && sbloccato('scontoFurgoni') ? 0.9 : 1)); }
function compraFurgone(idModello, usato) {
  const m = modello(idModello), prezzo = prezzoAcquisto(m, usato);
  if (!sbloccato("modelli", m.id)) return `${m.nome}: si sblocca al livello ${livelloPer("modelli", m.id)}.`;
  if (S.cassa < prezzo) return 'Non hai abbastanza soldi.';
  movimento('mezzi', -prezzo);
  S.furgoni.push({ id: nuovoId('f'), modello: m.id, usato, km: usato ? casoInt(90000, 180000) : 0,
    autistaId: null, zona: null, fermo: 0, motivo: null, valore: prezzo, acquistatoGiorno: S.giorno, premio: 1, incidenti: 0, mag: magAttivo() });
  notizia(`Comprato ${m.nome}${usato ? ' usato' : ''} per ${prezzo.toLocaleString('it-IT')} €.`, 'info');
  return null;
}
function vendiFurgone(id) {
  const f = S.furgoni.find(x => x.id === id); if (!f) return;
  const ricavo = Math.round(f.valore * COSTANTI.valoreRivendita);
  S.consegneVendute = (S.consegneVendute || 0) + leggiStat(f, 'tot', 'consegne');
  movimento('vendite', ricavo);
  S.furgoni = S.furgoni.filter(x => x.id !== id);
  notizia(`Venduto ${modello(f.modello).nome} per ${ricavo} €.`, 'info');
}
function puoiMettereMagazzino(lngLat) {
  const { citta, km } = cittaVicina(lngLat);
  return km <= citta.raggio * COSTANTI.distanzaMaxMagazzino ? null : `Troppo lontano dalle tue città (${Math.round(km)} km dal centro di ${citta.nome}).`;
}
function apriMagazzino(lngLat) {
  if (magazziniSenzaResponsabile().length) return 'Prima completa i miglioramenti e affida ogni magazzino a un responsabile.';
  const err = puoiMettereMagazzino(lngLat); if (err) return err;
  const cittaM = cittaVicina(lngLat).citta, prezzo = prezzoMagazzino(cittaM, lngLat);
  if (S.cassa < prezzo) return `Qui un magazzino costa ${prezzo.toLocaleString('it-IT')} €: non hai abbastanza soldi.`;
  movimento('magazzini', -prezzo);
  const n = S.depositi.length + 1;
  const nuovo = { id: nuovoId('m'), cittaId: cittaM.id, nome: 'Magazzino ' + n + (S.filiali.length ? ' ' + cittaM.nome : ''), lng: lngLat[0], lat: lngLat[1], valore: prezzo, migl: {} };
  S.depositi.push(nuovo); assegnaZoneNuovoMagazzino(nuovo); S.magAttivo = nuovo.id;
  notizia(`Comprato il Magazzino ${n} per ${prezzo.toLocaleString('it-IT')} €. Ogni zona parte dal magazzino più vicino.`, 'buono');
  return null;
}
function valoreMagazzino(m) { return m.valore || COSTANTI.prezzoMagazzinoMin; }
function vendiMagazzino(id) {
  if (S.depositi.length <= 1) return 'Ti serve almeno un magazzino.';
  const m = S.depositi.find(x => x.id === id); if (!m) return null;
  const ricavo = Math.round(valoreMagazzino(m) * COSTANTI.rivenditaMagazzino);
  movimento('vendite', ricavo);
  S.depositi = S.depositi.filter(x => x.id !== id);
  notizia(`Venduto ${m.nome} per ${ricavo.toLocaleString('it-IT')} €.`, 'info');
  return null;
}

function assegna(idFurgone, campo, valore) {
  const f = S.furgoni.find(x => x.id === idFurgone); if (!f) return;
  if (campo === 'autista') {
    S.furgoni.forEach(x => { if (x.autistaId === valore && valore) x.autistaId = null; });
    f.autistaId = valore || null;
  } else {
    const z = valore && !String(valore).startsWith(ZONA_JOLLY) ? zona(valore) : null;
    if (z && magDi(z) !== magDi(f)) return 'altro-magazzino';
    if (z && !haLicenza(z)) { notizia(`Per consegnare in ${nomeZona(z)} serve la licenza (${prezzoLicenza(z).toLocaleString('it-IT')} €).`, 'male'); return 'licenza'; }
    f.zona = valore || null;
  }
}
function autistaSospeso(f) { const d = f.autistaId && dipendente(f.autistaId); return !!(d && d.sospesoFino >= S.giorno); }
function furgoneOperativo(f) { return f.zona && f.autistaId && f.fermo === 0 && !f.daRiparare && !autistaSospeso(f); }

/* ---------- guasti: il furgone resta fermo finché non lo fai riparare ---------- */
function furgoniDaRiparare() { return S ? S.furgoni.filter(f => f.daRiparare > 0) : []; }
function ripara(id) {
  const f = S.furgoni.find(x => x.id === id); if (!f || !f.daRiparare) return 'Questo furgone non è guasto.';
  if (S.cassa < f.daRiparare) return `Servono ${f.daRiparare.toLocaleString('it-IT')} € per la riparazione.`;
  movimento('manutenzione', -f.daRiparare); stat(f, 'manutenzione', f.daRiparare);
  notizia(`${modello(f.modello).nome} riparato per ${f.daRiparare.toLocaleString('it-IT')} €: dalla prossima giornata torna a lavorare.`, 'info');
  f.daRiparare = 0; f.fermo = 0; f.motivo = null;
  return null;
}

/* ---------- un giorno di gioco ---------- */
// Una giornata ha due momenti: l'inizio (si decide cosa succede) e la fine (si chiudono i conti).
// Nel mezzo l'interfaccia fa entrare l'incasso in cassa poco alla volta con avanzaIncasso().
function simulaGiorno() { avviaGiornata(); concludiGiornata(); }

function avviaGiornata() {
  const g = S.giorno;
  if (S.inCorso && S.inCorso.giorno === g) return; // già avviata (es. dopo una ricarica della pagina)
  S.inCorso = { giorno: g, incasso: 0, accreditato: 0, costi: {} };
  if (S.annunciInArrivo.autista === g) { generaCandidati('autista'); delete S.annunciInArrivo.autista; notizia('Sono arrivati nuovi candidati autisti.', 'info', 'cand-a'); }
  if (S.annunciInArrivo.magazziniere === g) { generaCandidati('magazziniere'); delete S.annunciInArrivo.magazziniere; notizia('Sono arrivati nuovi candidati magazzinieri.', 'info', 'cand-m'); }

  const d = dataDelGiorno(g);
  if (d.getDay() === 1 && g > 0) settimanale();
  if (feriale(g)) giornoLavorativo(); else S.ieri = { festivo: true, consegne: 0, incasso: 0, perZona: {} };
}

// p = quanto della giornata è passato (0..1): accredita la parte di incasso maturata finora
function avanzaIncasso(p) {
  const c = S.inCorso; if (!c || c.giorno !== S.giorno || !c.incasso) return;
  const dovuto = c.incasso * Math.min(1, Math.max(0, p));
  if (dovuto > c.accreditato) { movimento('incassi', dovuto - c.accreditato); c.accreditato = dovuto; }
}

function concludiGiornata() {
  const g = S.giorno, d = dataDelGiorno(g);
  if (!S.inCorso || S.inCorso.giorno !== g) avviaGiornata();
  avanzaIncasso(1);
  const c = S.inCorso.costi;
  for (const k in c) if (c[k]) movimento(k, -c[k]);
  (S.inCorso.contratti || []).forEach(x => { if (x.ricavo) movimento('contratti', x.ricavo); if (x.penale) movimento('penali', -x.penale); notiziaContratto(x); });
  if (S.inCorso.premio) movimento('premi', S.inCorso.premio);
  controllaTraguardi();
  // serie della cassa per i grafici (ultimi 180 giorni)
  S.serieCassa = S.serieCassa || [];
  S.serieCassa.push([g, Math.round(S.cassa)]);
  if (S.serieCassa.length > 180) S.serieCassa.splice(0, S.serieCassa.length - 180);
  S.inCorso = null;

  // fine mese: buste paga e assicurazione
  const domani = dataDelGiorno(g + 1);
  if (domani.getMonth() !== d.getMonth()) fineMese(d);
  S.giorno += 1;
}

function giornoLavorativo() {
  const servite = S.zone.filter(z => S.furgoni.some(f => f.zona === z.id));  // i jolly non aprono zone nuove
  forseEvento();
  controllaPosta();
  lavoroResponsabili(); contrattiResponsabili();
  if (dataDelGiorno(S.giorno).getDay() === 1) S.depositi.forEach(m => { if (m.responsabile || (S.gestionale && S.capoturno && S.taglia !== false && sbloccato('capoturno'))) tagliaPersonaleInPiu(m); });
  if (S.capoturno && S.gestionale && sbloccato('capoturno')) { let n = 0; S.depositi.filter(m => !m.responsabile).forEach(m => { n += applicaPiano(pianoOrganizza(m.id)); }); if (n) notizia(`Il capoturno ha riorganizzato la flotta (${n} cambi).`, 'info', 'capoturno'); }
  effettiDipendenti();
  const sciopero = effetto.sciopero();
  if (sciopero) notizia('Sciopero: oggi i furgoni restano in deposito.', 'male', 'sciopero');
  if (effetto.capacita() < 1) notizia('Neve: oggi i furgoni vanno piano e fanno meno consegne.', 'male', 'neve');
  const repFatt = 0.85 + S.reputazione / 100 * 0.3;

  // pacchi in arrivo per zona (nuovi + giacenze)
  const arrivo = {};
  let totale = 0;
  // picchi di ordini: ogni giorno in qualche zona di ogni città arrivano più pacchi del solito.
  // Sono il lavoro del jolly: abbastanza da tenerlo occupato, non tanto da intasare tutto.
  const picco = {};
  // Le zone cambiano ogni giorno (oggi il Centro, domani il Nord...).
  const ieri = S.picchiIeri || [];
  tutteCitta().forEach(c => {
    const zc = servite.filter(z => idCitta(z) === c.id); if (zc.length < 2) return;
    // più zone servi, più picchi: con 13 zone circa 5 furgoni di pacchi in più al giorno = lavoro per 5 jolly
    const quante = Math.min(5, Math.max(1, Math.floor(zc.length / 2.6)));
    const furgoniExtra = Math.min(5.4, Math.max(0.4, (zc.length - 2) * 0.5)) * caso(0.85, 1.05);
    const totale = Math.round(COSTANTI.maxConsegneCorriere * furgoniExtra);
    const scelte = [...zc].sort(() => Math.random() - 0.5).sort((a, b) => ieri.includes(a.id) - ieri.includes(b.id)).slice(0, quante);
    const pesi = scelte.map(() => caso(0.7, 1.3)), somma = pesi.reduce((a, b) => a + b, 0);
    scelte.forEach((z, i) => { picco[z.id] = Math.round(totale * pesi[i] / somma); });
  });
  S.picchiIeri = Object.keys(picco); S.piccoOggi = picco;
  const nuovi = {};
  servite.forEach(z => { nuovi[z.id] = Math.round(z.pacchi * repFatt * effetto.pacchi(z.id) * caso(0.9, 1.1)) + (picco[z.id] || 0); arrivo[z.id] = nuovi[z.id] + S.giacenze[z.id]; totale += arrivo[z.id]; });
  const zonePicco = Object.keys(picco).map(id => zona(id));
  if (zonePicco.length) {
    const haJolly = S.furgoni.some(f => isJolly(f) && furgoneOperativo(f));
    notizia(`Picco di ordini in ${zonePicco.map(z => nomeZona(z)).join(', ')} (+${Object.values(picco).reduce((a, b) => a + b, 0)} pacchi). ${haJolly ? 'Ci pensa il jolly.' : 'Un furgone jolly li porterebbe via.'}`, haJolly ? 'info' : 'male', 'picco');
  }
  S.zone.forEach(z => { if (!arrivo[z.id]) S.giacenze[z.id] = 0; });
  // smistamento: ogni magazzino ha i suoi magazzinieri
  const quota = {}, multi = S.depositi.length > 1;
  S.depositi.forEach(c => {
    const mags = S.dipendenti.filter(x => x.ruolo === 'magazziniere' && magDi(x) === c.id && !(x.sospesoFino >= S.giorno));
    const cap = Math.round(mags.reduce((t, m) => t + fattoreSmistamento(m), 0) * COSTANTI.pacchiMagazziniere * effetto.smistamento(c.id));
    mags.forEach(giornataMagazziniere);
    const tot = servite.filter(z => magDi(z) === c.id).reduce((t, z) => t + arrivo[z.id], 0);
    quota[c.id] = tot > 0 ? Math.min(1, cap / tot) : 0;
    c.quotaIeri = tot > 0 ? quota[c.id] : 1;
    mags.forEach(x => { stat(x, 'giorni', 1); stat(x, 'pacchi', Math.floor(tot * quota[c.id]) / mags.length); });
    const dove = multi ? c.nome + ': ' : '';
    if (tot > 0 && !mags.length) notizia(`${dove}nessun magazziniere, i pacchi restano nel magazzino e i furgoni non partono.`, 'male', 'no-mag-' + c.id);
    else if (quota[c.id] < 1) notizia(`${dove}magazzino intasato, i magazzinieri non riescono a smistare tutti i pacchi.`, 'male', 'intasato-' + c.id);
  });

  let incassoZone = 0, consegneTot = 0, consegneNormali = 0, carburante = 0, ricarica = 0, manut = 0, giacenzeTot = 0;
  const perZona = {}, perFurgone = {}, chiusi = [], jollyOggi = {};
  const capFurgone = Math.floor(COSTANTI.maxConsegneCorriere * effetto.capacita());

  // 1) ogni zona con i suoi furgoni: prima i contratti, poi i pacchi normali
  const ris = {};
  servite.forEach(z => {
    const smistati = Math.floor(arrivo[z.id] * (quota[magDi(z)] || 0));
    const giri = sciopero ? [] : S.furgoni.filter(f => f.zona === z.id && furgoneOperativo(f));
    const ec = eseguiContratti(z, giri, giri.reduce((t, f) => t + capacitaFurgone(f), 0));
    chiusi.push(...ec.chiusi);
    const consegneCtr = ec.chiusi.reduce((t, c) => t + c.fatti, 0);
    const consegne = Math.min(smistati, ec.capacita);
    // furgoni della zona che oggi non partono, con il motivo (per spiegarlo nella scheda Giri)
    const fuori = sciopero ? [] : S.furgoni.filter(f => f.zona === z.id && !furgoneOperativo(f))
      .map(f => f.fermo > 0 ? (f.motivo === 'incidente' ? 'fermo per incidente' : f.motivo === 'guasto' ? 'fermo per guasto' : 'fermo per ' + f.motivo) : !f.autistaId ? 'senza autista' : 'con l\'autista sospeso');
    ris[z.id] = { z, smistati, giri, consegneCtr, consegne, jolly: [], fuori, aiuto: 0 };
  });

  // 2a) con il gestionale acceso (o un responsabile) i furgoni che finiscono la zona con posto libero
  //     passano a dare una mano nella zona vicina che ha ancora più pacchi pronti
  let aiutati = 0;
  Object.values(ris).forEach(r => {
    const m = magDi(r.z);
    if (!(gestito(m) || (S.gestionale && S.capoturno)) || !r.giri.length) return;
    let libero = r.giri.reduce((t, f) => t + capacitaFurgone(f), 0) - r.consegne;
    const vicine = Object.values(ris).filter(x => x !== r && magDi(x.z) === m && x.smistati > x.consegne)
      .sort((a, b) => distanzaKm(r.z.centro, a.z.centro) - distanzaKm(r.z.centro, b.z.centro));
    vicine.forEach(x => { if (libero < 10) return; const n = Math.min(libero, x.smistati - x.consegne); x.consegne += n; x.aiuto += n; libero -= n; aiutati += n; });
  });
  if (aiutati) notizia(`Il gestionale ha mandato i furgoni con posto libero nelle zone vicine: ${aiutati} pacchi in più consegnati.`, 'info', 'aiuto');
  // 2) i jolly vanno da soli nella zona con più pacchi pronti in deposito che nessuno porta
  const jolly = sciopero ? [] : S.furgoni.filter(f => isJolly(f) && furgoneOperativo(f));
  // il jolly va nella zona con più pacchi pronti; se gli resta posto passa anche a una seconda zona
  jolly.forEach(f => {
    let posto = capacitaFurgone(f); jollyOggi[f.id] = null;
    for (let giro = 0; giro < 2 && posto > 10; giro++) {
      let meglio = null, attesa = 0;
      Object.values(ris).forEach(r => { if (magDi(r.z) !== magDi(f)) return;   // il jolly lavora per il suo magazzino
 const pronti = r.smistati - r.consegne; if (pronti > attesa) { attesa = pronti; meglio = r; } });
      if (!meglio) break;
      const extra = Math.min(attesa, posto);
      meglio.consegne += extra; meglio.jolly.push({ f, n: extra }); posto -= extra;
      if (!jollyOggi[f.id]) jollyOggi[f.id] = meglio.z.id;
    }
  });
  // quanti jolly sono serviti davvero oggi, per magazzino (servono a capire se ce ne sono troppi)
  if (!sciopero) S.depositi.forEach(m => {
    const portati = f => Object.values(ris).reduce((t, r) => t + r.jolly.filter(j => j.f === f).reduce((a, j) => a + j.n, 0), 0);
    const usati = jolly.filter(f => magDi(f) === m.id && portati(f) >= 30).length;   // jolly che oggi hanno lavorato davvero
    m.jollyUsati = (m.jollyUsati || []).concat(usati).slice(-10);
  });
  if (jolly.length) {
    const usati = Object.values(jollyOggi).filter(Boolean).length;
    notizia(usati ? `Jolly al lavoro: ${usati} furgon${usati > 1 ? 'i' : 'e'} a smaltire i pacchi in più.` : 'Jolly fermi: oggi nessuna zona ha pacchi in più.', 'info', 'jolly');
  }

  // 3) chiusura di ogni zona: giacenze, reputazione, km, incidenti
  servite.forEach(z => {
    const r = ris[z.id], giri = r.giri, consegne = r.consegne, consegneCtr = r.consegneCtr;
    const restano = arrivo[z.id] - consegne;
    const persi = Math.max(0, restano - z.pacchi);       // oltre un giorno di giacenza gli ordini si perdono
    S.giacenze[z.id] = restano - persi;
    const daJolly = r.jolly.reduce((t, j) => t + j.n, 0), daAiuto = r.aiuto;
    stat(z, 'consegne', consegne + consegneCtr); stat(z, 'incasso', consegne * tariffa() * effetto.tariffaZona(z.id));
    stat(magazzino(magDi(z)) || S.depositi[0], 'incasso', consegne * tariffa() * effetto.tariffaZona(z.id));
    perZona[z.id] = { picco: picco[z.id] || 0, nuovi: nuovi[z.id], arrivo: arrivo[z.id], smistati: r.smistati, consegne: consegne + consegneCtr, giacenza: S.giacenze[z.id],
      giri: giri.length, capacita: giri.reduce((t, f) => t + capacitaFurgone(f), 0), jolly: daJolly, aiuto: daAiuto, fuori: r.fuori, sciopero: !!sciopero };
    consegneTot += consegne + consegneCtr; consegneNormali += consegne; incassoZone += consegne * tariffa() * effetto.tariffaZona(z.id); giacenzeTot += S.giacenze[z.id];

    if (restano > 0 && (giri.length || daJolly)) notizia(`Zona ${z.nome}: pacchi in giacenza, la reputazione scende.`, 'male', 'giac-' + z.id);
    if (!giri.length && !daJolly && !sciopero) notizia(`Zona ${z.nome}: nessun furgone operativo oggi.`, 'male', 'ferma-' + z.id);
    if (persi > 0) notizia(`Zona ${z.nome}: ${persi} ordini persi per le giacenze.`, 'male', 'persi-' + z.id);

    // giri dei furgoni: quelli della zona si dividono le loro consegne, i jolly portano le loro
    const totZona = consegne - daJolly - daAiuto + consegneCtr;
    const lavori = giri.map((f, i) => ({ f, mie: Math.floor(totZona / giri.length) + (i < totZona % giri.length ? 1 : 0) }))
      .concat(r.jolly.map(j => ({ f: j.f, mie: j.n })));
    stat(magazzino(magDi(z)) || magazzinoVicino(z.centro, idCitta(z)).magazzino, 'pacchi', r.smistati);
    lavori.forEach(({ f, mie }) => {
      perFurgone[f.id] = mie;
      const km = Math.round(kmGiro(z) * effetto.km(z.id) * (ha(f, 'navigatore') ? 0.92 : 1) * (0.7 + 0.3 * Math.min(1, mie / 100)));
      const m = modello(f.modello), c = costoKm(m, f.usato);
      if (m.tipo === 'diesel') carburante += km * c.energia; else ricarica += km * c.energia;
      manut += km * c.manutenzione;
      stat(magazzino(magDi(f)) || S.depositi[0], 'costi', km * (c.energia + c.manutenzione));
      f.km += km;
      const a = dipendente(f.autistaId);
      a.esperienza = Math.min(100, a.esperienza + 0.15);
      // statistiche del furgone e dell'autista
      stat(f, 'giorni', 1); stat(f, 'consegne', mie); stat(f, 'km', km);
      stat(f, m.tipo === 'diesel' ? 'carburante' : 'ricarica', km * c.energia); stat(f, 'manutenzione', km * c.manutenzione);
      stat(f, 'incasso', mie * tariffa() * effetto.tariffaZona(z.id));
      stat(a, 'giorni', 1); stat(a, 'consegne', mie); stat(a, 'km', km);
      giornataAutista(a, f, mie, S.giacenze[z.id] === 0);
      // incidente: dipende dall'esperienza
      const pKm = Math.max(0.00004, 0.00032 - 0.0000028 * a.esperienza) * effetto.incidenti(magDi(a)) * (ha(f, 'telecamere') ? 0.75 : 1) * (a.rischio || 1) * fattoreIncidenti(a) * (f.difettoFino >= S.giorno ? 2 : 1);
      if (Math.random() < Math.max(pKm * km, a.indole === 'distratto' ? 0.15 : 0)) {   // il distratto: circa 3 incidenti al mese
        stat(f, 'incidenti', 1); stat(a, 'incidenti', 1); registra(a, 'incidente');
        f.fermo = casoInt(1, 3); f.motivo = 'incidente'; f.fermoDal = S.giorno;
        f.premio = (f.premio || 1) + COSTANTI.aumentoPremioIncidente; f.incidenti = (f.incidenti || 0) + 1;
        notizia(`Incidente: ${a.nome} con il ${m.nome}. Furgone fermo ${f.fermo} gg, assicurazione di questo furgone a ${assicurazioneFurgone(f)} €/mese. La riparazione è trattenuta dallo stipendio.`, 'male', 'inc-' + f.id);
      } else if (Math.random() < GUASTO_GIORNO[f.usato ? 'usato' : 'nuovo'] * (1 + f.km / 300000) * (ha(f, 'tagliandi') ? 0.6 : 1)) {
        const costo = Math.round(casoInt(300, 1200) * effetto.guasti(magDi(f)));
        stat(f, 'guasti', 1);
        // resta fermo finché il giocatore non paga la riparazione
        if (livello('officina', magDi(f)) || gestito(magDi(f))) {
          // con l'officina nel magazzino il meccanico ripara da solo (anche a gioco chiuso): un giorno di fermo
          movimento('manutenzione', -costo); stat(f, 'manutenzione', costo);
          f.fermo = 1; f.motivo = 'guasto'; f.fermoDal = S.giorno;
          notizia(`Guasto al ${m.nome}: l'officina l'ha già riparato (${costo} €), domani torna in strada.`, 'info', 'gua-' + f.id);
        } else {
          f.daRiparare = costo; f.fermo = 1; f.motivo = 'guasto'; f.fermoDal = S.giorno;
          notizia(`Guasto al ${m.nome}${f.usato ? ' usato' : ''}: resta fermo finché non lo ripari (${costo} €).`, 'male', 'gua-' + f.id);
        }
      }
    });
  });

  S.furgoni.filter(f => f.zona && !f.autistaId).forEach(f => notizia(`${modello(f.modello).nome} assegnato senza autista: resta fermo.`, 'male', 'noaut-' + f.id));
  // i giorni di fermo si scalano a fine giornata, ma non il giorno stesso dell'incidente/guasto
  S.furgoni.forEach(f => { if (f.fermo > 0 && !f.daRiparare && f.fermoDal !== S.giorno) { f.fermo -= 1; if (f.fermo === 0) f.motivo = null; } });

  chiusi.push(...contrattiNonServiti());
  const incasso = Math.round(incassoZone);
  if (servite.length) S.serieSenzaGiacenze = giacenzeTot === 0 ? (S.serieSenzaGiacenze || 0) + 1 : 0;
  const premio = valutaObiettivo(consegneTot, giacenzeTot);
  nuovoObiettivo(consegneTot, giacenzeTot);
  // l'incasso delle consegne entra in cassa piano piano durante la giornata;
  // contratti, premi, penali e costi a fine giornata
  S.inCorso = { giorno: S.giorno, incasso, accreditato: 0, perFurgone, jolly: jollyOggi, contratti: chiusi, premio,
    costi: { carburante: Math.round(carburante), ricarica: Math.round(ricarica), manutenzione: Math.round(manut) } };
  S.ieri = { festivo: false, consegne: consegneTot, incasso, perZona };
  aggiungiEsperienza(consegneTot);
  aggiornaReputazione(perZona);
  if (consegneTot) notizia(`${consegneTot} consegne, incasso ${incasso.toLocaleString('it-IT')} €.`, 'buono', 'giornata');
}

function assicurazioneFurgone(f) { return Math.round(COSTANTI.assicurazioneMensile * (f.premio || 1)); }

function settimanale() {
  ['autista', 'magazziniere'].forEach(r => { if (!S.annunciInArrivo[r]) generaCandidati(r); });
}

function giorniNelMese(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function pagaPersonaleParziale(dip) {
  // stipendio dei giorni lavorati nel mese corrente, se licenziato a metà mese
  const d = dataDelGiorno(S.giorno), inizio = Math.max(dip.assuntoGiorno, S.giorno - d.getDate() + 1);
  const giorni = S.giorno - inizio + 1;
  movimento('personale', -Math.round(dip.stipendio * giorni / giorniNelMese(d)));
}
function fineMese(d) {
  const primo = S.giorno - d.getDate() + 1, gg = giorniNelMese(d);
  let personale = 0;
  S.dipendenti.forEach(x => { const giorni = S.giorno - Math.max(x.assuntoGiorno, primo) + 1; personale += x.stipendio * giorni / gg; });
  if (personale) movimento('personale', -Math.round(personale));
  const assic = S.furgoni.reduce((t, f) => t + assicurazioneFurgone(f), 0);
  if (assic) movimento('assicurazione', -assic);
  const nomeMese = d.toLocaleDateString('it-IT', { month: 'long' });
  if (personale) notizia(`Busta paga di ${nomeMese}: ${Math.round(personale)} € al personale.`, 'info', 'paga');
  if (assic) notizia(`Assicurazione flotta di ${nomeMese}: ${assic} €.`, 'info', 'assic');
  S.furgoni.forEach(f => { stat(f, 'assicurazione', assicurazioneFurgone(f)); stat(magazzino(magDi(f)) || S.depositi[0], 'costi', assicurazioneFurgone(f)); });
  S.dipendenti.forEach(x => stat(magazzino(magDi(x)) || S.depositi[0], 'costi', x.stipendio * (S.giorno - Math.max(x.assuntoGiorno, primo) + 1) / gg));
  reportMensile(d);

  S.dipendenti.forEach(x => stat(x, 'stipendio', x.stipendio * (S.giorno - Math.max(x.assuntoGiorno, primo) + 1) / gg));
  [...S.furgoni, ...S.dipendenti, ...S.depositi, ...S.zone].forEach(chiudiMeseStat);
  S.storico.unshift({ mese: S.conti.mese, voci: S.conti.voci });
  S.storico.length = Math.min(S.storico.length, 12);
  S.conti = { mese: chiaveMese(dataDelGiorno(S.giorno + 1)), voci: vociVuote() };
  if (S.cassa < 0) notizia('Cassa in rosso! Vendi un mezzo o riduci i costi.', 'male', 'rosso');
}

// il lunedì il gestionale (o il responsabile) licenzia chi è in più: autisti senza furgone oltre uno di riserva,
// e i jolly che negli ultimi 10 giorni non sono mai serviti tutti insieme (vende anche il loro furgone).
function tagliaPersonaleInPiu(m) {
  let licenziati = 0, venduti = 0;
  const peggiori = (a, b) => (stelleDi(a) ?? 3) - (stelleDi(b) ?? 3) || costoLicenziamento(a) - costoLicenziamento(b);
  const senzaFurgone = S.dipendenti.filter(d => d.ruolo === 'autista' && magDi(d) === m.id && !S.furgoni.some(f => f.autistaId === d.id) && !(d.sospesoFino >= S.giorno))
    .sort(peggiori);
  senzaFurgone.slice(0, Math.max(0, senzaFurgone.length - 1)).forEach(d => { licenzia(d.id); licenziati++; });
  const storia = m.jollyUsati || [];
  if (storia.length >= 5) {
    const servono = Math.max(JOLLY_MINIMI, Math.max(...storia) + 1);   // mai sotto i 5 jolly di riserva
    const euroKm = f => { const k = costoKm(modello(f.modello), f.usato); return k.energia + k.manutenzione; };
    const jolly = S.furgoni.filter(f => magDi(f) === m.id && isJolly(f) && f.autistaId && furgoneOperativo(f)).sort((a, b) => euroKm(b) - euroKm(a));
    jolly.slice(0, Math.max(0, jolly.length - servono)).forEach(f => { const d = f.autistaId; vendiFurgone(f.id); licenzia(d); venduti++; licenziati++; });
  }
  if (licenziati || venduti) {
    const chi = m.responsabile ? `${m.responsabile.nome} (${m.nome})` : 'Il gestionale';
    notizia(`${chi}: personale in più tagliato, ${licenziati} autist${licenziati === 1 ? 'a' : 'i'} licenziat${licenziati === 1 ? 'o' : 'i'}${venduti ? ` e ${venduti} jolly vendut${venduti === 1 ? 'o' : 'i'}` : ''}.`, 'info', 'taglia-' + m.id);
    if (m.responsabile) { const r = m.responsabile; r.mese = r.mese || {}; r.mese.tagliati = (r.mese.tagliati || 0) + licenziati; }
  }
}
const JOLLY_MINIMI = 5;   // riserva fissa: i picchi e i guasti li coprono loro
const COSTO_GESTIONALE = 100000;   // una volta sola, poi è tuo per sempre
function compraGestionale() {
  if (S.gestionale) return null;
  if (!sbloccato('capoturno')) return 'Non ancora sbloccato.';
  if (S.cassa < COSTO_GESTIONALE) return 'Non hai abbastanza soldi.';
  movimento('miglioramenti', -COSTO_GESTIONALE); S.gestionale = true; S.capoturno = true; salva(); return null;
}

/* ---------- salvataggio ---------- */
function salva() { if (S) S.salvatoIl = Date.now(); try { localStorage.setItem(CHIAVE_SALVATAGGIO, JSON.stringify(S)); } catch (e) { /* niente salvataggio */ } }
function carica() {
  try {
    const t = localStorage.getItem(CHIAVE_SALVATAGGIO);
    if (t) {
      S = JSON.parse(t);
      // partite salvate prima di questa versione
      if (!S.nomeAzienda) S.nomeAzienda = 'Logistica ' + S.citta.nome;
      if (!S.citta.id) S.citta.id = 'c1';
      if (!S.filiali) S.filiali = [];
      // magazzini come sedi: zone, furgoni e dipendenti appartengono a un magazzino; miglioramenti per magazzino
      if (!S.depositi[0].migl) {
        S.depositi.forEach(m => { m.migl = Object.assign({}, S.miglioramenti || {}); });
        S.zone.forEach(z => { z.mag = magazzinoVicino(z.centro, idCitta(z)).magazzino.id; });
        S.furgoni.forEach(f => { const z = f.zona && !isJolly(f) && zona(f.zona); f.mag = z ? z.mag : (S.depositi.find(m => idCitta(m) === (isJolly(f) ? cittaJolly(f) : 'c1')) || S.depositi[0]).id; });
        S.dipendenti.forEach(d => { const f = S.furgoni.find(x => x.autistaId === d.id); d.mag = f ? f.mag : (S.depositi.find(m => idCitta(m) === idCitta(d)) || S.depositi[0]).id; });
        S.magAttivo = S.depositi[0].id;
      }
      // posta: via le email già risposte, al massimo 3 da leggere (le più recenti)
      if (S.posta && S.postaRicevute === undefined) { S.postaUsate = S.posta.map(m => m.id).slice(0, 30); S.postaRicevute = S.posta.length; S.posta = S.posta.filter(m => m.risposta === null).slice(0, 3); }
      // livelli e licenze: l'esperienza parte dalle consegne già fatte; le zone di periferia già servite restano tue
      // carattere nascosto anche per chi era già assunto (stesse probabilità dei nuovi)
      S.dipendenti.forEach(d => { if (d.indole === undefined) { d.indole = indoleCasuale(); d.reg = d.reg || []; } });
      if (S.xp === undefined) { S.xp = totaleConsegne(); S.licenze = {}; S.zone.filter(z => /(^|-)a2-/.test(z.id) && S.furgoni.some(f => f.zona === z.id)).forEach(z => { S.licenze[z.id] = true; }); }
      // reputazione v2: livello di servizio + fama (vedi aggiornaReputazione)
      if (S.servizio === undefined) { S.servizio = Math.max(0.9, 1 - (85 - Math.min(S.reputazione, 85)) / 150); S.fama = Math.max(0, S.reputazione - 85); S.reputazione = calcolaReputazione(); }
      // grafica delle zone v2: più grandi sulla mappa (pacchi e km invariati)
      if ((S.versioneZone || 1) < 2) { tutteCitta().forEach(c => ridisegnaZone(S.zone.filter(z => idCitta(z) === c.id), c)); S.versioneZone = 2; }
      if (!S.contrattiAttivi) S.contrattiAttivi = [];
      // conti: aggiunge le voci nuove e ripara i valori rotti (NaN) delle versioni precedenti
      const ripara = v => { Object.keys(VOCI).forEach(k => { if (!Number.isFinite(v[k])) v[k] = 0; }); for (const k in v) if (!Number.isFinite(v[k])) v[k] = 0; };
      ripara(S.conti.voci); (S.storico || []).forEach(m => ripara(m.voci));
      if (!Number.isFinite(S.cassa)) S.cassa = 0;
      if (!S.miglioramenti) S.miglioramenti = {};
      if (!S.effetti) S.effetti = {};
      // allestimenti e carichi speciali tolti: i contratti già firmati diventano pacchi express
      S.furgoni.forEach(f => { delete f.allestimento; });
      (S.contrattiAttivi || []).forEach(c => { c.tipo = 'standard'; });
      if (S.offertaContratto) S.offertaContratto.tipo = 'standard';
      S.furgoni.forEach(f => { if (!f.premio) f.premio = S.premio || 1; });
      delete S.premio;
      return S;
    }
  } catch (e) { /* ignora */ }
  return null;
}
function cancellaSalvataggio() { try { localStorage.removeItem(CHIAVE_SALVATAGGIO); } catch (e) { /* ignora */ } }

if (typeof module !== 'undefined') module.exports = { get S() { return S; }, nuovaPartita, avviaGiornata, concludiGiornata, avanzaIncasso, apriMagazzino, kmGiro, simulaGiorno, compraFurgone, assumi, assegna, pubblicaAnnuncio, ammortamento, utileMese, dataDelGiorno };

function rinominaAzienda(nome) {
  nome = String(nome || '').trim().slice(0, 40);
  if (nome.length < 2) return 'Il nome deve avere almeno 2 caratteri.';
  S.nomeAzienda = nome; return null;
}

/* ---------- tempo passato a gioco chiuso ---------- */
const OFFLINE_MAX_SECONDI = 2 * 60 * 60;   // si recuperano al massimo 2 ore reali
// Fa passare il tempo trascorso mentre il gioco era chiuso, con la stessa simulazione di sempre
// (niente offerte di contratto ed eventi: quelli richiedono il giocatore). Restituisce un riepilogo.
function recuperaOffline() {
  if (!S || !S.salvatoIl) return null;
  const secondi = Math.min(OFFLINE_MAX_SECONDI, (Date.now() - S.salvatoIl) / 1000);
  if (secondi < 60) return null;
  const prima = { cassa: S.cassa, giorno: S.giorno, consegne: 0, servizio: S.servizio, reputazione: S.reputazione };
  // con l'officina nel magazzino i furgoni già guasti si riparano mentre sei via
  S.furgoni.filter(f => f.daRiparare && livello('officina', magDi(f))).forEach(f => { movimento('manutenzione', -f.daRiparare); f.daRiparare = 0; f.fermo = 0; f.motivo = null; });
  const durata = COSTANTI.secondiPerGiorno;
  S.recuperoOffline = true;
  S.offertaContratto = null;
  let resto = secondi, consegne = 0;
  while (resto > 0) {
    if (!S.inCorso || S.inCorso.giorno !== S.giorno) avviaGiornata();
    const mancano = durata - (S.tempoGiorno || 0);
    if (resto < mancano) { S.tempoGiorno = (S.tempoGiorno || 0) + resto; avanzaIncasso(S.tempoGiorno / durata); break; }
    resto -= mancano; S.tempoGiorno = 0;
    consegne += (S.ieri && !S.ieri.festivo) ? S.ieri.consegne : 0;
    const sabato = dataDelGiorno(S.giorno).getDay() === 6;
    concludiGiornata();
    if (sabato) simulaGiorno();
  }
  delete S.recuperoOffline;
  // a gioco chiuso la reputazione può scendere al massimo di 5 punti
  if (S.reputazione < prima.reputazione - 5) { S.servizio = Math.max(S.servizio, prima.servizio - 0.02); S.reputazione = prima.reputazione - 5; }
  return { secondi, ridotto: (Date.now() - S.salvatoIl) / 1000 > OFFLINE_MAX_SECONDI, giorni: S.giorno - prima.giorno, consegne, differenza: S.cassa - prima.cassa };
}

/* ---------- filiali in altre città ---------- */
const FILIALE = { costo: 50000, furgoni: 5, reputazione: 60 };
function requisitiFiliale() {
  const mancano = [];
  if (!sbloccato('filiali')) mancano.push(`il livello ${livelloPer('filiali')} dell'azienda`);
  if (magazziniSenzaResponsabile().length) mancano.push('un responsabile in ogni magazzino');
  if (S.furgoni.length < FILIALE.furgoni) mancano.push(`almeno ${FILIALE.furgoni} furgoni (ne hai ${S.furgoni.length})`);
  if (S.reputazione < FILIALE.reputazione) mancano.push(`reputazione almeno ${FILIALE.reputazione} (ora ${Math.round(S.reputazione)})`);
  if (S.cassa < FILIALE.costo + prezzoMagazzinoMin()) mancano.push(`almeno ${(FILIALE.costo + prezzoMagazzinoMin()).toLocaleString('it-IT')} € in cassa`);
  return mancano;
}
function apriFiliale(citta, lngLat, zonePronte) {
  const manca = requisitiFiliale(); if (manca.length) return 'Ti servono ' + manca.join(', ') + '.';
  if (tutteCitta().some(c => distanzaKm([c.lng, c.lat], [citta.lng, citta.lat]) < c.raggio + citta.raggio)) return 'Questa città è troppo vicina a una dove sei già.';
  const id = 'c' + (S.filiali.length + 2);
  const nuova = Object.assign({}, citta, { id });
  const d = distanzaKm([citta.lng, citta.lat], lngLat);
  if (d > citta.raggio * COSTANTI.distanzaMaxMagazzino) return `Troppo lontano dal centro di ${citta.nome} (${Math.round(d)} km).`;
  const prezzo = prezzoMagazzino(nuova, lngLat);
  if (S.cassa < FILIALE.costo + prezzo) return `Servono ${(FILIALE.costo + prezzo).toLocaleString('it-IT')} € (apertura + magazzino).`;
  movimento('magazzini', -(FILIALE.costo + prezzo));
  S.filiali.push(nuova);
  const zone = (zonePronte || generaZone(nuova)).map(z => Object.assign(z, { id: id + '-' + z.id, cittaId: id }));
  const mNuovo = { id: nuovoId('m'), cittaId: id, nome: 'Magazzino ' + citta.nome, lng: lngLat[0], lat: lngLat[1], valore: prezzo, migl: {} };
  S.depositi.push(mNuovo); S.magAttivo = mNuovo.id;
  zone.forEach(z => { z.mag = mNuovo.id; S.zone.push(z); S.giacenze[z.id] = 0; });
  notizia(`Aperta la filiale di ${citta.nome}! Assumi magazzinieri per la nuova città e assegna i furgoni alle sue zone.`, 'buono');
  return null;
}
/* ---------- nuovi magazzini: solo nei capoluoghi di regione ----------
   Ogni nuovo magazzino apre in un capoluogo dove non sei ancora, con le sue zone, nel punto già deciso.
   Prezzo: più la città è grande più costa, e ogni magazzino in più costa il 20% più del precedente. */
function capoluoghiLiberi() {
  return CAPOLUOGHI_REGIONE.filter(c => !tutteCitta().some(t => t.nome === c.nome || distanzaKm([t.lng, t.lat], [c.lng, c.lat]) < t.raggio + c.raggio));
}
function prezzoSede(c) { return Math.round((COSTANTI.prezzoMagazzinoMin + 12000 * c.raggio) * rincaroMagazzini() / 5000) * 5000; }
function apriSede(nome) {
  if (magazziniSenzaResponsabile().length) return 'Prima completa i miglioramenti e affida ogni magazzino a un responsabile.';
  const c = capoluoghiLiberi().find(x => x.nome === nome); if (!c) return 'Qui hai già un magazzino.';
  const prezzo = prezzoSede(c);
  if (S.cassa < prezzo) return `A ${c.nome} il magazzino costa ${prezzo.toLocaleString('it-IT')} €: non hai abbastanza soldi.`;
  movimento('magazzini', -prezzo);
  const id = 'c' + (S.filiali.length + 2);
  const nuova = { id, nome: c.nome, dettaglio: c.dettaglio, lng: c.lng, lat: c.lat, raggio: c.raggio };
  S.filiali.push(nuova);
  const zone = generaZone(nuova).map(z => Object.assign(z, { id: id + '-' + z.id, cittaId: id }));
  const m = { id: nuovoId('m'), cittaId: id, nome: 'Magazzino ' + c.nome, lng: c.mag[0], lat: c.mag[1], valore: prezzo, migl: {} };
  S.depositi.push(m); S.magAttivo = m.id;
  zone.forEach(z => { z.mag = m.id; S.zone.push(z); S.giacenze[z.id] = 0; });
  notizia(`Aperto il magazzino di ${c.nome} per ${prezzo.toLocaleString('it-IT')} €: si riparte da zero, con i soldi del primo.`, 'buono');
  salva(); return null;
}
function spostaMagazziniere(id, cittaId) { const d = dipendente(id); if (d) d.cittaId = cittaId; }

/* ---------- reputazione ----------
   Reputazione = servizio + fama.
   - servizio: media degli ultimi giorni (circa una settimana) della quota di pacchi consegnati.
     Consegnare tutto vale 85 punti; ogni 1% di pacchi lasciati indietro ne toglie 1,5. Un giorno storto pesa poco.
   - fama: le scelte nelle email, negli eventi e nei contratti (da −30 a +15), torna piano piano verso 0.
   Ogni giorno la reputazione si muove al massimo di 3 punti per il servizio. */
function calcolaReputazione() {
  const base = limita(85 - 150 * (1 - S.servizio), 0, 85);
  return limita(base + (S.fama || 0), 0, 100);
}
function aggiornaReputazione(perZona) {
  // quota del giorno: pacchi consegnati / pacchi arrivati oggi (gli arretrati smaltiti contano a favore)
  const z = Object.values(perZona || {}); const arrivo = z.reduce((t, x) => t + (x.nuovi || x.arrivo), 0);
  if (arrivo > 0) {
    const oggi = Math.min(1, z.reduce((t, x) => t + x.consegne, 0) / arrivo);
    S.servizio = 0.85 * (S.servizio === undefined ? oggi : S.servizio) + 0.15 * oggi;
  }
  S.fama = (S.fama || 0) * 0.99;
  const obiettivo = calcolaReputazione();
  S.reputazione = limita(S.reputazione + limita(obiettivo - S.reputazione, -3, 3), 0, 100);
}
function cambiaFama(punti) {
  S.fama = limita((S.fama || 0) + punti, -30, 15);
  S.reputazione = limita(S.reputazione + punti, 0, 100);
}

/* ---------- Organizza: assegnazione automatica di autisti, furgoni e zone ----------
   1) gli autisti liberi vanno sui furgoni senza autista (prima i più esperti);
   2) ogni zona già servita riceve i furgoni che le servono per i suoi pacchi;
   3) i furgoni in più (o in deposito) vanno alle zone che ne hanno bisogno, poi diventano jolly della loro città;
   4) i giri più lunghi ai furgoni che costano meno al km, i jolly a quelli che consumano di più.
   Restituisce l'elenco dei cambi senza applicarli, così il giocatore li vede prima. */
function pianoOrganizza(soloMag) {
  // lavora magazzino per magazzino: furgoni, autisti e zone non passano da un magazzino all'altro
  const cambi = [], prova = S.furgoni.filter(f => !soloMag || magDi(f) === soloMag).map(f => ({ f, autista: f.autistaId, zona: f.zona }));
  const pronto = p => p.autista && !p.f.daRiparare && p.f.fermo === 0 && !autistaSospeso(p.f);
  S.depositi.filter(c => !soloMag || c.id === soloMag).forEach(c => {
    const miei = prova.filter(p => magDi(p.f) === c.id);
    const occupati = new Set(S.furgoni.map(f => f.autistaId).filter(Boolean));
    const liberi = S.dipendenti.filter(d => d.ruolo === 'autista' && magDi(d) === c.id && !occupati.has(d.id) && !(d.sospesoFino >= S.giorno)).sort((a, b) => b.esperienza - a.esperienza);
    miei.filter(p => !p.autista && !p.f.daRiparare).forEach(p => { const d = liberi.shift(); if (d) p.autista = d.id; });
    // pacchi normali attesi in ogni zona (come li calcola la giornata). Picchi e pacchi rimasti in deposito
    // cambiano zona ogni giorno: li coprono i jolly, che vanno dove servono.
    const repFatt = 0.85 + S.reputazione / 100 * 0.3;
    const serve = z => z.pacchi * repFatt * effetto.pacchi(z.id);
    const servite = S.zone.filter(z => magDi(z) === c.id && miei.some(p => p.zona === z.id));
    const jolly = (miei.find(p => p.zona && p.zona.startsWith(ZONA_JOLLY)) || {}).zona || ZONA_JOLLY;
    const pool = miei.filter(pronto), assegnati = new Map(), manca = new Map(servite.map(z => [z.id, serve(z)]));
    const soglia = COSTANTI.maxConsegneCorriere * 0.5;   // sotto mezzo furgone di pacchi ci pensano i jolly
    // a turno, la zona più scoperta prende un furgone: prima uno che era già lì, poi quello che la copre meglio.
    // Ogni zona ha almeno un furgone; poi restano sempre 5 jolly di riserva (se ci sono abbastanza furgoni).
    const riserva = Math.min(JOLLY_MINIMI, Math.max(0, pool.length - servite.length));
    const coperta = id => [...assegnati.values()].includes(id);
    for (;;) {
      const scoperte = servite.filter(z => !coperta(z.id)).length;
      const soloScoperte = pool.length <= riserva + scoperte;   // i furgoni rimasti servono alle zone vuote o alla riserva
      let peggio = null; manca.forEach((m, id) => { if (m > soglia && !(soloScoperte && coperta(id)) && (!peggio || m > manca.get(peggio))) peggio = id; });
      if (!peggio || !pool.length) break;
      const m = manca.get(peggio);
      let i = pool.findIndex(p => p.zona === peggio);
      if (i < 0) { const basta = pool.map((p, k) => ({ k, c: capacitaFurgone(p.f) })).filter(x => x.c >= m).sort((x, y) => x.c - y.c)[0];
        i = basta ? basta.k : pool.reduce((best, p, k) => capacitaFurgone(p.f) > capacitaFurgone(pool[best].f) ? k : best, 0); }
      const p = pool.splice(i, 1)[0]; assegnati.set(p, peggio); manca.set(peggio, m - capacitaFurgone(p.f));
    }
    assegnati.forEach((z, p) => { p.zona = z; });
    pool.forEach(p => { p.zona = jolly; });   // gli altri fanno i jolly: vanno dove restano pacchi
    // i giri con più km ai furgoni che costano meno al km (elettrici), i jolly a quelli che consumano di più.
    // Si scambiano i posti solo tra furgoni con la stessa capienza, così ogni zona resta coperta.
    const posto = z => z.startsWith(ZONA_JOLLY) ? 0 : kmGiro(zona(z));
    const euroKm = p => { const k = costoKm(modello(p.f.modello), p.f.usato); return k.energia + k.manutenzione; };
    const perCapienza = {};
    miei.filter(p => pronto(p) && p.zona).forEach(p => { (perCapienza[capacitaFurgone(p.f)] = perCapienza[capacitaFurgone(p.f)] || []).push(p); });
    Object.values(perCapienza).forEach(g => {
      const posti = g.map(p => p.zona).sort((a, b) => posto(b) - posto(a));
      [...g].sort((a, b) => euroKm(a) - euroKm(b)).forEach((p, i) => { p.zona = posti[i]; });
    });
  });
  prova.forEach(p => {
    if (p.autista !== p.f.autistaId) cambi.push({ f: p.f, campo: 'autista', da: p.f.autistaId, a: p.autista });
    if ((p.zona || null) !== (p.f.zona || null)) cambi.push({ f: p.f, campo: 'zona', da: p.f.zona, a: p.zona });
  });
  return cambi;
}
function applicaPiano(cambi) { cambi.forEach(c => assegna(c.f.id, c.campo, c.a)); return cambi.length; }
