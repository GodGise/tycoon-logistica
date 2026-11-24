/* Tycoon Logistica – posta: ogni lunedì arriva una email con una decisione da prendere.
   Le scelte non sono banali: quella giusta alza la reputazione, a volte costa soldi subito.
   Se non rispondi entro 3 giorni vale la scelta peggiore. */

const POSTA = { giornoSettimana: 1, giorniPerRispondere: 3 };

// Ogni scelta: rep (punti reputazione), soldi (+/−), esito (spiegazione mostrata dopo).
// La prima email arriva quando l'azienda ha almeno un furgone.
const EMAIL = [
  { id: 'phishing', mittente: 'Amministrazione · Carburanti Nord Srl', oggetto: 'Cambio IBAN urgente per le prossime fatture',
    testo: () => `Buongiorno, da oggi le fatture del carburante vanno pagate sul nostro nuovo conto. Vi chiediamo di aggiornare l'IBAN entro oggi, altrimenti dovremo sospendere le forniture. La fattura di questo mese è di 4.800 €.`,
    scelte: [
      { testo: 'Pago subito sul nuovo IBAN', rep: -4, soldi: -4800, esito: 'Era una truffa: l\'email veniva da un indirizzo simile a quello vero. I 4.800 € sono persi e il fornitore vero aspetta ancora il pagamento.' },
      { testo: 'Chiamo il fornitore al numero che ho già', rep: 3, soldi: 0, esito: 'Il fornitore non ha cambiato conto: era un tentativo di truffa. Lo hai segnalato e i tuoi clienti apprezzano che i dati siano al sicuro.' },
      { testo: 'Rispondo all\'email chiedendo conferma', rep: -1, soldi: 0, esito: 'Il truffatore ti ha "confermato" il nuovo IBAN. Per fortuna il commercialista ha bloccato il bonifico, ma hai perso tempo e fiducia.' },
    ] },
  { id: 'stanco', mittente: () => `${nomeAutista()} · autista`, oggetto: 'Un collega guida troppo stanco',
    testo: () => `Capo, ti scrivo in privato. Un collega fa doppi turni per arrotondare e l'altro giorno si è quasi addormentato al volante. Non voglio metterlo nei guai, ma ho paura che succeda qualcosa.`,
    scelte: [
      { testo: 'Gli parlo e limito i turni a uno al giorno', rep: 4, soldi: -600, esito: 'Il collega all\'inizio si è arrabbiato, poi ha capito. Gli hai dato un piccolo aumento per compensare: niente incidenti e un clima migliore.' },
      { testo: 'Lascio fare: è maggiorenne', rep: -5, soldi: -2500, esito: 'Pochi giorni dopo un tamponamento: furgone fermo, franchigia da pagare e un cliente che ha visto tutto. La voce gira.' },
      { testo: 'Lo licenzio per sicurezza', rep: -2, soldi: 0, esito: 'Problema risolto, ma gli altri autisti ora hanno paura di segnalarti le cose. Il prossimo problema non lo saprai in tempo.' },
    ] },
  { id: 'porta', mittente: 'Ufficio logistica · ShopVeloce.it', oggetto: 'Proposta: lasciate i pacchi davanti alla porta',
    testo: () => `Per velocizzare chiediamo che i nostri pacchi vengano lasciati davanti alla porta anche senza firma, quando il cliente non c'è. In cambio vi aumentiamo i volumi. Ci servono 3 mesi di prova.`,
    scelte: [
      { testo: 'Sì, per tutti i pacchi', rep: -4, soldi: 3000, esito: 'Più volumi, ma anche furti dai pianerottoli e reclami. Le recensioni parlano di "pacchi spariti".' },
      { testo: 'Sì, solo se il cliente lo autorizza nell\'app', rep: 4, soldi: 1500, esito: 'Soluzione apprezzata: chi vuole il servizio lo attiva, gli altri firmano. Pochi reclami e volumi in crescita.' },
      { testo: 'No, sempre con firma', rep: 0, soldi: 0, esito: 'Nessun rischio, ma ShopVeloce ha spostato una parte delle spedizioni a un concorrente più flessibile.' },
    ] },
  { id: 'recensione', mittente: 'Notifiche · Recensioni online', oggetto: 'Nuova recensione da 1 stella',
    testo: () => `"Corriere pessimo, pacco arrivato in ritardo e autista maleducato." Dai registri il pacco è arrivato nei tempi previsti e il cliente non era in casa al primo passaggio.`,
    scelte: [
      { testo: 'Rispondo con calma, con i fatti e offro aiuto', rep: 4, soldi: 0, esito: 'Chi legge vede una risposta educata e precisa. Il cliente ha anche corretto la recensione a 3 stelle.' },
      { testo: 'Rispondo che mente', rep: -4, soldi: 0, esito: 'Il botta e risposta è finito in un gruppo cittadino. Avevi ragione tu, ma è sembrato arrogante.' },
      { testo: 'Ignoro', rep: -1, soldi: 0, esito: 'La recensione resta lì senza risposta e altri due clienti scontenti si accodano.' },
    ] },
  { id: 'nero', mittente: 'Officina Rapida di Bruno', oggetto: 'Sconto sui tagliandi',
    testo: () => `Ciao! Per i tagliandi della tua flotta ti faccio il 30% di sconto se paghi in contanti senza fattura. Risparmi 2.000 € all'anno. Fammi sapere.`,
    scelte: [
      { testo: 'Accetto: 2.000 € sono tanti', rep: -5, soldi: -3500, esito: 'Un controllo della Guardia di Finanza ha trovato le spese senza fattura: multa più alta del risparmio e brutta figura con i clienti business.' },
      { testo: 'Rifiuto e chiedo un preventivo con fattura', rep: 3, soldi: -400, esito: 'Bruno ti fa comunque uno sconto del 10% con fattura. Tutto in regola e un fornitore affidabile.' },
    ] },
  { id: 'banco', mittente: 'Banco Alimentare', oggetto: 'Ci aiutate con la raccolta di Natale?',
    testo: () => `Cerchiamo un'azienda che porti gratis i pacchi della raccolta alimentare dai supermercati al nostro magazzino. Servirebbero 2 furgoni per un sabato.`,
    scelte: [
      { testo: 'Sì, con 2 furgoni e autisti volontari pagati', rep: 5, soldi: -900, esito: 'Il giornale locale ha messo la foto dei tuoi furgoni. Tanti nuovi clienti ti hanno scelto "perché siete quelli del Banco Alimentare".' },
      { testo: 'Sì, ma mi pagate il carburante', rep: 1, soldi: -200, esito: 'Hanno accettato, ma la cosa è passata in sordina.' },
      { testo: 'No, non abbiamo tempo', rep: -1, soldi: 0, esito: 'Lo ha fatto un concorrente, ed è finito sul giornale al posto tuo.' },
    ] },
  { id: 'danneggiato', mittente: () => `${nomeMagazziniere()} · magazzino`, oggetto: 'Pacco danneggiato allo smistamento',
    testo: () => `Durante lo smistamento è caduto un pacco con scritto "fragile". Dentro qualcosa tintinna. Il cliente è un negozio che ci manda tanti pacchi. Che faccio?`,
    scelte: [
      { testo: 'Avviso il cliente prima di consegnare e propongo il rimborso', rep: 4, soldi: -350, esito: 'Il negozio ha apprezzato la sincerità: rimborso fatto e nessun reclamo. Hanno anche aumentato le spedizioni.' },
      { testo: 'Consegno come se niente fosse', rep: -4, soldi: 0, esito: 'Il destinatario ha filmato l\'apertura del pacco e l\'ha pubblicato. Il negozio ti ha chiesto spiegazioni.' },
      { testo: 'Lo tengo in magazzino finché qualcuno chiede', rep: -2, soldi: 0, esito: 'Il pacco è risultato "in giacenza" per una settimana: reclamo per ritardo e poi anche per il danno.' },
    ] },
  { id: 'cartello', mittente: 'Direzione · Corriere concorrente', oggetto: 'Una proposta tra colleghi',
    testo: () => `Ci facciamo la guerra sui prezzi e perdiamo entrambi. Proposta riservata: voi non prendete clienti nelle nostre zone e noi non li prendiamo nelle vostre, e teniamo le tariffe alte.`,
    scelte: [
      { testo: 'Accetto: guadagnamo tutti e due', rep: -6, soldi: 2000, esito: 'Un cliente se n\'è accorto e ha segnalato all\'Antitrust. È un accordo vietato: indagine aperta e notizia sui giornali.' },
      { testo: 'Rifiuto, competo con il servizio', rep: 3, soldi: 0, esito: 'Hai rifiutato per iscritto. Hai continuato a competere sulla qualità e i clienti l\'hanno notato.' },
    ] },
  { id: 'permesso', mittente: () => `${nomeAutista()} · autista`, oggetto: 'Mi serve un giorno libero domani',
    testo: () => `Mio figlio sta male e non ho nessuno a cui lasciarlo. So che domani c'è tanto lavoro, mi dispiace. Posso restare a casa?`,
    scelte: [
      { testo: 'Sì, copro io con il jolly', rep: 3, soldi: -150, esito: 'Il jolly ha coperto il suo giro. L\'autista ti ha ringraziato e gli altri hanno visto che ci si può fidare.' },
      { testo: 'No, il lavoro viene prima', rep: -4, soldi: 0, esito: 'È venuto al lavoro, distratto e preoccupato: consegne sbagliate e un piccolo incidente in retromarcia.' },
      { testo: 'Sì, ma gli tolgo la giornata dallo stipendio', rep: 0, soldi: 0, esito: 'Tutto regolare, ma l\'autista ci è rimasto male.' },
    ] },
  { id: 'domenica', mittente: 'Ufficio acquisti · MegaStore', oggetto: 'Consegne di domenica a tariffa doppia',
    testo: () => `Per il periodo dei saldi ci servono consegne anche la domenica, per 4 settimane. Paghiamo doppio. Ci date una risposta entro la settimana?`,
    scelte: [
      { testo: 'Sì, solo con autisti volontari pagati come straordinario', rep: 3, soldi: 4000, esito: 'Si sono offerti in tanti: guadagno buono, autisti contenti e cliente soddisfatto.' },
      { testo: 'Sì, a turno obbligatorio per tutti', rep: -4, soldi: 6000, esito: 'Più soldi, ma due autisti si sono licenziati e il sindacato ha alzato la voce.' },
      { testo: 'No, la domenica si riposa', rep: 0, soldi: 0, esito: 'MegaStore ha trovato un altro corriere per le domeniche.' },
    ] },
  { id: 'giornalista', mittente: () => `Redazione · Giornale di ${S.citta.nome}`, oggetto: 'Intervista sulle condizioni dei corrieri',
    testo: () => `Stiamo preparando un'inchiesta sui ritmi di lavoro dei corrieri in città. Vorremmo intervistare lei e qualche autista, liberamente.`,
    scelte: [
      { testo: 'Accetto e lascio parlare liberamente gli autisti', rep: 5, soldi: 0, esito: 'Gli autisti hanno parlato bene di te, con qualche critica onesta. L\'articolo ti descrive come un\'azienda seria.' },
      { testo: 'Accetto, ma scelgo io cosa dicono gli autisti', rep: -3, soldi: 0, esito: 'Un autista l\'ha raccontato al giornalista. Titolo: "Il corriere che mette il bavaglio".' },
      { testo: 'Rifiuto', rep: -1, soldi: 0, esito: 'Nell\'articolo c\'è scritto "l\'azienda non ha voluto rispondere".' },
    ] },
  { id: 'anziana', mittente: 'Signora Maria, 84 anni', oggetto: 'Grazie e una richiesta',
    testo: () => `Il vostro autista è sempre gentile. Abito al quinto piano senza ascensore: potreste portarmi su le casse d'acqua che ordino online? So che non è il vostro lavoro.`,
    scelte: [
      { testo: 'Sì, l\'autista ha il permesso di farlo', rep: 3, soldi: 0, esito: 'Qualche minuto in più a settimana. La signora l\'ha raccontato a mezzo quartiere.' },
      { testo: 'No, il contratto prevede la consegna al portone', rep: -1, soldi: 0, esito: 'Regolare, ma la signora ha cambiato negozio e corriere.' },
    ] },
  { id: 'pausa', mittente: 'Rappresentante sindacale', oggetto: 'Spogliatoio e area pausa nel magazzino',
    testo: () => `I magazzinieri chiedono uno spogliatoio e una piccola area pausa: oggi mangiano in piedi tra i bancali. Chiediamo un incontro.`,
    scelte: [
      { testo: 'Li faccio subito', rep: 4, soldi: -3000, esito: 'Spesa una tantum, ma meno malumori e meno assenze. Se ne parla bene anche fuori.' },
      { testo: 'Incontro e prometto per l\'anno prossimo', rep: 0, soldi: 0, esito: 'Per ora va bene, ma tra un anno se lo ricorderanno.' },
      { testo: 'Non è una priorità', rep: -4, soldi: 0, esito: 'Assemblea in magazzino e mezza giornata di smistamento persa.' },
    ] },
  { id: 'influencer', mittente: 'Luca · 300k follower', oggetto: 'Collaborazione: video virale coi vostri furgoni',
    testo: () => `Faccio video divertenti. Idea: io che lancio pacchi dal furgone "alla velocità del corriere". Mi pagate 1.500 € e diventate famosi.`,
    scelte: [
      { testo: 'Ok, un po\' di pubblicità fa bene', rep: -4, soldi: -1500, esito: 'Il video è diventato virale... come esempio di pacchi maltrattati. Commenti: "ecco perché arrivano rotti".' },
      { testo: 'Propongo un video sul lavoro vero dei corrieri', rep: 3, soldi: -800, esito: 'Video meno virale ma simpatico e onesto: tanti messaggi di stima per gli autisti.' },
      { testo: 'No grazie', rep: 0, soldi: 0, esito: 'Nessun rischio, nessuna pubblicità.' },
    ] },
  { id: 'farmaci', mittente: 'Farmacia Comunale', oggetto: 'Consegna urgente di farmaci',
    testo: () => `Abbiamo farmaci da consegnare oggi a 12 pazienti anziani a domicilio, ma il nostro furgone è guasto. Potete farlo voi a prezzo normale?`,
    scelte: [
      { testo: 'Sì, li porto oggi spostando un giro', rep: 4, soldi: -200, esito: 'Un giro ha finito più tardi, ma 12 persone hanno avuto le medicine in tempo. Il Comune ti ha ringraziato pubblicamente.' },
      { testo: 'Sì, ma solo domani', rep: 0, soldi: 0, esito: 'Hanno trovato un\'altra soluzione per oggi.' },
      { testo: 'Sì, a tariffa urgente tripla', rep: -3, soldi: 600, esito: 'Hanno pagato, ma la cosa è girata e non ha fatto una bella impressione.' },
    ] },
];

