/* Tycoon Logistica – motore di simulazione (nessun accesso al DOM). */

const DATA_INIZIO = new Date(2027, 0, 4); // lunedì 4 gennaio 2027
const CHIAVE_SALVATAGGIO = 'tycoon-logistica-v01';
const VOCI = {
  incassi: 'Consegne', vendite: 'Vendita mezzi',
  personale: 'Personale', carburante: 'Carburante', ricarica: 'Ricarica',
  manutenzione: 'Manutenzione', assicurazione: 'Assicurazione', mezzi: 'Acquisto mezzi', annunci: 'Annunci di lavoro',
};
const VOCI_ENTRATA = ['incassi', 'vendite'];

let S = null; // stato della partita

const caso = (a, b) => a + Math.random() * (b - a);
const casoInt = (a, b) => Math.floor(caso(a, b + 1));
const limita = (x, a, b) => Math.max(a, Math.min(b, x));
const scegli = arr => arr[Math.floor(Math.random() * arr.length)];

function dataDelGiorno(g) { const d = new Date(DATA_INIZIO); d.setDate(d.getDate() + g); return d; }
function chiaveMese(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function feriale(g) { const w = dataDelGiorno(g).getDay(); return w !== 0 && w !== 6; }
function modello(id) { return CATALOGO.find(m => m.id === id); }
function zona(id) { return ZONE.find(z => z.id === id); }
function dipendente(id) { return S.dipendenti.find(d => d.id === id); }
function nuovoId(pref) { S.seq += 1; return pref + S.seq; }

function vociVuote() { const v = {}; Object.keys(VOCI).forEach(k => v[k] = 0); return v; }

function nuovaPartita(prezzi) {
  S = {
    versione: 1, seq: 0, giorno: 0,
    cassa: COSTANTI.cassaIniziale, reputazione: 70, premio: 1,
    furgoni: [], dipendenti: [],
    offerta: { autista: RUOLI.autista.stipDefault, magazziniere: RUOLI.magazziniere.stipDefault },
    candidati: { autista: [], magazziniere: [] }, annunciInArrivo: {},
    giacenze: {}, ieri: null,
    conti: { mese: chiaveMese(DATA_INIZIO), voci: vociVuote() }, storico: [],
    feed: [], prezzi: prezzi || PREZZI_RISERVA,
  };
  ZONE.forEach(z => S.giacenze[z.id] = 0);
  generaCandidati('autista'); generaCandidati('magazziniere');
  notizia('Benvenuto! Compra un furgone, assumi un autista e un magazziniere, poi assegna il furgone a una zona.', 'info');
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
function prezzoAcquisto(m, usato) { return Math.round(m.prezzo * (usato ? SCONTO_USATO : 1)); }
function compraFurgone(idModello, usato) {
  const m = modello(idModello), prezzo = prezzoAcquisto(m, usato);
  if (S.cassa < prezzo) return 'Non hai abbastanza soldi.';
  movimento('mezzi', -prezzo);
  S.furgoni.push({ id: nuovoId('f'), modello: m.id, usato, km: usato ? casoInt(90000, 180000) : 0,
    autistaId: null, zona: null, fermo: 0, motivo: null, valore: prezzo, acquistatoGiorno: S.giorno });
  notizia(`Comprato ${m.nome}${usato ? ' usato' : ''} per ${prezzo} €.`, 'info');
  return null;
}
function vendiFurgone(id) {
  const f = S.furgoni.find(x => x.id === id); if (!f) return;
  const ricavo = Math.round(f.valore * COSTANTI.valoreRivendita);
  movimento('vendite', ricavo);
  S.furgoni = S.furgoni.filter(x => x.id !== id);
  notizia(`Venduto ${modello(f.modello).nome} per ${ricavo} €.`, 'info');
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
function simulaGiorno() {
  const g = S.giorno;
  if (S.annunciInArrivo.autista === g) { generaCandidati('autista'); delete S.annunciInArrivo.autista; notizia('Sono arrivati nuovi candidati autisti.', 'info', 'cand-a'); }
  if (S.annunciInArrivo.magazziniere === g) { generaCandidati('magazziniere'); delete S.annunciInArrivo.magazziniere; notizia('Sono arrivati nuovi candidati magazzinieri.', 'info', 'cand-m'); }

  const d = dataDelGiorno(g);
  if (d.getDay() === 1 && g > 0) settimanale();
  if (feriale(g)) giornoLavorativo(); else S.ieri = { festivo: true, consegne: 0, incasso: 0, perZona: {} };

  // fine mese: buste paga e assicurazione
  const domani = dataDelGiorno(g + 1);
  if (domani.getMonth() !== d.getMonth()) fineMese(d);
  S.giorno += 1;
}

function giornoLavorativo() {
  const magazzinieri = S.dipendenti.filter(x => x.ruolo === 'magazziniere').length;
  const servite = ZONE.filter(z => S.furgoni.some(f => f.zona === z.id));
  const capSmistamento = magazzinieri * COSTANTI.pacchiMagazziniere;
  const repFatt = 0.85 + S.reputazione / 100 * 0.3;

  // pacchi in arrivo per zona (nuovi + giacenze)
  const arrivo = {};
  let totale = 0;
  servite.forEach(z => { arrivo[z.id] = Math.round(z.pacchi * repFatt * caso(0.9, 1.1)) + S.giacenze[z.id]; totale += arrivo[z.id]; });
  ZONE.forEach(z => { if (!arrivo[z.id]) S.giacenze[z.id] = 0; });
  const quota = totale > 0 ? Math.min(1, capSmistamento / totale) : 0;
  if (servite.length && magazzinieri === 0) notizia('Nessun magazziniere: i pacchi restano nel magazzino e i furgoni non partono.', 'male', 'no-mag');
  else if (quota < 1) notizia('Magazzino intasato: i magazzinieri non riescono a smistare tutti i pacchi.', 'male', 'intasato');

  let consegneTot = 0, carburante = 0, ricarica = 0, manut = 0;
  const perZona = {};
  servite.forEach(z => {
    const smistati = Math.floor(arrivo[z.id] * quota);
    const giri = S.furgoni.filter(f => f.zona === z.id && furgoneOperativo(f));
    const consegne = Math.min(smistati, giri.length * COSTANTI.maxConsegneCorriere);
    const restano = arrivo[z.id] - consegne;
    const persi = Math.max(0, restano - z.pacchi);       // oltre un giorno di giacenza gli ordini si perdono
    S.giacenze[z.id] = restano - persi;
    perZona[z.id] = { arrivo: arrivo[z.id], consegne, giacenza: S.giacenze[z.id], giri: giri.length };
    consegneTot += consegne;

    if (restano > 0 && giri.length) notizia(`Zona ${z.nome}: pacchi in giacenza, la reputazione scende.`, 'male', 'giac-' + z.id);
    if (!giri.length) notizia(`Zona ${z.nome}: nessun furgone operativo oggi.`, 'male', 'ferma-' + z.id);
    S.reputazione = limita(S.reputazione + (restano > 0 ? -Math.min(3, 0.5 + restano / 40) : 0.25), 0, 100);
    if (persi > 0) notizia(`Zona ${z.nome}: ${persi} ordini persi per le giacenze.`, 'male', 'persi-' + z.id);

    giri.forEach((f, i) => {
      const mie = Math.floor(consegne / giri.length) + (i < consegne % giri.length ? 1 : 0);
      const km = Math.round(z.km * (0.7 + 0.3 * Math.min(1, mie / 100)));
      const m = modello(f.modello), c = costoKm(m, f.usato);
      if (m.tipo === 'diesel') carburante += km * c.energia; else ricarica += km * c.energia;
      manut += km * c.manutenzione;
      f.km += km;
      const a = dipendente(f.autistaId);
      a.esperienza = Math.min(100, a.esperienza + 0.15);
      // incidente: dipende dall'esperienza
      const pKm = Math.max(0.00004, 0.00032 - 0.0000028 * a.esperienza);
      if (Math.random() < pKm * km) {
        f.fermo = casoInt(1, 3); f.motivo = 'incidente'; f.fermoDal = S.giorno;
        S.premio += COSTANTI.aumentoPremioIncidente;
        notizia(`Incidente: ${a.nome} con il ${m.nome}. Furgone fermo ${f.fermo} gg, premio assicurativo in salita. La riparazione è trattenuta dallo stipendio.`, 'male', 'inc-' + f.id);
      } else if (Math.random() < GUASTO_GIORNO[f.usato ? 'usato' : 'nuovo'] * (1 + f.km / 300000)) {
        const costo = casoInt(300, 1200);
        f.fermo = casoInt(1, 2); f.motivo = 'guasto'; f.fermoDal = S.giorno; manut += costo;
        notizia(`Guasto al ${m.nome}${f.usato ? ' usato' : ''}: ${costo} € di officina, fermo ${f.fermo} gg.`, 'male', 'gua-' + f.id);
      }
    });
  });

  S.furgoni.filter(f => f.zona && !f.autistaId).forEach(f => notizia(`${modello(f.modello).nome} assegnato senza autista: resta fermo.`, 'male', 'noaut-' + f.id));
  // i giorni di fermo si scalano a fine giornata, ma non il giorno stesso dell'incidente/guasto
  S.furgoni.forEach(f => { if (f.fermo > 0 && f.fermoDal !== S.giorno) { f.fermo -= 1; if (f.fermo === 0) f.motivo = null; } });

  const incasso = consegneTot * COSTANTI.euroPerConsegna;
  if (incasso) movimento('incassi', incasso);
  if (carburante) movimento('carburante', -Math.round(carburante));
  if (ricarica) movimento('ricarica', -Math.round(ricarica));
  if (manut) movimento('manutenzione', -Math.round(manut));
  S.ieri = { festivo: false, consegne: consegneTot, incasso, perZona };
  if (consegneTot) notizia(`${consegneTot} consegne, incasso ${incasso} €.`, 'buono', 'giornata');
}

function settimanale() {
  S.premio = Math.max(1, S.premio - COSTANTI.rientroPremioSettimanale);
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
  const assic = Math.round(S.furgoni.length * COSTANTI.assicurazioneMensile * S.premio);
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
function salva() { try { localStorage.setItem(CHIAVE_SALVATAGGIO, JSON.stringify(S)); } catch (e) { /* niente salvataggio */ } }
function carica() {
  try { const t = localStorage.getItem(CHIAVE_SALVATAGGIO); if (t) { S = JSON.parse(t); return S; } } catch (e) { /* ignora */ }
  return null;
}
function cancellaSalvataggio() { try { localStorage.removeItem(CHIAVE_SALVATAGGIO); } catch (e) { /* ignora */ } }

if (typeof module !== 'undefined') module.exports = { get S() { return S; }, nuovaPartita, simulaGiorno, compraFurgone, assumi, assegna, pubblicaAnnuncio, ammortamento, utileMese, dataDelGiorno };
