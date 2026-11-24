/* Tycoon Logistica – posta: ogni lunedì e giovedì arriva una email con una decisione da prendere.
   Le scelte non sono banali: quella giusta alza la reputazione, a volte costa soldi subito.
   Se non rispondi entro una settimana l'email scade e perdi 1 punto di reputazione. */

const POSTA = { giorniSettimana: [1, 4], giorniPerRispondere: 7 };   // lunedì e giovedì

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
  { id: 'fattura-falsa', mittente: 'Ufficio legale · Corriere Rapido Srl', oggetto: 'Diffida: pagamento fattura scaduta',
    testo: () => `Vi diffidiamo dal ritardare ancora il pagamento della fattura n. 4471 da 2.900 € per "servizi di trasporto". In allegato il file fattura.zip. In mancanza di pagamento procederemo per vie legali.`,
    scelte: [
      { testo: 'Apro l\'allegato per capire', rep: -5, soldi: -3000, esito: 'Lo zip conteneva un virus che ha bloccato i computer dell\'ufficio per due giorni. Tecnico, ritardi e clienti senza tracking.' },
      { testo: 'Controllo in contabilità senza aprire nulla', rep: 3, soldi: 0, esito: 'Nessuna fattura 4471, nessun rapporto con quell\'azienda: era una truffa. Email segnalata e cancellata.' },
      { testo: 'Pago per evitare problemi', rep: -3, soldi: -2900, esito: 'Soldi spariti su un conto estero. Il commercialista non era per niente contento.' },
    ] },
  { id: 'password', mittente: 'Ufficio IT', oggetto: 'Tutti usano la stessa password',
    testo: () => `Abbiamo scoperto che tutti gli autisti accedono al gestionale con la stessa password, "corriere123", scritta su un foglio in magazzino. Proposta: account personali con autenticazione a due fattori.`,
    scelte: [
      { testo: 'Sì, account personali e 2FA per tutti', rep: 3, soldi: -1200, esito: 'Un pomeriggio di formazione e qualche lamentela, poi tutto liscio. Un mese dopo un ex dipendente ha provato ad entrare: bloccato.' },
      { testo: 'Cambio solo la password comune', rep: -1, soldi: 0, esito: 'La nuova password è finita su un altro foglio, attaccato allo stesso muro.' },
      { testo: 'Lascio così, funziona', rep: -4, soldi: -1800, esito: 'Qualcuno da fuori è entrato e ha cambiato gli indirizzi di consegna di una ventina di pacchi. Rimborsi e figuraccia.' },
    ] },
  { id: 'dati-clienti', mittente: 'Agenzia Marketing Plus', oggetto: 'Compriamo la vostra lista clienti',
    testo: () => `Vi offriamo 5.000 € per la lista con nomi, indirizzi e telefoni dei destinatari dei vostri pacchi. Ci serve per campagne pubblicitarie. Massima discrezione.`,
    scelte: [
      { testo: 'Vendo, 5.000 € fanno comodo', rep: -6, soldi: -6000, esito: 'Violazione del GDPR: il Garante della privacy ti ha multato e la notizia è uscita sui giornali.' },
      { testo: 'Rifiuto: i dati dei clienti non si vendono', rep: 3, soldi: 0, esito: 'Risposta netta. Un grande cliente business ha scelto te proprio perché tratti bene i dati.' },
    ] },
  { id: 'pacco-sospetto', mittente: () => `${nomeMagazziniere()} · magazzino`, oggetto: 'Pacco strano allo smistamento',
    testo: () => `C'è un pacco che perde polvere bianca e ha un odore chimico. Il mittente è sconosciuto. Lo carichiamo lo stesso? Il destinatario lo aspetta per oggi.`,
    scelte: [
      { testo: 'Lo isolo e chiamo le autorità', rep: 4, soldi: -300, esito: 'Era un prodotto per piscine mal imballato e irritante. Hanno ringraziato per la prudenza; un\'ora di stop allo smistamento.' },
      { testo: 'Lo carico, non è affar nostro', rep: -5, soldi: -1500, esito: 'Il pacco si è rotto nel furgone: autista intossicato leggermente e furgone da bonificare.' },
      { testo: 'Lo rimando al mittente senza dire niente', rep: -1, soldi: 0, esito: 'Il mittente era irraggiungibile: il pacco è rimasto in giro per giorni.' },
    ] },
  { id: 'auto-elettriche', mittente: () => `Comune di ${S.citta.nome} · Mobilità`, oggetto: 'Incentivi per furgoni elettrici',
    testo: () => `Il Comune finanzia il 30% di chi sostituisce un furgone diesel con uno elettrico entro fine anno. In cambio chiede di pubblicare i dati delle emissioni risparmiate.`,
    scelte: [
      { testo: 'Partecipo e pubblico i dati', rep: 4, soldi: 2500, esito: 'Contributo arrivato e logo dell\'azienda nella campagna "Città pulita" del Comune.' },
      { testo: 'Partecipo ma senza pubblicare nulla', rep: 0, soldi: 0, esito: 'Senza i dati il contributo non spetta. Tempo perso.' },
      { testo: 'Non mi interessa', rep: -1, soldi: 0, esito: 'Un concorrente ha preso il contributo e la visibilità.' },
    ] },
  { id: 'assunzione-amico', mittente: 'Tuo cugino Marco', oggetto: 'Mi assumi?',
    testo: () => `Ciao! Ho perso il lavoro e mi servirebbe qualcosa subito. Non ho la patente C né esperienza, ma imparo in fretta. Mi metti a fare l'autista?`,
    scelte: [
      { testo: 'Lo assumo come autista subito', rep: -3, soldi: -1200, esito: 'Senza esperienza ha rigato due furgoni nella prima settimana, e i colleghi hanno parlato di favoritismi.' },
      { testo: 'Gli offro di iniziare in magazzino e fare il corso', rep: 3, soldi: -400, esito: 'Ha iniziato dal basso, ha fatto il corso e dopo due mesi guidava bene. I colleghi lo rispettano.' },
      { testo: 'Gli dico di no', rep: 0, soldi: 0, esito: 'Ci è rimasto male, ma l\'azienda non ne risente.' },
    ] },
  { id: 'sciopero-solidale', mittente: 'Coordinamento corrieri', oggetto: 'Sciopero nazionale dei rider venerdì',
    testo: () => `Venerdì c'è uno sciopero nazionale per i diritti dei corrieri delle piattaforme. Vi chiediamo di non sostituire i rider in sciopero prendendo le loro consegne.`,
    scelte: [
      { testo: 'Non prendo le loro consegne', rep: 3, soldi: -500, esito: 'Hai rinunciato a qualche consegna extra, ma i sindacati e molti clienti lo hanno apprezzato.' },
      { testo: 'Prendo tutte le consegne che posso', rep: -3, soldi: 1500, esito: 'Guadagno extra, ma ti hanno chiamato "crumiri" sui social per giorni.' },
    ] },
  { id: 'ritardo-cronico', mittente: () => `${nomeAutista()} · autista`, oggetto: 'Il navigatore ci manda sempre nel traffico',
    testo: () => `Il navigatore gratuito che usiamo ci fa passare sempre in centro all'ora di punta. Ho segnato io dei percorsi migliori su una mappa. Li posso far usare a tutti?`,
    scelte: [
      { testo: 'Sì, e lo premio per l\'idea', rep: 3, soldi: -300, esito: 'Giri più corti, autisti più motivati: la sua mappa ora è in tutti i furgoni.' },
      { testo: 'No, si usa il navigatore e basta', rep: -2, soldi: -400, esito: 'I ritardi continuano e l\'autista ha smesso di proporre idee.' },
    ] },
  { id: 'cliente-urla', mittente: 'Centralino', oggetto: 'Cliente furioso al telefono',
    testo: () => `Un cliente urla da mezz'ora: il suo pacco risulta consegnato ma lui non l'ha ricevuto. Dalla foto di consegna il pacco è davanti alla porta del vicino. Cosa gli diciamo?`,
    scelte: [
      { testo: 'Mandiamo l\'autista a recuperarlo e ci scusiamo', rep: 4, soldi: -80, esito: 'Pacco recuperato dal vicino in un\'ora. Il cliente si è calmato e ha lasciato una recensione da 5 stelle.' },
      { testo: 'Gli mandiamo la foto: il pacco è consegnato', rep: -2, soldi: 0, esito: 'Tecnicamente vero, ma il cliente si è sentito preso in giro.' },
      { testo: 'Gli rimborsiamo il valore e chiudiamo', rep: 1, soldi: -250, esito: 'Cliente contento, ma il pacco è rimasto al vicino e hai pagato due volte.' },
    ] },
  { id: 'sponsor-squadra', mittente: () => `ASD Calcio ${S.citta.nome}`, oggetto: 'Sponsorizzazione delle maglie',
    testo: () => `La squadra giovanile cerca uno sponsor per le maglie: 2.000 € a stagione. Il vostro logo andrebbe su 120 maglie e sul pulmino.`,
    scelte: [
      { testo: 'Sponsorizzo', rep: 3, soldi: -2000, esito: 'Logo in città ogni domenica e tante famiglie che ora scelgono te per le spedizioni.' },
      { testo: 'Offro i trasporti gratis per le trasferte invece dei soldi', rep: 2, soldi: -600, esito: 'Soluzione apprezzata e più economica, un po\' meno visibilità.' },
      { testo: 'No', rep: 0, soldi: 0, esito: 'Nessun costo, nessun effetto.' },
    ] },
  { id: 'peso-falso', mittente: 'Ufficio fatturazione', oggetto: 'Un cliente dichiara pesi sbagliati',
    testo: () => `Un grosso cliente e-commerce dichiara sempre pesi più bassi del vero: paghiamo il carburante del peso vero ma incassiamo quello dichiarato. È il nostro terzo cliente per volume.`,
    scelte: [
      { testo: 'Gli parlo e propongo di pesare tutto in magazzino', rep: 2, soldi: 1800, esito: 'All\'inizio ha protestato, poi ha accettato. Da ora le fatture sono giuste.' },
      { testo: 'Lascio stare, non voglio perderlo', rep: -1, soldi: -1200, esito: 'Continui a perderci soldi ogni mese, e gli altri clienti ne pagano il conto con i prezzi.' },
      { testo: 'Gli fatturo il triplo per punirlo', rep: -3, soldi: -500, esito: 'Ha contestato le fatture e se n\'è andato da un concorrente.' },
    ] },
  { id: 'notturno', mittente: 'Logistica · Supermercati Freschi', oggetto: 'Consegne di notte ai negozi',
    testo: () => `Vorremmo consegne tra le 4 e le 6 del mattino nei nostri 8 negozi. Paghiamo bene, ma servono autisti disposti a lavorare di notte con turni fissi.`,
    scelte: [
      { testo: 'Accetto con autisti volontari e indennità notturna', rep: 3, soldi: 3500, esito: 'Due autisti si sono offerti: lavoro ben pagato e cliente fisso.' },
      { testo: 'Accetto e sposto chi capita', rep: -3, soldi: 4500, esito: 'Più soldi, ma autisti stanchi e un incidente alle 5 del mattino.' },
      { testo: 'Rifiuto', rep: 0, soldi: 0, esito: 'Hanno trovato un altro fornitore.' },
    ] },
  { id: 'social-autista', mittente: 'Ufficio comunicazione', oggetto: 'Un autista è diventato virale',
    testo: () => `Un tuo autista ha pubblicato un video sui social mentre canta in furgone durante le consegne. 200.000 visualizzazioni. Alcuni dicono che è simpatico, altri che guidava col telefono in mano.`,
    scelte: [
      { testo: 'Lo ringrazio ma gli ricordo: mai telefono alla guida', rep: 3, soldi: 0, esito: 'Ha rifatto il video da fermo, con la cintura e il furgone parcheggiato. Ancora più visualizzazioni e messaggio giusto.' },
      { testo: 'Lo licenzio per immagine', rep: -3, soldi: 0, esito: 'I follower si sono schierati con lui: "Licenziato perché cantava".' },
      { testo: 'Lo uso come pubblicità così com\'è', rep: -2, soldi: 0, esito: 'Commenti pieni di "guida col telefono!". La Polizia Locale ha condiviso il video come esempio sbagliato.' },
    ] },
  { id: 'nevicata', mittente: 'Protezione Civile', oggetto: 'Allerta neve per domani',
    testo: () => `Domani è prevista neve abbondante. Le strade di periferia potrebbero essere chiuse. Si consiglia di limitare gli spostamenti non necessari.`,
    scelte: [
      { testo: 'Avviso i clienti e sposto i pacchi non urgenti', rep: 3, soldi: -200, esito: 'Clienti avvisati prima: nessuna lamentela e nessun furgone bloccato nella neve.' },
      { testo: 'Tutti fuori come sempre', rep: -3, soldi: -1500, esito: 'Due furgoni bloccati in collina, carro attrezzi e pacchi in ritardo lo stesso.' },
      { testo: 'Chiudo tutto domani', rep: -1, soldi: 0, esito: 'Prudente, ma anche le zone centrali senza neve sono rimaste senza consegne.' },
    ] },
  { id: 'magazzino-sporco', mittente: 'ASL · Ufficio Igiene', oggetto: 'Ispezione al magazzino tra una settimana',
    testo: () => `Vi comunichiamo che tra una settimana faremo un'ispezione igienico-sanitaria del vostro magazzino, con particolare attenzione ai locali per il personale e alle uscite di sicurezza.`,
    scelte: [
      { testo: 'Pulizia, controllo estintori e uscite libere', rep: 3, soldi: -800, esito: 'Ispezione superata senza rilievi. Il personale ha notato il magazzino più ordinato.' },
      { testo: 'Pulisco solo dove guarderanno', rep: -2, soldi: -1500, esito: 'Gli ispettori hanno aperto proprio l\'uscita di sicurezza bloccata dai bancali: sanzione.' },
    ] },
  { id: 'consulente', mittente: 'Dott. Ferri · Consulenze aziendali', oggetto: 'Raddoppio il vostro fatturato in 30 giorni',
    testo: () => `Con il mio metodo esclusivo raddoppio il fatturato di qualsiasi corriere in 30 giorni. Investimento: 9.000 € anticipati. Posti limitati, rispondete entro oggi!`,
    scelte: [
      { testo: 'Pago, se funziona è un affare', rep: -2, soldi: -9000, esito: 'Ti ha mandato un PDF di 10 pagine scaricato da internet. Il fatturato è rimasto uguale.' },
      { testo: 'Chiedo referenze e risultati verificabili', rep: 1, soldi: 0, esito: 'Nessuna referenza vera. Non hai pagato nulla.' },
      { testo: 'Cestino', rep: 0, soldi: 0, esito: 'Tempo risparmiato.' },
    ] },
  { id: 'gara-appalto', mittente: () => `Ospedale di ${S.citta.nome} · Ufficio gare`, oggetto: 'Gara per il trasporto di campioni',
    testo: () => `Cerchiamo un corriere per trasportare campioni di laboratorio tra i nostri reparti e due cliniche. Servono puntualità al minuto e furgoni dedicati. Contratto di 2 anni.`,
    scelte: [
      { testo: 'Partecipo con un\'offerta seria e furgoni dedicati', rep: 4, soldi: 2500, esito: 'Gara vinta: contratto stabile e un cliente che dà prestigio.' },
      { testo: 'Partecipo con il prezzo più basso possibile', rep: -2, soldi: -500, esito: 'Vinta, ma al prezzo offerto ci perdi. Ritardi e penali nei primi mesi.' },
      { testo: 'Non partecipo', rep: 0, soldi: 0, esito: 'L\'ha vinta un concorrente.' },
    ] },
  { id: 'molestie', mittente: () => `${nomeMagazziniere()} · magazzino`, oggetto: 'Una segnalazione delicata',
    testo: () => `Una collega mi ha detto che un caposquadra le fa commenti pesanti da settimane. Lei ha paura di parlarne. Io ti scrivo perché non so cosa fare.`,
    scelte: [
      { testo: 'Ascolto lei in privato e avvio una verifica seria', rep: 4, soldi: -500, esito: 'La verifica ha confermato i fatti: provvedimento disciplinare e un referente esterno per le segnalazioni. Il clima è migliorato.' },
      { testo: 'Chiedo al caposquadra cosa ne pensa', rep: -4, soldi: 0, esito: 'Il caposquadra ha capito chi aveva parlato. La collega si è licenziata.' },
      { testo: 'Lascio che se la vedano tra loro', rep: -5, soldi: -2000, esito: 'La collega ha fatto causa all\'azienda.' },
    ] },
  { id: 'carburante-rubato', mittente: 'Ufficio controllo costi', oggetto: 'Il gasolio non torna',
    testo: () => `Un furgone consuma il 40% in più degli altri sullo stesso giro. Le ricevute del distributore hanno orari strani. Sospettiamo che qualcuno faccia il pieno anche alla propria auto.`,
    scelte: [
      { testo: 'Verifico con i dati e parlo con l\'autista', rep: 2, soldi: 900, esito: 'Le prove erano chiare: l\'autista ha ammesso e restituito i soldi. Ora le carte carburante hanno un limite.' },
      { testo: 'Licenzio subito l\'autista di quel furgone', rep: -2, soldi: 0, esito: 'Il furgone era usato anche da un altro collega: hai licenziato la persona sbagliata.' },
      { testo: 'Ignoro, sono pochi soldi', rep: -1, soldi: -900, esito: 'I consumi strani sono continuati e si sono estesi ad altri furgoni.' },
    ] },
  { id: 'cliente-nero', mittente: 'Cliente nuovo · import-export', oggetto: 'Spedizioni senza bolle',
    testo: () => `Abbiamo un grosso volume di scatole da distribuire ogni settimana. Paghiamo in contanti, ma senza documenti di trasporto e senza sapere cosa c'è dentro. Interessati?`,
    scelte: [
      { testo: 'Accetto, pagano bene', rep: -6, soldi: -4000, esito: 'Le scatole contenevano merce contraffatta. Sequestro, furgone fermo e indagine.' },
      { testo: 'Solo con documenti e contenuto dichiarato', rep: 2, soldi: 0, esito: 'Sono spariti. Meglio così.' },
    ] },
  { id: 'meteo-caldo', mittente: () => `${nomeAutista()} · autista`, oggetto: 'Nei furgoni si muore di caldo',
    testo: () => `Con questo caldo nei furgoni vecchi senza aria condizionata arriviamo a 40 gradi. Ieri un collega si è sentito male. Si può fare qualcosa?`,
    scelte: [
      { testo: 'Acqua, pause più lunghe e giri al mattino presto', rep: 3, soldi: -400, esito: 'Nessun malore e consegne lo stesso in orario. Gli autisti l\'hanno apprezzato molto.' },
      { testo: 'Compro climatizzatori per tutti i furgoni vecchi', rep: 3, soldi: -2500, esito: 'Spesa grossa ma risolta per sempre. Ottimo per il morale.' },
      { testo: 'D\'estate fa caldo, è normale', rep: -4, soldi: -800, esito: 'Un altro malore, ambulanza e un giorno di consegne perso.' },
    ] },
  { id: 'recesso', mittente: 'Grande cliente · ModaFast', oggetto: 'Vi lasciamo per un concorrente',
    testo: () => `Il vostro concorrente ci offre il 15% in meno. Se non pareggiate l'offerta da lunedì spostiamo tutte le spedizioni.`,
    scelte: [
      { testo: 'Chiedo un incontro e punto sulla qualità, sconto piccolo', rep: 2, soldi: -500, esito: 'Ti hanno dato ragione sulla qualità: sconto del 5% e cliente tenuto.' },
      { testo: 'Pareggio subito il 15%', rep: 0, soldi: -2000, esito: 'Cliente tenuto, ma ora ci guadagni pochissimo.' },
      { testo: 'Li lascio andare', rep: -1, soldi: -1500, esito: 'Persi i volumi. Tre mesi dopo sono tornati, scontenti del concorrente.' },
    ] },
  { id: 'formazione-sicurezza', mittente: 'Consulente sicurezza sul lavoro', oggetto: 'Corso antincendio scaduto',
    testo: () => `Il corso antincendio e primo soccorso del personale di magazzino è scaduto da 6 mesi. È obbligatorio per legge. Possiamo organizzarlo il prossimo sabato.`,
    scelte: [
      { testo: 'Lo organizzo e pago il sabato come straordinario', rep: 3, soldi: -900, esito: 'Corso fatto. Due settimane dopo un principio d\'incendio è stato spento in 30 secondi.' },
      { testo: 'Lo rimando a fine anno', rep: -2, soldi: -1200, esito: 'Un controllo dell\'Ispettorato ha trovato il corso scaduto: multa.' },
    ] },
  { id: 'regalo-cliente', mittente: 'Ditta Rossi Arredamenti', oggetto: 'Un pensiero per lei',
    testo: () => `Per ringraziarla della collaborazione le abbiamo fatto recapitare un orologio di valore. Speriamo continui a darci la precedenza nelle consegne e qualche sconto.`,
    scelte: [
      { testo: 'Lo restituisco con un grazie', rep: 3, soldi: 0, esito: 'Restituito con garbo. Il rapporto è rimasto ottimo e trasparente.' },
      { testo: 'Lo tengo e do loro la precedenza', rep: -4, soldi: 0, esito: 'Gli altri clienti hanno notato i ritardi e qualcuno ha capito il perché.' },
      { testo: 'Lo tengo ma non cambio nulla', rep: -1, soldi: 0, esito: 'Si aspettavano un favore che non è arrivato: rapporto rovinato.' },
    ] },
  { id: 'disabile', mittente: 'Ufficio personale', oggetto: 'Candidato in sedia a rotelle',
    testo: () => `Per il ruolo di addetto allo smistamento si è candidata una persona in sedia a rotelle con ottime referenze. Servirebbe adattare una postazione (circa 1.500 €).`,
    scelte: [
      { testo: 'La assumo e adatto la postazione', rep: 4, soldi: -1500, esito: 'Si è rivelata una delle più precise del magazzino. Hai anche ottenuto un contributo pubblico per la postazione.' },
      { testo: 'Scelgo un altro candidato per evitare la spesa', rep: -3, soldi: 0, esito: 'La candidata ha raccontato la cosa e un\'associazione ne ha parlato pubblicamente.' },
    ] },
];

