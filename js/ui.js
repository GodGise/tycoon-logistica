/* Tycoon Logistica – interfaccia: pannello laterale, schede, ciclo di gioco. */
{
const $ = s => document.querySelector(s);
const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: true });
const eur2 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 3, maximumFractionDigits: 3 });
const dec1 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const eurCent = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const intero = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: true });
const segnato = n => `<span class="num ${n >= 0 ? 'piu' : 'meno'}">${n >= 0 ? '+' : '−'}${eur.format(Math.abs(n))}</span>`;
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtData = g => dataDelGiorno(g).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

let scheda = 'azienda', ultimoT = null, daRidisegnare = true;
let negozioUsato = false, negozioAperto = false, negozioAllestimento = 'standard';
let prezziCaricati = null, posizionando = false;
let dettaglio = null; // { tipo: 'furgone' | 'dipendente' | 'magazzino', id }
const inizio = { fase: 'citta', risultati: null, citta: null, cercando: false, errore: '' };

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('vis'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('vis'), 2600); }
function esito(errore, ok) { if (errore) toast(errore); else if (ok) toast(ok); ridisegna(); salva(); }

/* ---------- schede ---------- */
function vistaAzienda() {
  const utile = utileMese(S.conti.voci);
  const autisti = S.dipendenti.filter(d => d.ruolo === 'autista').length, mag = S.dipendenti.filter(d => d.ruolo === 'magazziniere').length;
  const rep = Math.round(S.reputazione), cls = rep >= 60 ? '' : rep >= 35 ? 'medio' : 'basso';
  const inc = S.inCorso && S.inCorso.giorno === S.giorno ? S.inCorso : null;
  const ieri = S.ieri && !S.ieri.festivo ? `${intero.format(S.ieri.consegne)} consegne · ${eur.format(inc ? inc.accreditato : S.ieri.incasso)} di ${eur.format(S.ieri.incasso)}` : 'Oggi non si lavora';
  const zone = S.zone.map(z => {
    const giri = S.furgoni.filter(f => f.zona === z.id);
    const pz = S.ieri && S.ieri.perZona && S.ieri.perZona[z.id];
    const cap = giri.length * COSTANTI.maxConsegneCorriere, cop = cap ? Math.min(100, Math.round(cap / z.pacchi * 100)) : 0;
    return `<div class="scheda">
      <div class="riga"><span class="zona-titolo"><i class="pallino" style="background:${z.colore}"></i>${esc(z.nome)}</span><span class="num">${z.pacchi} pacchi/giorno</span></div>
      <div class="metro ${cop >= 100 ? '' : cop >= 70 ? 'medio' : 'basso'}"><i style="width:${cop}%"></i></div>
      <div class="riga a-capo"><span>${giri.length ? `${giri.length} furgon${giri.length > 1 ? 'i' : 'e'} · capacità ${cap} consegne` : 'Zona non servita'} · giro ${kmGiro(z)} km</span>
      <span class="num">${pz ? `oggi ${pz.consegne} cons.${pz.giacenza ? ` · <span class="meno">${pz.giacenza} in giacenza</span>` : ''}` : ''}</span></div>
    </div>`;
  }).join('');
  const p = S.prezzi;
  return `
  <form class="cerca" data-azione="rinomina"><input id="input-nome" maxlength="40" value="${esc(S.nomeAzienda)}" aria-label="Nome dell'azienda"><button class="btn" type="submit">Rinomina</button></form>
  <div class="kpi">
    <div><b>${S.furgoni.length}</b><span>Furgoni</span></div>
    <div><b>${autisti}</b><span>Autisti</span></div>
    <div><b>${mag}</b><span>Magazzinieri</span></div>
  </div>
  ${vistaObiettivoEContratti()}
  <div class="scheda">
    <div class="riga"><span>Utile del mese</span>${segnato(utile)}</div>
    <div class="riga"><span>Oggi</span><span class="num" id="oggi">${ieri}</span></div>
    <div class="riga"><span>Reputazione</span><span class="num">${rep}/100</span></div>
    <div class="metro ${cls}"><i style="width:${rep}%"></i></div>
    <div class="riga"><span>Assicurazione flotta</span><span class="num">${eur.format(S.furgoni.reduce((t, f) => t + assicurazioneFurgone(f), 0))}/mese</span></div>
  </div>
  ${vistaMagazzini()}
  ${vistaMiglioramenti()}
  <div><h2>Zone di consegna <small>${esc(S.citta.nome)} · ${S.zone.length} zone</small></h2><div style="display:grid;gap:8px">${zone}</div>
  <p class="nota" style="margin-top:8px">Un corriere fa al massimo ${COSTANTI.maxConsegneCorriere} consegne al giorno; un magazziniere smista ${COSTANTI.pacchiMagazziniere} pacchi.</p></div>
  <div class="scheda">
    <h2 style="margin:0">Prezzi della settimana <small>${esc(p.settimana || '')}</small></h2>
    <div class="riga"><span>Gasolio (media FVG)</span><span class="num">${eur2.format(p.diesel_eur_litro)}/l</span></div>
    <div class="riga"><span>Ricarica in deposito</span><span class="num">${eur2.format(prezzoRicaricaDeposito())}/kWh</span></div>
    <div class="riga"><span>Energia all'ingrosso (PUN)</span><span class="num">${eur2.format(p.pun_eur_kwh)}/kWh</span></div>
    <p class="nota">Fonte: ${esc(p.fonte || '')}</p>
  </div>
  <button class="btn link" data-azione="nuova">Ricomincia da capo</button>`;
}

function vistaObiettivoEContratti() {
  const o = S.obiettivo;
  const quando = g => g === S.giorno ? 'oggi' : g === S.giorno + 1 ? 'domani' : dataDelGiorno(g).toLocaleDateString('it-IT', { weekday: 'long' });
  const ob = o ? `<div class="scheda obiettivo"><div class="riga"><span>Obiettivo di ${quando(o.giorno)}</span><b class="piu">+${eur.format(o.premio)}</b></div><div>${esc(o.testo)}</div></div>` : '';
  const ctr = S.contrattiAttivi.length ? `<div class="scheda"><h2 style="margin:0">Contratti firmati</h2>${S.contrattiAttivi.map(c => {
    const pronti = furgoniAdatti(c.zona, c.tipo).length;
    return `<div class="riga a-capo"><span><b style="color:var(--testo)">${esc(c.cliente)}</b> · ${c.pacchi} ${TIPI_CARICO[c.tipo].unita} · ${esc(zona(c.zona).nome)} · ${quando(c.giorno)}</span>
      <span class="num ${pronti ? 'piu' : 'meno'}">${pronti ? eur.format(c.totale) : (c.tipo === 'standard' ? 'nessun furgone in zona!' : 'serve furgone ' + ALLESTIMENTI[c.tipo].nome.toLowerCase() + '!')}</span></div>`;
  }).join('')}</div>` : '';
  return ob + ctr;
}

// Scheda dell'offerta di contratto, in basso sopra la mappa
function disegnaOfferta() {
  const el = $('#offerta'), o = S && S.offertaContratto;
  if (!o) { el.hidden = true; el.dataset.id = ''; return; }
  const t = TIPI_CARICO[o.tipo], z = zona(o.zona);
  if (el.dataset.id !== o.id) {
    el.dataset.id = o.id; el.hidden = false;
    const pronti = furgoniAdatti(o.zona, o.tipo).length;
    const requisito = o.tipo === 'standard'
      ? (pronti ? `Hai ${pronti} furgon${pronti > 1 ? 'i' : 'e'} in questa zona` : 'Nessun furgone in questa zona: assegnane uno prima del giorno di consegna')
      : (pronti ? `Hai un furgone ${ALLESTIMENTI[o.tipo].nome.toLowerCase()} in questa zona` : `Serve un furgone ${ALLESTIMENTI[o.tipo].nome.toLowerCase()} assegnato a questa zona`);
    el.innerHTML = `<div class="offerta-testa"><span class="badge ${o.tipo === 'standard' ? '' : 'speciale'}">${t.nome}</span><span class="nota">Nuovo contratto</span></div>
      <div class="offerta-corpo"><div><b>${esc(o.cliente)}</b><div class="nota">${o.pacchi} ${t.unita} in zona ${esc(z.nome)} · ${o.giorno === S.giorno + 1 ? 'domani' : dataDelGiorno(o.giorno).toLocaleDateString('it-IT', { weekday: 'long' })} · ${eurCent.format(o.paga)} l'uno</div></div>
      <div class="offerta-totale">${eur.format(o.totale)}</div></div>
      <div class="nota ${pronti ? 'piu' : 'meno'}">${requisito}. Se non consegni tutto paghi una penale.</div>
      <div class="metro"><i id="offerta-tempo"></i></div>
      <div class="due"><button class="btn" data-offerta="no">Rifiuta</button><button class="btn primario" data-offerta="si">Accetta</button></div>`;
  }
  $('#offerta-tempo').style.width = Math.max(0, o.restano / OFFERTA.durata * 100) + '%';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-offerta]'); if (!b || !S) return;
  if (b.dataset.offerta === 'si') esito(accettaOfferta(), 'Contratto firmato!'); else { rifiutaOfferta(); salva(); }
  disegnaOfferta(); ridisegna();
});

