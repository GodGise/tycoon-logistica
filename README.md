# Tycoon Logistica – prototipo v0.1

Tycoon di logistica free to play: gestisci un'azienda di corrieri su una mappa vera, nella città che scegli tu.
Nome del gioco provvisorio.

## Giocare online

https://godgise.github.io/tycoon-logistica/ (si aggiorna da solo a ogni modifica su `main`).

## Come si avvia sul Mac

Serve internet (la mappa e la libreria MapLibre si scaricano online).

```bash
cd tycoon
python3 -m http.server 8000
```

Poi apri **http://localhost:8000** in Safari o Chrome.

Si può anche aprire `index.html` con doppio clic: funziona, ma il browser non lascia leggere
`prezzi.json` da file, quindi il gioco usa i prezzi di riserva scritti in `js/dati.js`.

La partita si salva da sola nel browser. Per ricominciare: scheda **Azienda → Ricomincia da capo**.

Il tempo scorre da solo: **ogni giornata dura 2 minuti e mezzo** (il fine settimana passa in un unico blocco da 2:30). Non si può accelerare: come nei tycoon classici, all'inizio c'è tempo per organizzarsi. Il tempo scorre solo mentre il gioco è aperto.

## Cosa c'è nella v0.1

- Mappa scura di Udine (MapLibre + stile Dark Matter di CARTO su dati OpenStreetMap), pannello in vetro con le schede Azienda, Attività, Conti, Flotta, Personale
- Qualsiasi città: la cerchi (OpenStreetMap Nominatim) e le zone si creano da sole a cerchi e spicchi intorno al centro (5 zone per le città piccole, 13 per quelle grandi)
- Magazzini dove vuoi: clicchi sulla mappa. Ogni zona parte dal magazzino più vicino e i km del giro dipendono dalla distanza. I magazzini si comprano e restano tuoi: 300.000 € in centro, fino a 200.000 € al bordo della città. Cassa iniziale 400.000 €
- Furgoni diesel ed elettrici, nuovi o usati, con riquadro Ammortamento calcolato sui prezzi della settimana
- Autisti (con esperienza che sale col tempo) e magazzinieri, con stipendio scelto tramite annuncio
- 6 € a consegna (da 5,10 a 6,90 € con la reputazione), massimo 125 consegne per corriere, 300 pacchi al giorno per magazziniere
- Contratti dei clienti: un'offerta circa ogni giornata, da accettare entro 40 secondi. Pagano più dei pacchi normali; se non consegni tutto paghi una penale
- Carichi speciali (merce refrigerata, merce pesante, animali vivi): pagano molto di più ma serve un furgone con l'allestimento giusto
- Eventi rari con una decisione da prendere entro 60 secondi: scioperi, strade chiuse, controlli della Stradale, pacchi smarriti, richieste di aumento, neve, accordi con i clienti, offerte per i tuoi furgoni
- Miglioramenti da comprare: nastro di smistamento, software per i percorsi, pubblicità, corso di guida sicura, officina interna
- A gioco chiuso l'azienda continua a lavorare (fino a 2 ore reali recuperate) e al ritorno compare il riepilogo
- Jolly: un furgone con zona "Jolly" va ogni mattina da solo nella zona con più pacchi in attesa in deposito
- Schede di dettaglio: tocca un furgone, un dipendente o un magazzino (anche sulla mappa) per statistiche del mese, del mese scorso e totali, potenziamenti e azioni
- Scheda Giri: per ogni zona pacchi del giorno, consegnati, posti sui furgoni e pacchi che aspettano in deposito
- Obiettivo del giorno con premio in denaro, "+€" che salgono dai furgoni sulla mappa
- Incidenti (riparazione a carico dell'autista, premio assicurativo che sale), guasti più frequenti sull'usato
- Busta paga e assicurazione a fine mese, giacenze che fanno scendere la reputazione
- Furgoni animati sulla mappa, feed attività raggruppato, importi formattati in italiano

Non ancora inclusi (previsti dal documento): jolly a chiamata, furgone di riserva, eventi rari dei dipendenti, ricarica alla colonnina.

## File

| File | Cosa fa |
|---|---|
| `index.html` | La pagina del gioco |
| `css/style.css` | Grafica: mappa a tutto schermo, pannello in vetro |
| `js/dati.js` | **Numeri da tarare**: prezzi furgoni, costanti di bilanciamento |
| `js/citta.js` | Ricerca città e generazione automatica delle zone |
| `js/gioco.js` | Simulazione (un giorno alla volta), senza grafica |
| `js/mappa.js` | Mappa, zone colorate, furgoni animati |
| `js/ui.js` | Pannello, schede, ciclo di gioco |
| `prezzi.json` | Prezzi della settimana letti all'avvio |
| `scripts/aggiorna_prezzi.py` | Scarica i dati MIMIT (gasolio, media self FVG) e GME (PUN Index) e scrive `prezzi.json` |
| `.github/workflows/prezzi.yml` | Fa girare lo script ogni martedì con GitHub Actions e committa `prezzi.json` |

## Prezzi settimanali con GitHub Actions

1. Carica la cartella in una repo GitHub.
2. Vai su **Actions → Aggiorna prezzi settimanali → Run workflow** per la prima prova.
3. Da lì in poi gira da solo ogni martedì.

Per provarlo in locale: `pip install pypdf` e poi `python3 scripts/aggiorna_prezzi.py`.

Note sulle fonti:
- MIMIT: dal 10 febbraio 2026 i CSV usano `|` come separatore; lo script gestisce anche il vecchio `;`.
- GME: il PUN si legge dal report settimanale in PDF. Se GME cambia il nome dei file, lo script tiene il valore della settimana prima e lo scrive in `note`.
- La mappa CARTO è gratuita per progetti non commerciali con traffico limitato: se il gioco cresce, valutare un server di tile proprio o un altro fornitore.

## Da tarare

Prezzi dei furgoni (provvisori, da verificare con i listini), stipendi, pacchi per zona,
capacità dei magazzinieri, aumento del premio per incidente: tutto in `js/dati.js`.
