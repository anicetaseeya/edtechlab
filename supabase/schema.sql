-- =====================================================================
-- IEU Labs — complete database schema
-- Safe to run again: every statement is idempotent.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- 1.1 My lab week entries (the main feature on /app)
create table if not exists public.entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  title         text not null check (char_length(trim(title)) between 1 and 200),
  type          text not null default 'Task'
                check (type in ('Session','Partner meeting','Team meeting',
                                'Deliverable','Deadline','Task')),
  entry_date    date not null default ((now() at time zone 'Europe/Madrid')::date + 7),
  entry_time    time without time zone,
  place         text,
  meeting_link  text,
  notes         text,
  mandatory     boolean not null default false,
  tbc           boolean not null default false,
  done          boolean not null default false,
  cancelled     boolean not null default false,
  moved         boolean not null default false,
  moved_from    text,
  attendance    text check (attendance in ('attended','missed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists entries_user_date_idx
  on public.entries (user_id, entry_date, entry_time nulls first);

-- 1.2 The labs on offer. Seat numbers are edited by hand in the Table Editor.
create table if not exists public.lab_seats (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  area       text not null check (area in ('Consultancy','Social Impact','Entrepreneurship')),
  seats      integer not null default 0 check (seats >= 0),
  tagline    text not null default '',
  sort_order integer not null default 0
);

-- 1.3 Application rounds. Dates are edited by hand in the Table Editor.
create table if not exists public.rounds (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  application_deadline timestamptz not null,
  add_deadline         timestamptz not null,
  drop_deadline        timestamptz not null,
  batch_time           time without time zone not null default '20:00',
  is_current           boolean not null default true,
  last_settled_at      timestamptz,
  last_signature       text
);

-- 1.4 One row per student per round: when they first submitted, whether they dropped.
create table if not exists public.applications (
  round_id           uuid not null references public.rounds (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  first_submitted_at timestamptz not null default now(),
  dropped_at         timestamptz,
  primary key (round_id, user_id)
);

-- 1.5 The lottery. Never readable from the browser: RLS is on and there is
--     deliberately NO select policy. Your own number comes back only through
--     public.ieu_my_status(), together with your result.
create table if not exists public.lottery (
  round_id       uuid not null references public.rounds (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  lottery_number double precision not null,
  created_at     timestamptz not null default now(),
  primary key (round_id, user_id)
);

-- 1.6 My ranking (up to 5 labs, with an optional reason each).
create table if not exists public.rankings (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references public.rounds (id) on delete cascade,
  user_id    uuid not null default auth.uid()
             references auth.users (id) on delete cascade,
  lab_id     uuid not null references public.lab_seats (id) on delete cascade,
  rank       integer not null check (rank between 1 and 5),
  reason     text,
  created_at timestamptz not null default now(),
  unique (round_id, user_id, lab_id),
  unique (round_id, user_id, rank)
);

-- 1.7 Matching results. Written only by the database functions.
create table if not exists public.results (
  round_id        uuid not null references public.rounds (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  lab_id          uuid references public.lab_seats (id) on delete set null,
  choice_rank     integer,
  waitlist        jsonb not null default '[]'::jsonb,
  previous_lab_id uuid references public.lab_seats (id) on delete set null,
  changed_at      timestamptz,
  computed_at     timestamptz not null default now(),
  primary key (round_id, user_id)
);

-- ---------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
--    Every table is protected. No policy grants the anon role anything.
-- ---------------------------------------------------------------------

alter table public.entries      enable row level security;
alter table public.lab_seats    enable row level security;
alter table public.rounds       enable row level security;
alter table public.applications enable row level security;
alter table public.lottery      enable row level security;
alter table public.rankings     enable row level security;
alter table public.results      enable row level security;

-- Drop first so this file can be run again safely.
drop policy if exists entries_select_own on public.entries;
drop policy if exists entries_insert_own on public.entries;
drop policy if exists entries_update_own on public.entries;
drop policy if exists entries_delete_own on public.entries;

create policy entries_select_own on public.entries
  for select to authenticated using (auth.uid() = user_id);
create policy entries_insert_own on public.entries
  for insert to authenticated with check (auth.uid() = user_id);
create policy entries_update_own on public.entries
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy entries_delete_own on public.entries
  for delete to authenticated using (auth.uid() = user_id);

-- Reference data: read-only for logged-in users.
drop policy if exists lab_seats_read on public.lab_seats;
create policy lab_seats_read on public.lab_seats
  for select to authenticated using (true);

drop policy if exists rounds_read on public.rounds;
create policy rounds_read on public.rounds
  for select to authenticated using (true);

-- My own application row: readable only by me, written only by the functions.
drop policy if exists applications_select_own on public.applications;
create policy applications_select_own on public.applications
  for select to authenticated using (auth.uid() = user_id);

-- My ranking: read and write my own rows, and only while my window is open.
drop policy if exists rankings_select_own on public.rankings;
drop policy if exists rankings_insert_own on public.rankings;
drop policy if exists rankings_update_own on public.rankings;
drop policy if exists rankings_delete_own on public.rankings;

create policy rankings_select_own on public.rankings
  for select to authenticated using (auth.uid() = user_id);
create policy rankings_insert_own on public.rankings
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (select 1 from public.rounds r
                 where r.id = round_id and now() <= r.add_deadline)
  );
create policy rankings_update_own on public.rankings
  for update to authenticated using (
    auth.uid() = user_id
    and exists (select 1 from public.rounds r
                 where r.id = round_id and now() <= r.add_deadline)
  ) with check (auth.uid() = user_id);
create policy rankings_delete_own on public.rankings
  for delete to authenticated using (
    auth.uid() = user_id
    and exists (select 1 from public.rounds r
                 where r.id = round_id and now() <= r.add_deadline)
  );

-- My result: read-only, mine only. No insert/update/delete policy exists,
-- so the browser can never write results.
drop policy if exists results_select_own on public.results;
create policy results_select_own on public.results
  for select to authenticated using (auth.uid() = user_id);

-- public.lottery gets NO policies at all: nothing can read or write it
-- through the API, in any role.

-- ---------------------------------------------------------------------
-- 3. GRANTS — the anon (publishable) key gets nothing at all.
-- ---------------------------------------------------------------------

-- Start from nothing for both browser roles, then hand back only what the
-- app actually needs. public.lottery is left out on purpose: no role reaches
-- it through the API at all, on top of RLS having no policy for it.
revoke all on public.entries, public.lab_seats, public.rounds,
               public.applications, public.lottery, public.rankings,
               public.results
  from anon, authenticated;

grant select, insert, update, delete on public.entries   to authenticated;
grant select, insert, update, delete on public.rankings  to authenticated;
grant select on public.lab_seats, public.rounds, public.applications,
                public.results to authenticated;

-- ---------------------------------------------------------------------
-- 4. THE MATCHING ALGORITHM
-- ---------------------------------------------------------------------

-- 4.1 PURE function — no tables, no clock, no auth. Testable with made-up data.
--
--     Students take turns in order (batch first, then lottery number) and each
--     takes their highest-ranked lab that still has a free seat; if none of
--     their ranked labs has a seat they end up unassigned. Every lab they
--     ranked above the lab they got (or every lab they ranked, if unassigned)
--     records a waitlist position, in that same order.
--
--     With one shared lottery this is exactly student-proposing Deferred
--     Acceptance, and it is strategy-proof: ranking honestly is always best.
--
--     p_students : [{"user_id":"u1","lottery":0.42,"batch":0,"prefs":["lab","lab"]}]
--     p_seats    : [{"lab_id":"lab","seats":8}]
--     returns    : [{"user_id":"u1","lab_id":"lab"|null,"choice_rank":1|null,
--                    "waitlist":[{"lab_id":"lab","position":3}]}]
create or replace function public.ieu_match(p_students jsonb, p_seats jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_cap    jsonb := '{}'::jsonb;   -- lab_id -> seats still free
  v_wait   jsonb := '{}'::jsonb;   -- lab_id -> ordered array of user_id
  v_rows   jsonb := '[]'::jsonb;
  v_out    jsonb := '[]'::jsonb;
  v_s      jsonb;
  v_pref   text;
  v_lab    text;
  v_rank   integer;
  v_i      integer;
  v_missed jsonb;
  v_wl     jsonb;
  v_m      text;
  v_pos    integer;
begin
  if p_students is null or jsonb_typeof(p_students) <> 'array' then
    raise exception 'ieu_match: p_students must be a JSON array';
  end if;
  if p_seats is null or jsonb_typeof(p_seats) <> 'array' then
    raise exception 'ieu_match: p_seats must be a JSON array';
  end if;

  select coalesce(jsonb_object_agg(s->>'lab_id', greatest((s->>'seats')::int, 0)), '{}'::jsonb)
    into v_cap
    from jsonb_array_elements(p_seats) as s;

  -- One pass, in lottery order. Earlier batches go first, so late students
  -- can only ever take seats nobody on time wanted.
  for v_s in
    select e
      from jsonb_array_elements(p_students) as e
     order by coalesce((e->>'batch')::numeric, 0),
              coalesce((e->>'lottery')::numeric, 0),
              e->>'user_id'
  loop
    v_lab := null; v_rank := null; v_missed := '[]'::jsonb; v_i := 0;

    for v_pref in
      select t from jsonb_array_elements_text(coalesce(v_s->'prefs', '[]'::jsonb)) as t
    loop
      exit when v_lab is not null;
      v_i := v_i + 1;

      if coalesce((v_cap->>v_pref)::int, 0) > 0 then
        v_lab  := v_pref;
        v_rank := v_i;
        v_cap  := jsonb_set(v_cap, array[v_pref], to_jsonb(((v_cap->>v_pref)::int) - 1));
      else
        v_missed := v_missed || to_jsonb(v_pref);
        v_wait   := jsonb_set(v_wait, array[v_pref],
                      coalesce(v_wait->v_pref, '[]'::jsonb) || to_jsonb(v_s->>'user_id'), true);
      end if;
    end loop;

    v_rows := v_rows || jsonb_build_object(
      'user_id', v_s->>'user_id',
      'lab_id',  v_lab,
      'choice_rank', v_rank,
      'missed', v_missed);
  end loop;

  -- Turn the per-lab queues into "you are number N on the list".
  for v_s in select e from jsonb_array_elements(v_rows) as e
  loop
    v_wl := '[]'::jsonb;
    for v_m in select t from jsonb_array_elements_text(v_s->'missed') as t
    loop
      select q.idx::int into v_pos
        from (select ordinality as idx, value as uid
                from jsonb_array_elements_text(coalesce(v_wait->v_m, '[]'::jsonb))
                with ordinality) q
       where q.uid = v_s->>'user_id'
       limit 1;
      v_wl := v_wl || jsonb_build_object('lab_id', v_m, 'position', v_pos);
    end loop;

    v_out := v_out || jsonb_build_object(
      'user_id', v_s->>'user_id',
      'lab_id',  v_s->'lab_id',
      'choice_rank', v_s->'choice_rank',
      'waitlist', v_wl);
  end loop;

  return v_out;
end;
$$;

-- 4.2 Which daily batch does a late ranking belong to?
create or replace function public.ieu_batch_at(p_submitted timestamptz, p_batch_time time)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case
    when (p_submitted at time zone 'Europe/Madrid')::time <= p_batch_time
      then (((p_submitted at time zone 'Europe/Madrid')::date + p_batch_time)
            at time zone 'Europe/Madrid')
    else ((((p_submitted at time zone 'Europe/Madrid')::date + 1) + p_batch_time)
          at time zone 'Europe/Madrid')
  end;
$$;

-- 4.3 settle(): does nothing unless something is actually due, and is safe to
--     call from many places at the same time (advisory lock + a signature of
--     the inputs, so identical input is never recomputed).
create or replace function public.ieu_settle()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round    public.rounds%rowtype;
  v_students jsonb;
  v_seats    jsonb;
  v_sig      text;
  v_res      jsonb;
begin
  select * into v_round
    from public.rounds
   where is_current
   order by application_deadline
   limit 1;
  if not found then return; end if;

  -- Nothing can be decided before the application deadline has passed.
  if now() <= v_round.application_deadline then return; end if;

  -- Another settle is already running: let it finish, nothing to do here.
  if not pg_try_advisory_xact_lock(hashtext('ieu_settle:' || v_round.id::text)) then
    return;
  end if;

  select * into v_round from public.rounds where id = v_round.id;

  select coalesce(jsonb_agg(jsonb_build_object('lab_id', l.id::text, 'seats', l.seats)
                            order by l.id), '[]'::jsonb)
    into v_seats
    from public.lab_seats l;

  with app as (
    select a.user_id,
           a.first_submitted_at,
           a.dropped_at,
           (a.first_submitted_at > v_round.application_deadline) as is_late
      from public.applications a
     where a.round_id = v_round.id
  ), elig as (
    select app.user_id,
           case when app.is_late
                then extract(epoch from
                       public.ieu_batch_at(app.first_submitted_at, v_round.batch_time))::numeric
                else 0 end as batch
      from app
     where app.dropped_at is null
       and (not app.is_late or (
              app.first_submitted_at <= v_round.add_deadline
              and public.ieu_batch_at(app.first_submitted_at, v_round.batch_time) <= now()))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', e.user_id::text,
           'lottery', l.lottery_number,
           'batch',   e.batch,
           'prefs',   coalesce(p.prefs, '[]'::jsonb)) order by e.user_id), '[]'::jsonb)
    into v_students
    from elig e
    join public.lottery l
      on l.round_id = v_round.id and l.user_id = e.user_id
    left join lateral (
      select jsonb_agg(r.lab_id::text order by r.rank) as prefs
        from public.rankings r
       where r.round_id = v_round.id and r.user_id = e.user_id
    ) p on true;

  v_sig := md5(v_seats::text || '|' || v_students::text);
  if v_round.last_signature is not distinct from v_sig then
    return;  -- nothing changed since last time
  end if;

  v_res := public.ieu_match(v_students, v_seats);

  insert into public.results as t
      (round_id, user_id, lab_id, choice_rank, waitlist, computed_at)
  select v_round.id,
         (r->>'user_id')::uuid,
         (r->>'lab_id')::uuid,
         (r->>'choice_rank')::int,
         coalesce(r->'waitlist', '[]'::jsonb),
         now()
    from jsonb_array_elements(v_res) as r
  on conflict (round_id, user_id) do update
    set previous_lab_id = case when t.lab_id is distinct from excluded.lab_id
                               then t.lab_id else t.previous_lab_id end,
        changed_at      = case when t.lab_id is distinct from excluded.lab_id
                               then now() else t.changed_at end,
        lab_id      = excluded.lab_id,
        choice_rank = excluded.choice_rank,
        waitlist    = excluded.waitlist,
        computed_at = now();

  -- Students who dropped (or whose batch is not out yet) hold no result.
  delete from public.results d
   where d.round_id = v_round.id
     and not exists (select 1 from jsonb_array_elements(v_res) as r
                      where (r->>'user_id')::uuid = d.user_id);

  update public.rounds
     set last_signature = v_sig,
         last_settled_at = now()
   where id = v_round.id;
end;
$$;

-- 4.4 Seats still free per lab — counts only, never names.
create or replace function public.ieu_open_seats()
returns table (lab_id uuid, open_seats integer)
language sql
security definer
set search_path = ''
as $$
  select l.id,
         greatest(l.seats - (select count(*)::int
                               from public.results r
                               join public.rounds ro on ro.id = r.round_id and ro.is_current
                              where r.lab_id = l.id), 0)
    from public.lab_seats l;
$$;

-- ---------------------------------------------------------------------
-- 5. FUNCTIONS A STUDENT CALLS — each one only ever touches auth.uid()
-- ---------------------------------------------------------------------

-- 5.1 Save (or replace) my ranking. The lottery number is created here, by the
--     database, at random. I can never choose or change it.
create or replace function public.ieu_save_ranking(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_round public.rounds%rowtype;
  v_app   public.applications%rowtype;
  v_n     integer;
  v_item  jsonb;
  v_i     integer := 0;
begin
  if v_uid is null then raise exception 'You must be logged in.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'A ranking must be a list of labs.';
  end if;

  v_n := jsonb_array_length(p_items);
  if v_n < 1 or v_n > 5 then
    raise exception 'Rank between 1 and 5 labs.';
  end if;

  select * into v_round from public.rounds
   where is_current order by application_deadline limit 1;
  if not found then raise exception 'There is no open round right now.'; end if;

  select * into v_app from public.applications
   where round_id = v_round.id and user_id = v_uid;

  if found then
    -- Already applied: on-time students may edit until the application
    -- deadline; a late ranking is final once submitted.
    if v_app.dropped_at is not null then
      raise exception 'You dropped your place in this round.';
    end if;
    if v_app.first_submitted_at > v_round.application_deadline then
      raise exception 'A late ranking cannot be changed.';
    end if;
    if now() > v_round.application_deadline then
      raise exception 'The application deadline has passed.';
    end if;
  else
    -- New applicant: on time before the application deadline, late (daily
    -- batch) up to the add deadline.
    if now() > v_round.add_deadline then
      raise exception 'The add deadline has passed.';
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as i
     where not exists (select 1 from public.lab_seats l
                        where l.id = (i->>'lab_id')::uuid)) then
    raise exception 'One of those labs does not exist.';
  end if;

  if (select count(distinct (i->>'lab_id')) from jsonb_array_elements(p_items) as i) <> v_n then
    raise exception 'You cannot rank the same lab twice.';
  end if;

  insert into public.applications (round_id, user_id)
  values (v_round.id, v_uid)
  on conflict (round_id, user_id) do nothing;

  -- The lottery number: assigned once, by the database, never again.
  insert into public.lottery (round_id, user_id, lottery_number)
  values (v_round.id, v_uid, random())
  on conflict (round_id, user_id) do nothing;

  delete from public.rankings where round_id = v_round.id and user_id = v_uid;

  for v_item in select i from jsonb_array_elements(p_items) as i loop
    v_i := v_i + 1;
    insert into public.rankings (round_id, user_id, lab_id, rank, reason)
    values (v_round.id, v_uid, (v_item->>'lab_id')::uuid, v_i,
            nullif(trim(coalesce(v_item->>'reason','')), ''));
  end loop;

  return jsonb_build_object('ok', true, 'count', v_i);
end;
$$;

-- 5.2 Everything I am allowed to see about my own place, including my own
--     lottery number. Never anybody else's.
create or replace function public.ieu_my_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_round public.rounds%rowtype;
begin
  if v_uid is null then raise exception 'You must be logged in.'; end if;

  select * into v_round from public.rounds
   where is_current order by application_deadline limit 1;
  if not found then return jsonb_build_object('round', null); end if;

  return jsonb_build_object(
    'round', to_jsonb(v_round) - 'last_signature',
    'lottery_number', (select l.lottery_number from public.lottery l
                        where l.round_id = v_round.id and l.user_id = v_uid),
    'submitted_at',  (select a.first_submitted_at from public.applications a
                        where a.round_id = v_round.id and a.user_id = v_uid),
    'dropped_at',    (select a.dropped_at from public.applications a
                        where a.round_id = v_round.id and a.user_id = v_uid),
    'result',        (select to_jsonb(r) from public.results r
                        where r.round_id = v_round.id and r.user_id = v_uid)
  );
end;
$$;

-- 5.3 Drop my place. Matching re-runs straight away, in the same order, so
--     everybody else either moves up or stays where they are.
create or replace function public.ieu_drop()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_round public.rounds%rowtype;
begin
  if v_uid is null then raise exception 'You must be logged in.'; end if;

  select * into v_round from public.rounds
   where is_current order by application_deadline limit 1;
  if not found then raise exception 'There is no open round right now.'; end if;
  if now() > v_round.drop_deadline then raise exception 'The drop deadline has passed.'; end if;

  if not exists (select 1 from public.results r
                  where r.round_id = v_round.id and r.user_id = v_uid
                    and r.lab_id is not null) then
    raise exception 'You do not hold a lab place to drop.';
  end if;

  update public.applications
     set dropped_at = now()
   where round_id = v_round.id and user_id = v_uid and dropped_at is null;

  perform public.ieu_settle();
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. FUNCTION GRANTS — the anon key can call nothing.
-- ---------------------------------------------------------------------

revoke all on function public.ieu_match(jsonb, jsonb)       from public, anon;
revoke all on function public.ieu_batch_at(timestamptz, time) from public, anon;
revoke all on function public.ieu_settle()                  from public, anon;
revoke all on function public.ieu_open_seats()              from public, anon;
revoke all on function public.ieu_save_ranking(jsonb)       from public, anon;
revoke all on function public.ieu_my_status()               from public, anon;
revoke all on function public.ieu_drop()                    from public, anon;

grant execute on function public.ieu_settle()            to authenticated;
grant execute on function public.ieu_open_seats()        to authenticated;
grant execute on function public.ieu_save_ranking(jsonb) to authenticated;
grant execute on function public.ieu_my_status()         to authenticated;
grant execute on function public.ieu_drop()              to authenticated;

-- ---------------------------------------------------------------------
-- 7. SEED DATA (only inserted if missing — your own edits are never
--    overwritten when this file is run again)
-- ---------------------------------------------------------------------

insert into public.lab_seats (name, area, seats, tagline, sort_order) values
  ('AI Lab','Consultancy',8,'Experience the corporate world of artificial intelligence.',1),
  ('Behavior Lab','Consultancy',10,'Make positive change through people.',2),
  ('Branding Lab','Consultancy',8,'Get your brand across to your audience.',3),
  ('Communication Lab','Consultancy',12,'Create media content that matters.',4),
  ('Econ Data Lab','Consultancy',10,'Dive into the data and make economics relevant.',5),
  ('Entertainment Lab','Consultancy',8,'Join the revolution across music, film and digital content.',6),
  ('Finance Lab','Consultancy',10,'Analyze financial markets to optimize investment strategies.',7),
  ('Innovation Lab','Consultancy',8,'Unleash creativity through real business growth challenges.',8),
  ('Legal Clinic','Consultancy',8,'Offer legal advice and counselling to NGOs and startups.',9),
  ('Marketing Lab','Consultancy',12,'Build brand strategy and marketing plans for real clients.',10),
  ('Policy Lab','Consultancy',10,'Develop professional projects for public and private organizations.',11),
  ('Strategy Lab','Consultancy',10,'Connecting businesses with bright new minds.',12),
  ('Tech Lab','Consultancy',10,'Design innovative solutions for real-life technology challenges.',13),
  ('Social Impact Lab','Social Impact',12,'Work in social development consultancy to help people and communities.',14),
  ('Sustainability Lab','Social Impact',10,'Build a sustainable and regenerative future.',15),
  ('Start-Up Lab','Entrepreneurship',15,'Bring your business ideas to life.',16)
on conflict (name) do nothing;

-- One current round. Change these four dates by hand in
-- Supabase -> Table Editor -> rounds.
insert into public.rounds
  (name, application_deadline, add_deadline, drop_deadline, batch_time, is_current)
select 'Current round',
       now() + interval '7 days',
       now() + interval '14 days',
       now() + interval '21 days',
       '20:00',
       true
where not exists (select 1 from public.rounds where is_current);

-- ---------------------------------------------------------------------
-- 8. OPTIONAL: run the matching automatically every 10 minutes.
--    Supabase -> Database -> Extensions -> enable "pg_cron", then run:
--
--      select cron.schedule('ieu-settle', '*/10 * * * *',
--                           $job$ select public.ieu_settle(); $job$);
--
--    (The app also calls ieu_settle() whenever /apply or the "Your lab
--     place" card loads, so cron is a belt-and-braces extra.)
-- ---------------------------------------------------------------------
