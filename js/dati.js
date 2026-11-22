/* Tycoon Logistica – dati di base (catalogo, zone, costanti di bilanciamento).
   Tutti i numeri qui sono PROVVISORI: vanno tarati durante i test. */

const COSTANTI = {
  cassaIniziale: 80000,
  euroPerConsegna: 2,
  maxConsegneCorriere: 125,       // oltre restano pacchi in giacenza
  pacchiMagazziniere: 300,        // pacchi smistati al giorno da un magazziniere
  secondiPerGiorno: 180,          // ogni giornata dura 3 minuti reali, senza possibilità di accelerare
  // il fine settimana (sabato + domenica) passa in un unico blocco da 3 minuti
  assicurazioneMensile: 150,      // per furgone, premio base
  aumentoPremioIncidente: 0.15,   // +15% al premio flotta per incidente
  rientroPremioSettimanale: 0.01, // il premio torna verso la base piano piano
  costoAnnuncio: 50,              // pubblicare un annuncio di lavoro
  // prezzo della ricarica = PUN all'ingrosso (dato reale) + una quota fissa per reti, oneri e tasse
  oneriDeposito: 0.10,            // €/kWh in più sul PUN: ricarica lenta in deposito
  oneriColonnina: 0.45,           // €/kWh in più sul PUN: colonnina veloce (non ancora usata)
  valoreRivendita: 0.5,
  costoNuovoMagazzino: 5000,      // allestimento di un magazzino in più
  affittoMagazzino: 1200,         // al mese, per ogni magazzino
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
