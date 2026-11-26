/* Tycoon Logistica – ogni magazzino è una "sede" con i suoi furgoni, dipendenti, zone e miglioramenti.
   Quando un magazzino ha tutti i miglioramenti puoi assumere un responsabile che lo gestisce da solo
   e passare al magazzino successivo. */

const RESPONSABILE = { stipendio: 5000, quotaUtile: 0.08, giusteSu10: 8 };

function magAttivo() { const id = S.magAttivo; return S.depositi.some(m => m.id === id) ? id : S.depositi[0].id; }
function magazzino(id) { return S.depositi.find(m => m.id === id); }
function magDi(o) { return (o && o.mag) || S.depositi[0].id; }
function nomeMag(id) { const m = magazzino(id); return m ? m.nome : 'Magazzino'; }
function gestito(id) { const m = magazzino(id); return !!(m && m.responsabile); }
function delMag(id) { return o => magDi(o) === id; }

// zone di un magazzino nuovo: quelle della stessa città che nessuno serve e che sono più vicine a lui
function assegnaZoneNuovoMagazzino(m) {
  S.zone.filter(z => idCitta(z) === idCitta(m)).forEach(z => {
    const servita = S.furgoni.some(f => f.zona === z.id);
    if (!servita && magazzinoVicino(z.centro, idCitta(z)).magazzino.id === m.id) z.mag = m.id;
  });
}

/* ---------- responsabile ---------- */
function puoiAssumereResponsabile(id) {
  const m = magazzino(id); if (!m || m.responsabile) return 'Questo magazzino ha già un responsabile.';
  const manca = miglioramentiMancanti(id);
  if (manca.length) return 'Prima completa tutti i miglioramenti di questo magazzino.';
  return null;
}
function assumiResponsabile(id) {
  const err = puoiAssumereResponsabile(id); if (err) return err;
  const m = magazzino(id);
  m.responsabile = { nome: scegli(NOMI) + ' ' + scegli(COGNOMI), dal: S.giorno };
  notizia(`${m.responsabile.nome} è il nuovo responsabile del ${m.nome}: da ora lo gestisce lui. Puoi comprare un altro magazzino.`, 'buono');
  return null;
}
function licenziaResponsabile(id) {
  const m = magazzino(id); if (!m || !m.responsabile) return;
  notizia(`${m.responsabile.nome} non è più responsabile del ${m.nome}: torni a gestirlo tu.`, 'info');
  m.responsabile = null;
}

// ogni mattina il responsabile sistema il suo magazzino
function lavoroResponsabili() {
  S.depositi.filter(m => m.responsabile).forEach(m => {
    const r = m.responsabile; r.mese = r.mese || { contratti: 0, email: 0, giuste: 0, assunti: 0, riparati: 0 };
    // guasti: li fa riparare subito
    S.furgoni.filter(f => magDi(f) === m.id && f.daRiparare).forEach(f => { movimento('manutenzione', -f.daRiparare); stat(f, 'manutenzione', f.daRiparare); f.daRiparare = 0; f.fermo = 0; f.motivo = null; r.mese.riparati++; });
    // furgoni senza autista: assume qualcuno (prende il candidato più esperto)
    const scoperti = S.furgoni.filter(f => magDi(f) === m.id && !f.autistaId).length;
    const liberi = S.dipendenti.filter(d => d.ruolo === 'autista' && magDi(d) === m.id && !S.furgoni.some(f => f.autistaId === d.id)).length;
    for (let i = 0; i < scoperti - liberi; i++) assumiPer(m.id, 'autista') && r.mese.assunti++;
    // smistamento che non basta: un magazziniere in più
    if ((m.quotaIeri || 1) < 0.97) assumiPer(m.id, 'magazziniere') && r.mese.assunti++;
    applicaPiano(pianoOrganizza(m.id));
  });
}
function assumiPer(magId, ruolo) {
  if (!S.candidati[ruolo].length) generaCandidati(ruolo);
  const c = [...S.candidati[ruolo]].sort((a, b) => (b.esperienza || 0) - (a.esperienza || 0))[0]; if (!c) return false;
  const prima = S.magAttivo; S.magAttivo = magId; assumi(c.id, ruolo); S.magAttivo = prima;
  return true;
}
// il responsabile risponde alle email dei clienti del suo magazzino (8 volte su 10 nel modo giusto)
function rispondeResponsabile(magId, email, ctx) {
  const m = magazzino(magId), r = m.responsabile; r.mese = r.mese || { contratti: 0, email: 0, giuste: 0, assunti: 0, riparati: 0 };
  const giusta = Math.random() < RESPONSABILE.giusteSu10 / 10;
  const scelte = email.scelte, migliore = scelte.reduce((b, s, i) => s.rep > scelte[b].rep ? i : b, 0);
  const i = giusta ? migliore : Math.floor(Math.random() * scelte.length);
  const s = scelte[i]; if (s.fai) s.fai(ctx || {}); cambiaFama(s.rep); if (s.soldi) movimento(s.soldi > 0 ? 'contratti' : 'eventi', s.soldi);
  return s;
  r.mese.email++; if (i === migliore) r.mese.giuste++;
}
// contratti nelle zone gestite: li accetta lui se ha furgoni nella zona
function contrattiResponsabili() {
  const o = S.offertaContratto; if (!o) return;
  const z = zona(o.zona); if (!z || !gestito(magDi(z))) return;
  if (furgoniAdatti(o.zona).length && !accettaOfferta()) { const r = magazzino(magDi(z)).responsabile; r.mese = r.mese || {}; r.mese.contratti = (r.mese.contratti || 0) + 1; }
}