function vistaMiglioramenti() {
  return `<div class="scheda"><h2 style="margin:0">Miglioramenti</h2>${Object.entries(MIGLIORAMENTI).map(([id, m]) => {
    const l = livello(id), prezzo = prezzoMiglioramento(id), multi = m.livelli.length > 1;
    return `<div class="miglioramento"><div><b>${m.nome}${multi ? ` <small class="nota">livello ${l}/${m.livelli.length}</small>` : ''}</b><div class="nota">${m.descr}</div></div>
      ${prezzo === null ? '<span class="badge">Fatto</span>' : `<button class="btn piccolo" data-azione="migliora" data-id="${id}" ${S.cassa < prezzo ? 'disabled' : ''}>${eur.format(prezzo)}</button>`}</div>`;
  }).join('')}</div>`;
}

// Finestra al centro per gli eventi rari (con decisione) e per il riepilogo a gioco chiuso
function disegnaEvento() {
  const el = $('#finestra'), ev = S && S.evento;
  if (el.dataset.tipo === 'offline') return;
  if (!ev) { if (el.dataset.tipo === 'evento') { el.hidden = true; el.dataset.tipo = ''; el.dataset.id = ''; } return; }
  if (el.dataset.id !== ev.id) {
    el.dataset.id = ev.id; el.dataset.tipo = 'evento'; el.hidden = false;
    el.innerHTML = `<div class="finestra-corpo vetro"><span class="badge speciale">Imprevisto</span><h2>${esc(ev.titolo)}</h2><p>${esc(ev.testo)}</p>
      <div class="metro"><i id="evento-tempo"></i></div><p class="nota">Se non decidi, si applica l'ultima scelta.</p>
      <div class="scelte">${ev.scelte.map((s, i) => `<button class="btn ${i === 0 ? 'primario' : ''}" data-scelta="${i}">${esc(s)}</button>`).join('')}</div></div>`;
  }
  $('#evento-tempo').style.width = Math.max(0, ev.restano / EVENTO.durata * 100) + '%';
}
function mostraRiepilogoOffline(r) {
  const el = $('#finestra'); el.dataset.tipo = 'offline'; el.hidden = false;
  const ore = Math.floor(r.secondi / 3600), min = Math.round(r.secondi % 3600 / 60);
  el.innerHTML = `<div class="finestra-corpo vetro"><span class="badge">Bentornato</span><h2>Mentre eri via</h2>
    <p>Sono passat${ore ? 'e ' + ore + ' or' + (ore > 1 ? 'e' : 'a') + ' e ' : 'i '}${min} minuti${r.ridotto ? ' (si recuperano al massimo 2 ore)' : ''}: <b>${r.giorni} giorni</b> di lavoro per la tua azienda.</p>
    <div class="riga"><span>Consegne</span><span class="num">${intero.format(r.consegne)}</span></div>
    <div class="riga"><span>Cassa</span>${segnato(r.differenza)}</div>
    <div class="scelte"><button class="btn primario" data-scelta="ok">Continua</button></div></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-scelta]'); if (!b || !S) return;
  const el = $('#finestra');
  if (b.dataset.scelta === 'ok') { el.hidden = true; el.dataset.tipo = ''; return; }
  const testo = decidiEvento(+b.dataset.scelta);
  el.hidden = true; el.dataset.tipo = ''; el.dataset.id = '';
  esito(null, testo);
});

function vistaMagazzini() {
  const lista = S.depositi.map((m, i) => {
    const zoneServite = S.zone.filter(z => magazzinoVicino(z.centro).magazzino.id === m.id && S.furgoni.some(f => f.zona === z.id)).length;
    return `<div class="riga"><span><b style="color:var(--testo)">${i + 1}</b> · <button class="titolo-link piccolo" data-azione="dettaglio" data-tipo="magazzino" data-id="${m.id}">${esc(m.nome)} ›</button> · ${zoneServite} zon${zoneServite === 1 ? 'a' : 'e'} servit${zoneServite === 1 ? 'a' : 'e'}</span>
      ${S.depositi.length > 1 ? `<button class="btn piccolo" data-azione="vendi-magazzino" data-id="${m.id}">Vendi per ${eur.format(valoreMagazzino(m) * COSTANTI.rivenditaMagazzino)}</button>` : `<span class="num">${eur.format(valoreMagazzino(m))}</span>`}</div>`;
  }).join('');
  return `<div class="scheda">
    <h2 style="margin:0">Magazzini <small>di tua proprietà</small></h2>
    ${lista}
    ${posizionando ? `<p class="nota" style="color:var(--accento)">Clicca sulla mappa dove vuoi il nuovo magazzino.</p><button class="btn" data-azione="annulla-magazzino">Annulla</button>`
      : `<button class="btn" data-azione="nuovo-magazzino" ${S.cassa < COSTANTI.prezzoMagazzinoMin ? 'disabled' : ''}>Compra un magazzino (${eur.format(COSTANTI.prezzoMagazzinoMin)}–${eur.format(COSTANTI.prezzoMagazzinoMax)})</button>`}
    <p class="nota">Costa di più in centro e meno verso la periferia. Una volta comprato è tuo: niente affitto.</p>
    <p class="nota">Ogni zona parte dal magazzino più vicino: più è lontano, più km fanno i furgoni ogni giorno.</p>
  </div>`;
}

function vistaInizio() {
  if (inizio.fase === 'magazzino') {
    const c = inizio.citta;
    return `<div class="scheda">
      <h2 style="margin:0">${esc(c.nome)}</h2>
      <p class="nota">${esc(c.dettaglio || '')}</p>
      <div class="riga"><span>Zone create in automatico</span><span class="num">${anteprimaZone ? anteprimaZone.length : 0}</span></div>
      <div class="riga"><span>Pacchi al giorno in tutta la città</span><span class="num">${anteprimaZone ? intero.format(anteprimaZone.reduce((a, z) => a + z.pacchi, 0)) : 0}</span></div>
    </div>
    <div class="scheda" style="border-color:var(--accento)">
      <label style="display:grid;gap:6px"><span class="nota">Nome della tua azienda</span><input id="nome-nuova" class="campo-testo" maxlength="40" value="${esc(inizio.nome || ('Logistica ' + c.nome))}"></label>
      <h2 style="margin:0">Metti il tuo primo magazzino</h2>
      <p style="margin:0">Clicca sulla mappa nel punto dove vuoi il magazzino. Vicino al centro i giri sono più corti; in periferia arrivi meglio alle zone esterne.</p>
      <div class="riga"><span>Prezzo del magazzino</span><span class="num">${eur.format(COSTANTI.prezzoMagazzinoMin)}–${eur.format(COSTANTI.prezzoMagazzinoMax)}</span></div>
      <div class="riga"><span>Cassa iniziale</span><span class="num">${eur.format(COSTANTI.cassaIniziale)}</span></div>
      <p class="nota">In centro costa 300.000 €, verso il bordo della città scende fino a 200.000 €. Quello che resta ti serve per furgoni e stipendi.</p>
      ${inizio.errore ? `<p class="nota meno">${esc(inizio.errore)}</p>` : ''}
    </div>
    <button class="btn" data-azione="cambia-citta">Scegli un'altra città</button>`;
  }
  const voce = (c, i, gruppo) => `<button class="voce-citta" data-azione="scegli-citta" data-gruppo="${gruppo}" data-i="${i}"><b>${esc(c.nome)}</b><span>${esc(c.dettaglio || '')}</span></button>`;
  const risultati = inizio.risultati;
  return `<div style="display:grid;gap:10px">
      <h2 style="margin:0;font-size:22px">Dove apri la tua azienda?</h2>
      <p class="nota" style="margin:0">Scegli una città qualsiasi: le zone di consegna si creano da sole, a cerchi intorno al centro.</p>
      <form class="cerca" data-azione="cerca"><input id="cerca-citta" type="search" placeholder="Cerca una città…" autocomplete="off" value="${esc(inizio.testo || '')}"><button class="btn primario" type="submit" ${inizio.cercando ? 'disabled' : ''}>${inizio.cercando ? 'Cerco…' : 'Cerca'}</button></form>
      ${inizio.errore ? `<p class="nota meno">${esc(inizio.errore)}</p>` : ''}
    </div>
    ${risultati ? `<div class="lista-citta">${risultati.length ? risultati.map((c, i) => voce(c, i, 'r')).join('') : '<p class="nota">Nessuna città trovata.</p>'}</div>` : ''}
    <div><h2>Oppure parti da qui</h2><div class="lista-citta">${CITTA_SUGGERITE.map((c, i) => voce(c, i, 's')).join('')}</div></div>
    <p class="nota">Ricerca: © OpenStreetMap, Nominatim.</p>`;
}

