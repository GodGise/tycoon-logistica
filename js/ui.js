/* Tycoon Logistica – interfaccia: pannello laterale, schede, ciclo di gioco. */
{
const $ = s => document.querySelector(s);
const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: true });
const eur2 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 3, maximumFractionDigits: 3 });
const dec1 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const intero = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: true });
const segnato = n => `<span class="num ${n >= 0 ? 'piu' : 'meno'}">${n >= 0 ? '+' : '−'}${eur.format(Math.abs(n))}</span>`;
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtData = g => dataDelGiorno(g).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

let scheda = 'azienda', ultimoT = null, daRidisegnare = true;
let negozioUsato = false, negozioAperto = false;

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('vis'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('vis'), 2600); }
function esito(errore, ok) { if (errore) toast(errore); else if (ok) toast(ok); ridisegna(); salva(); }

/* ---------- schede ---------- */
function vistaAzienda() {
  const utile = utileMese(S.conti.voci);
  const autisti = S.dipendenti.filter(d => d.ruolo === 'autista').length, mag = S.dipendenti.filter(d => d.ruolo === 'magazziniere').length;
  const rep = Math.round(S.reputazione), cls = rep >= 60 ? '' : rep >= 35 ? 'medio' : 'basso';
  const ieri = S.ieri && !S.ieri.festivo ? `${intero.format(S.ieri.consegne)} consegne · ${eur.format(S.ieri.incasso)}` : 'Nessuna giornata lavorativa';
  const zone = ZONE.map(z => {
    const giri = S.furgoni.filter(f => f.zona === z.id);
    const pz = S.ieri && S.ieri.perZona && S.ieri.perZona[z.id];
    const cap = giri.length * COSTANTI.maxConsegneCorriere, cop = cap ? Math.min(100, Math.round(cap / z.pacchi * 100)) : 0;
    return `<div class="scheda">
      <div class="riga"><span class="zona-titolo"><i class="pallino" style="background:${z.colore}"></i>${esc(z.nome)}</span><span class="num">${z.pacchi} pacchi/giorno</span></div>
      <div class="metro ${cop >= 100 ? '' : cop >= 70 ? 'medio' : 'basso'}"><i style="width:${cop}%"></i></div>
      <div class="riga a-capo"><span>${giri.length ? `${giri.length} furgon${giri.length > 1 ? 'i' : 'e'} · capacità ${cap} consegne` : 'Zona non servita'}</span>
      <span class="num">${pz ? `ieri ${pz.consegne} cons.${pz.giacenza ? ` · <span class="meno">${pz.giacenza} in giacenza</span>` : ''}` : ''}</span></div>
    </div>`;
  }).join('');
  const p = S.prezzi;
  return `
  <div class="kpi">
    <div><b>${S.furgoni.length}</b><span>Furgoni</span></div>
    <div><b>${autisti}</b><span>Autisti</span></div>
    <div><b>${mag}</b><span>Magazzinieri</span></div>
  </div>
  <div class="scheda">
    <div class="riga"><span>Utile del mese</span>${segnato(utile)}</div>
    <div class="riga"><span>Ieri</span><span class="num">${ieri}</span></div>
    <div class="riga"><span>Reputazione</span><span class="num">${rep}/100</span></div>
    <div class="metro ${cls}"><i style="width:${rep}%"></i></div>
    <div class="riga"><span>Premio assicurativo flotta</span><span class="num ${S.premio > 1.001 ? 'meno' : ''}">${S.premio > 1.001 ? '+' + Math.round((S.premio - 1) * 100) + '%' : 'base'}</span></div>
  </div>
  <div><h2>Zone di consegna <small>${esc(DEPOSITO.nome)}</small></h2><div style="display:grid;gap:8px">${zone}</div>
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
  <p class="nota">Stipendi e assicurazione si pagano l'ultimo giorno del mese. Le riparazioni dopo un incidente sono a carico dell'autista: all'azienda sale il premio assicurativo.</p>`;
}

