/* Tycoon Logistica – posta: ogni lunedì arriva una email con una decisione da prendere.
   Le scelte non sono banali: quella giusta alza la reputazione, a volte costa soldi subito.
   Se non rispondi entro una settimana l'email scade e perdi 1 punto di reputazione. */

const POSTA = { giorniSettimana: [1], giorniPerRispondere: 7, massimoInAttesa: 3 };   // una email ogni lunedì
// al massimo 3 email da leggere alla volta, anche dopo tanto tempo offline
function postaPiena() { return (S.posta || []).filter(m => m.risposta === null && !m.report).length >= POSTA.massimoInAttesa; }
function segnaUsata(id) { S.postaUsate = (S.postaUsate || []).concat(id).slice(-30); S.postaRicevute = (S.postaRicevute || 0) + 1; }
// le email già risposte o scadute spariscono dall'elenco
function pulisciPosta() { S.posta = (S.posta || []).filter(m => m.risposta === null && !m.archiviato); }   // lunedì e giovedì

// Ogni scelta: rep (punti reputazione), soldi (+/−), esito (spiegazione mostrata dopo).
// Le email sono a trabocchetto: la risposta migliore dipende da un dettaglio nel testo,
// e spesso quella che "sembra" giusta (verificare, essere generosi, essere severi) non lo è.
// L'ordine delle risposte viene mescolato ogni volta.
const EMAIL = [
  { id: 'iban2', mittente: 'Amministrazione · Carburanti Nord Srl', oggetto: 'Nuove coordinate bancarie',
    testo: () => `Gentile cliente, per una fusione societaria dal 1° del mese cambiano le nostre coordinate bancarie. Trova in allegato la lettera firmata dal nostro amministratore. Per qualsiasi dubbio può chiamare il nostro ufficio al 351 482 7710. Fattura del mese: 4.800 €.`,
    scelte: [
      { testo: `Chiamo il numero indicato nell'email per conferma`, rep: -3, soldi: -4800, esito: `Al numero dell'email ha risposto il truffatore, gentilissimo, che ha "confermato" tutto. Il numero vero del fornitore era un altro: quello stampato sulle vecchie fatture.` },
      { testo: `Chiamo il numero che ho sulle vecchie fatture`, rep: 3, soldi: 0, esito: `Il fornitore non ha cambiato nessun conto: lettera e firma erano false. Truffa evitata e segnalata.` },
      { testo: `Pago sul vecchio IBAN come sempre e non rispondo`, rep: 0, soldi: 0, esito: `Nessun danno questa volta, ma non hai avvisato il fornitore: altri suoi clienti ci sono cascati.` },
    ] },
  { id: 'secondo-lavoro', mittente: () => `${nomeAutista()} · autista`, oggetto: 'Un collega fa anche il cameriere di notte',
    testo: () => `Capo, ti scrivo in privato. Un collega la sera fa il cameriere in un locale fino all'1 di notte e alle 7 è qui. Non fa niente di vietato, ma la mattina è uno zombie e l'altro giorno ha preso un paletto in retromarcia.`,
    scelte: [
      { testo: `Gli vieto il secondo lavoro`, rep: -2, soldi: -800, esito: `Non puoi vietarlo se non fa concorrenza a te: si è rivolto a un sindacato e hai dovuto fare marcia indietro, pagando anche l'avvocato.` },
      { testo: `Gli parlo e gli do un giro più corto che parte alle 9`, rep: 3, soldi: -150, esito: `Ha apprezzato che non lo trattassi da colpevole. Con due ore di sonno in più guida bene e nessun altro paletto.` },
      { testo: `Non sono affari miei finché non fa danni gravi`, rep: -3, soldi: -2200, esito: `Due settimane dopo si è addormentato a un semaforo: tamponamento, franchigia e furgone fermo.` },
    ] },
  { id: 'porta2', mittente: 'Ufficio logistica · ShopVeloce.it', oggetto: 'Consegna senza firma: i clienti hanno già accettato',
    testo: () => `Abbiamo aggiornato le condizioni di vendita (punto 14.3): i clienti accettano che il pacco venga lasciato davanti alla porta se non sono in casa. Chiediamo di farlo da lunedì per tutti i nostri pacchi. In cambio vi passiamo il 20% di volumi in più.`,
    scelte: [
      { testo: `Ok: i clienti hanno già accettato`, rep: -3, soldi: 2500, esito: `Una clausola nascosta al punto 14.3 non è un vero consenso. Pacchi spariti dai pianerottoli, e i reclami arrivano a te, non a ShopVeloce.` },
      { testo: `Sì, ma solo per chi lo attiva nell'app di tracking`, rep: 3, soldi: 1500, esito: `Chi vuole il servizio lo attiva, gli altri firmano. Pochi reclami e volumi in crescita lo stesso.` },
      { testo: `No, sempre con firma`, rep: -1, soldi: -800, esito: `Nessun rischio, ma ShopVeloce ha spostato una parte dei pacchi a un concorrente più flessibile.` },
    ] },
  { id: 'recensione2', mittente: 'Notifiche · Recensioni online', oggetto: 'Nuova recensione da 1 stella',
    testo: () => `"Pacco in ritardo e autista maleducato, mi ha sbattuto il citofono in faccia." Dai registri il pacco è arrivato puntuale. Lo stesso autista questo mese ha già ricevuto altre due segnalazioni per i modi.`,
    scelte: [
      { testo: `Rispondo con i dati: il pacco era puntuale`, rep: -1, soldi: 0, esito: `Avevi ragione sull'orario, ma hai ignorato la parte sui modi, che era vera. Chi legge vede un'azienda che si difende invece di ascoltare.` },
      { testo: `Mi scuso per i modi, chiarisco l'orario e parlo con l'autista`, rep: 3, soldi: 0, esito: `Risposta onesta su tutti e due i punti. Il cliente ha alzato la recensione a 3 stelle e l'autista ha capito l'antifona.` },
      { testo: `Chiedo alla piattaforma di rimuoverla perché falsa`, rep: -2, soldi: 0, esito: `Non era falsa: la piattaforma l'ha lasciata e ha aggiunto "l'azienda ha contestato la recensione". Pessima figura.` },
    ] },
  { id: 'ricambi', mittente: 'Officina Rapida di Bruno', oggetto: 'Tagliandi con ricambi compatibili: −35%',
    testo: () => `Ciao! Per i tagliandi della tua flotta posso usare ricambi compatibili invece degli originali: stessa qualità, 35% in meno, fattura regolare e 6 mesi di garanzia mia. Ti ricordo che i furgoni nuovi hanno ancora la garanzia della casa.`,
    scelte: [
      { testo: `Compatibili su tutti i furgoni`, rep: -1, soldi: -2400, esito: `Sui furgoni nuovi i ricambi non originali hanno fatto perdere la garanzia della casa: un guasto al cambio te lo sei pagato tu.` },
      { testo: `Compatibili sui furgoni vecchi, originali su quelli in garanzia`, rep: 2, soldi: 1200, esito: `Risparmio vero dove non rischi nulla e garanzia salva sui nuovi. Bruno ha anche apprezzato la chiarezza.` },
      { testo: `Solo originali su tutti`, rep: 0, soldi: -500, esito: `Nessun rischio, ma hai speso di più anche sui furgoni vecchi, dove non serviva.` },
    ] },
  { id: 'banco2', mittente: 'raccolta.solidale.natale@gmail.com', oggetto: 'Ci aiutate con la raccolta alimentare di Natale?',
    testo: () => `Siamo volontari della raccolta alimentare cittadina. Cerchiamo un'azienda che porti gratis i pacchi dai supermercati al nostro deposito, un sabato. Per l'assicurazione dei volontari chiediamo solo una cauzione di 300 €, che vi restituiamo a gennaio.`,
    scelte: [
      { testo: `Partecipo e verso la cauzione`, rep: -2, soldi: -300, esito: `Nessuna associazione vera chiede cauzioni da un indirizzo gmail. I 300 € sono spariti e nessuno si è presentato quel sabato.` },
      { testo: `Chiamo l'associazione ufficiale per verificare`, rep: 3, soldi: -400, esito: `L'associazione vera non sapeva niente di quella email, ma cercava davvero furgoni: hai fatto la raccolta con loro, gratis, e sei finito sul giornale.` },
      { testo: `Non rispondo`, rep: 0, soldi: 0, esito: `Nessun danno, ma l'occasione di aiutare (quella vera) l'ha presa un concorrente.` },
    ] },
  { id: 'fragile', mittente: () => `${nomeMagazziniere()} · magazzino`, oggetto: 'Pacco fragile caduto allo smistamento',
    testo: () => `Durante lo smistamento è caduto un pacco "fragile" di un negozio di ceramiche, nostro cliente importante. Dentro qualcosa tintinna. Sull'etichetta c'è scritto "assicurato dal mittente – valore dichiarato 900 €".`,
    scelte: [
      { testo: `Rimborso subito io i 900 € al negozio`, rep: 1, soldi: -900, esito: `Il negozio ha ringraziato, ma il pacco era assicurato: bastava aprire la pratica e non avresti pagato nulla.` },
      { testo: `Avviso il negozio e apro la pratica con l'assicurazione`, rep: 3, soldi: 0, esito: `Sincerità e pratica veloce: il negozio è stato rimborsato dall'assicurazione e si fida ancora di più.` },
      { testo: `Lo reimballo bene e lo consegno`, rep: -4, soldi: -900, esito: `Il destinatario ha filmato l'apertura: ceramica in pezzi in un imballo "nuovo". Nessuna assicurazione paga un danno nascosto.` },
    ] },
  { id: 'deposito-condiviso', mittente: 'Direzione · Corriere concorrente', oggetto: 'Dividiamo il deposito notturno?',
    testo: () => `Sprechiamo tutti e due soldi con un deposito mezzo vuoto di notte. Proposta: lo condividiamo e dividiamo l'affitto. Per organizzarci meglio ci scambiamo anche l'elenco dei clienti e delle tariffe.`,
    scelte: [
      { testo: `Accetto tutto: si risparmia`, rep: -4, soldi: -3000, esito: `Condividere clienti e tariffe con un concorrente è un'intesa vietata: segnalazione all'Antitrust e multa.` },
      { testo: `Divido il deposito, ma niente clienti né tariffe`, rep: 2, soldi: 1500, esito: `Affitto dimezzato e nessun rischio. Il concorrente ha accettato senza fiatare.` },
      { testo: `Rifiuto: mai fidarsi dei concorrenti`, rep: 0, soldi: 0, esito: `Nessun rischio, ma hai rinunciato a un risparmio del tutto legale.` },
    ] },
  { id: 'figlio-malato', mittente: () => `${nomeAutista()} · autista`, oggetto: 'Domani resto a casa, mio figlio ha la febbre',
    testo: () => `Capo, mio figlio di 4 anni ha la febbre alta e non ho nessuno. È la terza volta questo mese, lo so. Un collega dice in giro che l'ultima volta ero allo stadio, ma non è vero.`,
    scelte: [
      { testo: `Ok, ma mi porti il certificato del pediatra`, rep: 3, soldi: 0, esito: `Per un figlio sotto gli 8 anni il congedo per malattia è un suo diritto, con il certificato del pediatra. Il certificato è arrivato: chiacchiere zittite senza accusare nessuno.` },
      { testo: `Ok, nessun problema, copro con il jolly`, rep: 0, soldi: -150, esito: `Gentile, ma i colleghi che avevano messo in giro la voce pensano che tu non controlli mai nulla.` },
      { testo: `No: tre volte in un mese sono troppe`, rep: -4, soldi: -1000, esito: `È un diritto di legge: ha fatto ricorso con il sindacato e hai pagato le spese.` },
    ] },
  { id: 'domenica2', mittente: 'Ufficio acquisti · MegaStore', oggetto: 'Consegne di domenica per i saldi',
    testo: () => `Per 4 settimane di saldi ci servono consegne anche la domenica. Paghiamo il doppio della tariffa, pagamento a 30 giorni. L'offerta non è trattabile: rispondete sì o no.`,
    scelte: [
      { testo: `Sì, con gli autisti che si offrono, pagati come straordinario`, rep: 2, soldi: 3500, esito: `Si sono offerti in tanti: guadagno buono, autisti contenti e cliente soddisfatto.` },
      { testo: `Provo a chiedere il triplo`, rep: -1, soldi: 0, esito: `Avevano scritto "non trattabile": hanno risposto "no grazie" e chiamato un concorrente.` },
      { testo: `Sì, turno obbligatorio a rotazione per tutti`, rep: -3, soldi: 4500, esito: `Più soldi, ma due autisti si sono licenziati e se ne parla male in giro.` },
    ] },
  { id: 'giornalista2', mittente: () => `Redazione · Giornale di ${S.citta.nome}`, oggetto: 'Vorremmo filmare il magazzino',
    testo: () => `Prepariamo un servizio sui corrieri in città. Vorremmo intervistarla e filmare il magazzino martedì alle 7:30, nel momento di massimo lavoro, "per far vedere i ritmi veri". Gli autisti potranno parlare liberamente.`,
    scelte: [
      { testo: `Accetto tutto come chiedono`, rep: -2, soldi: 0, esito: `Alle 7:30 il magazzino è il caos: le immagini dei bancali in corsa sono finite nel servizio con il titolo "Ritmi infernali".` },
      { testo: `Accetto, ma propongo le 10 e lascio parlare chi vuole`, rep: 3, soldi: 0, esito: `Magazzino ordinato, autisti sinceri e un servizio equilibrato. Ottima pubblicità.` },
      { testo: `Rifiuto`, rep: -1, soldi: 0, esito: `Nel servizio c'è scritto "l'azienda non ha voluto mostrarsi". Hanno filmato i furgoni da fuori.` },
    ] },
  { id: 'anziana2', mittente: 'Signora Maria, 84 anni', oggetto: 'Le casse d\'acqua al quinto piano',
    testo: () => `Il vostro autista è sempre gentile. Abito al quinto piano senza ascensore e ordino 6 casse d'acqua a settimana. Potreste portarmele su? So che non è il vostro lavoro.`,
    scelte: [
      { testo: `Sì, l'autista gliele porta su a mano`, rep: 0, soldi: -900, esito: `Sei casse a settimana per cinque piani: dopo un mese l'autista si è bloccato la schiena. Cinque giorni a casa.` },
      { testo: `Sì, e compro un carrello saliscale per l'autista`, rep: 3, soldi: -350, esito: `Qualche minuto in più, niente fatica. La signora l'ha raccontato a mezzo quartiere.` },
      { testo: `No, consegniamo al portone`, rep: -2, soldi: 0, esito: `Regolare, ma la signora ha cambiato negozio e corriere, e lo dice a tutti.` },
    ] },
  { id: 'premio-pacchi', mittente: 'Rappresentante sindacale', oggetto: 'Il premio a pacchi fa correre gli autisti',
    testo: () => `Il premio di 0,20 € a pacco oltre i 100 al giorno spinge gli autisti a correre: due incidenti questo mese e tante consegne "lanciate". Chiediamo di rivederlo.`,
    scelte: [
      { testo: `Lo tolgo e alzo lo stipendio base`, rep: 1, soldi: -1500, esito: `Più calma, ma anche meno grinta: le consegne al giorno sono calate e il costo è salito.` },
      { testo: `Lo trasformo in un premio per zero incidenti e zero reclami`, rep: 3, soldi: -400, esito: `Gli autisti ora vanno veloci ma attenti, perché un reclamo fa perdere il premio. Incidenti azzerati.` },
      { testo: `Lo lascio: funziona`, rep: -3, soldi: -1800, esito: `Un terzo incidente, questa volta con un pedone ferito leggermente. Ora il premio sembra una scelta pericolosa.` },
    ] },
  { id: 'influencer2', mittente: 'Luca · 300k follower', oggetto: 'Video sponsorizzato sui vostri furgoni',
    testo: () => `Faccio video sui lavori di tutti i giorni. 300.000 follower (il mio pubblico è internazionale: l'80% è all'estero). Un video sul vostro corriere costa 1.500 €, pagamento anticipato.`,
    scelte: [
      { testo: `Pago: 300.000 persone sono tante`, rep: -1, soldi: -1500, esito: `L'80% dei follower all'estero non spedisce pacchi nella tua città. Video visto, zero clienti nuovi.` },
      { testo: `Propongo di pagarlo a risultato, con un codice sconto`, rep: 2, soldi: 200, esito: `Ha accettato a malincuore: pochi codici usati, ma hai pagato solo quelli e qualche cliente vero è arrivato.` },
      { testo: `Cerco invece una pagina del quartiere con follower locali`, rep: 3, soldi: -300, esito: `Diecimila follower, ma tutti della tua città: una dozzina di negozi ti ha contattato.` },
    ] },
  { id: 'insuline', mittente: 'Farmacia Comunale', oggetto: 'Consegna urgente di farmaci',
    testo: () => `Il nostro furgone è guasto: dobbiamo consegnare oggi farmaci a 12 pazienti anziani a domicilio. 4 di loro sono insuline, da tenere tra 2 e 8 gradi. Potete farlo voi a tariffa normale?`,
    scelte: [
      { testo: `Sì, li porto tutti oggi con un giro normale`, rep: -3, soldi: -600, esito: `Le insuline sono rimaste ore nel furgone caldo: da buttare. Le hai ripagate tu e la farmacia non ti chiama più.` },
      { testo: `Sì, ma le insuline nelle loro borse frigo, consegnate per prime`, rep: 4, soldi: -100, esito: `Borse frigo dalla farmacia, insuline consegnate entro un'ora, il resto in giornata. Il Comune ti ha ringraziato pubblicamente.` },
      { testo: `Solo domani, con calma`, rep: -1, soldi: 0, esito: `Hanno chiesto a un altro. Tre pazienti sono rimasti un giorno senza farmaci.` },
    ] },
  { id: 'login-fattura', mittente: 'Fatturazione · Gomme & Cerchi Srl', oggetto: 'Fattura n. 2231 disponibile',
    testo: () => `Gentile cliente, la fattura n. 2231 da 2.900 € per il cambio gomme è disponibile. Per scaricarla acceda con le credenziali aziendali Microsoft dal link qui sotto. (Il cambio gomme lo avete fatto davvero il mese scorso, e la fattura risulta già pagata.)`,
    scelte: [
      { testo: `Apro il link e accedo per scaricarla`, rep: -4, soldi: -2500, esito: `Il link rubava le credenziali: da quell'account sono partite email false ai tuoi clienti. Tecnico, password cambiate e scuse.` },
      { testo: `Pago di nuovo per sicurezza, la cifra è giusta`, rep: -1, soldi: -2900, esito: `L'avevi già pagata: hai pagato due volte, e i soldi nuovi sono andati su un conto che non era del gommista.` },
      { testo: `Non apro nulla e verifico in contabilità`, rep: 3, soldi: 0, esito: `Fattura già pagata e nessuna nuova emissione: era phishing con dati veri presi da una vecchia email. Segnalato all'IT.` },
    ] },
  { id: 'due-fattori', mittente: 'Ufficio IT', oggetto: 'Sicurezza del gestionale',
    testo: () => `Vorremmo l'autenticazione a due fattori per tutti. Gli autisti però dicono che alle 7 di mattina, con 20 furgoni che partono, perdere 2 minuti a testa col codice sul telefono rallenta la partenza.`,
    scelte: [
      { testo: `Due fattori per tutti, senza eccezioni`, rep: 1, soldi: -900, esito: `Sicuro, ma ogni mattina si crea la fila al gestionale e i primi giri partono in ritardo.` },
      { testo: `Due fattori per ufficio e amministrazione, PIN personale per gli autisti`, rep: 3, soldi: -500, esito: `Gli account che contano davvero (pagamenti, clienti) sono blindati, e la mattina i furgoni partono in orario.` },
      { testo: `Lascio tutto com'è`, rep: -3, soldi: -1800, esito: `Qualcuno è entrato con la password di un ex dipendente e ha cambiato venti indirizzi di consegna. Rimborsi e figuraccia.` },
    ] },
  { id: 'foto-consegna', mittente: 'Qualità · grande cliente e-commerce', oggetto: 'Ci mandate le foto delle consegne?',
    testo: () => `Per il controllo qualità vorremmo ogni settimana tutte le foto di consegna, con il volto di chi ritira, più il suo numero di telefono. Siamo il vostro primo cliente per volume.`,
    scelte: [
      { testo: `Mando tutto: è il cliente più importante`, rep: -4, soldi: -4000, esito: `Volti e telefoni di sconosciuti consegnati a terzi senza consenso: segnalazione al Garante della privacy e multa.` },
      { testo: `Mando le foto del pacco consegnato, senza volti né numeri`, rep: 3, soldi: 0, esito: `Al cliente bastava sapere dove e quando: perfetto così, e ti ha pure ringraziato per l'attenzione alla privacy.` },
      { testo: `Rifiuto qualsiasi foto`, rep: -1, soldi: -1200, esito: `Rigidità inutile: le foto del pacco si potevano dare. Il cliente ha spostato una parte dei volumi.` },
    ] },
  { id: 'olio-perde', mittente: () => `${nomeMagazziniere()} · magazzino`, oggetto: 'Pacco che perde liquido',
    testo: () => `Un pacco perde un liquido scuro che puzza di benzina. Il mittente è un negozio di ricambi auto che ci manda pacchi ogni giorno, sull'etichetta c'è "olio motore 4 litri". Il destinatario lo aspetta oggi.`,
    scelte: [
      { testo: `Chiamo i vigili del fuoco`, rep: 0, soldi: -300, esito: `Era davvero olio motore, tappo allentato. Un'ora di smistamento ferma e i vigili un po' perplessi.` },
      { testo: `Lo isolo, chiamo il mittente e lo faccio reimballare`, rep: 3, soldi: -80, esito: `Tappo allentato: il negozio ha mandato un imballo nuovo in mezz'ora. Pacco consegnato il giorno dopo e niente furgoni sporchi.` },
      { testo: `Lo carico in un sacco e via`, rep: -3, soldi: -900, esito: `Il sacco si è rotto in curva: furgone da pulire, altri 15 pacchi rovinati e rimborsi.` },
    ] },
  { id: 'incentivi2', mittente: () => `Comune di ${S.citta.nome} · Mobilità`, oggetto: 'Contributo 30% per furgoni elettrici',
    testo: () => `Il Comune finanzia il 30% di un furgone elettrico per chi rottama un diesel. Condizioni: il diesel rottamato deve avere almeno 10 anni e il nuovo va tenuto almeno 5 anni.`,
    scelte: [
      { testo: `Rottamo i diesel più nuovi per avere più contributi`, rep: -1, soldi: -3000, esito: `I diesel avevano meno di 10 anni: niente contributo, e li hai rottamati per niente.` },
      { testo: `Partecipo solo con i diesel che hanno più di 10 anni`, rep: 2, soldi: 2500, esito: `Contributo arrivato e logo nella campagna "Città pulita". Era l'unico modo di averlo.` },
      { testo: `Non mi interessa`, rep: 0, soldi: 0, esito: `Nessun cambiamento. Un concorrente ha preso contributo e visibilità.` },
    ] },
  { id: 'cugino2', mittente: 'Tuo cugino Marco', oggetto: 'Mi assumi?',
    testo: () => `Ciao! Ho perso il lavoro. Ho solo la patente B e niente patente C, ma ho guidato furgoni per un traslocatore due anni. Mi faresti fare l'autista? E magari nella zona del centro, che la conosco.`,
    scelte: [
      { testo: `No: senza patente C non può guidare`, rep: -1, soldi: 0, esito: `Per i furgoni sotto i 35 quintali basta la patente B. Hai perso un autista con esperienza per un errore tuo, e in famiglia se lo ricordano.` },
      { testo: `Lo assumo come tutti, in prova, nella zona che serve all'azienda`, rep: 2, soldi: 0, esito: `Due anni di furgoni si vedono. Nessun favoritismo: i colleghi lo trattano come uno di loro.` },
      { testo: `Lo assumo e gli do il centro come chiede`, rep: -3, soldi: 0, esito: `Il centro era la zona di un autista con anni di anzianità: hai spostato lui per tuo cugino. Malumore in tutta la squadra.` },
    ] },
  { id: 'sciopero2', mittente: 'Coordinamento corrieri', oggetto: 'Sciopero dei rider venerdì',
    testo: () => `Venerdì c'è uno sciopero dei rider delle piattaforme. Vi chiediamo di non prendere le loro consegne. Alcuni vostri clienti abituali però usano anche le piattaforme.`,
    scelte: [
      { testo: `Prendo tutte le consegne extra che arrivano`, rep: -3, soldi: 1500, esito: `Guadagno extra, ma per giorni sui social ti hanno chiamato "crumiro".` },
      { testo: `Non prendo nulla di nuovo, ma servo i miei clienti abituali`, rep: 2, soldi: 400, esito: `Niente pacchi dei rider in sciopero, ma i tuoi clienti di sempre non sono rimasti a piedi. Rispettato da tutti.` },
      { testo: `Venerdì non consegno nulla, per solidarietà`, rep: -1, soldi: -1500, esito: `Gesto forte, ma i tuoi clienti, che non c'entravano, sono rimasti senza consegne.` },
    ] },
  { id: 'scorciatoia', mittente: () => `${nomeAutista()} · autista`, oggetto: 'Ho trovato percorsi più veloci',
    testo: () => `Il navigatore ci fa girare intorno al centro. Io ho segnato su una mappa delle scorciatoie che tagliano dal centro storico la mattina presto, prima delle 8. Si risparmiano 20 minuti a giro. Le posso dare a tutti?`,
    scelte: [
      { testo: `Sì, a tutti da domani, e lo premio`, rep: -2, soldi: -1800, esito: `Il centro storico è ZTL: le telecamere hanno fotografato tutti i furgoni. Una pioggia di multe.` },
      { testo: `Prima controllo orari e permessi della ZTL`, rep: 3, soldi: -100, esito: `I furgoni merci possono entrare fino alle 10 con un permesso da poche decine di euro. Permesso preso e 20 minuti risparmiati, legalmente.` },
      { testo: `No, si usa il navigatore e basta`, rep: -1, soldi: -300, esito: `Nessun rischio, ma i giri restano lunghi e l'autista ha smesso di proporre idee.` },
    ] },
  { id: 'rimborsi-seriali', mittente: 'Centralino', oggetto: 'Cliente furioso: "il pacco non è mai arrivato"',
    testo: () => `Un cliente urla al telefono: il pacco risulta consegnato ma dice di non averlo. Nella foto di consegna il pacco è davanti alla sua porta, col suo numero civico. È la quarta richiesta di rimborso che fa quest'anno.`,
    scelte: [
      { testo: `Rimborso subito per chiudere la questione`, rep: -1, soldi: -250, esito: `Quarto rimborso in un anno: ormai sa che con te funziona. Il mese dopo ha chiesto il quinto.` },
      { testo: `Gli mando la foto con gentilezza e apro una verifica`, rep: 2, soldi: 0, esito: `Davanti alla foto ha cambiato tono: "forse l'ha preso mia moglie". Pacco ritrovato, niente rimborso.` },
      { testo: `Mando l'autista a controllare`, rep: 0, soldi: -80, esito: `L'autista ha suonato: nessuno ha aperto. Mezz'ora persa e il cliente ancora arrabbiato.` },
    ] },
  { id: 'squadra2', mittente: () => `ASD Calcio ${S.citta.nome}`, oggetto: 'Sponsor per la squadra giovanile',
    testo: () => `La squadra giovanile cerca uno sponsor: 2.000 € per il logo sulle maglie e sul pulmino. Se preferite, invece dei soldi ci basterebbe che un vostro furgone portasse i ragazzi alle trasferte.`,
    scelte: [
      { testo: `Presto un furgone per portare i ragazzi`, rep: -3, soldi: -800, esito: `I furgoni merci non possono trasportare persone sul vano di carico: fermati a un posto di blocco, multa e brutta figura con i genitori.` },
      { testo: `Sponsorizzo con i 2.000 €`, rep: 2, soldi: -2000, esito: `Logo in città ogni domenica e tante famiglie che ora ti scelgono per le spedizioni.` },
      { testo: `Pago solo le maglie, 1.000 €`, rep: 1, soldi: -1000, esito: `Logo sulle maglie, meno visibilità del pulmino, ma spesa dimezzata.` },
    ] },
  { id: 'peso-falso2', mittente: 'Ufficio fatturazione', oggetto: 'Un cliente dichiara pesi sbagliati',
    testo: () => `Il nostro terzo cliente per volume dichiara sempre pesi più bassi del vero: ci perdiamo circa 1.200 € al mese. Nel contratto c'è già una clausola che ci permette di ripesare i pacchi e fatturare la differenza.`,
    scelte: [
      { testo: `Gli parlo e chiedo di correggere i pesi`, rep: 1, soldi: 600, esito: `Ha promesso, ma ha corretto solo una parte. Ci perdi ancora qualcosa ogni mese.` },
      { testo: `Applico la clausola: ripeso e fatturo la differenza`, rep: 2, soldi: 2200, esito: `Era nel contratto firmato: ha protestato un giorno e poi ha accettato. Fatture finalmente giuste.` },
      { testo: `Lascio stare, non voglio perderlo`, rep: -1, soldi: -1200, esito: `Continui a perderci ogni mese, e lo sa.` },
    ] },
  { id: 'notte2', mittente: 'Logistica · Supermercati Freschi', oggetto: 'Consegne di notte nei negozi',
    testo: () => `Vorremmo consegne tra le 4 e le 6 nei nostri 8 negozi, tutte le notti. Servono 2 autisti fissi. (Nota dall'ufficio personale: tra i nostri autisti si è offerto solo uno.)`,
    scelte: [
      { testo: `Accetto: il volontario più uno a rotazione`, rep: -2, soldi: 3000, esito: `Chi ruota sulle notti dorme male tutta la settimana: stanchezza, un incidente alle 5 e malumore.` },
      { testo: `Accetto e assumo un autista apposta per le notti`, rep: 2, soldi: 2000, esito: `Un autista che vuole lavorare di notte si trova: cliente fisso e squadra tranquilla.` },
      { testo: `Accetto e ci metto i nuovi in prova`, rep: -4, soldi: 3500, esito: `Usare chi è in prova perché non può dire no: due si sono licenziati e uno ha raccontato tutto in giro.` },
    ] },
  { id: 'video-autista', mittente: 'Ufficio comunicazione', oggetto: 'Un autista è diventato virale',
    testo: () => `Un autista ha pubblicato un video in cui canta in furgone: 200.000 visualizzazioni e tanti complimenti. Lo ha girato da fermo, con le quattro frecce, ma parcheggiato sul posto per disabili.`,
    scelte: [
      { testo: `Lo ripubblichiamo sui nostri canali`, rep: -3, soldi: 0, esito: `Qualcuno ha notato il posto per disabili: la Polizia Locale ha condiviso il video come esempio di cosa non fare. Con il tuo logo.` },
      { testo: `Lo ringrazio e gli chiedo di rifarlo parcheggiato bene`, rep: 3, soldi: 0, esito: `Il secondo video, girato nel cortile del magazzino, ha fatto ancora più visualizzazioni. Messaggio giusto e tanta simpatia.` },
      { testo: `Lo licenzio per danno d'immagine`, rep: -3, soldi: 0, esito: `I follower si sono schierati con lui: "licenziato perché cantava".` },
    ] },
  { id: 'neve2', mittente: 'Protezione Civile', oggetto: 'Allerta neve per domani',
    testo: () => `Domani neve abbondante sopra i 600 metri, pioggia in pianura. Strade collinari a rischio chiusura. Si consiglia di limitare gli spostamenti non necessari nelle zone interessate.`,
    scelte: [
      { testo: `Domani chiudo tutto per sicurezza`, rep: -2, soldi: -1500, esito: `La città è in pianura: ha solo piovuto. Un giorno intero di consegne perso per niente.` },
      { testo: `Giri normali, avviso solo i clienti in collina`, rep: 3, soldi: 0, esito: `In città tutto regolare; i pochi clienti in collina sapevano già del ritardo. Nessuna lamentela.` },
      { testo: `Rimando tutti i pacchi non urgenti`, rep: -1, soldi: -500, esito: `Prudente, ma in città pioveva e basta: un giorno di ritardo per centinaia di clienti.` },
    ] },
  { id: 'asl-kit', mittente: 'ASL · Ufficio Igiene', oggetto: 'Ispezione al magazzino tra una settimana',
    testo: () => `Vi comunichiamo che tra una settimana faremo un'ispezione igienico-sanitaria del vostro magazzino. Per evitare sanzioni potete acquistare il kit di adeguamento (cartelli, registri, estintore) a 890 € dal nostro fornitore convenzionato, link qui sotto.`,
    scelte: [
      { testo: `Compro il kit, così sono a posto`, rep: -3, soldi: -890, esito: `L'ASL non vende kit e non ha fornitori convenzionati: era una truffa. Il kit non è mai arrivato.` },
      { testo: `Pulisco e controllo tutto da solo`, rep: 1, soldi: -800, esito: `Magazzino in ordine, ma l'ispezione non è mai arrivata: l'email era falsa e non te ne sei accorto.` },
      { testo: `Chiamo il numero ufficiale dell'ASL`, rep: 3, soldi: -150, esito: `Nessuna ispezione in programma: truffa segnalata. Già che c'eri hai fatto un controllo agli estintori.` },
    ] },
  { id: 'software-percorsi', mittente: 'Dott. Ferri · RotteSmart', oggetto: 'Riduciamo del 10% i km della vostra flotta',
    testo: () => `Il nostro software ottimizza i giri dei corrieri. Costa 9.000 € l'anno, ma lo provate gratis 30 giorni e lo pagate solo se taglia almeno il 10% dei km. Tre corrieri della regione lo usano, trova i loro contatti in allegato.`,
    scelte: [
      { testo: `Cestino: sono tutti truffatori`, rep: 0, soldi: -800, esito: `Questa volta era serio: un concorrente l'ha preso e ha tagliato i km del 12%.` },
      { testo: `Faccio la prova gratuita e chiamo i referenti`, rep: 2, soldi: 2500, esito: `I referenti hanno confermato, la prova ha tagliato l'11% dei km: l'hai pagato e lo hai già ripreso in gasolio.` },
      { testo: `Pago subito l'anno con lo sconto del 20%`, rep: 0, soldi: -1500, esito: `Funziona, ma hai rinunciato alla prova gratuita che ti avrebbe protetto.` },
    ] },
  { id: 'gara-frigo', mittente: () => `Ospedale di ${S.citta.nome} · Ufficio gare`, oggetto: 'Gara per il trasporto di campioni',
    testo: () => `Cerchiamo un corriere per trasportare campioni di laboratorio tra reparti e cliniche, 2 anni di contratto. Requisito: furgoni refrigerati con registratore di temperatura certificato.`,
    scelte: [
      { testo: `Partecipo e i furgoni frigo li prendo se vinco`, rep: -2, soldi: -1500, esito: `Hai vinto, ma i furgoni frigo arrivano dopo 3 mesi: penali per ogni giorno senza requisito.` },
      { testo: `Partecipo con un corriere refrigerato come partner`, rep: 3, soldi: 1500, esito: `Offerta in regola dal primo giorno: gara vinta in coppia e cliente prestigioso.` },
      { testo: `Non partecipo`, rep: 0, soldi: 0, esito: `L'ha vinta un concorrente.` },
    ] },
  { id: 'molestie2', mittente: () => `${nomeMagazziniere()} · magazzino`, oggetto: 'Una segnalazione delicata',
    testo: () => `Una collega mi ha detto che un caposquadra le fa commenti pesanti da settimane. Lei ha paura di parlarne e non vuole che si sappia che è stata lei.`,
    scelte: [
      { testo: `Sposto lei in un altro turno, così è al sicuro`, rep: -2, soldi: 0, esito: `Lei ha perso i suoi orari e i suoi colleghi, lui è rimasto dov'era: è sembrata una punizione per chi ha subito.` },
      { testo: `La ascolto in privato e avvio una verifica riservata`, rep: 4, soldi: -500, esito: `Verifica riservata con un consulente esterno: fatti confermati, provvedimento per il caposquadra e nome di lei protetto.` },
      { testo: `Chiedo al caposquadra la sua versione`, rep: -3, soldi: 0, esito: `Il caposquadra ha capito subito chi aveva parlato. La collega si è licenziata.` },
    ] },
  { id: 'gasolio2', mittente: 'Ufficio controllo costi', oggetto: 'Il gasolio non torna',
    testo: () => `Un furgone consuma il 40% in più degli altri sullo stesso giro. Le ricevute del distributore hanno orari strani, spesso di domenica. Quel furgone lo usano a turno due autisti.`,
    scelte: [
      { testo: `Licenzio l'autista titolare del furgone`, rep: -3, soldi: -1200, esito: `I rifornimenti della domenica li faceva l'altro autista. Hai licenziato un innocente e ora ti fa causa.` },
      { testo: `Incrocio ricevute e turni prima di decidere`, rep: 3, soldi: 900, esito: `I pieni della domenica coincidevano con i turni di uno solo dei due: ha ammesso e restituito i soldi. Ora le carte carburante hanno un limite.` },
      { testo: `Metto un limite alla carta carburante e basta`, rep: 0, soldi: 300, esito: `Il furto si è ridotto, ma chi rubava è ancora lì, e gli altri lo sanno.` },
    ] },
  { id: 'integratori', mittente: 'Import Salute Srl', oggetto: 'Grosso volume di consegne, pagamento anticipato',
    testo: () => `Distribuiamo integratori importati. 2.000 pacchi a settimana, pagamento anticipato con bonifico, documenti in regola. Paghiamo il 25% sopra la vostra tariffa. Destinatari sempre diversi, nessun reso, mai.`,
    scelte: [
      { testo: `Accetto: pagano prima e sopra tariffa`, rep: -5, soldi: -4000, esito: `Erano farmaci contraffatti spacciati per integratori. Sequestro, furgoni fermi per i controlli e il tuo nome nelle indagini.` },
      { testo: `Chiedo visura camerale e di vedere la merce prima`, rep: 2, soldi: 0, esito: `Alla richiesta di vedere la merce sono spariti. Prezzo troppo alto e "nessun reso, mai" erano i segnali giusti.` },
      { testo: `Accetto per un mese di prova`, rep: -3, soldi: -1500, esito: `Al primo controllo della Guardia di Finanza i tuoi furgoni erano pieni di merce sequestrata.` },
    ] },
  { id: 'caldo2', mittente: () => `${nomeAutista()} · autista`, oggetto: 'Nei furgoni si muore di caldo',
    testo: () => `Con questo caldo nei furgoni vecchi senza aria condizionata arriviamo a 40 gradi. Ieri un collega si è sentito male. L'installatore che ho sentito dice che per i climatizzatori servono 6 settimane, e l'estate finisce tra 5.`,
    scelte: [
      { testo: `Ordino subito i climatizzatori per tutti`, rep: 0, soldi: -2500, esito: `Arrivati a fine settembre, quando il caldo era passato. Intanto altri due malori.` },
      { testo: `Acqua, pause all'ombra e giri spostati al mattino presto`, rep: 3, soldi: -400, esito: `Subito efficace: nessun malore e consegne lo stesso in orario. I climatizzatori li valuti con calma per l'anno prossimo.` },
      { testo: `D'estate fa caldo, si è sempre fatto così`, rep: -4, soldi: -900, esito: `Un altro malore, ambulanza e un giorno di consegne perso.` },
    ] },
  { id: 'recesso2', mittente: 'Grande cliente · ModaFast', oggetto: 'Vi lasciamo per un concorrente',
    testo: () => `Il vostro concorrente ci offre il 15% in meno. Se non pareggiate, da lunedì spostiamo tutto. PS: il vostro servizio resta il migliore che abbiamo avuto, i loro tempi di consegna sono più lunghi.`,
    scelte: [
      { testo: `Pareggio subito il 15%`, rep: 0, soldi: -2000, esito: `Cliente tenuto, ma il PS diceva già che non volevano andarsene: hai regalato margine.` },
      { testo: `Incontro, punto sulla qualità e offro il 5%`, rep: 2, soldi: -500, esito: `Come lasciava capire il PS, la qualità contava: 5% di sconto e cliente tenuto per altri due anni.` },
      { testo: `Li lascio andare`, rep: -1, soldi: -1500, esito: `Persi i volumi. Tre mesi dopo sono tornati, scontenti dei tempi del concorrente.` },
    ] },
  { id: 'corso-online', mittente: 'Consulente sicurezza sul lavoro', oggetto: 'Corso antincendio scaduto',
    testo: () => `Il corso antincendio del personale di magazzino è scaduto da 6 mesi ed è obbligatorio. Possiamo farlo sabato in presenza (900 €) oppure online (300 €). Ricordo che la parte pratica con l'estintore va fatta in presenza.`,
    scelte: [
      { testo: `Online: costa un terzo`, rep: -1, soldi: -1200, esito: `Senza la parte pratica in presenza il corso non vale: al controllo dell'Ispettorato risultava ancora scaduto. Multa più il corso rifatto.` },
      { testo: `In presenza, pagando il sabato come straordinario`, rep: 3, soldi: -900, esito: `Corso fatto. Due settimane dopo un principio d'incendio è stato spento in 30 secondi.` },
      { testo: `Lo rimando a fine anno`, rep: -2, soldi: -1500, esito: `Controllo dell'Ispettorato a sorpresa: multa.` },
    ] },
  { id: 'regalo2', mittente: 'Ditta Rossi Arredamenti', oggetto: 'Un pensiero per lei',
    testo: () => `Per ringraziarla della collaborazione le abbiamo fatto recapitare un orologio di valore. Confidiamo che i nostri mobili continuino ad avere la precedenza nei carichi del mattino.`,
    scelte: [
      { testo: `Lo tengo: un regalo è un regalo`, rep: -2, soldi: 0, esito: `Si aspettavano un favore in cambio. Quando non è arrivato, il rapporto si è rovinato.` },
      { testo: `Lo restituisco con un grazie e spiego che non ci sono precedenze`, rep: 3, soldi: 0, esito: `Restituito con garbo: il rapporto è rimasto ottimo, e trasparente.` },
      { testo: `Lo tengo e do loro la precedenza`, rep: -4, soldi: 0, esito: `Gli altri clienti hanno notato i ritardi, e qualcuno ha capito il perché.` },
    ] },
  { id: 'postazione', mittente: 'Ufficio personale', oggetto: 'Candidata in sedia a rotelle',
    testo: () => `Per il ruolo di addetta allo smistamento si è candidata una persona in sedia a rotelle con ottime referenze. Bisogna abbassare un bancone (1.500 €). L'INAIL rimborsa buona parte delle spese per adattare le postazioni.`,
    scelte: [
      { testo: `La assumo, ma in ufficio dove non serve adattare nulla`, rep: -1, soldi: 0, esito: `Si era candidata per lo smistamento, dove era bravissima. Si è sentita messa da parte e ha accettato un'altra offerta.` },
      { testo: `La assumo e adatto la postazione chiedendo il rimborso INAIL`, rep: 4, soldi: -300, esito: `Rimborso ottenuto per gran parte della spesa, e si è rivelata una delle più precise del magazzino.` },
      { testo: `Scelgo un altro candidato per evitare la spesa`, rep: -3, soldi: 0, esito: `La candidata l'ha raccontato e un'associazione ne ha parlato pubblicamente.` },
    ] },
];

