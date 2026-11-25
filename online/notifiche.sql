-- Tycoon Logistica: notifiche sul telefono (web push).
-- Da incollare una volta nell'editor SQL di Supabase, DOPO supabase.sql (SQL Editor → New query → Run).
-- Il gioco, quando lo chiudi, programma qualche avviso (recupero al massimo, posta del lunedì, email in scadenza);
-- ogni 5 minuti pg_cron chiama la funzione "invia-notifiche" che manda quelli arrivati all'ora giusta.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists notifiche_iscrizioni (
  endpoint text primary key,
  giocatore uuid not null references giocatori on delete cascade,
  p256dh text not null,
  auth text not null,
  creata timestamptz not null default now()
);
create table if not exists notifiche_programmate (
  id bigint generated always as identity primary key,
  giocatore uuid not null references giocatori on delete cascade,
  quando timestamptz not null,
  titolo text not null,
  testo text not null,
  inviata boolean not null default false
);
create index if not exists notifiche_dovute on notifiche_programmate (quando) where not inviata;
-- le chiavi VAPID le crea da sola la funzione "invia-notifiche" la prima volta che parte
create table if not exists notifiche_config (
  id int primary key check (id = 1),
  vapid_pubblica text not null,
  vapid_privata text not null
);
alter table notifiche_iscrizioni enable row level security;
alter table notifiche_programmate enable row level security;
alter table notifiche_config enable row level security;
-- nessuna policy: dal browser si passa solo dalle funzioni qui sotto

-- chiave pubblica per iscriversi (null finché la funzione non è partita la prima volta)
create or replace function chiave_notifiche() returns text
language sql security definer set search_path = public as $$
  select vapid_pubblica from notifiche_config where id = 1
$$;

create or replace function iscrivi_notifiche(p_token uuid, p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  select giocatore into g from sessioni where token = p_token;
  if g is null then raise exception 'sessione'; end if;
  insert into notifiche_iscrizioni(endpoint, giocatore, p256dh, auth) values (p_endpoint, g, p_p256dh, p_auth)
  on conflict (endpoint) do update set giocatore = g, p256dh = p_p256dh, auth = p_auth;
end $$;

create or replace function disiscrivi_notifiche(p_token uuid, p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from notifiche_iscrizioni where endpoint = p_endpoint
    and giocatore = (select giocatore from sessioni where token = p_token)
$$;

-- sostituisce gli avvisi ancora da mandare con quelli nuovi: [{ "tra_minuti": 120, "titolo": "...", "testo": "..." }]
-- (massimo 5, tra 0 e 3 giorni; una lista vuota li cancella, per esempio quando torni a giocare)
create or replace function programma_notifiche(p_token uuid, p_lista jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid; n jsonb;
begin
  select giocatore into g from sessioni where token = p_token;
  if g is null then raise exception 'sessione'; end if;
  delete from notifiche_programmate where giocatore = g and not inviata;
  delete from notifiche_programmate where giocatore = g and inviata and quando < now() - interval '7 days';
  for n in select * from jsonb_array_elements(coalesce(p_lista, '[]'::jsonb)) limit 5 loop
    insert into notifiche_programmate(giocatore, quando, titolo, testo)
    values (g, now() + make_interval(mins => least(greatest((n->>'tra_minuti')::int, 0), 4320)),
            left(n->>'titolo', 80), left(n->>'testo', 200));
  end loop;
end $$;

grant execute on function chiave_notifiche(), iscrivi_notifiche(uuid, text, text, text),
  disiscrivi_notifiche(uuid, text), programma_notifiche(uuid, jsonb) to anon, authenticated;

-- ogni 5 minuti: manda le notifiche arrivate all'ora giusta
select cron.unschedule('invia-notifiche') where exists (select 1 from cron.job where jobname = 'invia-notifiche');
select cron.schedule('invia-notifiche', '*/5 * * * *', $$
  select net.http_post(url := 'https://kiefpncgfgttlwmqtafk.supabase.co/functions/v1/invia-notifiche',
                       headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb)
$$);