/* ---------- conti per magazzino e report di fine mese ---------- */
function utileMagazzino(m, per = 'mese') { return leggiStat(m, per, 'incasso') - leggiStat(m, per, 'costi'); }
function reportMensile(d) {
  S.depositi.filter(m => m.responsabile).forEach(m => {
    const r = m.responsabile, utile = Math.round(utileMagazzino(m));
    const costo = Math.round(RESPONSABILE.stipendio + Math.max(0, utile) * RESPONSABILE.quotaUtile);
    movimento('personale', -costo); stat(m, 'costi', costo);
    // consigli: autisti con poche stelle, furgoni in perdita per colpa dell'assicurazione
    const consigli = [];
    S.dipendenti.filter(x => magDi(x) === m.id).forEach(x => {
      const s = stelleDi(x), rr = riepilogo(x);
      if (s !== null && s < 2.5) consigli.push({ tipo: 'licenzia', id: x.id, testo: `${x.nome} (${RUOLI[x.ruolo].nome.toLowerCase()}): ${s} stelle, ${rr.incidenti} incidenti, ${rr.lamentele} lamentele, ${rr.persi + rr.rotti} pacchi persi o rotti. Consiglio di licenziarlo.` });
    });
    S.furgoni.filter(f => magDi(f) === m.id).forEach(f => {
      const incasso = leggiStat(f, 'mese', 'incasso'), costi = ['carburante', 'ricarica', 'manutenzione', 'assicurazione'].reduce((t, k) => t + leggiStat(f, 'mese', k), 0);
      if (incasso > 0 && incasso < costi) consigli.push({ tipo: 'vendi', id: f.id, testo: `${modello(f.modello).nome}${f.zona && !isJolly(f) ? ' in ' + nomeZona(zona(f.zona)) : ''}: assicurazione ${assicurazioneFurgone(f)} €/mese, il giro è in perdita di ${Math.round(costi - incasso).toLocaleString(LOCALE)} €. Valuta di venderlo e comprarne uno nuovo.` });
    });
    const mese = r.mese || {};
    S.posta = S.posta || [];
    S.posta.unshift({ id: 'report', report: true, mag: m.id, giorno: S.giorno, mittente: `${r.nome} · responsabile ${m.nome}`,
      oggetto: `Report di ${d.toLocaleDateString(LOCALE, { month: 'long' })}`,
      righe: [`Utile del magazzino: ${utile.toLocaleString(LOCALE)} €`, `Mio compenso: ${costo.toLocaleString(LOCALE)} € (${RESPONSABILE.stipendio.toLocaleString(LOCALE)} € + 8% dell'utile)`,
        `Contratti accettati: ${mese.contratti || 0} · Email dei clienti gestite: ${mese.email || 0} (${mese.giuste || 0} come avresti fatto tu)`,
        `Assunti: ${mese.assunti || 0} · Licenziati perché in più: ${mese.tagliati || 0} · Guasti fatti riparare: ${mese.riparati || 0}`],
      consigli, letta: false, risposta: null, esito: '' });
    S.posta[0].testo = S.posta[0].righe[0] + (consigli.length ? ` · ${consigli.length} consigli` : '');
    r.mese = { contratti: 0, email: 0, giuste: 0, assunti: 0, riparati: 0 };
  });
}
function seguiConsiglio(email, i) {
  const c = email.consigli[i]; if (!c || c.fatto) return;
  if (c.tipo === 'licenzia' && dipendente(c.id)) licenzia(c.id);
  if (c.tipo === 'vendi' && S.furgoni.some(f => f.id === c.id)) vendiFurgone(c.id);
  c.fatto = true;
}