// Scheda Giri: per ogni zona quanti pacchi ci sono e quanti aspettano in deposito
function vistaGiri() {
  const pz = (S.ieri && S.ieri.perZona) || {};
  const jolly = S.furgoni.filter(f => f.zona === ZONA_JOLLY);
  const dove = S.inCorso && S.inCorso.jolly || {};
  const servite = S.zone.filter(z => S.furgoni.some(f => f.zona === z.id))
    .map(z => ({ z, d: pz[z.id] || null, attesa: S.giacenze[z.id] || 0 }))
    .sort((a, b) => b.attesa - a.attesa);
  const totAttesa = servite.reduce((t, x) => t + x.attesa, 0);
  const righe = servite.map(({ z, d, attesa }) => {
    const furgoni = S.furgoni.filter(f => f.zona === z.id).length;
    const cap = d ? d.capacita : furgoni * COSTANTI.maxConsegneCorriere;
    const arrivo = d ? d.arrivo : z.pacchi;
    const pieno = cap ? Math.min(100, Math.round(arrivo / cap * 100)) : 100;
    return `<div class="scheda giro ${attesa > 0 ? 'in-ritardo' : ''}">
      <div class="riga"><span class="zona-titolo"><i class="pallino" style="background:${z.colore}"></i>${esc(z.nome)}</span>
        <span class="num ${attesa > 0 ? 'meno' : 'piu'}"><b>${intero.format(attesa)}</b> in attesa</span></div>
      <div class="metro ${pieno > 100 || attesa > 0 ? 'basso' : pieno > 85 ? 'medio' : ''}"><i style="width:${Math.min(100, pieno)}%"></i></div>
      <div class="griglia-giro">
        <div><b>${intero.format(arrivo)}</b><span>pacchi oggi</span></div>
        <div><b>${d ? intero.format(d.consegne) : '–'}</b><span>consegnati</span></div>
        <div><b>${furgoni}</b><span>furgon${furgoni === 1 ? 'e' : 'i'} · ${intero.format(cap)} posti</span></div>
        <div><b>${d && d.jolly ? '+' + intero.format(d.jolly) : '–'}</b><span>dal jolly</span></div>
      </div>
      ${d && d.smistati < d.arrivo ? `<p class="nota meno">${intero.format(d.arrivo - d.smistati)} pacchi non smistati: servono più magazzinieri.</p>` : ''}
    </div>`;
  }).join('');
  return `<div class="scheda">
      <div class="riga"><h2 style="margin:0">Pacchi in attesa in deposito</h2><span class="num ${totAttesa ? 'meno' : 'piu'}"><b>${intero.format(totAttesa)}</b></span></div>
      <p class="nota">Sono i pacchi rimasti in magazzino che domani si aggiungono a quelli nuovi. Oltre un giorno di ritardo i clienti annullano gli ordini e la reputazione scende.</p>
    </div>
    <div class="scheda jolly-box">
      <div class="riga"><h2 style="margin:0">Jolly</h2><span class="badge">${jolly.length} furgon${jolly.length === 1 ? 'e' : 'i'}</span></div>
      ${jolly.length ? jolly.map(f => { const z = dove[f.id] ? zona(dove[f.id]) : null, a = dipendente(f.autistaId);
        return `<div class="riga"><span>${esc(modello(f.modello).nome)} · ${a ? esc(a.nome) : 'senza autista'}</span><span class="num">${!furgoneOperativo(f) ? '<span class="meno">fermo</span>' : z ? 'oggi in ' + esc(z.nome) : 'in deposito'}</span></div>`; }).join('')
        : '<p class="nota">Nessun jolly. Nella scheda Flotta scegli "Jolly" come zona di un furgone: ogni mattina andrà da solo nella zona con più pacchi in attesa e la svuoterà. Utile anche quando un furgone è fermo per un incidente.</p>'}
    </div>
    ${righe || '<p class="nota">Nessuna zona servita: assegna un furgone a una zona nella scheda Flotta.</p>'}`;
}

