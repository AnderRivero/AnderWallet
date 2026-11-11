-- AnderWallet
-- Ejecuta este script en el SQL Editor de un proyecto Supabase nuevo. Volver a ejecutarlo no borra datos.
--
-- Cerraduras de la base, todas obligatorias:
-- 1. hook_before_user_created rechaza cualquier correo que no esté en public.allowed_users
--    ni en luzmonitor.allowed_users (si ese esquema existe) antes de crear el usuario.
--    Hay que activarlo en Authentication → Hooks (ver README).
--    LuzMonitor vive en el esquema luzmonitor y no usa estas tablas.
-- 2. is_allowed() exige que el correo esté autorizado y que la sesión haya pasado el segundo factor (aal2).
-- 3. Todas las tablas tienen RLS. anon no tiene permisos. Sin is_allowed() no se lee ni se escribe nada.

create extension if not exists pgcrypto;

create table if not exists public.allowed_users (
  email text primary key check (email = lower(email))
);

-- Helpers -----------------------------------------------------------------

create or replace function public.valid_icon(kind text, value text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case kind
    when 'lucide' then value ~ '^[A-Za-z0-9]{1,60}$'
    when 'url' then value ~ '^https://[^\s"''<>]{4,490}$'
    when 'brand' then value ~ '^[a-z0-9-]{1,40}:[a-z0-9-]{1,80}$'
    else false
  end;
$$;

create or replace function public.caracas_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'America/Caracas')::date;
$$;

-- Acceso ------------------------------------------------------------------

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
  allowed boolean := false;
begin
  if candidate <> '' then
    select exists (
      select 1 from public.allowed_users where email = candidate
    ) into allowed;

    if not allowed and to_regclass('luzmonitor.allowed_users') is not null then
      execute 'select exists (select 1 from luzmonitor.allowed_users where email = $1)'
        into allowed
        using candidate;
    end if;
  end if;

  if allowed then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error',
    jsonb_build_object('http_code', 403, 'message', 'Esta cuenta no tiene acceso.')
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1
      from auth.users as users
      join public.allowed_users as allowed on lower(users.email) = allowed.email
      where users.id = auth.uid()
    );
$$;

-- Tablas ------------------------------------------------------------------

create table if not exists public.rate_snapshots (
  source text primary key check (source in ('bcv_usd', 'bcv_eur', 'binance_usdt', 'manual_usd')),
  ves_per_unit numeric(20, 8) check (ves_per_unit is null or ves_per_unit > 0),
  fetched_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  name_key text generated always as (lower(btrim(name))) stored unique,
  kind text not null check (kind in ('bank', 'wallet', 'crypto')),
  currency text not null check (currency in ('USD', 'VES', 'EUR', 'USDT')),
  rate_source text not null default 'bcv' check (rate_source in ('bcv', 'binance', 'manual')),
  ref_currency text check (ref_currency is null or ref_currency in ('USD', 'VES', 'EUR', 'USDT')),
  color text not null default '#22c55e' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon_kind text not null default 'lucide',
  icon_value text not null default 'Landmark',
  featured boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 2000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_ref_differs check (ref_currency is null or ref_currency <> currency),
  constraint accounts_crypto_usdt check (kind <> 'crypto' or currency = 'USDT'),
  constraint accounts_icon check (public.valid_icon(icon_kind, icon_value))
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  name_key text generated always as (lower(btrim(name))) stored,
  kind text not null check (kind in ('income', 'expense')),
  color text not null default '#22c55e' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon_kind text not null default 'lucide',
  icon_value text not null default 'Tag',
  created_at timestamptz not null default now(),
  constraint categories_unique_name unique (kind, name_key),
  constraint categories_icon check (public.valid_icon(icon_kind, icon_value))
);

