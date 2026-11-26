/* Tycoon Logistica – eventi rari con decisioni e miglioramenti da comprare. */

/* ---------- miglioramenti ----------
   Ogni magazzino ha i suoi. Prezzi pensati per completare il primo magazzino in circa 2 settimane reali
   (circa 15 mesi di gioco); ogni magazzino successivo costa il 50% in più del precedente. */
const MIGLIORAMENTI = {
  nastro:     { nome: 'Nastro trasportatore', motto: 'I pacchi corrono da soli verso i furgoni.', descr: 'Ogni magazziniere smista il 50% di pacchi in più.', livelli: [40000] },
  software:   { nome: 'Navigatore intelligente', motto: 'Meno strada, meno gasolio, giri più rapidi.', descr: 'Giri più corti: −10% di km per ogni livello.', livelli: [25000, 55000] },
  pubblicita: { nome: 'Pubblicità in città', motto: 'Cartelloni, social e furgoni con il tuo logo.', descr: '+10% di pacchi in tutte le zone per ogni livello.', livelli: [15000, 30000, 55000] },
  commerciale:{ nome: 'Ufficio commerciale', motto: 'Qualcuno che tratta i prezzi con i clienti.', descr: '+5% sulla tariffa di ogni pacco per ogni livello.', livelli: [20000, 40000] },
  formazione: { nome: 'Corso di guida sicura', motto: 'Autisti più attenti, furgoni sempre in strada.', descr: 'Gli autisti fanno il 40% di incidenti in meno.', livelli: [20000] },
  officina:   { nome: 'Officina nel magazzino', motto: 'Un meccanico tutto tuo, giorno e notte.', descr: 'Ripara i guasti da solo, anche a gioco chiuso, a metà prezzo.', livelli: [50000] },
  solare:     { nome: 'Pannelli solari sul tetto', motto: 'I furgoni elettrici si ricaricano col sole.', descr: 'La ricarica dei furgoni elettrici costa la metà.', livelli: [25000] },
  scaffali:   { nome: 'Scaffali per le giacenze', motto: 'I pacchi rimasti aspettano in ordine.', descr: 'I clienti aspettano un giorno in più prima di annullare: la metà dei pacchi persi.', livelli: [20000] },
  selezione:  { nome: 'Ufficio del personale', motto: 'Colloqui fatti bene, meno sorprese.', descr: 'Un candidato in più a ogni ricerca e metà delle "mele marce".', livelli: [10000] },
};
// i miglioramenti sono di ogni magazzino (di default quello che stai gestendo)
function livello(id, mag) { const m = S.depositi && magazzino(mag || magAttivo()); return (m && m.migl && m.migl[id]) || 0; }
// ogni magazzino dopo il primo ha miglioramenti più cari del 50% rispetto al precedente (×1,5, ×2,25, ...)
function rincaroMiglioramenti(mag) { const i = S.depositi.findIndex(m => m.id === (mag || magAttivo())); return Math.pow(1.5, Math.max(0, i)); }
function prezzoMiglioramento(id, mag) { const l = MIGLIORAMENTI[id].livelli, n = livello(id, mag); return n < l.length ? Math.round(l[n] * rincaroMiglioramenti(mag) / 5000) * 5000 : null; }
function compraMiglioramento(id) {
  if (!sbloccato('miglioramenti', id)) return `Si sblocca al livello ${livelloPer('miglioramenti', id)}.`;
  const prezzo = prezzoMiglioramento(id);
  if (prezzo === null) return 'Hai già il livello massimo.';
  if (S.cassa < prezzo) return 'Non hai abbastanza soldi.';
  movimento('miglioramenti', -prezzo);
  const m = magazzino(magAttivo()); m.migl = m.migl || {};
  m.migl[id] = livello(id) + 1;
  notizia(`${m.nome}: ${MIGLIORAMENTI[id].nome}${MIGLIORAMENTI[id].livelli.length > 1 ? ' livello ' + livello(id) : ''}.`, 'buono');
  return null;
}
// moltiplicatori usati dalla simulazione
const effetto = {
  smistamento: mag => livello('nastro', mag) ? 1.5 : 1,
  km: zonaId => (1 - 0.1 * livello('software', magDi(zona(zonaId)))) * (S.effetti && S.effetti.lavori && S.effetti.lavori.zona === zonaId && S.giorno <= S.effetti.lavori.fino ? 1.3 : 1),
  pacchi: zonaId => (1 + 0.1 * livello('pubblicita', magDi(zona(zonaId)))) * (S.effetti && S.effetti.accordo && S.effetti.accordo.zona === zonaId && S.giorno <= S.effetti.accordo.fino ? 1.25 : 1),
  tariffaZona: zonaId => (1 + 0.05 * livello('commerciale', magDi(zona(zonaId)))) * (S.effetti && S.effetti.accordo && S.effetti.accordo.zona === zonaId && S.giorno <= S.effetti.accordo.fino ? 0.9 : 1),
  ricarica: mag => livello('solare', mag) ? 0.5 : 1,
  pazienza: mag => livello('scaffali', mag) ? 2 : 1,
  incidenti: mag => livello('formazione', mag) ? 0.6 : 1,
  guasti: mag => livello('officina', mag) ? 0.5 : 1,
  capacita: () => S.effetti && S.effetti.neve === S.giorno ? 0.6 : 1,
  sciopero: () => S.effetti && S.effetti.sciopero === S.giorno,
};