/* ---------- schede di dettaglio ---------- */
function tabellaStat(o, righe) {
  // righe: [etichetta, campo | funzione(periodo), tipo: 'eur' | 'num' | 'eur-' ]
  const val = (r, per) => typeof r[1] === 'function' ? r[1](per) : leggiStat(o, per, r[1]);
  const fmt = (r, v) => r[2] === 'num' ? intero.format(v) : r[2] === 'eur-' ? (v ? '−' + eur.format(v) : '–') : r[2] === 'segno' ? segnato(v) : eur.format(v);
  return `<table class="tab-stat"><thead><tr><th></th><th>Questo mese</th><th>Mese scorso</th><th>Totale</th></tr></thead><tbody>
    ${righe.map(r => `<tr class="${r[3] || ''}"><td>${r[0]}</td>${['mese', 'prec', 'tot'].map(per => `<td>${fmt(r, Math.round(val(r, per)))}</td>`).join('')}</tr>`).join('')}
  </tbody></table>`;
}
function testaDettaglio(titolo, sotto, indietro) {
  return `<button class="btn link indietro" data-azione="chiudi-dettaglio">‹ ${indietro}</button>
    <div><h2 class="titolo-dettaglio">${titolo}</h2><div class="nota">${sotto}</div></div>`;
}
function dettaglioFurgone(f) {
  const m = modello(f.modello), a = dipendente(f.autistaId), c = costoKm(m, f.usato);
  const energia = m.tipo === 'diesel' ? 'carburante' : 'ricarica';
  const costi = per => leggiStat(f, per, energia) + leggiStat(f, per, 'manutenzione') + leggiStat(f, per, 'assicurazione');
  const kpi = `<div class="kpi">
    <div><b>${capacitaFurgone(f)}</b><span>pacchi per giro</span></div>
    <div><b>${eurCent.format(c.energia + c.manutenzione)}</b><span>costo al km</span></div>
    <div><b>${eur.format(assicurazioneFurgone(f))}</b><span>assicurazione/mese</span></div></div>`;
  const stato = f.fermo > 0 ? `fermo ${f.fermo} gg (${f.motivo})` : furgoneOperativo(f) ? (f.zona === ZONA_JOLLY ? 'jolly' : 'in zona ' + zona(f.zona).nome) : 'non operativo';
  const pot = Object.entries(POTENZIAMENTI_FURGONE).map(([k, p]) => `<div class="miglioramento"><div><b>${p.nome}</b><div class="nota">${p.descr}</div></div>
    ${ha(f, k) ? '<span class="badge">Montato</span>' : `<button class="btn piccolo" data-azione="potenzia" data-id="${f.id}" data-p="${k}" ${S.cassa < p.costo ? 'disabled' : ''}>${eur.format(p.costo)}</button>`}</div>`).join('');
  return `${testaDettaglio(esc(m.nome) + (f.usato ? ' <small class="nota">usato</small>' : ''), `${m.tipo} · ${ALLESTIMENTI[f.allestimento || 'standard'].nome.toLowerCase()} · ${intero.format(f.km)} km · ${stato}${a ? ' · autista ' + esc(a.nome) : ''}`, 'Flotta')}
    ${kpi}
    <div class="scheda">${tabellaStat(f, [
      ['Giorni di lavoro', 'giorni', 'num'], ['Consegne', 'consegne', 'num'], ['Km', 'km', 'num'],
      ['Incasso consegne', 'incasso', 'eur'],
      [m.tipo === 'diesel' ? 'Gasolio' : 'Ricarica', energia, 'eur-'], ['Manutenzione', 'manutenzione', 'eur-'], ['Assicurazione', 'assicurazione', 'eur-'],
      ['Utile del furgone', per => leggiStat(f, per, 'incasso') - costi(per), 'segno', 'totale'],
      ['Incidenti', 'incidenti', 'num'], ['Guasti', 'guasti', 'num']])}
      <p class="nota">L'utile del furgone non comprende lo stipendio dell'autista. L'assicurazione si conta a fine mese.</p></div>
    <div class="scheda"><h2 style="margin:0">Potenziamenti</h2>${pot}<p class="nota">Restano sul furgone; se lo vendi ne recuperi metà del costo.</p></div>
    <div class="scheda"><div class="riga"><span>Valore di rivendita</span><button class="btn piccolo" data-azione="vendi" data-id="${f.id}">Vendi per ${eur.format(f.valore * COSTANTI.valoreRivendita)}</button></div></div>`;
}
function dettaglioDipendente(d) {
  const autista = d.ruolo === 'autista', f = S.furgoni.find(x => x.autistaId === d.id);
  const giorniAz = S.giorno - d.assuntoGiorno;
  const costoUnita = per => { const n = leggiStat(d, per, autista ? 'consegne' : 'pacchi'); return n ? leggiStat(d, per, 'stipendio') / n : 0; };
  const corsoTra = d.ultimoCorso !== undefined ? CORSO_AUTISTA.pausaGiorni - (S.giorno - d.ultimoCorso) : 0;
  return `${testaDettaglio(esc(d.nome), `${RUOLI[d.ruolo].nome} · in azienda da ${giorniAz} giorn${giorniAz === 1 ? 'o' : 'i'}${f ? ' · ' + esc(modello(f.modello).nome) + (f.zona === ZONA_JOLLY ? ' (jolly)' : f.zona ? ' in ' + esc(zona(f.zona).nome) : '') : ''}`, 'Personale')}
    <div class="kpi">
      <div><b>${eur.format(d.stipendio)}</b><span>stipendio/mese</span></div>
      ${autista ? `<div><b>${Math.round(d.esperienza)}</b><span>esperienza /100</span></div>` : `<div><b>${intero.format(Math.round(COSTANTI.pacchiMagazziniere * effetto.smistamento()))}</b><span>pacchi al giorno</span></div>`}
      <div><b>${eurCent.format(costoUnita('prec') || costoUnita('mese'))}</b><span>costo per ${autista ? 'consegna' : 'pacco'}</span></div></div>
    ${autista ? `<div class="metro ${d.esperienza >= 60 ? '' : d.esperienza >= 30 ? 'medio' : 'basso'}"><i style="width:${d.esperienza}%"></i></div>` : ''}
    <div class="scheda">${tabellaStat(d, autista
      ? [['Giorni di lavoro', 'giorni', 'num'], ['Consegne', 'consegne', 'num'], ['Km guidati', 'km', 'num'], ['Incidenti', 'incidenti', 'num'], ['Stipendio pagato', 'stipendio', 'eur-']]
      : [['Giorni di lavoro', 'giorni', 'num'], ['Pacchi smistati', 'pacchi', 'num'], ['Stipendio pagato', 'stipendio', 'eur-']])}
      <p class="nota">Lo stipendio si conta a fine mese.${autista ? ' Più esperienza vuol dire meno incidenti, e quindi assicurazione più bassa.' : ''}</p></div>
    <div class="scheda"><h2 style="margin:0">Azioni</h2>
      ${autista ? `<div class="miglioramento"><div><b>Corso di guida</b><div class="nota">+${CORSO_AUTISTA.esperienza} di esperienza. Al massimo uno ogni ${CORSO_AUTISTA.pausaGiorni} giorni.</div></div>
        ${corsoTra > 0 ? `<span class="badge">tra ${corsoTra} gg</span>` : `<button class="btn piccolo" data-azione="corso" data-id="${d.id}" ${S.cassa < CORSO_AUTISTA.costo ? 'disabled' : ''}>${eur.format(CORSO_AUTISTA.costo)}</button>`}</div>` : ''}
      <div class="miglioramento"><div><b>Aumento di 100 €/mese</b><div class="nota">Per 60 giorni non chiederà aumenti e non rischi che si dimetta.</div></div>
        <button class="btn piccolo" data-azione="aumento" data-id="${d.id}">+100 €</button></div>
      <div class="miglioramento"><div><b>Licenzia</b><div class="nota">Paghi i giorni lavorati questo mese.</div></div>
        <button class="btn piccolo" data-azione="licenzia" data-id="${d.id}">Licenzia</button></div>
    </div>`;
}
function dettaglioMagazzino(mz) {
  const zone = S.zone.filter(z => magazzinoVicino(z.centro).magazzino.id === mz.id);
  const servite = zone.filter(z => S.furgoni.some(f => f.zona === z.id));
  const furgoni = S.furgoni.filter(f => f.zona && f.zona !== ZONA_JOLLY && servite.some(z => z.id === f.zona)).length;
  return `${testaDettaglio(esc(mz.nome), `${zone.length} zone vicine · ${servite.length} servite · ${furgoni} furgon${furgoni === 1 ? 'e' : 'i'} partono da qui`, 'Azienda')}
    <div class="kpi">
      <div><b>${eur.format(valoreMagazzino(mz))}</b><span>pagato</span></div>
      <div><b>${intero.format(leggiStat(mz, 'prec', 'pacchi') || leggiStat(mz, 'mese', 'pacchi'))}</b><span>pacchi al mese</span></div>
      <div><b>${zone.length ? Math.round(zone.reduce((t, z) => t + kmGiro(z), 0) / zone.length) : 0} km</b><span>giro medio</span></div></div>
    <div class="scheda">${tabellaStat(mz, [['Pacchi smistati per le sue zone', 'pacchi', 'num']])}</div>
    <div class="scheda"><h2 style="margin:0">Zone che partono da qui</h2>
      ${zone.map(z => `<div class="riga"><span class="zona-titolo"><i class="pallino" style="background:${z.colore}"></i>${esc(z.nome)}</span><span class="num">${z.pacchi} pacchi · giro ${kmGiro(z)} km${S.furgoni.some(f => f.zona === z.id) ? '' : ' · <span class="nota">non servita</span>'}</span></div>`).join('') || '<p class="nota">Nessuna: le zone partono da un altro magazzino più vicino.</p>'}
    </div>
    ${S.depositi.length > 1 ? `<div class="scheda"><div class="riga"><span>Vendita (70% del prezzo)</span><button class="btn piccolo" data-azione="vendi-magazzino" data-id="${mz.id}">Vendi per ${eur.format(valoreMagazzino(mz) * COSTANTI.rivenditaMagazzino)}</button></div></div>` : ''}`;
}
function vistaDettaglio() {
  const d = dettaglio;
  const o = d.tipo === 'furgone' ? S.furgoni.find(x => x.id === d.id) : d.tipo === 'dipendente' ? dipendente(d.id) : S.depositi.find(x => x.id === d.id);
  if (!o) { dettaglio = null; return VISTE[scheda](); }
  return d.tipo === 'furgone' ? dettaglioFurgone(o) : d.tipo === 'dipendente' ? dettaglioDipendente(o) : dettaglioMagazzino(o);
}
function apriDettaglio(tipo, id) {
  dettaglio = { tipo, id };
  scheda = tipo === 'furgone' ? 'flotta' : tipo === 'dipendente' ? 'personale' : 'azienda';
  negozioAperto = false; $('#contenuto').scrollTop = 0; ridisegna();
}
window.apriDettaglio = apriDettaglio;

