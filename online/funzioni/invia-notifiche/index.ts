// Tycoon Logistica – funzione Supabase "invia-notifiche" (Edge Function, Deno).
// La chiama pg_cron ogni 5 minuti (vedi online/notifiche.sql). Manda le notifiche programmate
// arrivate all'ora giusta a tutti i telefoni iscritti del giocatore.
// Da creare nel pannello di Supabase: Edge Functions → Deploy a new function → nome "invia-notifiche",
// incollare questo file, e togliere "Verify JWT" (la chiama il cron senza chiave; manda solo ciò che è già in coda).
// Le chiavi VAPID le crea da sola la prima volta e le tiene nella tabella notifiche_config:
// nessuna chiave segreta da copiare a mano.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITO = "https://godgise.github.io/tycoon-logistica/";

Deno.serve(async () => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // chiavi VAPID: create la prima volta, poi sempre le stesse
  let { data: cfg } = await db.from("notifiche_config").select("vapid_pubblica, vapid_privata").eq("id", 1).maybeSingle();
  if (!cfg) {
    const k = webpush.generateVAPIDKeys();
    await db.from("notifiche_config").insert({ id: 1, vapid_pubblica: k.publicKey, vapid_privata: k.privateKey });
    ({ data: cfg } = await db.from("notifiche_config").select("vapid_pubblica, vapid_privata").eq("id", 1).maybeSingle());
  }
  webpush.setVapidDetails(SITO, cfg!.vapid_pubblica, cfg!.vapid_privata);

  const { data: dovute } = await db.from("notifiche_programmate")
    .select("id, giocatore, titolo, testo").eq("inviata", false).lte("quando", new Date().toISOString()).limit(200);
  let inviate = 0, tolte = 0;
  for (const n of dovute ?? []) {
    const { data: iscrizioni } = await db.from("notifiche_iscrizioni").select("endpoint, p256dh, auth").eq("giocatore", n.giocatore);
    for (const s of iscrizioni ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ titolo: n.titolo, testo: n.testo }), { TTL: 6 * 3600 });
        inviate++;
      } catch (e) {
        // iscrizione scaduta o tolta dal telefono: si cancella
        const stato = (e as { statusCode?: number }).statusCode;
        if (stato === 404 || stato === 410) { await db.from("notifiche_iscrizioni").delete().eq("endpoint", s.endpoint); tolte++; }
      }
    }
    await db.from("notifiche_programmate").update({ inviata: true }).eq("id", n.id);
  }
  return new Response(JSON.stringify({ pronte: !!cfg, dovute: (dovute ?? []).length, inviate, tolte }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
  });
});