function vistaNegozio() {
  const a = ammortamento();
  const box = `<div class="ammortamento">Ammortamento: con i prezzi di questa settimana l'e-Pacato si ripaga rispetto al Pacato Fiatt in
    <b>${isFinite(a.settimane) ? a.settimane + ' settimane di gioco' : 'mai'}</b> (risparmio di ${eur.format(a.risparmio)} a settimana su ${a.kmSettimana} km).</div>`;
  const lista = CATALOGO.filter(m => !(negozioUsato && m.tipo === 'elettrico')).map(m => {
    const prezzo = prezzoAcquisto(m, negozioUsato), c = costoKm(m, negozioUsato);
    return `<div class="scheda">
      <div class="riga"><strong>${esc(m.nome)}</strong><span class="badge ${m.tipo}">${m.tipo}</span></div>
      <div class="riga"><span>${dec1.format(m.consumo)} ${m.tipo === 'diesel' ? 'l' : 'kWh'}/100 km · costo ${eur2.format(c.energia + c.manutenzione)}/km</span><span class="num"><b>${eur.format(prezzo)}</b></span></div>
      <button class="btn primario" data-azione="compra" data-id="${m.id}" ${S.cassa < prezzo ? 'disabled' : ''}>Compra${negozioUsato ? ' usato' : ''}</button>
    </div>`;
  }).join('');
  return `<div class="riga"><h2 style="margin:0">Compra un furgone</h2><button class="btn piccolo" data-azione="chiudi-negozio">Chiudi</button></div>
    <div class="interruttore"><button data-azione="usato" data-v="0" aria-pressed="${!negozioUsato}">Nuovo</button><button data-azione="usato" data-v="1" aria-pressed="${negozioUsato}">Usato</button></div>
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
    const optZ = ['<option value="">In deposito</option>', ...ZONE.map(z => `<option value="${z.id}" ${f.zona === z.id ? 'selected' : ''}>${esc(z.nome)}</option>`)].join('');
    return `<div class="scheda">
      <div class="riga"><strong>${esc(m.nome)}${f.usato ? ' <small class="nota">usato</small>' : ''}</strong><span class="badge ${m.tipo}">${m.tipo}</span></div>
      <div class="riga"><span>${intero.format(f.km)} km</span>${stato}</div>
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
      <div class="riga"><strong>${esc(d.nome)}</strong><span class="num">${eur.format(d.stipendio)}/mese</span></div>
      ${ruolo === 'autista' ? `<div class="riga"><span>Esperienza</span><span class="num">${Math.round(d.esperienza)}/100</span></div><div class="metro ${d.esperienza >= 60 ? '' : d.esperienza >= 30 ? 'medio' : 'basso'}"><i style="width:${d.esperienza}%"></i></div>` : ''}
      <div class="riga"><span>${ruolo === 'autista' ? (S.furgoni.some(f => f.autistaId === d.id) ? 'Assegnato a un furgone' : 'Senza furgone') : `Smista ${COSTANTI.pacchiMagazziniere} pacchi al giorno`}</span>
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

const VISTE = { azienda: vistaAzienda, attivita: vistaAttivita, conti: vistaConti, flotta: vistaFlotta, personale: vistaPersonale };

function testata() {
  $('#cassa').textContent = eur.format(S.cassa);
  $('#cassa').className = 'cifra-grande' + (S.cassa < 0 ? ' meno' : '');
  const u = utileMese(S.conti.voci);
  $('#utile-mese').innerHTML = `${segnato(u)} <span style="color:var(--testo-2)">questo mese</span>`;
  $('#data').textContent = dataDelGiorno(S.giorno).getDay() === 6 ? 'Fine settimana ' + dataDelGiorno(S.giorno).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : fmtData(S.giorno);
}
function ridisegna() {
  testata();
  const c = $('#contenuto'), scroll = c.scrollTop;
  c.innerHTML = VISTE[scheda]();
  c.scrollTop = scroll;
  document.querySelectorAll('.schede button').forEach(b => b.setAttribute('aria-selected', b.dataset.scheda === scheda));
  aggiornaZoneMappa();
  daRidisegnare = false;
}
// non ridisegnare mentre il giocatore sta usando un menu o uno slider
function ridisegnaSePossibile() {
  const a = document.activeElement;
  if (a && $('#contenuto').contains(a) && (a.tagName === 'SELECT' || a.tagName === 'INPUT')) { daRidisegnare = true; testata(); return; }
  ridisegna();
}

/* ---------- eventi ---------- */
document.querySelector('.schede').addEventListener('click', e => {
  const b = e.target.closest('button[data-scheda]'); if (!b) return;
  scheda = b.dataset.scheda; negozioAperto = false; $('#contenuto').scrollTop = 0; ridisegna();
});
$('#contenuto').addEventListener('click', e => {
  const b = e.target.closest('[data-azione]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
  const id = b.dataset.id;
  switch (b.dataset.azione) {
    case 'apri-negozio': negozioAperto = true; $('#contenuto').scrollTop = 0; ridisegna(); break;
    case 'chiudi-negozio': negozioAperto = false; ridisegna(); break;
    case 'usato': negozioUsato = b.dataset.v === '1'; ridisegna(); break;
    case 'compra': { const err = compraFurgone(id, negozioUsato); if (!err) negozioAperto = false; esito(err, 'Furgone comprato: ora assegnagli un autista e una zona.'); break; }
    case 'vendi': if (b.dataset.conferma) { vendiFurgone(id); esito(null, 'Furgone venduto.'); } else { b.dataset.conferma = 1; b.textContent = 'Confermi la vendita?'; } break;
    case 'assumi': esito(assumi(id, b.dataset.ruolo), 'Assunto!'); break;
    case 'licenzia': if (b.dataset.conferma) { licenzia(id); esito(null, 'Dipendente licenziato.'); } else { b.dataset.conferma = 1; b.textContent = 'Confermi?'; } break;
    case 'annuncio': { const r = b.dataset.ruolo; esito(pubblicaAnnuncio(r, S.offerta[r])); break; }
    case 'nuova': if (b.dataset.conferma) { cancellaSalvataggio(); nuovaPartita(S.prezzi); ridisegna(); salva(); } else { b.dataset.conferma = 1; b.textContent = 'Sicuro? Perdi la partita attuale. Clicca di nuovo.'; } break;
  }
});
$('#contenuto').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.azione === 'assegna') { assegna(t.dataset.id, t.dataset.campo, t.value); t.blur(); esito(); }
  if (t.dataset.azione === 'stipendio') { S.offerta[t.dataset.ruolo] = +t.value; t.blur(); salva(); if (daRidisegnare) ridisegna(); }
});
$('#contenuto').addEventListener('input', e => {
  const t = e.target; if (t.dataset.azione === 'stipendio') $('#val-' + t.dataset.ruolo).textContent = eur.format(+t.value);
});