// ordine delle risposte mescolato: la migliore non è sempre la prima
function mescola(scelte) { return scelte.map((_, i) => i).sort(() => Math.random() - 0.5); }
function nomeAutista() { const a = S.dipendenti.filter(d => d.ruolo === 'autista'); return a.length ? scegli(a).nome : 'Un autista'; }
function nomeMagazziniere() { const a = S.dipendenti.filter(d => d.ruolo === 'magazziniere'); return a.length ? scegli(a).nome : 'Un magazziniere'; }
function testoDi(v) { return typeof v === 'function' ? v() : v; }

// chiamata all'inizio di ogni giornata lavorativa
// ogni email arriva a un magazzino: a uno che gestisci tu (quelli con il responsabile se la cavano da soli)
function magPerEmail() { const miei = S.depositi.filter(m => !m.responsabile); return (miei.length ? scegli(miei) : magazzino(magAttivo())).id; }
function postaDi(mag) { return (S.posta || []).filter(m => magDi(m) === mag); }
function nonLetteDi(mag) { return postaDi(mag).filter(m => m.report ? !m.letta : m.risposta === null).length; }
function controllaPosta() {
  S.posta = S.posta || [];
  // a gioco chiuso le email non scadono: aspettano che torni
  if (S.recuperoOffline) S.posta.filter(m => m.risposta === null && !m.report).forEach(m => { m.scadenza = Math.max(m.scadenza, S.giorno + 1); });
  // scadute dopo una settimana: nessuna scelta, solo −1 di reputazione
  S.posta.filter(m => m.risposta === null && S.giorno > m.scadenza).forEach(m => {
    m.risposta = -1; m.letta = true; m.rep = -1; m.soldi = 0; m.esito = 'Non hai risposto in tempo: il mittente è rimasto senza risposta.';
    cambiaFama(-1);
    notizia(`Email scaduta senza risposta: "${m.oggetto}". Reputazione −1.`, 'male');
  });
  pulisciPosta();
  if (!S.furgoni.length || postaPiena()) return;
  forseEmailGrave();
  if (postaPiena()) return;
  // la prima email arriva subito (il primo giorno con un furgone), poi una ogni lunedì
  if (S.postaRicevute && !POSTA.giorniSettimana.includes(dataDelGiorno(S.giorno).getDay())) return;
  if (S.posta.some(m => m.giorno === S.giorno)) return;
  const usate = S.postaUsate || [];
  const libere = EMAIL.filter(e => !usate.includes(e.id));
  const e = scegli(libere.length ? libere : EMAIL);
  S.posta.unshift({ id: e.id, mag: magPerEmail(), giorno: S.giorno, scadenza: S.giorno + POSTA.giorniPerRispondere,
    mittente: testoDi(e.mittente), oggetto: e.oggetto, testo: testoDi(e.testo), letta: false, risposta: null, esito: '', ordine: mescola(e.scelte) });
  segnaUsata(e.id);
  notizia(`Nuova email: "${e.oggetto}". Rispondi entro ${POSTA.giorniPerRispondere} giorni nella scheda Posta.`, 'info', 'posta');
}

