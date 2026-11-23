/* Tycoon Logistica – contratti dei clienti (con conto alla rovescia) e obiettivo del giorno. */

// Clienti inventati (nomi storpiati, nessun marchio vero)
const CLIENTI = {
  standard: ['Zalandò', 'Amazzonia Shop', 'TechPoint', 'Libreria Mondatori', 'Sportissimo', 'Casa&Co', 'Profumeria Bellini'],
};

// Tipi di carico: paga per pacco (o per trasporto) e quanti pacchi
const TIPI_CARICO = {
  standard: { nome: 'Pacchi express', paga: [9, 12], pacchi: [20, 80], unita: 'pacchi' },
};

const OFFERTA = {
  primaDopo: 30,          // secondi reali prima della prima offerta
  ogni: [90, 150],        // secondi reali tra un'offerta e l'altra (circa una per giornata)
  durata: 40,             // secondi per accettare
  maxAttivi: 3,
  quotaPenale: 0.3,       // penale = 30% del valore non consegnato
};

function prossimoFeriale(g) { let x = g + 1; while (!feriale(x)) x++; return x; }
function furgoniAdatti(zonaId, tipo) {
  return S.furgoni.filter(f => f.zona === zonaId);
}

function generaOfferta() {
  const tipo = 'standard';
  const t = TIPI_CARICO[tipo];
  // preferisce le zone servite, ma a volte propone zone nuove
  const servite = S.zone.filter(z => S.furgoni.some(f => f.zona === z.id));
  const z = servite.length && Math.random() < 0.75 ? scegli(servite) : scegli(S.zone);
  const pacchi = casoInt(t.pacchi[0], t.pacchi[1]);
  const paga = Math.round(caso(t.paga[0], t.paga[1]) * 2) / 2;
  const totale = Math.round(pacchi * paga);
  S.offertaContratto = { id: nuovoId('o'), cliente: scegli(CLIENTI[tipo]), tipo, zona: z.id, pacchi, paga, totale,
    giorno: prossimoFeriale(S.giorno), restano: OFFERTA.durata };
}

function accettaOfferta() {
  const o = S.offertaContratto; if (!o) return null;
  if (S.contrattiAttivi.length >= OFFERTA.maxAttivi) return `Puoi avere al massimo ${OFFERTA.maxAttivi} contratti aperti.`;
  S.contrattiAttivi.push(o); S.offertaContratto = null;
  notizia(`Contratto firmato con ${o.cliente}: ${o.pacchi} ${TIPI_CARICO[o.tipo].unita} in zona ${zona(o.zona).nome}, ${o.totale.toLocaleString('it-IT')} €.`, 'buono');
  return null;
}
function rifiutaOfferta() { S.offertaContratto = null; }

// Avanza i timer delle offerte (dt in secondi reali). Restituisce true se è comparsa o sparita un'offerta.
function aggiornaOfferte(dt) {
  if (!S.furgoni.length) return false;               // le offerte partono dal primo furgone
  if (S.offertaContratto) {
    S.offertaContratto.restano -= dt;
    if (S.offertaContratto.restano <= 0) { notizia(`Offerta di ${S.offertaContratto.cliente} scaduta.`, 'info', 'scaduta'); S.offertaContratto = null; S.prossimaOfferta = caso(...OFFERTA.ogni); return true; }
    return false;
  }
  if (S.prossimaOfferta === undefined) S.prossimaOfferta = OFFERTA.primaDopo;
  S.prossimaOfferta -= dt;
  if (S.prossimaOfferta <= 0) { generaOfferta(); S.prossimaOfferta = caso(...OFFERTA.ogni); return true; }
  return false;
}

// Esegue i contratti di oggi in una zona. Usano la capacità dei furgoni prima dei pacchi normali.
// Restituisce la capacità che resta e i contratti chiusi (pagati o con penale a fine giornata).
function eseguiContratti(z, giri, capacita) {
  const chiusi = [];
  S.contrattiAttivi.filter(c => c.zona === z.id && c.giorno === S.giorno).forEach(c => {
    const adatto = giri.length > 0;
    const fatti = adatto ? Math.min(c.pacchi, capacita) : 0;
    capacita -= fatti;
    const ricavo = Math.round(fatti * c.paga);
    const penale = Math.round((c.pacchi - fatti) * c.paga * OFFERTA.quotaPenale);
    if (fatti < c.pacchi) S.reputazione = limita(S.reputazione - (fatti ? 3 : 6), 0, 100);
    else S.reputazione = limita(S.reputazione + 1, 0, 100);
    chiusi.push({ ...c, fatti, ricavo, penale, adatto });
  });
  S.contrattiAttivi = S.contrattiAttivi.filter(c => !(c.zona === z.id && c.giorno === S.giorno));
  return { capacita, chiusi };
}

// Contratti di zone senza furgoni (o rimasti indietro): falliscono
function contrattiNonServiti() {
  const chiusi = [];
  S.contrattiAttivi.filter(c => c.giorno <= S.giorno).forEach(c => {
    S.reputazione = limita(S.reputazione - 6, 0, 100);
    chiusi.push({ ...c, fatti: 0, ricavo: 0, penale: Math.round(c.pacchi * c.paga * OFFERTA.quotaPenale), adatto: false });
  });
  S.contrattiAttivi = S.contrattiAttivi.filter(c => c.giorno > S.giorno);
  return chiusi;
}

function notiziaContratto(c) {
  if (c.fatti === c.pacchi) { S.contrattiCompletati = (S.contrattiCompletati || 0) + 1; }
  if (c.fatti === c.pacchi) notizia(`Contratto ${c.cliente} completato: +${c.ricavo.toLocaleString('it-IT')} €.`, 'buono', 'ctr-' + c.id);
  else if (!c.adatto) notizia(`Contratto ${c.cliente} fallito: nessun furgone in zona. Penale ${c.penale.toLocaleString('it-IT')} €.`, 'male', 'ctr-' + c.id);
  else notizia(`Contratto ${c.cliente} consegnato a metà (${c.fatti}/${c.pacchi}): +${c.ricavo.toLocaleString('it-IT')} €, penale ${c.penale.toLocaleString('it-IT')} €.`, 'male', 'ctr-' + c.id);
}

/* ---------- obiettivo del giorno: si decide oggi per domani ---------- */
function nuovoObiettivo(consegneOggi, giacenzeOggi) {
  const giorno = prossimoFeriale(S.giorno);
  if (giacenzeOggi > 0 && Math.random() < 0.4) {
    S.obiettivo = { giorno, tipo: 'giacenze', testo: 'Nessun pacco in giacenza in nessuna zona', premio: 1200 };
  } else {
    const target = Math.max(consegneOggi + 20, Math.round(consegneOggi * 1.12 / 10) * 10, 60);
    S.obiettivo = { giorno, tipo: 'consegne', target, testo: `Consegna almeno ${target} pacchi`, premio: Math.round((500 + target * 3) / 50) * 50 };
  }
}
function valutaObiettivo(consegne, giacenze) {
  const o = S.obiettivo; if (!o || o.giorno !== S.giorno) return 0;
  const ok = o.tipo === 'consegne' ? consegne >= o.target : giacenze === 0;
  notizia(ok ? `Obiettivo raggiunto: ${o.testo.toLowerCase()}. +${o.premio} €!` : `Obiettivo mancato: ${o.testo.toLowerCase()}.`, ok ? 'buono' : 'info', 'obiettivo');
  S.obiettivo = null;
  return ok ? o.premio : 0;
}