/* ---------- ciclo di gioco ---------- */
// Il tempo scorre da solo: ogni giornata dura 3 minuti, il fine settimana passa in un unico blocco.
// Il tempo trascorso nella giornata è salvato, quindi ricaricare la pagina non fa ripartire il giorno.
let ultimoSalvataggio = 0;
function ciclo(t) {
  if (ultimoT === null) ultimoT = t;
  const dt = Math.min(0.25, (t - ultimoT) / 1000); ultimoT = t;
  const durata = COSTANTI.secondiPerGiorno;
  S.tempoGiorno = (S.tempoGiorno || 0) + dt;
  if (S.tempoGiorno >= durata) {
    S.tempoGiorno = 0;
    const sabato = dataDelGiorno(S.giorno).getDay() === 6;
    simulaGiorno();
    if (sabato) simulaGiorno(); // anche la domenica
    salva(); ridisegnaSePossibile();
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
  if (!carica()) nuovaPartita(prezzi || PREZZI_RISERVA);
  else if (prezzi) S.prezzi = prezzi;
  ridisegna();
  avviaMappa('mappa', msg => { const a = $('#avviso-mappa'); a.hidden = false; a.textContent = msg + ' Il gioco funziona lo stesso dal pannello.'; });
  requestAnimationFrame(ciclo);
}
avvio();
}
