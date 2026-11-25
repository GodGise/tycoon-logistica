/* Tycoon Logistica – account con nome utente e password: la partita si salva online
   e la ritrovi su ogni dispositivo. Archivio: Supabase (piano gratuito), solo tramite
   le funzioni di online/supabase.sql. Se ONLINE.url è vuoto il gioco resta solo locale. */

const ONLINE = {
  url: 'https://kiefpncgfgttlwmqtafk.supabase.co',
  chiave: 'sb_publishable_vsd9PzLEHjpurTW8ecLCoQ_slZH5ukn',   // chiave pubblica: è fatta per stare nel browser
};
const CHIAVE_ACCOUNT = 'tycoon-logistica-account';
const SYNC_OGNI = 30000;   // ms tra un salvataggio online e l'altro

const account = { token: null, nome: null, nuvolaIl: 0, inCorso: false, ultimo: 0, errore: '' };

function onlineAttivo() { return !!(ONLINE.url && ONLINE.chiave); }

async function rpc(funzione, argomenti, keepalive) {
  const r = await fetch(`${ONLINE.url}/rest/v1/rpc/${funzione}`, {
    method: 'POST', keepalive: !!keepalive,
    // chiave "anon" vecchia (JWT, inizia con eyJ) anche come Bearer; la nuova "publishable" (sb_publishable_…) solo come apikey
    headers: Object.assign({ apikey: ONLINE.chiave, 'Content-Type': 'application/json' }, ONLINE.chiave.startsWith('eyJ') ? { Authorization: 'Bearer ' + ONLINE.chiave } : {}),
    body: JSON.stringify(argomenti),
  });
  const testo = await r.text();
  const dati = testo ? JSON.parse(testo) : null;
  if (!r.ok) throw new Error((dati && dati.message) || 'errore ' + r.status);
  return dati;
}

const MESSAGGI_ONLINE = {
  nome_usato: 'Questo nome utente è già preso.',
  nome_non_valido: 'Il nome utente deve avere da 3 a 20 caratteri: lettere, numeri o _.',
  password_corta: 'La password deve avere almeno 6 caratteri.',
  credenziali: 'Nome utente o password sbagliati.',
  sessione: 'Sessione scaduta: accedi di nuovo.',
};
function messaggioOnline(e) {
  const m = String(e && e.message || e);
  return MESSAGGI_ONLINE[m] || (/fetch|network/i.test(m) ? 'Non riesco a collegarmi: controlla la connessione.' : 'Errore: ' + m);
}

function ricordaAccount() {
  try { account.token ? localStorage.setItem(CHIAVE_ACCOUNT, JSON.stringify({ token: account.token, nome: account.nome, nuvolaIl: account.nuvolaIl }))
    : localStorage.removeItem(CHIAVE_ACCOUNT); } catch (e) { /* ignora */ }
}

// All'avvio: riprende l'account salvato e controlla che la sessione sia ancora valida
async function avviaOnline() {
  if (!onlineAttivo()) return;
  try { Object.assign(account, JSON.parse(localStorage.getItem(CHIAVE_ACCOUNT) || '{}')); } catch (e) { /* ignora */ }
  if (!account.token) return;
  try {
    const nome = await rpc('chi_sono', { p_token: account.token });
    if (!nome) { account.token = null; account.nome = null; ricordaAccount(); return; }
    account.nome = nome;
    await allineaConNuvola();
  } catch (e) { account.errore = messaggioOnline(e); }
}

// Legge la partita online; se è più recente di quella su questo dispositivo la usa,
// altrimenti carica online quella di qui.
async function allineaConNuvola() {
  const righe = await rpc('leggi_partita', { p_token: account.token });
  const riga = righe && righe[0];
  if (riga && (!S || (riga.dati.salvatoIl || 0) > (S.salvatoIl || 0))) usaPartitaNuvola(riga);
  else if (S) await salvaOnline(true);
}

