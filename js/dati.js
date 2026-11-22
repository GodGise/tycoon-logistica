/* Tycoon Logistica – dati di base (catalogo, zone, costanti di bilanciamento).
   Tutti i numeri qui sono PROVVISORI: vanno tarati durante i test. */

const DEPOSITO = { nome: 'Deposito Udine Sud', lng: 13.2555, lat: 46.0372 };

const COSTANTI = {
  cassaIniziale: 80000,
  euroPerConsegna: 2,
  maxConsegneCorriere: 125,       // oltre restano pacchi in giacenza
  pacchiMagazziniere: 300,        // pacchi smistati al giorno da un magazziniere
  secondiPerGiorno: 12,           // durata di un giorno di gioco a velocità 1×
  assicurazioneMensile: 150,      // per furgone, premio base
  aumentoPremioIncidente: 0.15,   // +15% al premio flotta per incidente
  rientroPremioSettimanale: 0.01, // il premio torna verso la base piano piano
  costoAnnuncio: 50,              // pubblicare un annuncio di lavoro
  fattoreDeposito: 2.0,           // PUN all'ingrosso × fattore = ricarica in deposito
  fattoreColonnina: 5.0,          // ricarica veloce (non ancora usata in v0.1)
  valoreRivendita: 0.5,
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

// Zone di Udine (poligoni approssimativi). pacchi = pacchi al giorno, km = km medi del giro.
const ZONE = [
  { id: 'centro', nome: 'Centro', colore: '#ff8a3d', pacchi: 140, km: 85,
    poligono: [[13.2215,46.0712],[13.2395,46.0738],[13.2525,46.0676],[13.2528,46.0566],[13.2380,46.0528],[13.2215,46.0560],[13.2168,46.0640]] },
  { id: 'nord', nome: 'Nord – Rizzi e Beivars', colore: '#4fb3ff', pacchi: 95, km: 110,
    poligono: [[13.2050,46.0960],[13.2400,46.1000],[13.2700,46.0900],[13.2640,46.0720],[13.2525,46.0676],[13.2395,46.0738],[13.2215,46.0712],[13.2020,46.0790]] },
  { id: 'sud', nome: 'Sud – Paparotti e Cussignacco', colore: '#b98cff', pacchi: 80, km: 120,
    poligono: [[13.2168,46.0640],[13.2215,46.0560],[13.2380,46.0528],[13.2528,46.0566],[13.2700,46.0480],[13.2650,46.0280],[13.2400,46.0240],[13.2120,46.0350],[13.2000,46.0520]] },
];

const NOMI = ['Marco','Luca','Sara','Giulia','Davide','Elena','Matteo','Chiara','Andrea','Francesca','Simone','Martina','Alessio','Valentina','Nicola','Ilaria','Stefano','Federica','Paolo','Anna','Enrico','Laura','Riccardo','Silvia','Omar','Ana','Bogdan','Fatima'];
const COGNOMI = ['Rossi','Zanin','Del Fabbro','Comelli','Tonutti','Petris','Bressan','Cossio','Zuliani','Fabris','Moro','Pittana','Venuti','Coos','Marcuzzi','Gervasi','Popescu','Iacuzzi','Sabbadini','Bertossi'];

const RUOLI = {
  autista:      { nome: 'Autista',      stipMin: 1400, stipMax: 2600, stipDefault: 1850 },
  magazziniere: { nome: 'Magazziniere', stipMin: 1300, stipMax: 2200, stipDefault: 1600 },
};
