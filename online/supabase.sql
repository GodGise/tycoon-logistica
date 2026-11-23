-- Tycoon Logistica: account con nome utente e password e partita salvata online.
-- Da incollare una volta nell'editor SQL di Supabase (SQL Editor → New query → Run).
-- Le tabelle non sono leggibili dal browser: si usano solo le funzioni qui sotto.
create extension if not exists pgcrypto with schema extensions;

create table if not exists giocatori (
  id uuid primary key default gen_random_uuid(),
  nome text unique not null check (nome ~ '^[a-z0-9_]{3,20}$'),
  hash text not null,
  creato timestamptz not null default now()
);
create table if not exists sessioni (
  token uuid primary key default gen_random_uuid(),
  giocatore uuid not null references giocatori on delete cascade,
  creata timestamptz not null default now()
);
create table if not exists partite (
  giocatore uuid primary key references giocatori on delete cascade,
  dati jsonb not null,
  aggiornata timestamptz not null default now()
);
alter table giocatori enable row level security;
alter table sessioni enable row level security;
alter table partite enable row level security;
-- nessuna policy: dal browser si passa solo dalle funzioni

create or replace function registra(p_nome text, p_password text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare g uuid; t uuid;
begin
  if lower(p_nome) !~ '^[a-z0-9_]{3,20}$' then raise exception 'nome_non_valido'; end if;
  if length(p_password) < 6 then raise exception 'password_corta'; end if;
  insert into giocatori(nome, hash) values (lower(p_nome), crypt(p_password, gen_salt('bf'))) returning id into g;
  insert into sessioni(giocatore) values (g) returning token into t;
  return t;
exception when unique_violation then raise exception 'nome_usato';
end $$;

create or replace function accedi(p_nome text, p_password text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare g uuid; t uuid;
begin
  select id into g from giocatori where nome = lower(p_nome) and hash = crypt(p_password, hash);
  if g is null then raise exception 'credenziali'; end if;
  insert into sessioni(giocatore) values (g) returning token into t;
  return t;
end $$;

create or replace function chi_sono(p_token uuid) returns text
language sql security definer set search_path = public as $$
  select g.nome from sessioni s join giocatori g on g.id = s.giocatore where s.token = p_token
$$;

create or replace function leggi_partita(p_token uuid) returns table (dati jsonb, aggiornata timestamptz)
language sql security definer set search_path = public as $$
  select p.dati, p.aggiornata from partite p join sessioni s on s.giocatore = p.giocatore where s.token = p_token
$$;

create or replace function quando_partita(p_token uuid) returns timestamptz
language sql security definer set search_path = public as $$
  select p.aggiornata from partite p join sessioni s on s.giocatore = p.giocatore where s.token = p_token
$$;

create or replace function salva_partita(p_token uuid, p_dati jsonb) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare g uuid; ora timestamptz := clock_timestamp();
begin
  select giocatore into g from sessioni where token = p_token;
  if g is null then raise exception 'sessione'; end if;
  insert into partite(giocatore, dati, aggiornata) values (g, p_dati, ora)
    on conflict (giocatore) do update set dati = excluded.dati, aggiornata = excluded.aggiornata;
  return ora;
end $$;

create or replace function esci(p_token uuid) returns void
language sql security definer set search_path = public as $$
  delete from sessioni where token = p_token
$$;

revoke all on function registra(text, text), accedi(text, text), chi_sono(uuid), leggi_partita(uuid),
  quando_partita(uuid), salva_partita(uuid, jsonb), esci(uuid) from public;
grant execute on function registra(text, text), accedi(text, text), chi_sono(uuid), leggi_partita(uuid),
  quando_partita(uuid), salva_partita(uuid, jsonb), esci(uuid) to anon, authenticated;
