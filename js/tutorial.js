/* Tycoon Logistica – tutorial della prima partita.
   Un riquadro in alto dice cosa fare; il pulsante giusto lampeggia; quando il passo è fatto si va avanti da soli.
   Parte con ogni partita nuova (S.tutorial); si può saltare e rivedere dalle Impostazioni. */
const PASSI_TUTORIAL = [
  { titolo: 'Compra il primo furgone', testo: 'Apri <b>Flotta</b> e tocca <b>Compra un furgone</b>. Un usato costa meno: per iniziare va benissimo.',
    evidenzia: ['[data-scheda="flotta"]', '[data-azione="apri-negozio"]', '[data-azione="compra"]'], fatto: () => S.furgoni.length > 0 },
  { titolo: 'Assumi un autista', testo: 'In <b>Personale</b> scegli un candidato <b>autista</b> e tocca <b>Assumi</b>. Le sue stelle si scoprono dopo qualche giorno di lavoro.',
    evidenzia: ['[data-scheda="personale"]', '[data-azione="assumi"][data-ruolo="autista"]'], fatto: () => S.dipendenti.some(d => d.ruolo === 'autista') },
  { titolo: 'Assumi un magazziniere', testo: 'Il magazziniere smista i pacchi: senza di lui i furgoni partono vuoti. Uno basta per circa 300 pacchi al giorno.',
    evidenzia: ['[data-scheda="personale"]', '[data-azione="assumi"][data-ruolo="magazziniere"]'], fatto: () => S.dipendenti.some(d => d.ruolo === 'magazziniere') },
  { titolo: 'Manda il furgone in una zona', testo: 'In <b>Flotta</b> tocca il furgone e scegli <b>autista</b> e <b>zona</b>. Comincia dal <b>Centro</b>: è quella con più pacchi.',
    evidenzia: ['[data-scheda="flotta"]', '[data-azione="espandi-furgone"]', 'select[data-campo]'], fatto: () => S.furgoni.some(f => f.zona && f.autistaId) },
  { titolo: 'Guarda la giornata', testo: 'La barra in alto è la giornata: dura 10 minuti. In <b>Giri</b> vedi quanti pacchi consegni in ogni zona e, se ne restano, il perché. Puoi aspettare la fine del giorno o andare avanti.',
    evidenzia: ['[data-scheda="giri"]', '.barra-giorno'], fatto: () => S.tutorial && S.giorno > S.tutorial.giorno, avanti: true },
  { titolo: 'La posta', testo: 'Ogni lunedì arriva un\'email con una decisione. Leggi bene: c\'è sempre un dettaglio che cambia la risposta giusta. Se non rispondi entro una settimana perdi reputazione.',
    evidenzia: ['[data-scheda="posta"]'], avanti: true },
  { titolo: 'Il pulsante Azienda', testo: 'Il pulsante qui a destra apre l\'<b>Azienda</b>: livello, miglioramenti del magazzino, licenze per le zone di periferia e nuovi magazzini nei capoluoghi.',
    evidenzia: ['#logo', '#pulsante-azienda'], avanti: true },
  { titolo: 'Salva la partita online', testo: 'Dalle <b>Impostazioni</b> (l\'ingranaggio) crea un account: la partita si salva online e la ritrovi anche sul telefono. Da lì attivi le notifiche.',
    evidenzia: ['#pulsante-impostazioni', 'form[data-azione="account"]'], fatto: () => !!account.token, salta: () => !!account.token, avanti: true },
  { titolo: 'Sei pronto!', testo: 'Cresci un passo alla volta: guarda in <b>Giri</b> perché restano pacchi e compra o assumi di conseguenza. Più consegni, più sali di livello e sblocchi furgoni e miglioramenti. Buon lavoro!',
    evidenzia: [], avanti: 'Inizia a giocare' },
];

function iniziaTutorial() { if (S) { S.tutorial = { passo: 0, giorno: S.giorno }; salva(); aggiornaTutorial(); } }
function chiudiTutorial() { if (S && S.tutorial) { S.tutorial.finito = true; salva(); } aggiornaTutorial(); }

function aggiornaTutorial() {
  let box = document.getElementById('tutorial');
  document.querySelectorAll('.tut-evidenzia').forEach(e => e.classList.remove('tut-evidenzia'));
  const t = S && S.tutorial;
  if (!t || t.finito) { if (box) box.remove(); return; }
  // passi già fatti (o da saltare): si va avanti da soli
  while (t.passo < PASSI_TUTORIAL.length - 1) {
    const p = PASSI_TUTORIAL[t.passo];
    if ((p.fatto && p.fatto()) || (p.salta && p.salta())) { t.passo++; if (PASSI_TUTORIAL[t.passo].titolo === 'Guarda la giornata') t.giorno = S.giorno; }
    else break;
  }
  const p = PASSI_TUTORIAL[t.passo];
  if (!box) {
    box = document.createElement('div'); box.id = 'tutorial'; box.className = 'tutorial vetro'; box.setAttribute('role', 'status');
    document.body.appendChild(box);
    box.addEventListener('click', e => {
      if (e.target.closest('[data-tut="salta"]')) chiudiTutorial();
      else if (e.target.closest('[data-tut="avanti"]')) { if (S.tutorial.passo >= PASSI_TUTORIAL.length - 1) chiudiTutorial(); else { S.tutorial.passo++; if (PASSI_TUTORIAL[S.tutorial.passo].titolo === 'Guarda la giornata') S.tutorial.giorno = S.giorno; salva(); aggiornaTutorial(); } }
      else if (e.target.closest('[data-tut="riduci"]')) { box.classList.toggle('ridotto'); }
    });
  }
  const ultimo = t.passo === PASSI_TUTORIAL.length - 1;
  const chiave = t.passo + ':' + ultimo;
  if (box.dataset.chiave !== chiave) {
    box.dataset.chiave = chiave; box.classList.remove('ridotto');
    box.innerHTML = `<div class="tut-testa"><span class="tut-num">${ultimo ? '🎉' : `Passo ${t.passo + 1} di ${PASSI_TUTORIAL.length - 1}`}</span>
        <button class="tut-x" data-tut="riduci" aria-label="Riduci">–</button></div>
      <b class="tut-titolo">${p.titolo}</b><p>${p.testo}</p>
      <div class="tut-azioni">${ultimo ? '' : '<button class="btn link" data-tut="salta">Salta il tutorial</button>'}
        ${p.avanti ? `<button class="btn primario" data-tut="avanti">${typeof p.avanti === 'string' ? p.avanti : 'Avanti'}</button>` : ''}</div>
      <div class="tut-punti">${PASSI_TUTORIAL.slice(0, -1).map((_, i) => `<i class="${i < t.passo ? 'fatto' : i === t.passo ? 'ora' : ''}"></i>`).join('')}</div>`;
  }
  // fa lampeggiare l'elemento giusto: il più "avanzato" che si vede adesso (prima la scheda, poi il pulsante dentro)
  const visibili = p.evidenzia.map(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'))
    .filter(l => l.length);
  if (visibili.length) visibili[visibili.length - 1].slice(0, 3).forEach(e => e.classList.add('tut-evidenzia'));
}
