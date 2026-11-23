/* Tycoon Logistica – traguardi: obiettivi a lungo termine con medaglia e premio in denaro.
   Si controllano a fine giornata; ognuno si sblocca una volta sola. */
const TRAGUARDI = [
  { id: 'primo-furgone',  nome: 'Si parte!',             descr: 'Compra il primo furgone',                     premio: 1000,  ok: () => S.furgoni.length >= 1 },
  { id: 'cons-1k',        nome: 'Mille consegne',        descr: 'Consegna 1.000 pacchi in totale',             premio: 2000,  ok: () => totaleConsegne() >= 1000 },
  { id: 'cons-10k',       nome: 'Diecimila',             descr: 'Consegna 10.000 pacchi in totale',            premio: 8000,  ok: () => totaleConsegne() >= 10000 },
  { id: 'cons-100k',      nome: 'Centomila',             descr: 'Consegna 100.000 pacchi in totale',           premio: 40000, ok: () => totaleConsegne() >= 100000 },
  { id: 'flotta-5',       nome: 'Piccola flotta',        descr: 'Abbi 5 furgoni',                              premio: 5000,  ok: () => S.furgoni.length >= 5 },
  { id: 'flotta-15',      nome: 'Grande flotta',         descr: 'Abbi 15 furgoni',                             premio: 20000, ok: () => S.furgoni.length >= 15 },
  { id: 'elettrico',      nome: 'Aria pulita',           descr: 'Compra il primo furgone elettrico',           premio: 3000,  ok: () => S.furgoni.some(f => modello(f.modello).tipo === 'elettrico') },
  { id: 'speciale',       nome: 'Attrezzati',            descr: 'Compra un furgone con allestimento speciale', premio: 2000,  ok: () => S.furgoni.some(f => f.allestimento && f.allestimento !== 'standard') },
  { id: 'jolly',          nome: 'Jolly in campo',        descr: 'Metti un furgone come jolly',                 premio: 1500,  ok: () => S.furgoni.some(f => isJolly(f)) },
  { id: 'magazzini-2',    nome: 'Due basi',              descr: 'Abbi 2 magazzini',                            premio: 15000, ok: () => S.depositi.length >= 2 },
  { id: 'magazzini-3',    nome: 'Rete di magazzini',     descr: 'Abbi 3 magazzini',                            premio: 30000, ok: () => S.depositi.length >= 3 },
  { id: 'zone-tutte',     nome: 'Tutta la città',        descr: 'Servi tutte le zone della città',             premio: 25000, ok: () => S.zone.every(z => S.furgoni.some(f => f.zona === z.id)) },
  { id: 'contratti-10',   nome: 'Cliente affidabile',    descr: 'Completa 10 contratti',                       premio: 5000,  ok: () => (S.contrattiCompletati || 0) >= 10 },
  { id: 'animali',        nome: 'Arca di Noè',           descr: 'Completa un contratto con animali vivi',      premio: 3000,  ok: () => !!(S.speciali && S.speciali.animali) },
  { id: 'reputazione-90', nome: 'Il migliore in città',  descr: 'Arriva a 90 di reputazione',                  premio: 10000, ok: () => S.reputazione >= 90 },
  { id: 'zero-giacenze',  nome: 'Nessuno indietro',      descr: '10 giorni lavorativi di fila senza pacchi in attesa', premio: 6000, ok: () => (S.serieSenzaGiacenze || 0) >= 10 },
  { id: 'utile-50k',      nome: 'Mese d\'oro',           descr: 'Chiudi un mese con 50.000 € di utile dal lavoro',        premio: 10000, ok: () => (S.storico || []).some(m => utileMese(m.voci) - (m.voci.premi || 0) + (m.voci.mezzi || 0) + (m.voci.magazzini || 0) + (m.voci.miglioramenti || 0) - (m.voci.vendite || 0) >= 50000) },
  { id: 'cassa-1m',       nome: 'Milionario',            descr: 'Arriva a 1.000.000 € in cassa',               premio: 50000, ok: () => S.cassa >= 1000000 },
  { id: 'migliora-tutto', nome: 'Azienda modello',       descr: 'Compra tutti i miglioramenti al massimo livello', premio: 30000, ok: () => Object.keys(MIGLIORAMENTI).every(id => prezzoMiglioramento(id) === null) },
];
function totaleConsegne() { return S.furgoni.reduce((t, f) => t + leggiStat(f, 'tot', 'consegne'), 0) + (S.consegneVendute || 0); }

// Chiamata a fine giornata: sblocca i traguardi raggiunti e paga il premio
function controllaTraguardi() {
  S.traguardi = S.traguardi || {};
  const nuovi = [];
  TRAGUARDI.forEach(t => {
    if (S.traguardi[t.id]) return;
    let fatto = false; try { fatto = t.ok(); } catch (e) { /* dati non ancora presenti */ }
    if (!fatto) return;
    S.traguardi[t.id] = S.giorno;
    movimento('premi', t.premio);
    notizia(`Traguardo sbloccato: ${t.nome.replace(/!$/, '')}! +${t.premio.toLocaleString('it-IT')} €`, 'buono', 'tr-' + t.id);
    nuovi.push(t);
  });
  if (nuovi.length) S.traguardiNuovi = (S.traguardiNuovi || []).concat(nuovi.map(t => t.id));
  return nuovi;
}