create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  person text not null check (char_length(btrim(person)) between 1 and 120),
  currency text not null check (currency in ('USD', 'VES', 'EUR', 'USDT')),
  principal numeric(20, 8) not null check (principal > 0),
  due_date date,
  notes text check (notes is null or char_length(notes) <= 2000),
  color text not null default '#22c55e' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon_kind text not null default 'lucide',
  icon_value text not null default 'HandCoins',
  written_off boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivables_icon check (public.valid_icon(icon_kind, icon_value))
);

create table if not exists public.recurring (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(20, 8) not null check (amount > 0),
  currency text not null check (currency in ('USD', 'VES', 'EUR', 'USDT')),
  account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  cadence text not null check (cadence in ('weekly', 'monthly', 'yearly')),
  anchor_date date not null,
  paid_count integer not null default 0 check (paid_count >= 0),
  lead_days integer not null default 3 check (lead_days between 0 and 60),
  color text not null default '#22c55e' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon_kind text not null default 'lucide',
  icon_value text not null default 'Repeat',
  active boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_icon check (public.valid_icon(icon_kind, icon_value))
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete restrict,
  category_id uuid references public.categories (id) on delete restrict,
  kind text not null check (
    kind in ('opening', 'adjustment', 'income', 'expense', 'transfer', 'loan_out', 'collection')
  ),
  direction smallint not null check (direction in (-1, 1)),
  amount numeric(20, 8) not null check (amount > 0),
  occurred_on date not null,
  note text check (note is null or char_length(note) <= 2000),
  usd_rate numeric(24, 12) check (usd_rate is null or usd_rate > 0),
  usd_amount numeric(24, 8) generated always as (amount * usd_rate) stored,
  transfer_group uuid,
  receivable_id uuid references public.receivables (id) on delete cascade,
  receivable_amount numeric(20, 8) check (receivable_amount is null or receivable_amount > 0),
  recurring_id uuid references public.recurring (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint movements_direction check (
    (kind in ('income', 'collection') and direction = 1)
    or (kind in ('expense', 'loan_out') and direction = -1)
    or kind in ('opening', 'adjustment', 'transfer')
  ),
  constraint movements_category check (kind in ('income', 'expense') or category_id is null),
  constraint movements_transfer check ((kind = 'transfer') = (transfer_group is not null)),
  constraint movements_receivable check ((kind in ('loan_out', 'collection')) = (receivable_id is not null)),
  constraint movements_receivable_amount check ((receivable_id is null) = (receivable_amount is null)),
  constraint movements_recurring check (recurring_id is null or kind in ('income', 'expense'))
);

create index if not exists movements_account_idx on public.movements (account_id, occurred_on desc);
create index if not exists movements_transfer_idx on public.movements (transfer_group) where transfer_group is not null;
create index if not exists movements_receivable_idx on public.movements (receivable_id) where receivable_id is not null;
create unique index if not exists movements_one_loan
  on public.movements (receivable_id)
  where kind = 'loan_out';

create table if not exists public.alert_notices (
  recurring_id uuid not null references public.recurring (id) on delete cascade,
  due_date date not null,
  notified_at timestamptz not null default now(),
  primary key (recurring_id, due_date)
);

-- Reglas ------------------------------------------------------------------

create or replace function public.touch_updated()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.guard_account()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name := btrim(new.name);
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  new.updated_at := now();
  if tg_op = 'UPDATE'
    and new.currency is distinct from old.currency
    and exists (select 1 from public.movements where account_id = old.id) then
    raise exception 'No puedes cambiar la moneda de una cuenta que ya tiene movimientos.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_movement()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  category_kind text;
  principal numeric;
  collected numeric;
begin
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  new.updated_at := now();

  if current_setting('anderwallet.restoring', true) is distinct from 'on'
    and new.occurred_on > public.caracas_today() + 1 then
    raise exception 'La fecha no puede estar en el futuro.';
  end if;

  if new.category_id is not null then
    select kind into category_kind from public.categories where id = new.category_id;
    if category_kind is distinct from new.kind then
      raise exception 'La categoría no corresponde al tipo de movimiento.';
    end if;
  end if;

  if new.kind = 'collection' then
    select receivables.principal into principal
    from public.receivables
    where receivables.id = new.receivable_id
    for update;

    select coalesce(sum(movements.receivable_amount), 0) into collected
    from public.movements
    where movements.receivable_id = new.receivable_id
      and movements.kind = 'collection'
      and movements.id is distinct from new.id;

    if collected + new.receivable_amount > principal + 0.00000001 then
      raise exception 'El abono supera lo pendiente.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.check_transfer_group()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  groups uuid[];
  current_group uuid;
  row_count integer;
  account_count integer;
  direction_sum integer;
begin
  groups := array[
    case when tg_op <> 'INSERT' then old.transfer_group end,
    case when tg_op <> 'DELETE' then new.transfer_group end
  ];
  foreach current_group in array groups loop
    continue when current_group is null;
    select count(*), count(distinct account_id), coalesce(sum(direction), 0)
    into row_count, account_count, direction_sum
    from public.movements
    where transfer_group = current_group;
    continue when row_count = 0;
    if row_count <> 2 or account_count <> 2 or direction_sum <> 0 then
      raise exception 'Una transferencia necesita una salida y una entrada en cuentas distintas.';
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists accounts_guard on public.accounts;
create trigger accounts_guard before insert or update on public.accounts
for each row execute function public.guard_account();

drop trigger if exists receivables_touch on public.receivables;
create trigger receivables_touch before update on public.receivables
for each row execute function public.touch_updated();

drop trigger if exists recurring_touch on public.recurring;
create trigger recurring_touch before update on public.recurring
for each row execute function public.touch_updated();

drop trigger if exists rate_snapshots_touch on public.rate_snapshots;
create trigger rate_snapshots_touch before update on public.rate_snapshots
for each row execute function public.touch_updated();

drop trigger if exists movements_guard on public.movements;
create trigger movements_guard before insert or update on public.movements
for each row execute function public.guard_movement();

drop trigger if exists movements_transfer_check on public.movements;
create constraint trigger movements_transfer_check
after insert or update or delete on public.movements
deferrable initially deferred
for each row execute function public.check_transfer_group();

-- Seguridad por filas -----------------------------------------------------

alter table public.allowed_users enable row level security;
alter table public.rate_snapshots enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.receivables enable row level security;
alter table public.recurring enable row level security;
alter table public.movements enable row level security;
alter table public.alert_notices enable row level security;

drop policy if exists allowed_users_select_self on public.allowed_users;
create policy allowed_users_select_self on public.allowed_users
for select to authenticated
using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists rate_snapshots_read on public.rate_snapshots;
create policy rate_snapshots_read on public.rate_snapshots
for select to authenticated
using (public.is_allowed());

drop policy if exists rate_snapshots_manual on public.rate_snapshots;
create policy rate_snapshots_manual on public.rate_snapshots
for update to authenticated
using (public.is_allowed() and source = 'manual_usd')
with check (public.is_allowed() and source = 'manual_usd');

drop policy if exists accounts_all on public.accounts;
create policy accounts_all on public.accounts for all to authenticated
using (public.is_allowed()) with check (public.is_allowed());

drop policy if exists categories_all on public.categories;
create policy categories_all on public.categories for all to authenticated
using (public.is_allowed()) with check (public.is_allowed());

drop policy if exists receivables_all on public.receivables;
create policy receivables_all on public.receivables for all to authenticated
using (public.is_allowed()) with check (public.is_allowed());

drop policy if exists recurring_all on public.recurring;
create policy recurring_all on public.recurring for all to authenticated
using (public.is_allowed()) with check (public.is_allowed());

drop policy if exists movements_all on public.movements;
create policy movements_all on public.movements for all to authenticated
using (public.is_allowed()) with check (public.is_allowed());

revoke all on all tables in schema public from anon, authenticated;
grant select on public.allowed_users to authenticated;
grant select, update on public.rate_snapshots to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.receivables to authenticated;
grant select, insert, update, delete on public.recurring to authenticated;
grant select, insert, update, delete on public.movements to authenticated;
grant all on public.alert_notices to service_role;
grant all on public.rate_snapshots to service_role;

-- Operaciones que tocan varias filas a la vez -------------------------------

create or replace function public.save_transfer(
  p_group uuid,
  p_from uuid,
  p_to uuid,
  p_from_amount numeric,
  p_to_amount numeric,
  p_on date,
  p_note text,
  p_from_rate numeric,
  p_to_rate numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  target uuid;
begin
  if not public.is_allowed() then
    raise exception 'No autorizado';
  end if;
  if p_from = p_to then
    raise exception 'Elige dos cuentas distintas.';
  end if;

  target := coalesce(p_group, gen_random_uuid());
  if p_group is not null then
    delete from public.movements where transfer_group = p_group;
  end if;

  insert into public.movements (account_id, kind, direction, amount, occurred_on, note, usd_rate, transfer_group)
  values
    (p_from, 'transfer', -1, p_from_amount, p_on, p_note, p_from_rate, target),
    (p_to, 'transfer', 1, p_to_amount, p_on, p_note, p_to_rate, target);

  return target;
end;
$$;

create or replace function public.create_receivable(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.is_allowed() then
    raise exception 'No autorizado';
  end if;

  insert into public.receivables (person, currency, principal, due_date, notes, color, icon_kind, icon_value)
  values (
    btrim(payload ->> 'person'),
    payload ->> 'currency',
    (payload ->> 'principal')::numeric,
    nullif(payload ->> 'dueDate', '')::date,
    nullif(btrim(coalesce(payload ->> 'notes', '')), ''),
    coalesce(payload ->> 'color', '#22c55e'),
    coalesce(payload ->> 'iconKind', 'lucide'),
    coalesce(payload ->> 'iconValue', 'HandCoins')
  )
  returning id into new_id;

  if nullif(payload ->> 'accountId', '') is not null then
    insert into public.movements (
      account_id, kind, direction, amount, occurred_on, note, usd_rate, receivable_id, receivable_amount
    )
    values (
      (payload ->> 'accountId')::uuid,
      'loan_out',
      -1,
      (payload ->> 'accountAmount')::numeric,
      (payload ->> 'occurredOn')::date,
      nullif(btrim(coalesce(payload ->> 'notes', '')), ''),
      nullif(payload ->> 'usdRate', '')::numeric,
      new_id,
      (payload ->> 'principal')::numeric
    );
  end if;

  return new_id;
end;
$$;

create or replace function public.confirm_recurring(
  p_id uuid,
  p_expected integer,
  p_account uuid,
  p_amount numeric,
  p_on date,
  p_rate numeric,
  p_note text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  item public.recurring;
  new_id uuid;
begin
  if not public.is_allowed() then
    raise exception 'No autorizado';
  end if;

  select * into item from public.recurring where id = p_id for update;
  if not found then
    raise exception 'El pago fijo ya no existe.';
  end if;
  if item.paid_count <> p_expected then
    raise exception 'Este pago ya se registró.';
  end if;

  insert into public.movements (
    account_id, category_id, kind, direction, amount, occurred_on, note, usd_rate, recurring_id
  )
  values (
    p_account,
    item.category_id,
    item.kind,
    case item.kind when 'income' then 1 else -1 end,
    p_amount,
    p_on,
    coalesce(nullif(btrim(coalesce(p_note, '')), ''), item.name),
    p_rate,
    item.id
  )
  returning id into new_id;

  update public.recurring set paid_count = paid_count + 1 where id = item.id;
  return new_id;
end;
$$;

create or replace function public.skip_recurring(p_id uuid, p_expected integer)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_allowed() then
    raise exception 'No autorizado';
  end if;
  update public.recurring
  set paid_count = paid_count + 1
  where id = p_id and paid_count = p_expected;
  if not found then
    raise exception 'Este pago ya se registró.';
  end if;
end;
$$;

-- Respaldo ----------------------------------------------------------------

create or replace function public.restore_backup(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  counts jsonb := '{}'::jsonb;
  total integer;
begin
  if not public.is_allowed() then
    raise exception 'No autorizado';
  end if;
  if coalesce(payload ->> 'app', '') <> 'AnderWallet' or coalesce(payload ->> 'version', '') <> '1' then
    raise exception 'El archivo no es un respaldo de AnderWallet';
  end if;
  if jsonb_typeof(payload -> 'accounts') <> 'array'
    or jsonb_typeof(payload -> 'categories') <> 'array'
    or jsonb_typeof(payload -> 'receivables') <> 'array'
    or jsonb_typeof(payload -> 'recurring') <> 'array'
    or jsonb_typeof(payload -> 'movements') <> 'array' then
    raise exception 'El respaldo está incompleto';
  end if;

  perform set_config('anderwallet.restoring', 'on', true);

  delete from public.alert_notices;
  delete from public.movements;
  delete from public.recurring;
  delete from public.receivables;
  delete from public.categories;
  delete from public.accounts;

  total := 0;
  for item in select value from jsonb_array_elements(payload -> 'accounts') loop
    insert into public.accounts (
      id, name, kind, currency, rate_source, ref_currency, color, icon_kind, icon_value, featured, notes, sort_order
    )
    values (
      (item ->> 'id')::uuid, item ->> 'name', item ->> 'kind', item ->> 'currency', item ->> 'rateSource',
      nullif(item ->> 'refCurrency', ''), item ->> 'color', item -> 'icon' ->> 'kind', item -> 'icon' ->> 'value',
      coalesce((item ->> 'featured')::boolean, true), nullif(item ->> 'notes', ''),
      coalesce((item ->> 'sortOrder')::integer, 0)
    );
    total := total + 1;
  end loop;
  counts := counts || jsonb_build_object('accounts', total);

  total := 0;
  for item in select value from jsonb_array_elements(payload -> 'categories') loop
    insert into public.categories (id, name, kind, color, icon_kind, icon_value)
    values (
      (item ->> 'id')::uuid, item ->> 'name', item ->> 'kind', item ->> 'color',
      item -> 'icon' ->> 'kind', item -> 'icon' ->> 'value'
    );
    total := total + 1;
  end loop;
  counts := counts || jsonb_build_object('categories', total);

  total := 0;
  for item in select value from jsonb_array_elements(payload -> 'receivables') loop
    insert into public.receivables (
      id, person, currency, principal, due_date, notes, color, icon_kind, icon_value, written_off
    )
    values (
      (item ->> 'id')::uuid, item ->> 'person', item ->> 'currency', (item ->> 'principal')::numeric,
      nullif(item ->> 'dueDate', '')::date, nullif(item ->> 'notes', ''), item ->> 'color',
      item -> 'icon' ->> 'kind', item -> 'icon' ->> 'value', coalesce((item ->> 'writtenOff')::boolean, false)
    );
    total := total + 1;
  end loop;
  counts := counts || jsonb_build_object('receivables', total);

  total := 0;
  for item in select value from jsonb_array_elements(payload -> 'recurring') loop
    insert into public.recurring (
      id, name, kind, amount, currency, account_id, category_id, cadence, anchor_date, paid_count,
      lead_days, color, icon_kind, icon_value, active, notes
    )
    values (
      (item ->> 'id')::uuid, item ->> 'name', item ->> 'kind', (item ->> 'amount')::numeric, item ->> 'currency',
      nullif(item ->> 'accountId', '')::uuid, nullif(item ->> 'categoryId', '')::uuid, item ->> 'cadence',
      (item ->> 'anchorDate')::date, coalesce((item ->> 'paidCount')::integer, 0),
      coalesce((item ->> 'leadDays')::integer, 3), item ->> 'color', item -> 'icon' ->> 'kind',
      item -> 'icon' ->> 'value', coalesce((item ->> 'active')::boolean, true), nullif(item ->> 'notes', '')
    );
    total := total + 1;
  end loop;
  counts := counts || jsonb_build_object('recurring', total);

  total := 0;
  for item in
    select value from jsonb_array_elements(payload -> 'movements')
    order by value ->> 'occurredOn', value ->> 'kind' desc
  loop
    insert into public.movements (
      id, account_id, category_id, kind, direction, amount, occurred_on, note, usd_rate,
      transfer_group, receivable_id, receivable_amount, recurring_id
    )
    values (
      (item ->> 'id')::uuid, (item ->> 'accountId')::uuid, nullif(item ->> 'categoryId', '')::uuid,
      item ->> 'kind', (item ->> 'direction')::smallint, (item ->> 'amount')::numeric,
      (item ->> 'occurredOn')::date, nullif(item ->> 'note', ''), nullif(item ->> 'usdRate', '')::numeric,
      nullif(item ->> 'transferGroup', '')::uuid, nullif(item ->> 'receivableId', '')::uuid,
      nullif(item ->> 'receivableAmount', '')::numeric, nullif(item ->> 'recurringId', '')::uuid
    );
    total := total + 1;
  end loop;
  counts := counts || jsonb_build_object('movements', total);

  update public.rate_snapshots
  set ves_per_unit = nullif(payload ->> 'manualUsdRate', '')::numeric,
      fetched_at = case when nullif(payload ->> 'manualUsdRate', '') is null then null else now() end
  where source = 'manual_usd';

  perform set_config('anderwallet.restoring', 'off', true);
  return counts;
end;
$$;

-- Permisos de funciones -----------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on function public.valid_icon(text, text) to authenticated, service_role;
grant execute on function public.caracas_today() to authenticated, service_role;
grant execute on function public.is_allowed() to authenticated;
grant execute on function public.save_transfer(uuid, uuid, uuid, numeric, numeric, date, text, numeric, numeric) to authenticated;
grant execute on function public.create_receivable(jsonb) to authenticated;
grant execute on function public.confirm_recurring(uuid, integer, uuid, numeric, date, numeric, text) to authenticated;
grant execute on function public.skip_recurring(uuid, integer) to authenticated;
grant execute on function public.restore_backup(jsonb) to authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- Semilla -------------------------------------------------------------------

insert into public.allowed_users (email)
values ('rivero.ander@gmail.com')
on conflict (email) do nothing;

insert into public.rate_snapshots (source)
values ('bcv_usd'), ('bcv_eur'), ('binance_usdt'), ('manual_usd')
on conflict (source) do nothing;

insert into public.categories (name, kind, color, icon_kind, icon_value)
values
  ('Salario', 'income', '#22c55e', 'lucide', 'Briefcase'),
  ('Otros ingresos', 'income', '#14b8a6', 'lucide', 'Coins'),
  ('Comida', 'expense', '#f97316', 'lucide', 'Utensils'),
  ('Mercado', 'expense', '#eab308', 'lucide', 'ShoppingCart'),
  ('Servicios', 'expense', '#3b82f6', 'lucide', 'Zap'),
  ('Suscripciones', 'expense', '#a855f7', 'lucide', 'Repeat'),
  ('Transporte', 'expense', '#06b6d4', 'lucide', 'Car'),
  ('Salud', 'expense', '#ef4444', 'lucide', 'HeartPulse'),
  ('Otros gastos', 'expense', '#64748b', 'lucide', 'Receipt')
on conflict (kind, name_key) do nothing;