function nomeAutista() { const a = S.dipendenti.filter(d => d.ruolo === 'autista'); return a.length ? scegli(a).nome : 'Un autista'; }
function nomeMagazziniere() { const a = S.dipendenti.filter(d => d.ruolo === 'magazziniere'); return a.length ? scegli(a).nome : 'Un magazziniere'; }
function testoDi(v) { return typeof v === 'function' ? v() : v; }

// chiamata all'inizio di ogni giornata lavorativa
function controllaPosta() {
  S.posta = S.posta || [];
  // scadute: vale la scelta peggiore
  // a gioco chiuso le email non scadono: aspettano che torni
  if (S.recuperoOffline) S.posta.filter(m => m.risposta === null).forEach(m => { m.scadenza = Math.max(m.scadenza, S.giorno + 1); });
  S.posta.filter(m => m.risposta === null && S.giorno > m.scadenza).forEach(m => {
    const e = EMAIL.find(x => x.id === m.id), peggiore = e.scelte.reduce((a, s, i) => s.rep < e.scelte[a].rep ? i : a, 0);
    applicaRisposta(m, peggiore, true);
  });
  if (!S.furgoni.length) return;
  if (dataDelGiorno(S.giorno).getDay() !== POSTA.giornoSettimana) return;
  if (S.posta.some(m => m.giorno === S.giorno)) return;
  const usate = S.posta.map(m => m.id);
  const libere = EMAIL.filter(e => !usate.slice(-EMAIL.length + 3).includes(e.id));
  const e = scegli(libere.length ? libere : EMAIL);
  S.posta.unshift({ id: e.id, giorno: S.giorno, scadenza: S.giorno + POSTA.giorniPerRispondere,
    mittente: testoDi(e.mittente), oggetto: e.oggetto, testo: testoDi(e.testo), letta: false, risposta: null, esito: '' });
  S.posta = S.posta.slice(0, 30);
  notizia(`Nuova email: "${e.oggetto}". Rispondi entro ${POSTA.giorniPerRispondere} giorni nella scheda Posta.`, 'info', 'posta');
}

function applicaRisposta(m, i, scaduta) {
  const e = EMAIL.find(x => x.id === m.id), s = e.scelte[i];
  m.risposta = i; m.letta = true;
  cambiaFama(s.rep);
  if (s.soldi) movimento(s.soldi > 0 ? 'contratti' : 'eventi', s.soldi);
  m.esito = (scaduta ? 'Non hai risposto in tempo. ' : '') + s.esito;
  m.rep = s.rep; m.soldi = s.soldi;
  notizia(`Posta: ${m.oggetto}. Reputazione ${s.rep >= 0 ? '+' : ''}${s.rep}.`, s.rep > 0 ? 'buono' : s.rep < 0 ? 'male' : 'info');
}

function rispondiEmail(indice, scelta) {
  const m = S.posta[indice]; if (!m || m.risposta !== null) return 'Hai già risposto.';
  applicaRisposta(m, scelta, false);
  return null;
}
function emailNonLette() { return (S && S.posta || []).filter(m => m.risposta === null).length; }
