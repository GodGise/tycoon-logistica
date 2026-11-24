/* Tycoon Logistica – carattere nascosto dei dipendenti, stelle e periodo di prova.
   Circa 1 assunto su 8 è "iellato" (distratto, pasticcione o scortese), circa 1 su 10 è una "perla".
   Il carattere non si vede: si scopre dalle stelle e dal riepilogo degli ultimi 30 giorni. */

const STELLE = { giorniFinestra: 30, giorniValutazione: 6, prova: 30 };
const INDOLI = {
  distratto:   { autista: 'fa molti incidenti', magazziniere: 'smista lentamente' },
  pasticcione: { autista: 'perde e rompe pacchi', magazziniere: 'rompe pacchi allo smistamento' },
  scortese:    { autista: 'riceve lamentele dai clienti', magazziniere: 'litiga con i colleghi' },
  perla:       { autista: 'lavora benissimo', magazziniere: 'smista velocissimo' },
};
function indoleCasuale() {
  const r = Math.random();
  if (r < 0.125) return scegli(['distratto', 'pasticcione', 'scortese']);
  if (r < 0.225) return 'perla';
  return null;
}

// registro degli ultimi 30 giorni: eventi (incidente, perso, rotto, lamentela, complimento) e giornate di lavoro
function registra(d, tipo, n = 1) {
  d.reg = (d.reg || []).filter(e => e.g > S.giorno - STELLE.giorniFinestra);
  d.reg.push({ g: S.giorno, t: tipo, n });
}
function conta(d, tipo) { return (d.reg || []).filter(e => e.g > S.giorno - STELLE.giorniFinestra && e.t === tipo).reduce((t, e) => t + e.n, 0); }
function riepilogo(d) {
  const r = { giorni: conta(d, 'giorno'), pieni: conta(d, 'pieno'), incidenti: conta(d, 'incidente'), persi: conta(d, 'perso'),
    rotti: conta(d, 'rotto'), lamentele: conta(d, 'lamentela'), complimenti: conta(d, 'complimento'), lento: conta(d, 'lento') };
  r.quota = r.giorni ? r.pieni / r.giorni : 1;
  return r;
}
// 1–5 stelle (con mezze), oppure null se lavora da troppo poco
function stelleDi(d) {
  const r = riepilogo(d);
  if (r.giorni < STELLE.giorniValutazione) return null;
  let s = 5 - 1 * r.incidenti - 0.35 * (r.persi + r.rotti) - 0.5 * r.lamentele + 0.35 * r.complimenti;
  if (d.ruolo !== 'autista') s -= r.lento / r.giorni > 0.5 ? 1.5 : 0;   // le zone sovraccariche non sono colpa dell'autista
  return Math.round(limita(s, 1, 5) * 2) / 2;
}
function inProva(d) { return S.giorno - d.assuntoGiorno < STELLE.prova; }

