/* Tycoon Logistica – notifiche sul telefono (web push tramite Supabase, vedi online/notifiche.sql).
   Quando chiudi il gioco programma pochi avvisi prevedibili; quando torni li cancella.
   Su iPhone funzionano solo con il gioco aggiunto alla schermata Home (iOS 16.4 o più recente). */
const CHIAVE_NOTIFICHE = 'tycoon-logistica-notifiche';
const notifiche = { stato: '', errore: '' };

function pushSupportato() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function suIphoneNelBrowser() { return /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches); }
function notificheAttive() { try { return localStorage.getItem(CHIAVE_NOTIFICHE) === 'si' && Notification.permission === 'granted'; } catch (e) { return false; } }

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

function chiaveInByte(b64) {
  const s = atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}
const base64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function attivaNotifiche() {
  notifiche.errore = '';
  if (!account.token) return (notifiche.errore = 'Accedi o registrati qui sotto: le notifiche arrivano al tuo account.');
  if (!pushSupportato()) return (notifiche.errore = suIphoneNelBrowser() ? 'Su iPhone prima aggiungi il gioco alla schermata Home (Condividi → Aggiungi alla schermata Home) e aprilo da lì.' : 'Questo browser non supporta le notifiche.');
  const permesso = await Notification.requestPermission();
  if (permesso !== 'granted') return (notifiche.errore = 'Hai negato il permesso: puoi riattivarlo dalle impostazioni del telefono.');
  try {
    const chiave = await rpc('chiave_notifiche', {});
    if (!chiave) return (notifiche.errore = 'Il server delle notifiche non è ancora pronto: riprova tra qualche minuto.');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveInByte(chiave) });
    await rpc('iscrivi_notifiche', { p_token: account.token, p_endpoint: sub.endpoint, p_p256dh: base64url(sub.getKey('p256dh')), p_auth: base64url(sub.getKey('auth')) });
    localStorage.setItem(CHIAVE_NOTIFICHE, 'si');
  } catch (e) { notifiche.errore = messaggioOnline(e); }
}

async function disattivaNotifiche() {
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { if (account.token) await rpc('disiscrivi_notifiche', { p_token: account.token, p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
  } catch (e) { /* ignora */ }
  localStorage.removeItem(CHIAVE_NOTIFICHE);
}

// prova: una notifica subito (la funzione si chiama a mano invece di aspettare il giro dei 5 minuti)
async function provaNotifica() {
  await rpc('programma_notifiche', { p_token: account.token, p_lista: [{ tra_minuti: 0, titolo: S.nomeAzienda, testo: 'Le notifiche funzionano! 🚚' }] });
  await fetch(`${ONLINE.url}/functions/v1/invia-notifiche`, { method: 'POST' }).catch(() => {});
}

// gli avvisi prevedibili da qui a qualche ora, calcolati quando chiudi il gioco
function avvisiDaProgrammare() {
  if (!S) return [];
  const minGiorno = COSTANTI.secondiPerGiorno / 60, lista = [];
  const maxMin = Math.round(OFFLINE_MAX_SECONDI / 60);
  // 1) il recupero a gioco chiuso arriva al massimo: da lì l'azienda si ferma
  lista.push({ tra_minuti: maxMin, titolo: S.nomeAzienda, testo: `Sono passate ${maxMin / 60} ore: i tuoi furgoni hanno finito i giri. Torna a gestire l'azienda!` });
  // 2) la posta del lunedì (arriva durante il recupero)
  if (S.depositi.some(m => !m.responsabile)) {
    for (let g = 1; g <= 7; g++) {
      if (dataDelGiorno(S.giorno + g).getDay() === 1) {
        const min = Math.round(g * minGiorno);
        if (min > 0 && min < maxMin) lista.push({ tra_minuti: min, titolo: '✉ Posta del lunedì', testo: 'È arrivata una nuova email: c\'è una decisione da prendere.' });
        break;
      }
    }
  }
  // 3) un'email sta per scadere (−1 di reputazione)
  const prima = (S.posta || []).filter(m => m.risposta === null && !m.report).sort((a, b) => a.scadenza - b.scadenza)[0];
  if (prima) { const min = Math.round((prima.scadenza - S.giorno) * minGiorno); if (min > 0 && min < maxMin) lista.push({ tra_minuti: min, titolo: '⏳ Email in scadenza', testo: `"${prima.oggetto}": rispondi o perdi 1 punto di reputazione.` }); }
  return lista;
}

// chiudi o metti in secondo piano: programma gli avvisi; torni: li cancella
document.addEventListener('visibilitychange', () => {
  if (!notificheAttive() || !account.token || !S) return;
  const lista = document.visibilityState === 'hidden' ? avvisiDaProgrammare() : [];
  rpc('programma_notifiche', { p_token: account.token, p_lista: lista }, true).catch(() => {});
});

/* ---------- invito al primo avvio ----------
   Il permesso del sistema si può chiedere solo dopo un tocco: al primo avvio compare un riquadro
   con "Sì, attiva", e quel tocco apre subito la richiesta. Se il permesso c'è già, si attivano da sole. */
const CHIAVE_INVITO = 'tycoon-logistica-invito-notifiche';
function proponiNotifiche() {
  if (!pushSupportato() || !account.token || !S || notificheAttive()) return;
  if (Notification.permission === 'granted') { attivaNotifiche(); return; }        // già concesso: niente domande
  if (Notification.permission === 'denied') return;
  try { if (localStorage.getItem(CHIAVE_INVITO)) return; } catch (e) { return; }
  if (document.getElementById('invito-notifiche')) return;
  const d = document.createElement('div'); d.id = 'invito-notifiche'; d.className = 'invito-notifiche vetro';
  d.innerHTML = `<b>🔔 Vuoi le notifiche?</b><p>Ti avviso quando i furgoni hanno finito i giri, quando arriva la posta e se un'email sta per scadere.</p>
    <div class="riga"><button class="btn" data-no>Non ora</button><button class="btn primario" data-si>Sì, attiva</button></div>`;
  document.body.appendChild(d);
  const chiudi = () => { try { localStorage.setItem(CHIAVE_INVITO, '1'); } catch (e) { /* ignora */ } d.remove(); };
  d.querySelector('[data-no]').onclick = chiudi;
  d.querySelector('[data-si]').onclick = () => { chiudi(); attivaNotifiche().then(() => { if (typeof ridisegna === 'function') ridisegna(); if (notificheAttive() && typeof toast === 'function') toast('Notifiche attive.'); else if (notifiche.errore && typeof toast === 'function') toast(notifiche.errore); }); };
}
// all'apertura (dopo aver ripreso l'account) e dopo l'accesso
window.addEventListener('load', () => setTimeout(proponiNotifiche, 4000));