function nomeAutista() { const a = S.dipendenti.filter(d => d.ruolo === 'autista'); return a.length ? scegli(a).nome : 'Un autista'; }
function nomeMagazziniere() { const a = S.dipendenti.filter(d => d.ruolo === 'magazziniere'); return a.length ? scegli(a).nome : 'Un magazziniere'; }
function testoDi(v) { return typeof v === 'function' ? v() : v; }

// chiamata all'inizio di ogni giornata lavorativa
function controllaPosta() {
  S.posta = S.posta || [];
  // a gioco chiuso le email non scadono: aspettano che torni
  if (S.recuperoOffline) S.posta.filter(m => m.risposta === null).forEach(m => { m.scadenza = Math.max(m.scadenza, S.giorno + 1); });
  // scadute dopo una settimana: nessuna scelta, solo −1 di reputazione
  S.posta.filter(m => m.risposta === null && S.giorno > m.scadenza).forEach(m => {
    m.risposta = -1; m.letta = true; m.rep = -1; m.soldi = 0; m.esito = 'Non hai risposto in tempo: il mittente è rimasto senza risposta.';
    cambiaFama(-1);
    notizia(`Email scaduta senza risposta: "${m.oggetto}". Reputazione −1.`, 'male');
  });
  if (!S.furgoni.length) return;
  // la prima email arriva subito (il primo giorno con un furgone), poi una il lunedì e una il giovedì
  if (S.posta.length && !POSTA.giorniSettimana.includes(dataDelGiorno(S.giorno).getDay())) return;
  if (S.posta.some(m => m.giorno === S.giorno)) return;
  const usate = S.posta.map(m => m.id);
  const libere = EMAIL.filter(e => !usate.slice(-EMAIL.length + 3).includes(e.id));
  const e = scegli(libere.length ? libere : EMAIL);
  S.posta.unshift({ id: e.id, giorno: S.giorno, scadenza: S.giorno + POSTA.giorniPerRispondere,
    mittente: testoDi(e.mittente), oggetto: e.oggetto, testo: testoDi(e.testo), letta: false, risposta: null, esito: '' });
  S.posta = S.posta.slice(0, 40);
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