// autista: chiamata per ogni giornata di lavoro (pieno = la sua zona non ha lasciato pacchi indietro)
function giornataAutista(a, f, mie, pieno) {
  registra(a, 'giorno'); if (pieno) registra(a, 'pieno');
  const i = a.indole;
  if (Math.random() < (i === 'pasticcione' ? 0.35 : i === 'perla' ? 0.01 : 0.04)) {
    const n = casoInt(1, i === 'pasticcione' ? 3 : 1), costo = n * casoInt(25, 70);
    registra(a, 'perso', n); stat(a, 'persi', n); movimento('eventi', -costo);
    notizia(`${a.nome} ha perso ${n === 1 ? 'un pacco' : n + ' pacchi'}: ${costo} € di rimborsi.`, 'male', 'perso-' + a.id);
  }
  if (Math.random() < (i === 'scortese' ? 0.25 : i === 'pasticcione' ? 0.06 : i === 'perla' ? 0 : 0.02)) {
    registra(a, 'lamentela'); stat(a, 'lamentele', 1); cambiaFama(-0.4);
    emailLamentela(a);
  }
  if (Math.random() < (i === 'perla' ? 0.18 : i ? 0 : 0.025)) {
    registra(a, 'complimento'); stat(a, 'complimenti', 1); cambiaFama(0.2);
    notizia(`Un cliente ha fatto i complimenti a ${a.nome}.`, 'buono', 'compl-' + a.id);
  }
}
// moltiplicatori del carattere
function fattoreIncidenti(a) { return a.indole === 'distratto' ? 5 : a.indole === 'perla' ? 0.4 : 1; }
function fattoreSmistamento(m) { return m.indole === 'distratto' ? 0.75 : m.indole === 'perla' ? 1.15 : 1; }
function giornataMagazziniere(m) {
  registra(m, 'giorno');
  if (m.indole === 'distratto') registra(m, 'lento');
  if (Math.random() < (m.indole === 'pasticcione' ? 0.3 : m.indole === 'perla' ? 0.01 : 0.03)) {
    const n = casoInt(1, m.indole === 'pasticcione' ? 4 : 1), costo = n * casoInt(20, 60);
    registra(m, 'rotto', n); stat(m, 'rotti', n); movimento('eventi', -costo);
    notizia(`${m.nome} ha rotto ${n === 1 ? 'un pacco' : n + ' pacchi'} allo smistamento: ${costo} € di rimborsi.`, 'male', 'rotto-' + m.id);
  }
  if (m.indole === 'scortese' && Math.random() < 0.12) { registra(m, 'lamentela'); notizia(`Litigio in magazzino: ${m.nome} ha discusso con i colleghi.`, 'male', 'lite-' + m.id); }
}

// email di lamentela con il nome dell'autista (al massimo una a settimana per autista)
const EMAIL_LAMENTELE = [{
  id: 'lamentela',
  scelte: [
    { testo: 'Mi scuso e mando un buono sconto', rep: 1, soldi: -40, esito: 'Il cliente ha apprezzato le scuse.' },
    { testo: 'Mi scuso e parlo con l\'autista', rep: 1, soldi: 0, esito: 'Il cliente ringrazia. Tieni d\'occhio le stelle di questo autista.' },
    { testo: 'Ignoro', rep: -1, soldi: 0, esito: 'Il cliente ha lasciato una recensione negativa.' },
  ],
}];
const TESTI_LAMENTELA = [
  n => `Il vostro corriere ${n} ha lasciato il mio pacco sotto la pioggia, davanti al cancello. Dentro c'erano libri, tutti bagnati.`,
  n => `${n} mi ha risposto male al citofono e se n'è andato senza aspettare che scendessi.`,
  n => `Il pacco consegnato da ${n} è arrivato schiacciato e lui ha detto "non è colpa mia" senza nemmeno guardarlo.`,
  n => `${n} ha segnato "destinatario assente" ma io ero in casa tutto il giorno.`,
  n => `Il corriere ${n} ha lanciato il pacco oltre il cancello. L'ho visto dalla finestra.`,
];
function emailLamentela(a) {
  if (gestito(magDi(a))) { rispondeResponsabile(magDi(a), EMAIL_LAMENTELE[0]); return; }   // ci pensa il responsabile
  if ((a.ultimaLamentela || -99) > S.giorno - 7 || postaPiena()) { notizia(`Lamentela di un cliente su ${a.nome}.`, 'male', 'lam-' + a.id); return; }
  a.ultimaLamentela = S.giorno;
  S.posta = S.posta || [];
  S.posta.unshift({ id: 'lamentela', lamentela: true, ctx: { id: a.id }, giorno: S.giorno, scadenza: S.giorno + POSTA.giorniPerRispondere,
    mittente: 'Un cliente', oggetto: `Lamentela sul corriere ${a.nome}`, testo: scegli(TESTI_LAMENTELA)(a.nome), letta: false, risposta: null, esito: '' });
}

// licenziamento: gratis durante la prova, dopo costa un mese di stipendio
function costoLicenziamento(d) { return inProva(d) ? 0 : d.stipendio; }
