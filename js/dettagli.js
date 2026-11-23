/* Tycoon Logistica – statistiche di furgoni, dipendenti e magazzini, potenziamenti dei singoli furgoni
   e azioni sugli autisti. Nessun accesso al DOM. */

// Ogni oggetto (furgone, dipendente, magazzino) tiene: mese in corso, mese scorso e totale
function stat(o, campo, valore) {
  if (!o || !valore) return;
  o.stat = o.stat || { mese: {}, prec: {}, tot: {} };
  o.stat.mese[campo] = (o.stat.mese[campo] || 0) + valore;
  o.stat.tot[campo] = (o.stat.tot[campo] || 0) + valore;
}
function leggiStat(o, periodo, campo) { return (o && o.stat && o.stat[periodo] && o.stat[periodo][campo]) || 0; }
function chiudiMeseStat(o) { if (o && o.stat) { o.stat.prec = o.stat.mese; o.stat.mese = {}; } }

/* ---------- potenziamenti del singolo furgone ---------- */
const POTENZIAMENTI_FURGONE = {
  scaffali:   { nome: 'Scaffalature interne', descr: '+15% di pacchi per giro', costo: 3000 },
  navigatore: { nome: 'Navigatore professionale', descr: '−8% di km per giro', costo: 1500 },
  telecamere: { nome: 'Telecamere e sensori', descr: '−25% di incidenti', costo: 2500 },
  tagliandi:  { nome: 'Tagliandi programmati', descr: '−40% di guasti', costo: 2000 },
};
const ha = (f, p) => !!(f.pot && f.pot[p]);
function capacitaFurgone(f) { return Math.floor(COSTANTI.maxConsegneCorriere * (ha(f, 'scaffali') ? 1.15 : 1) * effetto.capacita()); }
function compraPotenziamento(idFurgone, p) {
  const f = S.furgoni.find(x => x.id === idFurgone), info = POTENZIAMENTI_FURGONE[p];
  if (!f || !info) return 'Potenziamento non trovato.';
  if (ha(f, p)) return 'Questo furgone lo ha già.';
  if (S.cassa < info.costo) return 'Non hai abbastanza soldi.';
  movimento('miglioramenti', -info.costo);
  f.pot = f.pot || {}; f.pot[p] = true;
  f.valore += Math.round(info.costo * 0.5);      // in parte si recupera rivendendo il furgone
  notizia(`${modello(f.modello).nome}: montato ${info.nome.toLowerCase()}.`, 'buono');
  return null;
}

/* ---------- azioni sugli autisti ---------- */
const CORSO_AUTISTA = { costo: 1200, esperienza: 15, pausaGiorni: 30 };
function corsoAutista(id) {
  const d = dipendente(id); if (!d) return null;
  if (d.ultimoCorso !== undefined && S.giorno - d.ultimoCorso < CORSO_AUTISTA.pausaGiorni) return `Ha già fatto un corso da poco: riprova tra ${CORSO_AUTISTA.pausaGiorni - (S.giorno - d.ultimoCorso)} giorni.`;
  if (S.cassa < CORSO_AUTISTA.costo) return 'Non hai abbastanza soldi.';
  movimento('miglioramenti', -CORSO_AUTISTA.costo);
  d.esperienza = Math.min(100, d.esperienza + CORSO_AUTISTA.esperienza); d.ultimoCorso = S.giorno;
  notizia(`${d.nome} ha fatto un corso di guida: esperienza +${CORSO_AUTISTA.esperienza}.`, 'buono');
  return null;
}
function aumentoDipendente(id, euro = 100) {
  const d = dipendente(id); if (!d) return null;
  d.stipendio += euro; d.ultimoAumento = S.giorno;
  notizia(`${d.nome} riceve un aumento di ${euro} €/mese: per un po' non chiederà altro.`, 'info');
  return null;
}