/* ---------- eventi rari ---------- */
// Ogni evento: quando può capitare, testo e scelte. La prima scelta è quella che costa soldi,
// l'ultima è quella che si applica da sola se non decidi entro il tempo.
const EVENTO = { prob: 0.14, pausaGiorni: 4, durata: 60 };
const servitaCasuale = () => { const s = S.zone.filter(z => S.furgoni.some(f => f.zona === z.id)); return s.length ? scegli(s) : null; };

const EVENTI = [
  { id: 'sciopero', puo: () => S.furgoni.length >= 2, crea: () => {
      const n = S.dipendenti.filter(d => d.ruolo === 'autista').length, costo = n * 150;
      return { titolo: 'Sciopero dei trasporti', testo: `I sindacati hanno indetto uno sciopero per domani. Puoi pagare uno straordinario di 150 € a ogni autista (${n}) per lavorare lo stesso, oppure restare fermi un giorno.`,
        scelte: [{ testo: `Paga ${costo.toLocaleString(LOCALE)} € e lavora`, fai: () => { movimento('eventi', -costo); return 'Gli autisti lavorano anche domani.'; } },
                 { testo: 'Resta fermo domani', fai: () => { S.effetti.sciopero = prossimoFeriale(S.giorno); cambiaFama(-2); return 'Domani i furgoni restano in deposito.'; } }] };
    } },
  { id: 'lavori', puo: () => !!servitaCasuale(), crea: () => {
      const z = servitaCasuale();
      return { titolo: 'Strada chiusa per lavori', testo: `Il Comune chiude una strada importante in zona ${z.nome} per 5 giorni. Con un permesso di transito i tuoi furgoni passano lo stesso; senza, i giri si allungano del 30%.`,
        scelte: [{ testo: 'Compra il permesso (800 €)', fai: () => { movimento('eventi', -800); return 'Permesso ottenuto.'; } },
                 { testo: 'Fai il giro lungo', fai: () => { S.effetti.lavori = { zona: z.id, fino: S.giorno + 5 }; return `Per 5 giorni i giri in zona ${z.nome} sono più lunghi.`; } }] };
    } },
  { id: 'controllo', puo: () => S.furgoni.some(f => f.autistaId), crea: () => {
      const f = scegli(S.furgoni.filter(x => x.autistaId)), m = modello(f.modello);
      return { titolo: 'Controllo della Polizia Stradale', testo: `Un tuo ${m.nome} è stato fermato a un controllo: manca il cronotachigrafo aggiornato. La multa è di 400 €. Puoi pagarla subito o fare ricorso: metà delle volte va annullata, altrimenti sale a 900 €.`,
        scelte: [{ testo: 'Paga 400 €', fai: () => { movimento('eventi', -400); return 'Multa pagata.'; } },
                 { testo: 'Fai ricorso', fai: () => { if (Math.random() < 0.5) return 'Ricorso accolto: niente multa!'; movimento('eventi', -900); return 'Ricorso respinto: 900 € di multa.'; } }] };
    } },
  { id: 'smarrito', puo: () => S.furgoni.length >= 1, crea: () => ({ titolo: 'Pacco smarrito', testo: 'Un cliente denuncia la perdita di un pacco da 600 €. Non è chiaro di chi sia la colpa. Rimborsarlo costa, ma rifiutare può fare brutta pubblicità.',
      scelte: [{ testo: 'Rimborsa 600 €', fai: () => { movimento('eventi', -600); cambiaFama(1); return 'Cliente rimborsato e soddisfatto.'; } },
               { testo: 'Rifiuta il rimborso', fai: () => { cambiaFama(-6); return 'Il cliente scrive recensioni negative: reputazione in calo.'; } }] }) },
  { id: 'aumento', puo: () => S.dipendenti.some(d => d.ruolo === 'autista' && !(S.giorno - (d.ultimoAumento ?? -999) < 60)), crea: () => {
      const d = scegli(S.dipendenti.filter(x => x.ruolo === 'autista' && !(S.giorno - (x.ultimoAumento ?? -999) < 60)));
      return { titolo: 'Richiesta di aumento', testo: `${d.nome} chiede un aumento di 150 € al mese. Dice che altrove pagano di più. Se rifiuti, potrebbe andarsene.`,
        scelte: [{ testo: 'Concedi +150 €/mese', fai: () => { d.stipendio += 150; return `${d.nome} resta volentieri.`; } },
                 { testo: 'Rifiuta', fai: () => { if (Math.random() < 0.35) { licenzia(d.id); return `${d.nome} si è dimesso.`; } return `${d.nome} resta, ma non è contento.`; } }] };
    } },
  { id: 'neve', puo: () => [10, 11, 0, 1, 2].includes(dataDelGiorno(S.giorno).getMonth()) && S.furgoni.length >= 1, crea: () => {
      const costo = S.furgoni.length * 120;
      return { titolo: 'Allerta neve per domani', testo: `È prevista una forte nevicata. Con le catene e le gomme da neve (120 € a furgone) lavori normalmente; senza, domani i furgoni fanno il 40% di consegne in meno.`,
        scelte: [{ testo: `Compra le catene (${costo.toLocaleString(LOCALE)} €)`, fai: () => { movimento('eventi', -costo); return 'Furgoni pronti per la neve.'; } },
                 { testo: 'Rischia', fai: () => { S.effetti.neve = prossimoFeriale(S.giorno); return 'Domani si va piano.'; } }] };
    } },
  { id: 'accordo', puo: () => !!servitaCasuale(), crea: () => {
      const z = servitaCasuale();
      return { titolo: 'Proposta di Amazzonia Shop', testo: `Amazzonia Shop vuole un accordo in zona ${z.nome} per 30 giorni: +25% di pacchi, ma pagati il 10% in meno.`,
        scelte: [{ testo: 'Accetta l\'accordo', fai: () => { S.effetti.accordo = { zona: z.id, fino: S.giorno + 30 }; return `Accordo firmato: più pacchi in zona ${z.nome}.`; } },
                 { testo: 'Rifiuta', fai: () => 'Nessun accordo.' }] };
    } },
  { id: 'compratore', puo: () => S.furgoni.length >= 2, crea: () => {
      const f = scegli(S.furgoni), m = modello(f.modello), offerta = Math.round(f.valore * 0.8 / 100) * 100;
      return { titolo: 'Un concorrente vuole un tuo furgone', testo: `Un corriere della zona ti offre ${offerta.toLocaleString(LOCALE)} € per il tuo ${m.nome}${f.usato ? ' usato' : ''}: più dei ${Math.round(f.valore * COSTANTI.valoreRivendita).toLocaleString(LOCALE)} € che prenderesti rivendendolo.`,
        scelte: [{ testo: 'Vendi', fai: () => { movimento('vendite', offerta); S.furgoni = S.furgoni.filter(x => x.id !== f.id); return 'Furgone venduto.'; } },
                 { testo: 'Tienilo', fai: () => 'Il furgone resta tuo.' }] };
    } },
];

