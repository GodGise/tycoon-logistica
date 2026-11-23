/* Tycoon Logistica – motore di simulazione (nessun accesso al DOM). */

const DATA_INIZIO = new Date(2027, 0, 4); // lunedì 4 gennaio 2027
const CHIAVE_SALVATAGGIO = 'tycoon-logistica-v02';
const VOCI = {
  incassi: 'Consegne', contratti: 'Contratti', premi: 'Premi obiettivi', vendite: 'Vendite (mezzi e magazzini)',
  personale: 'Personale', carburante: 'Carburante', ricarica: 'Ricarica',
  manutenzione: 'Manutenzione', assicurazione: 'Assicurazione', mezzi: 'Acquisto mezzi',
  magazzini: 'Acquisto magazzini', miglioramenti: 'Miglioramenti', penali: 'Penali contratti', eventi: 'Imprevisti', annunci: 'Annunci di lavoro',
};
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
function zona(id) { return S.zone.find(z => z.id === id); }
// magazzino più vicino a un punto e km stradali del giro giornaliero di una zona
function magazzinoVicino(punto) {
  let m = null, d = Infinity;
  S.depositi.forEach(x => { const k = distanzaKm([x.lng, x.lat], punto); if (k < d) { d = k; m = x; } });
  return { magazzino: m, km: d };
}
// prezzo di un magazzino: 300.000 € in centro, scende fino a 200.000 € al bordo della città
function prezzoMagazzino(citta, lngLat) {
  const t = limita(distanzaKm([citta.lng, citta.lat], lngLat) / (citta.raggio * 1.15), 0, 1);
  const p = COSTANTI.prezzoMagazzinoMax - (COSTANTI.prezzoMagazzinoMax - COSTANTI.prezzoMagazzinoMin) * t;
  return Math.round(p / 5000) * 5000;
}
function kmGiro(z) { return Math.round(z.kmGiro + 2 * COSTANTI.fattoreStrada * magazzinoVicino(z.centro).km); }
function dipendente(id) { return S.dipendenti.find(d => d.id === id); }
function nuovoId(pref) { S.seq += 1; return pref + S.seq; }

function vociVuote() { const v = {}; Object.keys(VOCI).forEach(k => v[k] = 0); return v; }

function nuovaPartita(prezzi, citta, primoMagazzino, zonePronte, nomeAzienda) {
  S = {
    citta, zone: zonePronte || generaZone(citta),
    depositi: [{ id: 'm1', nome: 'Magazzino 1', lng: primoMagazzino[0], lat: primoMagazzino[1], valore: prezzoMagazzino(citta, primoMagazzino) }],
    versione: 1, seq: 0, giorno: 0,
    nomeAzienda: nomeAzienda || ('Logistica ' + citta.nome),
    cassa: COSTANTI.cassaIniziale, reputazione: 70,
    furgoni: [], dipendenti: [],
    offerta: { autista: RUOLI.autista.stipDefault, magazziniere: RUOLI.magazziniere.stipDefault },
    candidati: { autista: [], magazziniere: [] }, annunciInArrivo: {},
    giacenze: {}, ieri: null,
    conti: { mese: chiaveMese(DATA_INIZIO), voci: vociVuote() }, storico: [],
    feed: [], prezzi: prezzi || PREZZI_RISERVA, tempoGiorno: 0,
    offertaContratto: null, contrattiAttivi: [], obiettivo: null, miglioramenti: {}, effetti: {}, evento: null,
  };
  S.zone.forEach(z => S.giacenze[z.id] = 0);
  movimento('magazzini', -S.depositi[0].valore);
  generaCandidati('autista'); generaCandidati('magazziniere');
  notizia(`Benvenuto, ${S.nomeAzienda}! Sei a ${citta.nome}. Compra un furgone, assumi un autista e un magazziniere, poi assegna il furgone a una zona.`, 'info');
  return S;
}

