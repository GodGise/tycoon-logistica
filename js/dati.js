/* Tycoon Logistica – dati di base (catalogo, zone, costanti di bilanciamento).
   Tutti i numeri qui sono PROVVISORI: vanno tarati durante i test. */

const COSTANTI = {
  cassaIniziale: 400000,          // basta per il primo magazzino (fino a 300.000 €), un furgone e i primi stipendi
  euroPerConsegna: 6,             // tariffa base; con la reputazione va da 5,10 a 6,90 €.
                                  // Alta per un gioco: un furgone usato si ripaga in circa 1 ora reale
  maxConsegneCorriere: 125,       // oltre restano pacchi in giacenza
  pacchiMagazziniere: 300,        // pacchi smistati al giorno da un magazziniere
  secondiPerGiorno: 150,          // ogni giornata dura 2 minuti e mezzo reali, senza possibilità di accelerare
  // il fine settimana (sabato + domenica) passa in un unico blocco da 3 minuti
  assicurazioneMensile: 150,      // per furgone, premio base
  aumentoPremioIncidente: 0.25,   // +25% al premio di QUEL furgone per ogni incidente. Non scende più:
                                  // se sale troppo conviene vendere il furgone e comprarne un altro
  costoAnnuncio: 50,              // pubblicare un annuncio di lavoro
  // prezzo della ricarica = PUN all'ingrosso (dato reale) + una quota fissa per reti, oneri e tasse
  oneriDeposito: 0.10,            // €/kWh in più sul PUN: ricarica lenta in deposito
  oneriColonnina: 0.45,           // €/kWh in più sul PUN: colonnina veloce (non ancora usata)
  valoreRivendita: 0.5,
  // i magazzini si comprano e restano tuoi: in centro costano di più, in periferia meno
  prezzoMagazzinoMax: 300000,     // in pieno centro
  prezzoMagazzinoMin: 200000,     // al bordo della città
  rivenditaMagazzino: 0.7,        // vendendolo recuperi il 70% del prezzo
  distanzaMaxMagazzino: 1.6,      // in multipli del raggio della città
  fattoreStrada: 1.3,             // km su strada rispetto alla linea d'aria
};

// Prezzi di riserva, usati se prezzi.json non si può leggere (es. aprendo il file con doppio clic).
const PREZZI_RISERVA = {
  settimana: 'valori di riserva',
  diesel_eur_litro: 1.68,
  pun_eur_kwh: 0.12,
  fonte: 'Valori indicativi inseriti a mano',
};

// Nomi storpiati, nessun logo vero. Prezzi ispirati a quelli reali, DA VERIFICARE.
const CATALOGO = [
  { id: 'pacato',   nome: 'Pacato Fiatt',   tipo: 'diesel',    prezzo: 32000, consumo: 8.6, manutKm: 0.065 },
  { id: 'epacato',  nome: 'e-Pacato',       tipo: 'elettrico', prezzo: 44000, consumo: 24,  manutKm: 0.030 },
  { id: 'daily',    nome: 'Ivecco Daylì',   tipo: 'diesel',    prezzo: 38000, consumo: 9.4, manutKm: 0.070 },
  { id: 'trancit',  nome: 'Ford Trancit',   tipo: 'diesel',    prezzo: 34000, consumo: 8.2, manutKm: 0.062 },
  { id: 'sprinta',  nome: 'Mercedez Sprinta', tipo: 'diesel',  prezzo: 42000, consumo: 8.0, manutKm: 0.068 },
  { id: 'mastre',   nome: 'Renò Mastre',    tipo: 'diesel',    prezzo: 31000, consumo: 8.9, manutKm: 0.066 },
];
const SCONTO_USATO = 0.45;          // l'usato costa il 45% del nuovo
const GUASTO_GIORNO = { nuovo: 0.003, usato: 0.018 };

const NOMI = ['Marco','Luca','Sara','Giulia','Davide','Elena','Matteo','Chiara','Andrea','Francesca','Simone','Martina','Alessio','Valentina','Nicola','Ilaria','Stefano','Federica','Paolo','Anna','Enrico','Laura','Riccardo','Silvia','Omar','Ana','Bogdan','Fatima'];
const COGNOMI = ['Rossi','Zanin','Del Fabbro','Comelli','Tonutti','Petris','Bressan','Cossio','Zuliani','Fabris','Moro','Pittana','Venuti','Coos','Marcuzzi','Gervasi','Popescu','Iacuzzi','Sabbadini','Bertossi'];

const RUOLI = {
  autista:      { nome: 'Autista',      stipMin: 1400, stipMax: 2600, stipDefault: 1850 },
  magazziniere: { nome: 'Magazziniere', stipMin: 1300, stipMax: 2200, stipDefault: 1600 },
};