/* ---------- grafici (scheda Conti) ---------- */
const nomeMeseBreve = k => { const [a, m] = k.split('-'); return new Date(+a, +m - 1, 1).toLocaleDateString('it-IT', { month: 'short' }); };
const compatto = n => { const a = Math.abs(n); return (n < 0 ? '−' : '') + (a >= 1e6 ? (a / 1e6).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' mln' : a >= 1e3 ? Math.round(a / 1e3) + 'k' : Math.round(a)) + ' €'; };
function graficoCassa() {
  const s = S.serieCassa || [];
  if (s.length < 2) return `<div class="scheda"><h2 style="margin:0">Cassa giorno per giorno</h2><p class="nota">Il grafico compare dopo qualche giornata di lavoro.</p></div>`;
  const W = 360, H = 150, sx = 8, dx = 44, top = 10, bot = 22;
  const vals = s.map(p => p[1]), min = Math.min(0, ...vals), max = Math.max(...vals);
  const x = i => dx + i * (W - dx - sx) / (s.length - 1), y = v => top + (max - v) / ((max - min) || 1) * (H - top - bot);
  const punti = s.map((p, i) => `${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
  const area = `${x(0)},${y(Math.max(min, 0))} ${punti} ${x(s.length - 1)},${y(Math.max(min, 0))}`;
  const ticks = [max, (max + min) / 2, min].map(v => `<line x1="${dx}" x2="${W - sx}" y1="${y(v)}" y2="${y(v)}" class="griglia-g"/><text x="${dx - 6}" y="${y(v) + 4}" text-anchor="end" class="asse-g">${compatto(v)}</text>`).join('');
  const zero = min < 0 ? `<line x1="${dx}" x2="${W - sx}" y1="${y(0)}" y2="${y(0)}" class="zero-g"/>` : '';
  const primo = fmtData(s[0][0]).split(' ').slice(1, 3).join(' '), ultimo = fmtData(s[s.length - 1][0]).split(' ').slice(1, 3).join(' ');
  return `<div class="scheda"><div class="riga"><h2 style="margin:0">Cassa giorno per giorno</h2><span class="num">${eur.format(vals[vals.length - 1])}</span></div>
    <div class="grafico" data-serie="cassa"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cassa negli ultimi ${s.length} giorni, da ${eur.format(vals[0])} a ${eur.format(vals[vals.length - 1])}">
      ${ticks}${zero}<polygon points="${area}" class="area-g"/><polyline points="${punti}" class="linea-g"/>
      <text x="${dx}" y="${H - 6}" class="asse-g">${primo}</text><text x="${W - sx}" y="${H - 6}" text-anchor="end" class="asse-g">${ultimo}</text>
      <line class="mirino" x1="0" x2="0" y1="${top}" y2="${H - bot}" visibility="hidden"/><circle class="punto-g" r="4" visibility="hidden"/>
    </svg><div class="tooltip-g" hidden></div></div></div>`;
}
function graficoUtileMesi() {
  const mesi = [...(S.storico || [])].reverse().concat([{ mese: S.conti.mese, voci: S.conti.voci, inCorso: true }]).slice(-12);
  if (mesi.length < 2 && !Object.values(S.conti.voci).some(v => v)) return '';
  // utile operativo: senza gli investimenti (furgoni, magazzini, miglioramenti) e senza le vendite di mezzi
  const operativo = v => utileMese(v) + (v.mezzi || 0) + (v.magazzini || 0) + (v.miglioramenti || 0) - (v.vendite || 0);
  const dati = mesi.map(m => ({ k: m.mese, v: operativo(m.voci), inCorso: m.inCorso }));
  const maxAbs = Math.max(1, ...dati.map(d => Math.abs(d.v)));
  return `<div class="scheda"><h2 style="margin:0">Utile operativo mese per mese</h2>
    <div class="barre-mesi ${dati.every(d => d.v >= 0) ? 'solo-pos' : ''}">${dati.map(d => `<div class="mese-b ${d.inCorso ? 'in-corso' : ''}" title="${nomeMeseBreve(d.k)}: ${d.v >= 0 ? '+' : '−'}${eur.format(Math.abs(d.v))}${d.inCorso ? ' (in corso)' : ''}">
      <div class="meta-su">${d.v > 0 ? `<i class="pos" style="height:${Math.max(3, d.v / maxAbs * 100)}%"></i>` : ''}</div>
      <div class="meta-giu">${d.v < 0 ? `<i class="neg" style="height:${Math.max(3, -d.v / maxAbs * 100)}%"></i>` : ''}</div>
      <span>${nomeMeseBreve(d.k)}</span></div>`).join('')}</div>
    <p class="nota">Quanto rende il lavoro, senza contare gli acquisti di furgoni, magazzini e miglioramenti. Verde guadagno, rosso perdita; l'ultima colonna è il mese in corso. Passa sopra una barra per il valore.</p></div>`;
}
function graficoZone() {
  const righe = S.zone.map(z => ({ z, v: leggiStat(z, 'mese', 'incasso'), p: leggiStat(z, 'prec', 'incasso'), c: leggiStat(z, 'mese', 'consegne') }))
    .filter(r => r.v || r.p).sort((a, b) => b.v - a.v);
  if (!righe.length) return '';
  const max = Math.max(...righe.map(r => r.v), 1);
  return `<div class="scheda"><h2 style="margin:0">Le zone che rendono di più <small>questo mese</small></h2>
    ${righe.map(r => `<div class="zona-b"><div class="riga"><span class="zona-titolo"><i class="pallino" style="background:${r.z.colore}"></i>${esc(r.z.nome)}</span><span class="num">${eur.format(r.v)} · ${intero.format(r.c)} cons.</span></div>
      <div class="barra-z"><i style="width:${r.v / max * 100}%"></i></div></div>`).join('')}
    <p class="nota">Incasso delle consegne normali, senza contratti.</p></div>`;
}
// tooltip del grafico della cassa
document.addEventListener('pointermove', e => {
  const g = e.target.closest && e.target.closest('.grafico[data-serie="cassa"]'); if (!g || !S || !S.serieCassa) return;
  const svg = g.querySelector('svg'), r = svg.getBoundingClientRect(), s = S.serieCassa;
  const W = 360, dx = 44, sx = 8, px = (e.clientX - r.left) / r.width * W;
  const i = Math.max(0, Math.min(s.length - 1, Math.round((px - dx) / (W - dx - sx) * (s.length - 1))));
  const vals = s.map(p => p[1]), min = Math.min(0, ...vals), max = Math.max(...vals), H = 150, top = 10, bot = 22;
  const x = dx + i * (W - dx - sx) / (s.length - 1), y = top + (max - s[i][1]) / ((max - min) || 1) * (H - top - bot);
  const m = svg.querySelector('.mirino'), c = svg.querySelector('.punto-g'), t = g.querySelector('.tooltip-g');
  m.setAttribute('x1', x); m.setAttribute('x2', x); m.setAttribute('visibility', 'visible');
  c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('visibility', 'visible');
  t.hidden = false; t.innerHTML = `<b>${eur.format(s[i][1])}</b><span>${fmtData(s[i][0])}</span>`;
  t.style.left = Math.min(r.width - 120, Math.max(0, x / W * r.width - 60)) + 'px';
});
document.addEventListener('pointerout', e => {
  const g = e.target.closest && e.target.closest('.grafico'); if (!g || g.contains(e.relatedTarget)) return;
  g.querySelectorAll('.mirino,.punto-g').forEach(el => el.setAttribute('visibility', 'hidden')); const t = g.querySelector('.tooltip-g'); if (t) t.hidden = true;
});

function vistaAttivita() {
  if (!S.feed.length) return '<p class="nota">Ancora nessuna attività.</p>';
  const gruppi = [];
  S.feed.forEach(f => { let g = gruppi.find(x => x.giorno === f.giorno); if (!g) gruppi.push(g = { giorno: f.giorno, voci: [] }); g.voci.push(f); });
  return gruppi.slice(0, 30).map(g => `<div class="giorno-feed"><h3>${fmtData(g.giorno)}</h3>${g.voci.map(v =>
    `<div class="voce-feed ${v.tipo}"><i class="segno"></i><span>${esc(v.testo)}</span>${v.n > 1 ? `<span class="conteggio">${v.n} volte</span>` : ''}</div>`).join('')}</div>`).join('');
}

function vistaConti() {
  const prec = S.storico[0];
  const nomeMese = k => { const [a, m] = k.split('-'); return new Date(+a, +m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }); };
  const righe = Object.keys(VOCI).filter(k => S.conti.voci[k] || (prec && prec.voci[k])).map(k => {
    const entra = VOCI_ENTRATA.includes(k), f = v => v ? `<span class="${entra ? 'piu' : 'meno'}">${entra ? '+' : '−'}${eur.format(v)}</span>` : '–';
    return `<tr><td>${VOCI[k]}</td><td>${f(S.conti.voci[k])}</td>${prec ? `<td>${f(prec.voci[k])}</td>` : ''}</tr>`;
  }).join('');
  return `<div class="scheda">
    <table><thead><tr><th>Voce</th><th>${nomeMese(S.conti.mese)}</th>${prec ? `<th>${nomeMese(prec.mese)}</th>` : ''}</tr></thead>
    <tbody>${righe || `<tr><td colspan="3">Nessun movimento questo mese.</td></tr>`}
    <tr class="totale"><td>Utile</td><td>${segnato(utileMese(S.conti.voci))}</td>${prec ? `<td>${segnato(utileMese(prec.voci))}</td>` : ''}</tr></tbody></table>
  </div>
  ${graficoCassa()}
  ${graficoUtileMesi()}
  ${graficoZone()}
  <p class="nota">Stipendi e assicurazione si pagano l'ultimo giorno del mese. Contratti, premi e penali si incassano o pagano a fine giornata. Le riparazioni dopo un incidente sono a carico dell'autista; all'azienda sale l'assicurazione di quel furgone (+25% a incidente) e non scende più finché non lo vendi.</p>`;
}