/* ---------- conti e feed ---------- */
function movimento(voce, importo) {
  // importo positivo = entrata, negativo = uscita
  S.cassa += importo;
  S.conti.voci[voce] += Math.abs(importo);
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
  S.dipendenti.push({ id: nuovoId('d'), nome: c.nome, ruolo, stipendio: c.stipendio, esperienza: c.esperienza, assuntoGiorno: S.giorno });
  notizia(`Assunto ${c.nome} come ${RUOLI[ruolo].nome.toLowerCase()}.`, 'buono');
  return null;
}
function licenzia(id) {
  const d = dipendente(id); if (!d) return;
  pagaPersonaleParziale(d);
  S.dipendenti = S.dipendenti.filter(x => x.id !== id);
  S.furgoni.forEach(f => { if (f.autistaId === id) f.autistaId = null; });
  notizia(`${d.nome} non lavora più per te.`, 'male');
}

/* ---------- flotta ---------- */
function prezzoAcquisto(m, usato, all = 'standard') { return Math.round(m.prezzo * (usato ? SCONTO_USATO : 1)) + ALLESTIMENTI[all].costo; }
function compraFurgone(idModello, usato, allestimento = 'standard') {
  const m = modello(idModello), prezzo = prezzoAcquisto(m, usato, allestimento);
  if (S.cassa < prezzo) return 'Non hai abbastanza soldi.';
  movimento('mezzi', -prezzo);
  S.furgoni.push({ id: nuovoId('f'), modello: m.id, usato, km: usato ? casoInt(90000, 180000) : 0,
    autistaId: null, zona: null, fermo: 0, motivo: null, valore: prezzo, acquistatoGiorno: S.giorno, premio: 1, incidenti: 0, allestimento });
  notizia(`Comprato ${m.nome}${usato ? ' usato' : ''}${allestimento !== 'standard' ? ' ' + ALLESTIMENTI[allestimento].nome.toLowerCase() : ''} per ${prezzo.toLocaleString('it-IT')} €.`, 'info');
  return null;
}
function vendiFurgone(id) {
  const f = S.furgoni.find(x => x.id === id); if (!f) return;
  const ricavo = Math.round(f.valore * COSTANTI.valoreRivendita);
  movimento('vendite', ricavo);
  S.furgoni = S.furgoni.filter(x => x.id !== id);
  notizia(`Venduto ${modello(f.modello).nome} per ${ricavo} €.`, 'info');
}
function puoiMettereMagazzino(lngLat) {
  const d = distanzaKm([S.citta.lng, S.citta.lat], lngLat);
  return d <= S.citta.raggio * COSTANTI.distanzaMaxMagazzino ? null : `Troppo lontano dalla città (${Math.round(d)} km dal centro).`;
}
function apriMagazzino(lngLat) {
  const err = puoiMettereMagazzino(lngLat); if (err) return err;
  const prezzo = prezzoMagazzino(S.citta, lngLat);
  if (S.cassa < prezzo) return `Qui un magazzino costa ${prezzo.toLocaleString('it-IT')} €: non hai abbastanza soldi.`;
  movimento('magazzini', -prezzo);
  const n = S.depositi.length + 1;
  S.depositi.push({ id: nuovoId('m'), nome: 'Magazzino ' + n, lng: lngLat[0], lat: lngLat[1], valore: prezzo });
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
  } else f.zona = valore || null;
}
function furgoneOperativo(f) { return f.zona && f.autistaId && f.fermo === 0; }

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
  S.inCorso = null;

  // fine mese: buste paga e assicurazione
  const domani = dataDelGiorno(g + 1);
  if (domani.getMonth() !== d.getMonth()) fineMese(d);
  S.giorno += 1;
}