function applicaRisposta(m, i, scaduta) {
  const e = trovaEmail(m.id), s = e.scelte[i];
  if (s.fai) s.fai(m.ctx || {});
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
function emailNonLette() { return (S && S.posta || []).filter(m => m.report ? !m.letta : m.risposta === null).length; }

/* ---------- email gravi: una al mese, con conseguenze vere su un dipendente o un furgone ---------- */
// ctx: chi è coinvolto. Le scelte hanno rep/soldi/esito come le altre, più fai(ctx) con l'effetto sul gioco.
const autistaConFurgone = () => { const a = S.dipendenti.filter(d => d.ruolo === 'autista' && S.furgoni.some(f => f.autistaId === d.id && f.zona)); return a.length ? scegli(a) : null; };
const unMagazziniere = () => { const a = S.dipendenti.filter(d => d.ruolo === 'magazziniere'); return a.length ? scegli(a) : null; };
const sospendi = (id, giorni) => { const d = dipendente(id); if (d) d.sospesoFino = S.giorno + giorni; };
const licenziaPer = id => { if (dipendente(id)) licenzia(id); };
const zonaDi = id => { const f = S.furgoni.find(x => x.autistaId === id); return f && f.zona ? (isJolly(f) ? 'il giro jolly' : 'la zona ' + nomeZona(zona(f.zona))) : 'il suo giro'; };
const BUCO = ' Il suo furgone resta senza autista finché non ne assumi un altro: se hai un jolly copre lui, altrimenti la zona resta scoperta e la reputazione scende.';

const EMAIL_GRAVI = [
  { id: 'g-droga', grave: true, puo: () => !!autistaConFurgone(), prepara: () => { const a = autistaConFurgone(); return { id: a.id, nome: a.nome }; },
    mittente: () => 'Caposquadra autisti', oggetto: c => `${c.nome} si droga durante il lavoro`,
    testo: c => `Ho trovato ${c.nome} a fare uso di droghe nel furgone durante la pausa. Non è la prima volta: altri colleghi l'hanno visto. Guida ogni giorno ${zonaDi(c.id)}. Devi decidere tu.`,
    scelte: [
      { testo: 'Lo licenzio subito', rep: 2, soldi: 0, fai: c => licenziaPer(c.id), esito: 'Licenziato. Hai protetto i colleghi e i clienti.' + BUCO },
      { testo: 'Lo sospendo e gli pago un percorso di recupero', rep: 4, soldi: -2500, fai: c => sospendi(c.id, 10), esito: 'Resta a casa 10 giorni per il percorso. Il furgone è fermo intanto: un jolly può coprire. Poi torna e lavora bene.' },
      { testo: 'Faccio finta di niente', rep: -3, soldi: 0, fai: c => { const d = dipendente(c.id); if (d) d.rischio = 1.5; }, esito: 'Resta al suo posto, ma da ora fa il 50% di incidenti in più. E i colleghi lo sanno.' },
    ] },
  { id: 'g-alcol', grave: true, puo: () => !!autistaConFurgone(), prepara: () => { const a = autistaConFurgone(); return { id: a.id, nome: a.nome }; },
    mittente: () => 'Polizia Locale', oggetto: c => `${c.nome} fermato con tasso alcolico alto`,
    testo: c => `Il vostro autista ${c.nome} è stato fermato alla guida del furgone aziendale con un tasso alcolico oltre il limite. Patente sospesa per 15 giorni, furgone affidato a un collega.`,
    scelte: [
      { testo: 'Lo licenzio', rep: 2, soldi: -300, fai: c => licenziaPer(c.id), esito: 'Licenziato per giusta causa.' + BUCO },
      { testo: 'Lo tengo in magazzino finché non riavrà la patente', rep: 3, soldi: 0, fai: c => sospendi(c.id, 15), esito: 'Per 15 giorni non guida: il suo furgone è fermo e serve un jolly. Poi torna al volante, molto più attento.' },
      { testo: 'Lo faccio guidare con un collega accanto che controlla', rep: -5, soldi: -3000, fai: c => { const d = dipendente(c.id); if (d) d.rischio = 1.5; }, esito: 'Con la patente sospesa non può guidare, collega accanto o no: secondo fermo, multa salata all\'azienda e da ora il 50% di incidenti in più.' },
    ] },
  { id: 'g-furto', grave: true, puo: () => !!unMagazziniere(), prepara: () => { const a = unMagazziniere(); return { id: a.id, nome: a.nome }; },
    mittente: () => 'Ufficio sicurezza', oggetto: c => `Le telecamere riprendono ${c.nome} mentre ruba`,
    testo: c => `Dalle telecamere del magazzino si vede ${c.nome} aprire pacchi e portare via cellulari e cuffie. Negli ultimi mesi i reclami per pacchi vuoti erano aumentati.`,
    scelte: [
      { testo: 'Lo licenzio e lo denuncio', rep: 4, soldi: -1200, fai: c => licenziaPer(c.id), esito: 'Licenziato e denunciato; avvocato pagato. Lo smistamento ha un magazziniere in meno finché non ne assumi un altro.' },
      { testo: 'Lo licenzio senza denuncia', rep: 2, soldi: 0, fai: c => licenziaPer(c.id), esito: 'Licenziato. Lo smistamento ha un magazziniere in meno finché non ne assumi un altro.' },
      { testo: 'Gli do un\'altra possibilità', rep: -3, soldi: 0, fai: c => { const d = dipendente(c.id); if (d) d.ruba = true; }, esito: 'Ha promesso di smettere. Non ha smesso: ogni tanto spariscono pacchi e paghi i rimborsi.' },
    ] },
  { id: 'g-patente', grave: true, puo: () => !!autistaConFurgone(), prepara: () => { const a = autistaConFurgone(); return { id: a.id, nome: a.nome }; },
    mittente: () => 'Ufficio personale', oggetto: c => `La patente di ${c.nome} è scaduta da 3 mesi`,
    testo: c => `Controllando i documenti abbiamo scoperto che la patente C di ${c.nome} è scaduta da tre mesi. Ha guidato tutto questo tempo senza saperlo (dice). Il rinnovo richiede una settimana.`,
    scelte: [
      { testo: 'Lo fermo una settimana finché rinnova', rep: 3, soldi: -200, fai: c => sospendi(c.id, 7), esito: 'Una settimana a terra: il suo furgone è fermo, un jolly può coprirlo. Poi tutto in regola.' },
      { testo: 'Lo faccio guidare: il rinnovo è già prenotato', rep: -4, soldi: -2500, fai: () => {}, esito: 'Una prenotazione non è una patente: controllo stradale, multa all\'azienda e furgone sequestrato per un giorno.' },
      { testo: 'Lo licenzio: doveva saperlo', rep: -1, soldi: 0, fai: c => licenziaPer(c.id), esito: 'Licenziato per una svista: gli altri non l\'hanno presa bene.' + BUCO },
    ] },
  { id: 'g-rissa', grave: true, puo: () => !!autistaConFurgone(), prepara: () => { const a = autistaConFurgone(); return { id: a.id, nome: a.nome }; },
    mittente: () => 'Ufficio reclami', oggetto: c => `${c.nome} ha spintonato un cliente`,
    testo: c => `Un cliente ha denunciato che ${c.nome}, durante una consegna, lo ha insultato e spintonato dopo una discussione sul pacco. C'è un video del citofono.`,
    scelte: [
      { testo: 'Lo licenzio', rep: 3, soldi: 0, fai: c => licenziaPer(c.id), esito: 'Licenziato. Il cliente ha ritirato la denuncia contro l\'azienda.' + BUCO },
      { testo: 'Lo sospendo 5 giorni e mi scuso col cliente', rep: 1, soldi: -300, fai: c => sospendi(c.id, 5), esito: 'Cinque giorni a casa senza stipendio, scuse e un buono al cliente. Il suo furgone è fermo intanto.' },
      { testo: 'Difendo il mio autista', rep: -5, soldi: -1500, fai: () => {}, esito: 'Il video è finito online. Causa persa e titolo sul giornale locale.' },
    ] },
  { id: 'g-infortunio', grave: true, puo: () => !!unMagazziniere(), prepara: () => { const a = unMagazziniere(); return { id: a.id, nome: a.nome }; },
    mittente: () => 'Responsabile magazzino', oggetto: c => `${c.nome} si è fatto male al lavoro`,
    testo: c => `${c.nome} si è schiacciato una mano con un bancale. Non aveva i guanti: quelli in magazzino sono finiti da settimane. Starà a casa 10 giorni. Ci chiede di dichiararlo come infortunio sul lavoro.`,
    scelte: [
      { testo: 'Lo dichiaro e compro le protezioni per tutti', rep: 4, soldi: -1800, fai: c => sospendi(c.id, 10), esito: 'Infortunio dichiarato, guanti e scarpe nuove per tutti. 10 giorni senza di lui: lo smistamento rallenta.' },
      { testo: 'Lo dichiaro, ma scrivo che non indossava i guanti', rep: -3, soldi: -3000, fai: c => sospendi(c.id, 10), esito: 'I guanti li deve fornire l\'azienda, e in magazzino erano finiti: l\'Ispettorato ha multato te, non lui.' },
      { testo: 'Gli chiedo di dire che si è fatto male a casa', rep: -6, soldi: -4000, fai: c => sospendi(c.id, 10), esito: 'Ha detto la verità all\'Ispettorato del lavoro: multa pesante e brutta figura.' },
    ] },
  { id: 'g-freni', grave: true, puo: () => S.furgoni.some(f => f.zona && f.autistaId), prepara: () => { const f = scegli(S.furgoni.filter(x => x.zona && x.autistaId)); return { furgone: f.id, nome: modello(f.modello).nome, autista: (dipendente(f.autistaId) || {}).nome || 'L\'autista' }; },
    mittente: c => `${c.autista} · autista`, oggetto: c => `I freni del ${c.nome} non vanno`,
    testo: c => `Capo, i freni del ${c.nome} fanno un rumore strano e a volte il pedale va giù troppo. Oggi ho rischiato. Il meccanico dice che servono 3 giorni e 1.400 €.`,
    scelte: [
      { testo: 'Lo fermo e lo riparo', rep: 3, soldi: -1400, fai: c => { const f = S.furgoni.find(x => x.id === c.furgone); if (f) { f.fermo = 3; f.motivo = 'riparazione freni'; f.fermoDal = S.giorno; } }, esito: 'Tre giorni fermo: un jolly può coprire la zona. Poi furgone sicuro.' },
      { testo: 'Lo faccio girare piano, solo in città, finché il meccanico ha posto', rep: -4, soldi: 0, fai: c => { const f = S.furgoni.find(x => x.id === c.furgone); if (f) f.difettoFino = S.giorno + 30; }, esito: 'Per un mese quel furgone ha il doppio dei rischi di incidente. E l\'autista lo racconta a tutti.' },
    ] },
  { id: 'g-concorrente', grave: true, puo: () => !!autistaConFurgone(), prepara: () => { const a = autistaConFurgone(); return { id: a.id, nome: a.nome, stip: a.stipendio }; },
    mittente: c => `${c.nome} · autista`, oggetto: () => 'Un concorrente mi offre di più',
    testo: c => `Ciao, sono il tuo autista con più esperienza su ${zonaDi(c.id)}. Un concorrente mi offre 350 € in più al mese. Mi trovo bene da te, ma ho una famiglia. Se non puoi, mi licenzio a fine settimana.`,
    scelte: [
      { testo: 'Gli aumento lo stipendio di 350 €', rep: 2, soldi: 0, fai: c => { const d = dipendente(c.id); if (d) d.stipendio += 350; }, esito: 'Resta, contento. Lo stipendio sale di 350 € al mese.' },
      { testo: 'Gli offro 150 € e un giorno libero in più al mese', rep: 1, soldi: 0, fai: c => { const d = dipendente(c.id); if (d) d.stipendio += 150; }, esito: 'Ha accettato il compromesso.' },
      { testo: 'Lo lascio andare', rep: -1, soldi: 0, fai: c => licenziaPer(c.id), esito: 'Se n\'è andato dal concorrente, con i suoi clienti affezionati.' + BUCO },
    ] },
  { id: 'g-ransomware', grave: true, puo: () => true, prepara: () => ({}),
    mittente: () => 'Ufficio IT', oggetto: () => 'Attacco informatico: server bloccati',
    testo: () => `Un virus ha cifrato i server: gestionale, tracking e indirizzi di consegna sono bloccati. Gli hacker chiedono 15.000 € in criptovalute. Il backup è di 3 giorni fa.`,
    scelte: [
      { testo: 'Ripristino subito il backup per ripartire', rep: 0, soldi: -3500, fai: () => {}, esito: 'Il virus era ancora nella rete: ha cifrato di nuovo tutto, backup compreso. Altri tre giorni persi e un tecnico pagato il doppio.' },
      { testo: 'Isolo i server, faccio bonificare, poi ripristino e denuncio', rep: 3, soldi: -2500, fai: () => {}, esito: 'Un giorno in più di lavoro manuale, ma il virus è stato tolto prima di ripristinare: tutto recuperato. Ora c\'è un backup ogni notte.' },
      { testo: 'Pago il riscatto', rep: -4, soldi: -15000, fai: () => {}, esito: 'Hanno sbloccato solo metà dei dati e un mese dopo ci hanno riprovato.' },
    ] },
  { id: 'g-caporalato', grave: true, puo: () => S.dipendenti.length >= 3, prepara: () => ({}),
    mittente: () => 'Agenzia LavoroSubito', oggetto: () => 'Autisti a 5 € l\'ora, senza contratto',
    testo: () => `Possiamo fornirvi autisti a 5 € l'ora, pagati in contanti, senza contratti né contributi. Risparmio garantito del 60% sul personale. Ne mandiamo quanti volete da lunedì.`,
    scelte: [
      { testo: 'Rifiuto e segnalo all\'Ispettorato del lavoro', rep: 5, soldi: 0, fai: () => {}, esito: 'L\'agenzia è stata chiusa. Il sindacato ti ha ringraziato pubblicamente.' },
      { testo: 'Rifiuto e basta', rep: 1, soldi: 0, fai: () => {}, esito: 'Non ti sei sporcato le mani.' },
      { testo: 'Li prendo per i picchi: il contratto è loro, la responsabilità pure', rep: -8, soldi: -6000, fai: () => {}, esito: 'Chi usa quei lavoratori risponde insieme all\'agenzia: controllo dei Carabinieri, lavoro nero e sfruttamento. Multa enorme e notizia ovunque.' },
    ] },
];
function trovaEmail(id) { return EMAIL.find(x => x.id === id) || EMAIL_GRAVI.find(x => x.id === id) || EMAIL_LAMENTELE.find(x => x.id === id); }

// al massimo una email grave al mese, in un giorno a caso dopo il 5 del mese
function forseEmailGrave() {
  if (S.furgoni.length < 2) return;
  const d = dataDelGiorno(S.giorno), mese = d.getFullYear() + '-' + d.getMonth();
  if (S.meseGrave === mese || d.getDate() < 5) return;
  if (d.getDate() < 25 && Math.random() > 0.15) return;
  const usate = (S.postaUsate || []).slice(-12);
  const possibili = EMAIL_GRAVI.filter(e => e.puo() && !usate.includes(e.id));
  if (!possibili.length) return;
  const e = scegli(possibili), ctx = e.prepara();
  S.meseGrave = mese;
  S.posta.unshift({ id: e.id, grave: true, ctx, mag: ctx && ctx.id && dipendente(ctx.id) ? magDi(dipendente(ctx.id)) : magPerEmail(), giorno: S.giorno, scadenza: S.giorno + POSTA.giorniPerRispondere,
    mittente: e.mittente(ctx), oggetto: e.oggetto(ctx), testo: e.testo(ctx), letta: false, risposta: null, esito: '', ordine: mescola(e.scelte) });
  notizia(`Email urgente: "${S.posta[0].oggetto}". Decidi nella scheda Posta.`, 'male', 'posta-grave');
  segnaUsata(e.id);
}

// effetti che durano: rimborsi per chi ruba
function effettiDipendenti() {
  S.dipendenti.filter(d => d.ruba).forEach(d => {
    if (Math.random() < 0.25) { const n = casoInt(150, 450); movimento('eventi', -n); cambiaFama(-0.5); notizia(`Pacchi aperti in magazzino di nuovo: ${n} € di rimborsi. Sospetti su ${d.nome}.`, 'male', 'ruba-' + d.id); }
  });
}