function vistaNegozio() {
  const a = ammortamento();
  const box = `<div class="ammortamento">Ammortamento: con i prezzi di questa settimana l'e-Pacato si ripaga rispetto al Pacato Fiatt in
    <b>${isFinite(a.settimane) ? a.settimane + ' settimane di gioco' : 'mai'}</b> (risparmio di ${eur.format(a.risparmio)} a settimana su ${a.kmSettimana} km).</div>`;
  const lista = CATALOGO.filter(m => !(negozioUsato && m.tipo === 'elettrico')).map(m => {
    const prezzo = prezzoAcquisto(m, negozioUsato, negozioAllestimento), c = costoKm(m, negozioUsato);
    return `<div class="scheda">
      <div class="riga"><strong>${esc(m.nome)}</strong><span class="badge ${m.tipo}">${m.tipo}</span></div>
      <div class="riga"><span>${dec1.format(m.consumo)} ${m.tipo === 'diesel' ? 'l' : 'kWh'}/100 km · costo ${eur2.format(c.energia + c.manutenzione)}/km</span><span class="num"><b>${eur.format(prezzo)}</b></span></div>
      <button class="btn primario" data-azione="compra" data-id="${m.id}" ${S.cassa < prezzo ? 'disabled' : ''}>Compra${negozioUsato ? ' usato' : ''}</button>
    </div>`;
  }).join('');
  return `<div class="riga"><h2 style="margin:0">Compra un furgone</h2><button class="btn piccolo" data-azione="chiudi-negozio">Chiudi</button></div>
    <div class="interruttore"><button data-azione="usato" data-v="0" aria-pressed="${!negozioUsato}">Nuovo</button><button data-azione="usato" data-v="1" aria-pressed="${negozioUsato}">Usato</button></div>
    <div><span class="nota">Allestimento</span>
    <div class="interruttore a-capo">${Object.entries(ALLESTIMENTI).map(([k, a]) => `<button data-azione="allestimento" data-v="${k}" aria-pressed="${negozioAllestimento === k}">${a.nome}${a.costo ? ' +' + eur.format(a.costo) : ''}</button>`).join('')}</div>
    <p class="nota" style="margin-top:6px">${ALLESTIMENTI[negozioAllestimento].descr}${negozioAllestimento !== 'standard' ? '. Serve per i contratti con carichi speciali, che pagano molto di più.' : '.'}</p></div>
    ${negozioUsato ? '<p class="nota">L\'usato costa molto meno ma si rompe più spesso: ottimo come furgone di riserva.</p>' : box}
    ${lista}
    <p class="nota">Prezzi provvisori, da verificare con i listini reali.</p>`;
}

function vistaFlotta() {
  if (negozioAperto) return vistaNegozio();
  const autisti = S.dipendenti.filter(d => d.ruolo === 'autista');
  const carte = S.furgoni.map(f => {
    const m = modello(f.modello);
    const stato = f.fermo > 0 ? `<span class="badge fermo">fermo ${f.fermo} gg · ${f.motivo}</span>` : furgoneOperativo(f) ? '<span class="badge">operativo</span>' : '<span class="badge fermo">non operativo</span>';
    const optA = ['<option value="">Nessun autista</option>', ...autisti.map(a => {
      const altro = S.furgoni.find(x => x.autistaId === a.id && x.id !== f.id);
      return `<option value="${a.id}" ${f.autistaId === a.id ? 'selected' : ''}>${esc(a.nome)}${altro ? ' (su altro furgone)' : ''}</option>`;
    })].join('');
    const optZ = ['<option value="">In deposito</option>', `<option value="${ZONA_JOLLY}" ${f.zona === ZONA_JOLLY ? 'selected' : ''}>Jolly: va dove ci sono più pacchi</option>`, ...S.zone.map(z => `<option value="${z.id}" ${f.zona === z.id ? 'selected' : ''}>${esc(z.nome)}</option>`)].join('');
    return `<div class="scheda">
      <div class="riga"><button class="titolo-link" data-azione="dettaglio" data-tipo="furgone" data-id="${f.id}">${esc(m.nome)}${f.usato ? ' <small class="nota">usato</small>' : ''} ›</button><span class="badge ${m.tipo}">${m.tipo}</span></div>
      ${f.allestimento && f.allestimento !== 'standard' ? `<div class="riga"><span>Allestimento</span><span class="badge speciale">${ALLESTIMENTI[f.allestimento].nome}</span></div>` : ''}
      <div class="riga"><span>${intero.format(f.km)} km</span>${stato}</div>
      <div class="riga"><span>Assicurazione</span><span class="num ${f.premio > 1 ? 'meno' : ''}">${eur.format(assicurazioneFurgone(f))}/mese${f.premio > 1 ? ` · +${Math.round((f.premio - 1) * 100)}% (${f.incidenti} incident${f.incidenti === 1 ? 'e' : 'i'})` : ''}</span></div>
      ${f.premio >= 1.75 ? '<p class="nota" style="color:var(--avviso)">Assicurazione molto cara: forse conviene venderlo e comprarne un altro.</p>' : ''}
      <div class="due">
        <label><span class="nota">Autista</span><select data-azione="assegna" data-campo="autista" data-id="${f.id}">${optA}</select></label>
        <label><span class="nota">Zona</span><select data-azione="assegna" data-campo="zona" data-id="${f.id}">${optZ}</select></label>
      </div>
      <div class="riga"><span>Valore di rivendita</span><button class="btn piccolo" data-azione="vendi" data-id="${f.id}">Vendi per ${eur.format(f.valore * COSTANTI.valoreRivendita)}</button></div>
    </div>`;
  }).join('');
  return `<button class="btn primario" data-azione="apri-negozio">Compra un furgone</button>
    ${carte || '<p class="nota">Non hai ancora furgoni. Comincia da uno: un diesel usato costa poco, un elettrico nuovo consuma meno.</p>'}
    <p class="nota">Un furgone senza autista resta fermo, ma assicurazione e costi del mezzo li paghi lo stesso.</p>`;
}