function usaPartitaNuvola(riga) {
  try { localStorage.setItem(CHIAVE_SALVATAGGIO, JSON.stringify(riga.dati)); } catch (e) { /* ignora */ }
  carica();
  account.nuvolaIl = Date.parse(riga.aggiornata); ricordaAccount();
  const r = S ? recuperaOffline() : null;
  if (r) { salva(); if (typeof mostraRiepilogoOffline === 'function') mostraRiepilogoOffline(r); }
}

// Salva online. Se un altro dispositivo ha salvato dopo di noi, prende la sua partita invece di sovrascriverla.
async function salvaOnline(forza) {
  if (!account.token || !S || account.inCorso) return null;
  account.inCorso = true;
  try {
    if (!forza) {
      const quando = await rpc('quando_partita', { p_token: account.token });
      if (quando && Date.parse(quando) > account.nuvolaIl + 1000) {
        const righe = await rpc('leggi_partita', { p_token: account.token });
        if (righe && righe[0]) { usaPartitaNuvola(righe[0]); return 'altro'; }
      }
    }
    salva();
    const ora = await rpc('salva_partita', { p_token: account.token, p_dati: S });
    account.nuvolaIl = Date.parse(ora); account.ultimo = Date.now(); account.errore = ''; ricordaAccount();
    return 'ok';
  } catch (e) {
    account.errore = messaggioOnline(e);
    if (String(e.message) === 'sessione') { account.token = null; ricordaAccount(); }
    return null;
  } finally { account.inCorso = false; }
}

async function registraAccount(nome, password) {
  try {
    account.token = await rpc('registra', { p_nome: nome.trim(), p_password: password });
    account.nome = nome.trim().toLowerCase(); account.nuvolaIl = 0; ricordaAccount();
    if (S) await salvaOnline(true);
    return null;
  } catch (e) { return messaggioOnline(e); }
}

// Accesso: se qui c'è già una partita diversa da quella online, chiede quale tenere
async function accediAccount(nome, password) {
  try {
    const token = await rpc('accedi', { p_nome: nome.trim(), p_password: password });
    const righe = await rpc('leggi_partita', { p_token: token });
    const riga = righe && righe[0];
    // con due partite diverse l'account si attiva solo dopo la scelta (così il salvataggio automatico non decide da solo)
    if (riga && S) return { ok: true, scegli: riga, token, nome: nome.trim().toLowerCase() };
    Object.assign(account, { token, nome: nome.trim().toLowerCase(), nuvolaIl: 0 }); ricordaAccount();
    if (!riga) { if (S) await salvaOnline(true); return { ok: true }; }
    usaPartitaNuvola(riga); return { ok: true };
  } catch (e) { return { errore: messaggioOnline(e) }; }
}

async function esciAccount() {
  await salvaOnline(true);
  try { await rpc('esci', { p_token: account.token }); } catch (e) { /* ignora */ }
  Object.assign(account, { token: null, nome: null, nuvolaIl: 0, errore: '' }); ricordaAccount();
}

// Ogni 30 secondi, e quando chiudi o lasci la pagina
function sincronizzaOgniTanto() {
  if (account.token && Date.now() - account.ultimo > SYNC_OGNI) { account.ultimo = Date.now(); return salvaOnline(false); }
  return null;
}
document.addEventListener('visibilitychange', async () => {
  if (!account.token) return;
  if (document.hidden) salvaOnline(false);
  else { // tornando sulla pagina: se nel frattempo hai giocato altrove, prende quella partita
    try {
      const quando = await rpc('quando_partita', { p_token: account.token });
      if (quando && Date.parse(quando) > account.nuvolaIl + 1000) {
        const righe = await rpc('leggi_partita', { p_token: account.token });
        if (righe && righe[0]) { usaPartitaNuvola(righe[0]); if (typeof dopoCambioPartita === 'function') dopoCambioPartita('Ho caricato la partita che hai giocato sull\'altro dispositivo.'); }
      }
    } catch (e) { /* offline: riprova più tardi */ }
  }
});