function giornoLavorativo() {
  const magazzinieri = S.dipendenti.filter(x => x.ruolo === 'magazziniere').length;
  const servite = S.zone.filter(z => S.furgoni.some(f => f.zona === z.id));
  const capSmistamento = Math.round(magazzinieri * COSTANTI.pacchiMagazziniere * effetto.smistamento());
  forseEvento();
  const sciopero = effetto.sciopero();
  if (sciopero) notizia('Sciopero: oggi i furgoni restano in deposito.', 'male', 'sciopero');
  if (effetto.capacita() < 1) notizia('Neve: oggi i furgoni vanno piano e fanno meno consegne.', 'male', 'neve');
  const repFatt = 0.85 + S.reputazione / 100 * 0.3;

  // pacchi in arrivo per zona (nuovi + giacenze)
  const arrivo = {};
  let totale = 0;
  servite.forEach(z => { arrivo[z.id] = Math.round(z.pacchi * repFatt * effetto.pacchi(z.id) * caso(0.9, 1.1)) + S.giacenze[z.id]; totale += arrivo[z.id]; });
  S.zone.forEach(z => { if (!arrivo[z.id]) S.giacenze[z.id] = 0; });
  const quota = totale > 0 ? Math.min(1, capSmistamento / totale) : 0;
  if (servite.length && magazzinieri === 0) notizia('Nessun magazziniere: i pacchi restano nel magazzino e i furgoni non partono.', 'male', 'no-mag');
  else if (quota < 1) notizia('Magazzino intasato: i magazzinieri non riescono a smistare tutti i pacchi.', 'male', 'intasato');

  let incassoZone = 0, consegneTot = 0, consegneNormali = 0, carburante = 0, ricarica = 0, manut = 0, giacenzeTot = 0;
  const perZona = {}, perFurgone = {}, chiusi = [];
  servite.forEach(z => {
    const smistati = Math.floor(arrivo[z.id] * quota);
    const giri = sciopero ? [] : S.furgoni.filter(f => f.zona === z.id && furgoneOperativo(f));
    // prima i contratti, poi i pacchi normali
    const ec = eseguiContratti(z, giri, Math.floor(giri.length * COSTANTI.maxConsegneCorriere * effetto.capacita()));
    chiusi.push(...ec.chiusi);
    const consegneCtr = ec.chiusi.reduce((t, c) => t + c.fatti, 0);
    const consegne = Math.min(smistati, ec.capacita);
    const restano = arrivo[z.id] - consegne;
    const persi = Math.max(0, restano - z.pacchi);       // oltre un giorno di giacenza gli ordini si perdono
    S.giacenze[z.id] = restano - persi;
    perZona[z.id] = { arrivo: arrivo[z.id], consegne: consegne + consegneCtr, giacenza: S.giacenze[z.id], giri: giri.length };
    consegneTot += consegne + consegneCtr; consegneNormali += consegne; incassoZone += consegne * tariffa() * effetto.tariffaZona(z.id); giacenzeTot += S.giacenze[z.id];

    if (restano > 0 && giri.length) notizia(`Zona ${z.nome}: pacchi in giacenza, la reputazione scende.`, 'male', 'giac-' + z.id);
    if (!giri.length && !sciopero) notizia(`Zona ${z.nome}: nessun furgone operativo oggi.`, 'male', 'ferma-' + z.id);
    // reputazione: scende solo se resta indietro più del 10% dei pacchi della zona, sale se si consegna tutto
    const soglia = z.pacchi * 0.1;
    S.reputazione = limita(S.reputazione + (restano > soglia ? -Math.min(2, restano / 50) : restano > 0 ? 0 : 0.4), 0, 100);
    if (persi > 0) notizia(`Zona ${z.nome}: ${persi} ordini persi per le giacenze.`, 'male', 'persi-' + z.id);

    const totZona = consegne + consegneCtr;
    giri.forEach((f, i) => {
      const mie = Math.floor(totZona / giri.length) + (i < totZona % giri.length ? 1 : 0);
      perFurgone[f.id] = mie;
      const km = Math.round(kmGiro(z) * effetto.km(z.id) * (0.7 + 0.3 * Math.min(1, mie / 100)));
      const m = modello(f.modello), c = costoKm(m, f.usato);
      if (m.tipo === 'diesel') carburante += km * c.energia; else ricarica += km * c.energia;
      manut += km * c.manutenzione;
      f.km += km;
      const a = dipendente(f.autistaId);
      a.esperienza = Math.min(100, a.esperienza + 0.15);
      // incidente: dipende dall'esperienza
      const pKm = Math.max(0.00004, 0.00032 - 0.0000028 * a.esperienza) * effetto.incidenti();
      if (Math.random() < pKm * km) {
        f.fermo = casoInt(1, 3); f.motivo = 'incidente'; f.fermoDal = S.giorno;
        f.premio = (f.premio || 1) + COSTANTI.aumentoPremioIncidente; f.incidenti = (f.incidenti || 0) + 1;
        notizia(`Incidente: ${a.nome} con il ${m.nome}. Furgone fermo ${f.fermo} gg, assicurazione di questo furgone a ${assicurazioneFurgone(f)} €/mese. La riparazione è trattenuta dallo stipendio.`, 'male', 'inc-' + f.id);
      } else if (Math.random() < GUASTO_GIORNO[f.usato ? 'usato' : 'nuovo'] * (1 + f.km / 300000)) {
        const costo = Math.round(casoInt(300, 1200) * effetto.guasti());
        f.fermo = Math.max(1, casoInt(1, 2) - (livello('officina') ? 1 : 0)); f.motivo = 'guasto'; f.fermoDal = S.giorno; manut += costo;
        notizia(`Guasto al ${m.nome}${f.usato ? ' usato' : ''}: ${costo} € di officina, fermo ${f.fermo} gg.`, 'male', 'gua-' + f.id);
      }
    });
  });

  S.furgoni.filter(f => f.zona && !f.autistaId).forEach(f => notizia(`${modello(f.modello).nome} assegnato senza autista: resta fermo.`, 'male', 'noaut-' + f.id));
  // i giorni di fermo si scalano a fine giornata, ma non il giorno stesso dell'incidente/guasto
  S.furgoni.forEach(f => { if (f.fermo > 0 && f.fermoDal !== S.giorno) { f.fermo -= 1; if (f.fermo === 0) f.motivo = null; } });

  chiusi.push(...contrattiNonServiti());
  const incasso = Math.round(incassoZone);
  const premio = valutaObiettivo(consegneTot, giacenzeTot);
  nuovoObiettivo(consegneTot, giacenzeTot);
  // l'incasso delle consegne entra in cassa piano piano durante la giornata;
  // contratti, premi, penali e costi a fine giornata
  S.inCorso = { giorno: S.giorno, incasso, accreditato: 0, perFurgone, contratti: chiusi, premio,
    costi: { carburante: Math.round(carburante), ricarica: Math.round(ricarica), manutenzione: Math.round(manut) } };
  S.ieri = { festivo: false, consegne: consegneTot, incasso, perZona };
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
  S.storico.unshift({ mese: S.conti.mese, voci: S.conti.voci });
  S.storico.length = Math.min(S.storico.length, 12);
  S.conti = { mese: chiaveMese(dataDelGiorno(S.giorno + 1)), voci: vociVuote() };
  if (S.cassa < 0) notizia('Cassa in rosso! Vendi un mezzo o riduci i costi.', 'male', 'rosso');
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
      if (!S.contrattiAttivi) S.contrattiAttivi = [];
      if (!S.miglioramenti) S.miglioramenti = {};
      if (!S.effetti) S.effetti = {};
      S.furgoni.forEach(f => { if (!f.allestimento) f.allestimento = 'standard'; });
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
  const prima = { cassa: S.cassa, giorno: S.giorno, consegne: 0 };
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
  return { secondi, ridotto: (Date.now() - S.salvatoIl) / 1000 > OFFLINE_MAX_SECONDI, giorni: S.giorno - prima.giorno, consegne, differenza: S.cassa - prima.cassa };
}