function vistaPersonale() {
  return ['autista', 'magazziniere'].map(ruolo => {
    const r = RUOLI[ruolo], staff = S.dipendenti.filter(d => d.ruolo === ruolo);
    const lista = staff.map(d => `<div class="scheda">
      <div class="riga"><button class="titolo-link" data-azione="dettaglio" data-tipo="dipendente" data-id="${d.id}">${esc(d.nome)} ›</button><span class="num">${eur.format(d.stipendio)}/mese</span></div>
      ${ruolo === 'autista' ? `<div class="riga"><span>Esperienza</span><span class="num">${Math.round(d.esperienza)}/100</span></div><div class="metro ${d.esperienza >= 60 ? '' : d.esperienza >= 30 ? 'medio' : 'basso'}"><i style="width:${d.esperienza}%"></i></div>` : ''}
      <div class="riga"><span>${ruolo === 'autista' ? (S.furgoni.some(f => f.autistaId === d.id && f.zona === ZONA_JOLLY) ? '<b style="color:#ffd60a">Jolly</b>' : S.furgoni.some(f => f.autistaId === d.id) ? 'Assegnato a un furgone' : 'Senza furgone') : `Smista ${COSTANTI.pacchiMagazziniere} pacchi al giorno`}</span>
      <button class="btn piccolo" data-azione="licenzia" data-id="${d.id}">Licenzia</button></div>
    </div>`).join('');
    const cand = S.candidati[ruolo].map(c => `<div class="scheda">
      <div class="riga"><strong>${esc(c.nome)}</strong><span class="num">${eur.format(c.stipendio)}/mese</span></div>
      ${c.esperienza !== null ? `<div class="riga"><span>Esperienza</span><span class="num">${c.esperienza}/100</span></div><div class="metro ${c.esperienza >= 60 ? '' : c.esperienza >= 30 ? 'medio' : 'basso'}"><i style="width:${c.esperienza}%"></i></div>` : ''}
      <button class="btn primario" data-azione="assumi" data-id="${c.id}" data-ruolo="${ruolo}">Assumi</button></div>`).join('');
    const inArrivo = S.annunciInArrivo[ruolo] !== undefined;
    return `<div style="display:grid;gap:8px">
      <h2>${r.nome === 'Autista' ? 'Autisti' : 'Magazzinieri'} <small>${staff.length} in squadra</small></h2>
      ${lista || '<p class="nota">Nessuno in squadra.</p>'}
      <div class="scheda">
        <div class="riga"><span>Stipendio offerto</span><span class="num" id="val-${ruolo}">${eur.format(S.offerta[ruolo])}</span></div>
        <input type="range" min="${r.stipMin}" max="${r.stipMax}" step="50" value="${S.offerta[ruolo]}" data-azione="stipendio" data-ruolo="${ruolo}" aria-label="Stipendio offerto ${r.nome}">
        <p class="nota">Stipendio basso: pochi candidati, quasi tutti inesperti. Stipendio alto: più candidati e più esperti.</p>
        <button class="btn" data-azione="annuncio" data-ruolo="${ruolo}" ${inArrivo ? 'disabled' : ''}>${inArrivo ? 'Annuncio pubblicato, candidati domani' : `Pubblica annuncio (${eur.format(COSTANTI.costoAnnuncio)})`}</button>
      </div>
      <h2>Candidati <small>si aggiornano ogni lunedì</small></h2>
      ${cand || '<p class="nota">Nessun candidato al momento.</p>'}
    </div>`;
  }).join('');
}

const VISTE = { azienda: vistaAzienda, giri: vistaGiri, attivita: vistaAttivita, conti: vistaConti, flotta: vistaFlotta, personale: vistaPersonale };

function testata() {
  $('#nome-azienda').textContent = S ? S.nomeAzienda : 'Tycoon Logistica';
  $('#sotto-marchio').textContent = S ? `Tycoon Logistica · ${S.citta.nome}` : 'nome del gioco provvisorio';
  $('#logo').textContent = S ? S.nomeAzienda.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') : 'TL';
  if (!S) { $('#cassa').textContent = '–'; $('#utile-mese').textContent = 'Scegli una città per iniziare'; $('#data').textContent = 'Nuova partita'; return; }
  $('#cassa').textContent = eur.format(S.cassa);
  $('#cassa').className = 'cifra-grande' + (S.cassa < 0 ? ' meno' : '');
  const u = utileMese(S.conti.voci);
  $('#utile-mese').innerHTML = `${segnato(u)} <span style="color:var(--testo-2)">questo mese</span>`;
  $('#data').textContent = dataDelGiorno(S.giorno).getDay() === 6 ? 'Fine settimana ' + dataDelGiorno(S.giorno).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : fmtData(S.giorno);
}
function ridisegna() {
  testata();
  const c = $('#contenuto'), scroll = c.scrollTop;
  document.querySelector('.pannello').classList.toggle('in-avvio', !S);
  c.innerHTML = S ? (dettaglio ? vistaDettaglio() : VISTE[scheda]()) : vistaInizio();
  const chiave = scheda + (dettaglio ? ':' + dettaglio.id : '');
  if (c.dataset.scheda !== chiave) { c.dataset.scheda = chiave; c.classList.remove('entra'); void c.offsetWidth; c.classList.add('entra'); }
  c.scrollTop = scroll;
  document.querySelectorAll('.schede button').forEach(b => b.setAttribute('aria-selected', b.dataset.scheda === scheda));
  muoviIndicatore();
  aggiornaZoneMappa();
  daRidisegnare = false;
}
// la "goccia" di vetro sotto la scheda selezionata scivola da una scheda all'altra
function muoviIndicatore() {
  const b = document.querySelector('.schede button[aria-selected="true"]'), ind = document.querySelector('.schede .indicatore');
  if (!b || !ind) return;
  ind.style.width = b.offsetWidth + 'px'; ind.style.transform = `translateX(${b.offsetLeft}px)`;
}
window.addEventListener('resize', muoviIndicatore);
// riflesso di luce leggero che segue il puntatore sulle superfici di vetro e svanisce quando esci
let vetroAttivo = null;
document.addEventListener('pointermove', e => {
  const v = e.target.closest && e.target.closest('.vetro, .finestra-corpo');
  if (vetroAttivo && vetroAttivo !== v) vetroAttivo.style.setProperty('--luce', 0);
  vetroAttivo = v;
  if (!v) return;
  const r = v.getBoundingClientRect();
  v.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
  v.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  v.style.setProperty('--luce', 1);
});
document.addEventListener('pointerleave', () => { if (vetroAttivo) { vetroAttivo.style.setProperty('--luce', 0); vetroAttivo = null; } });

// non ridisegnare mentre il giocatore sta usando un menu o uno slider
function ridisegnaSePossibile() {
  const a = document.activeElement;
  if (a && $('#contenuto').contains(a) && (a.tagName === 'SELECT' || a.tagName === 'INPUT')) { daRidisegnare = true; testata(); return; }
  ridisegna();
}

