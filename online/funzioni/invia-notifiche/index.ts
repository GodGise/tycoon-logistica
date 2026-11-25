// Tycoon Logistica – funzione Supabase "invia-notifiche" (Edge Function, Deno).
// La chiama pg_cron ogni 5 minuti (vedi online/notifiche.sql). Manda le notifiche programmate
// arrivate all'ora giusta a tutti i telefoni iscritti del giocatore.
// Da creare nel pannello di Supabase: Edge Functions → Deploy a new function → nome "invia-notifiche",
// incollare questo file, e togliere "Verify JWT" (la chiama il cron senza chiave; manda solo ciò che è già in coda).
// Le chiavi VAPID le crea da sola la prima volta e le tiene nella tabella notifiche_config:
// nessuna chiave segreta da copiare a mano.
import webpush from "npm:web-push@3.6.7";
import postgres from "npm:postgres@3.4.4";

const SITO = "https://godgise.github.io/tycoon-logistica/";
// collegamento diretto al database: Supabase lo dà già a ogni funzione (SUPABASE_DB_URL)
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });

Deno.serve(async () => {
  // chiavi VAPID: create la prima volta, poi sempre le stesse
  let [cfg] = await sql`select vapid_pubblica, vapid_privata from notifiche_config where id = 1`;
  if (!cfg) {
    const k = webpush.generateVAPIDKeys();
    await sql`insert into notifiche_config (id, vapid_pubblica, vapid_privata) values (1, ${k.publicKey}, ${k.privateKey}) on conflict (id) do nothing`;
    [cfg] = await sql`select vapid_pubblica, vapid_privata from notifiche_config where id = 1`;
  }
  webpush.setVapidDetails(SITO, cfg.vapid_pubblica, cfg.vapid_privata);

  const dovute = await sql`select id, giocatore, titolo, testo from notifiche_programmate
                           where not inviata and quando <= now() order by quando limit 200`;
  let inviate = 0, tolte = 0;
  for (const n of dovute) {
    const iscrizioni = await sql`select endpoint, p256dh, auth from notifiche_iscrizioni where giocatore = ${n.giocatore}`;
    for (const s of iscrizioni) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ titolo: n.titolo, testo: n.testo }), { TTL: 6 * 3600 });
        inviate++;
      } catch (e) {
        // iscrizione scaduta o tolta dal telefono: si cancella
        const stato = (e as { statusCode?: number }).statusCode;
        if (stato === 404 || stato === 410) { await sql`delete from notifiche_iscrizioni where endpoint = ${s.endpoint}`; tolte++; }
      }
    }
    await sql`update notifiche_programmate set inviata = true where id = ${n.id}`;
  }
  return new Response(JSON.stringify({ pronte: !!cfg, dovute: dovute.length, inviate, tolte }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
  });
});