// Chiamata all'inizio di ogni giornata lavorativa
function forseEvento() {
  S.effetti = S.effetti || {};
  if (S.evento || S.recuperoOffline) return;
  if (S.giorno - (S.ultimoEvento ?? -99) < EVENTO.pausaGiorni) return;
  if (Math.random() > EVENTO.prob) return;
  const possibili = EVENTI.filter(e => e.puo());
  if (!possibili.length) return;
  const e = scegli(possibili), dati = e.crea();
  S.evento = { id: nuovoId('e'), tipo: e.id, titolo: dati.titolo, testo: dati.testo, scelte: dati.scelte.map(s => s.testo), restano: EVENTO.durata };
  S.ultimoEvento = S.giorno;
  azioniEvento[S.evento.id] = dati.scelte.map(s => s.fai);
}
// le funzioni delle scelte non si salvano: se si ricarica la pagina, l'evento in sospeso si chiude con l'ultima scelta
const azioniEvento = {};
function decidiEvento(i) {
  const ev = S.evento; if (!ev) return null;
  const azioni = azioniEvento[ev.id];
  S.evento = null; delete azioniEvento[ev.id];
  const esitoTesto = azioni && azioni[i] ? azioni[i]() : 'Situazione risolta da sola.';
  notizia(`${ev.titolo}: ${esitoTesto}`, 'info', 'ev-' + ev.id);
  return esitoTesto;
}
function aggiornaEvento(dt) {
  if (!S.evento) return false;
  if (!azioniEvento[S.evento.id]) { S.evento = null; return true; }
  S.evento.restano -= dt;
  if (S.evento.restano <= 0) { decidiEvento(S.evento.scelte.length - 1); return true; }
  return false;
}

// Prima di comprare un altro magazzino (o aprire una filiale) bisogna completare tutti i miglioramenti del magazzino
function miglioramentiMancanti(mag) { return Object.keys(MIGLIORAMENTI).filter(id => prezzoMiglioramento(id, mag) !== null); }
function costoMiglioramentiMancanti(mag) {
  return miglioramentiMancanti(mag).reduce((t, id) => t + MIGLIORAMENTI[id].livelli.slice(livello(id, mag)).reduce((a, b) => a + Math.round(b * rincaroMiglioramenti(mag) / 5000) * 5000, 0), 0);
}
// un altro magazzino si compra solo quando tutti quelli che hai hanno un responsabile
function magazziniSenzaResponsabile() { return S.depositi.filter(m => !m.responsabile); }