/* ---------- eventi ---------- */
document.querySelector('.schede').addEventListener('click', e => {
  const b = e.target.closest('button[data-scheda]'); if (!b) return;
  scheda = b.dataset.scheda; negozioAperto = false; dettaglio = null; $('#contenuto').scrollTop = 0; ridisegna();
});
$('#contenuto').addEventListener('click', e => {
  const b = e.target.closest('[data-azione]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
  const id = b.dataset.id;
  switch (b.dataset.azione) {
    case 'apri-negozio': negozioAperto = true; $('#contenuto').scrollTop = 0; ridisegna(); break;
    case 'chiudi-negozio': negozioAperto = false; ridisegna(); break;
    case 'usato': negozioUsato = b.dataset.v === '1'; ridisegna(); break;
    case 'dettaglio': apriDettaglio(b.dataset.tipo, id); break;
    case 'chiudi-dettaglio': dettaglio = null; $('#contenuto').scrollTop = 0; ridisegna(); break;
    case 'potenzia': esito(compraPotenziamento(id, b.dataset.p), 'Potenziamento montato!'); break;
    case 'corso': esito(corsoAutista(id), 'Corso fatto: esperienza aumentata.'); break;
    case 'aumento': if (b.dataset.conferma) esito(aumentoDipendente(id), 'Aumento concesso.'); else { b.dataset.conferma = 1; b.textContent = 'Confermi?'; } break;
    case 'migliora': esito(compraMiglioramento(id), 'Miglioramento comprato!'); break;
    case 'allestimento': negozioAllestimento = b.dataset.v; ridisegna(); break;
    case 'compra': { const err = compraFurgone(id, negozioUsato, negozioAllestimento); if (!err) negozioAperto = false; esito(err, 'Furgone comprato: ora assegnagli un autista e una zona.'); break; }
    case 'vendi': if (b.dataset.conferma) { vendiFurgone(id); esito(null, 'Furgone venduto.'); } else { b.dataset.conferma = 1; b.textContent = 'Confermi la vendita?'; } break;
    case 'assumi': esito(assumi(id, b.dataset.ruolo), 'Assunto!'); break;
    case 'licenzia': if (b.dataset.conferma) { licenzia(id); esito(null, 'Dipendente licenziato.'); } else { b.dataset.conferma = 1; b.textContent = 'Confermi?'; } break;
    case 'annuncio': { const r = b.dataset.ruolo; esito(pubblicaAnnuncio(r, S.offerta[r])); break; }
    case 'scegli-citta': scegliCitta((b.dataset.gruppo === 's' ? CITTA_SUGGERITE : inizio.risultati)[+b.dataset.i]); break;
    case 'cambia-citta': annullaPuntoSullaMappa(); inizio.fase = 'citta'; inizio.errore = ''; ridisegna(); break;
    case 'nuovo-magazzino': posizionando = true; ridisegna(); chiediPuntoSullaMappa(punto => {
      posizionando = false; esito(apriMagazzino(punto), 'Magazzino aperto.'); aggiornaDepositiMappa(); }); break;
    case 'annulla-magazzino': posizionando = false; annullaPuntoSullaMappa(); ridisegna(); break;
    case 'vendi-magazzino': if (b.dataset.conferma) { esito(vendiMagazzino(id), 'Magazzino venduto.'); aggiornaDepositiMappa(); } else { b.dataset.conferma = 1; b.textContent = 'Confermi?'; } break;
    case 'nuova': if (b.dataset.conferma) { cancellaSalvataggio(); S = null; anteprimaZone = null; Object.assign(inizio, { fase: 'citta', risultati: null, citta: null, errore: '' }); aggiornaZoneMappa(); ridisegna(); } else { b.dataset.conferma = 1; b.textContent = 'Sicuro? Perdi la partita attuale. Clicca di nuovo.'; } break;
  }
});
$('#contenuto').addEventListener('submit', async e => {
  e.preventDefault();
  if (e.target.dataset.azione === 'rinomina') { esito(rinominaAzienda($('#input-nome').value), 'Nome aggiornato.'); $('#input-nome').blur(); return; }
  const testo = $('#cerca-citta').value.trim(); if (testo.length < 2) return;
  Object.assign(inizio, { testo, cercando: true, errore: '' }); ridisegna();
  try { inizio.risultati = await cercaCitta(testo); }
  catch (err) { inizio.errore = 'La ricerca non risponde: prova una delle città qui sotto.'; inizio.risultati = null; }
  inizio.cercando = false; ridisegna();
});
function scegliCitta(c) {
  if (!c) return;
  Object.assign(inizio, { fase: 'magazzino', citta: c, errore: '' });
  mostraCitta(c); ridisegna();
  const attendi = punto => {
    const d = distanzaKm([c.lng, c.lat], punto);
    if (d > c.raggio * COSTANTI.distanzaMaxMagazzino) { inizio.errore = `Troppo lontano dal centro (${Math.round(d)} km): avvicinati alla città.`; ridisegna(); chiediPuntoSullaMappa(attendi); return; }
    const campo = document.getElementById('nome-nuova');
    nuovaPartita(prezziCaricati || PREZZI_RISERVA, c, punto, anteprimaZone, (campo && campo.value.trim()) || inizio.nome);
    salva(); scheda = 'azienda'; ridisegna(); aggiornaZoneMappa();
    toast(`Magazzino comprato a ${c.nome} per ${eur.format(S.depositi[0].valore)}. Ora compra un furgone!`);
  };
  chiediPuntoSullaMappa(attendi);
}
$('#contenuto').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.azione === 'assegna') { assegna(t.dataset.id, t.dataset.campo, t.value); t.blur(); esito(); }
  if (t.dataset.azione === 'stipendio') { S.offerta[t.dataset.ruolo] = +t.value; t.blur(); salva(); if (daRidisegnare) ridisegna(); }
});
$('#contenuto').addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'nome-nuova') inizio.nome = t.value; if (t.dataset.azione === 'stipendio') $('#val-' + t.dataset.ruolo).textContent = eur.format(+t.value);
});

/* ---------- ciclo di gioco ---------- */
// Il tempo scorre da solo: ogni giornata dura 3 minuti, il fine settimana passa in un unico blocco.
// Il tempo trascorso nella giornata è salvato, quindi ricaricare la pagina non fa ripartire il giorno.
let ultimoSalvataggio = 0, ultimaTestata = 0;
function ciclo(t) {
  if (ultimoT === null) ultimoT = t;
  if (!S) { ultimoT = t; $('#countdown').textContent = '2:30'; $('#ora').textContent = ''; requestAnimationFrame(ciclo); return; }
  const dt = Math.min(0.25, (t - ultimoT) / 1000); ultimoT = t;
  const durata = COSTANTI.secondiPerGiorno;
  if (!S.inCorso || S.inCorso.giorno !== S.giorno) avviaGiornata();
  S.tempoGiorno = (S.tempoGiorno || 0) + dt;
  if (S.tempoGiorno >= durata) {
    S.tempoGiorno = 0;
    const sabato = dataDelGiorno(S.giorno).getDay() === 6;
    concludiGiornata();
    if (sabato) simulaGiorno(); // anche la domenica
    avviaGiornata();
    salva(); ridisegnaSePossibile();
  }
  // gli autisti consegnano: la cassa sale durante la giornata
  avanzaIncasso(S.tempoGiorno / durata);
  if (aggiornaOfferte(dt)) daRidisegnare = true;
  disegnaOfferta();
  if (aggiornaEvento(dt)) daRidisegnare = true;
  disegnaEvento();
  soldiSullaMappa(t, S.tempoGiorno / durata);
  if (t - ultimaTestata > 250) {
    ultimaTestata = t; testata();
    const oggi = document.getElementById('oggi');
    if (oggi && S.ieri && !S.ieri.festivo && S.inCorso) oggi.textContent = `${intero.format(S.ieri.consegne)} consegne · ${eur.format(S.inCorso.accreditato)} di ${eur.format(S.ieri.incasso)}`;
  }
  if (t - ultimoSalvataggio > 5000) { ultimoSalvataggio = t; salva(); }
  const p = S.tempoGiorno / durata, resto = Math.ceil(durata - S.tempoGiorno);
  $('#barra-giorno').style.width = (p * 100) + '%';
  $('#countdown').textContent = `${Math.floor(resto / 60)}:${String(resto % 60).padStart(2, '0')}`;
  const minuti = Math.floor(7 * 60 + p * 12 * 60); // giornata lavorativa dalle 7 alle 19
  $('#ora').textContent = feriale(S.giorno) ? `${String(Math.floor(minuti / 60)).padStart(2, '0')}:${String(minuti % 60).padStart(2, '0')}` : 'fine settimana';
  aggiornaFurgoniMappa(p);
  if (daRidisegnare && !(document.activeElement && /SELECT|INPUT/.test(document.activeElement.tagName))) ridisegna();
  requestAnimationFrame(ciclo);
}

async function leggiPrezzi() {
  try { const r = await fetch('prezzi.json', { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) { /* aperto da file: uso i valori di riserva */ }
  return null;
}

async function avvio() {
  const prezzi = await leggiPrezzi();
  prezziCaricati = prezzi;
  if (carica() && prezzi) S.prezzi = prezzi;
  const riepilogo = S ? recuperaOffline() : null;
  if (riepilogo) { salva(); mostraRiepilogoOffline(riepilogo); }
  ridisegna();
  avviaMappa('mappa', msg => { const a = $('#avviso-mappa'); a.hidden = false; a.textContent = msg + ' Il gioco funziona lo stesso dal pannello.'; });
  requestAnimationFrame(ciclo);
}
avvio();
}
