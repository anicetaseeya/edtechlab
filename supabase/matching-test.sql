-- =====================================================================
-- IEU Labs — a test of the matching function on made-up students.
--
-- Paste this into Supabase -> SQL Editor -> New query -> Run.
-- It only READS. It creates nothing, changes nothing and deletes nothing,
-- and it does not touch any real student data. Run it as often as you like.
--
-- You should see four rows, all saying PASS.
-- =====================================================================

with
-- Three labs, four seats in total.
seats as (
  select '[{"lab_id":"A","seats":2},
           {"lab_id":"B","seats":1},
           {"lab_id":"C","seats":1}]'::jsonb as j
),

-- Six made-up students who applied on time (batch 0).
-- Lower lottery number = earlier turn.
ontime as (
  select '[{"user_id":"s1","lottery":0.10,"batch":0,"prefs":["A","B","C"]},
           {"user_id":"s2","lottery":0.20,"batch":0,"prefs":["A","B","C"]},
           {"user_id":"s3","lottery":0.30,"batch":0,"prefs":["A","B","C"]},
           {"user_id":"s4","lottery":0.40,"batch":0,"prefs":["B","A","C"]},
           {"user_id":"s5","lottery":0.50,"batch":0,"prefs":["C","A"]},
           {"user_id":"s6","lottery":0.60,"batch":0,"prefs":["A"]}]'::jsonb as j
),

-- The same round after s1 (who held a seat in lab A) drops out.
after_drop as (
  select '[{"user_id":"s2","lottery":0.20,"batch":0,"prefs":["A","B","C"]},
           {"user_id":"s3","lottery":0.30,"batch":0,"prefs":["A","B","C"]},
           {"user_id":"s4","lottery":0.40,"batch":0,"prefs":["B","A","C"]},
           {"user_id":"s5","lottery":0.50,"batch":0,"prefs":["C","A"]},
           {"user_id":"s6","lottery":0.60,"batch":0,"prefs":["A"]}]'::jsonb as j
),

-- The same six, plus two late students in batch 1. They are given the best
-- lottery numbers in the whole round on purpose: being late must still put
-- them last.
with_late as (
  select (select j from ontime) ||
         '[{"user_id":"L1","lottery":0.01,"batch":1,"prefs":["A","B","C"]},
           {"user_id":"L2","lottery":0.02,"batch":1,"prefs":["B","C","A"]}]'::jsonb as j
),

-- Run the matching three times.
r_base as (select public.ieu_match((select j from ontime),     (select j from seats)) as j),
r_drop as (select public.ieu_match((select j from after_drop), (select j from seats)) as j),
r_late as (select public.ieu_match((select j from with_late),  (select j from seats)) as j),

base as (select e->>'user_id' as uid, e->>'lab_id' as lab, (e->>'choice_rank')::int as rk
           from r_base, jsonb_array_elements(r_base.j) e),
dropd as (select e->>'user_id' as uid, e->>'lab_id' as lab, (e->>'choice_rank')::int as rk
           from r_drop, jsonb_array_elements(r_drop.j) e),
latem as (select e->>'user_id' as uid, e->>'lab_id' as lab, (e->>'choice_rank')::int as rk
           from r_late, jsonb_array_elements(r_late.j) e),

stu as (select e->>'user_id' as uid, (e->>'lottery')::numeric as lot,
               (e->>'batch')::numeric as bat, e->'prefs' as prefs
          from jsonb_array_elements((select j from ontime)) e),

-- CHECK 1 — no lab is ever over capacity.
c1 as (
  select bool_and(cnt <= cap) as ok,
         string_agg(lab || ' ' || cnt || '/' || cap || ' seats', ', ' order by lab) as detail
    from (select s->>'lab_id' as lab,
                 (s->>'seats')::int as cap,
                 (select count(*) from base b where b.lab = s->>'lab_id') as cnt
            from jsonb_array_elements((select j from seats)) s) q
),

-- CHECK 2 — lottery order is respected: nobody earlier in the order wants a
-- lab that somebody later in the order walked away with.
envy as (
  select se.uid as earlier, sl.uid as later, l.lab as coveted
    from stu se
    join base e  on e.uid = se.uid
    join stu sl  on (sl.bat, sl.lot) > (se.bat, se.lot)
    join base l  on l.uid = sl.uid
   where l.lab is not null
     and coalesce((select ord from jsonb_array_elements_text(se.prefs)
                     with ordinality t(v, ord) where t.v = l.lab), 999)
         < coalesce(e.rk, 999)
),
c2 as (
  select count(*) = 0 as ok,
         coalesce(string_agg(earlier || ' wanted ' || coveted || ' that ' || later
                             || ' got', '; '), 'no student was passed over') as detail
    from envy
),

-- CHECK 3 — a drop can only move people up, never down.
-- (choice 1 is better than choice 2; 999 means "no seat at all".)
c3 as (
  select bool_and(coalesce(d.rk, 999) <= coalesce(b.rk, 999)) as ok,
         string_agg(b.uid || ': ' || coalesce(b.rk::text, 'no seat') || ' -> '
                    || coalesce(d.rk::text, 'no seat'), ', ' order by b.uid) as detail
    from base b
    join dropd d on d.uid = b.uid
),

-- CHECK 4 — late students never displace an on-time student, even with the
-- best lottery numbers in the round.
c4 as (
  select bool_and(l.lab is not distinct from b.lab
                  and coalesce(l.rk, 999) = coalesce(b.rk, 999)) as ok,
         string_agg(b.uid || ': ' || coalesce(b.lab, 'no seat') || ' -> '
                    || coalesce(l.lab, 'no seat'), ', ' order by b.uid) as detail
    from base b
    join latem l on l.uid = b.uid
)

select 1 as n, 'No lab is over capacity'                        as "check",
       case when ok then 'PASS' else 'FAIL' end as result, detail from c1
union all
select 2, 'Lottery order is respected',
       case when ok then 'PASS' else 'FAIL' end, detail from c2
union all
select 3, 'A drop moves nobody down',
       case when ok then 'PASS' else 'FAIL' end, detail from c3
union all
select 4, 'Late students never displace on-time students',
       case when ok then 'PASS' else 'FAIL' end, detail from c4
order by n;


-- ---------------------------------------------------------------------
-- Optional: see exactly who got what in the three runs above.
-- ---------------------------------------------------------------------
-- with seats as (select '[{"lab_id":"A","seats":2},{"lab_id":"B","seats":1},{"lab_id":"C","seats":1}]'::jsonb j),
--      ontime as (select '[{"user_id":"s1","lottery":0.10,"batch":0,"prefs":["A","B","C"]},
--                          {"user_id":"s2","lottery":0.20,"batch":0,"prefs":["A","B","C"]},
--                          {"user_id":"s3","lottery":0.30,"batch":0,"prefs":["A","B","C"]},
--                          {"user_id":"s4","lottery":0.40,"batch":0,"prefs":["B","A","C"]},
--                          {"user_id":"s5","lottery":0.50,"batch":0,"prefs":["C","A"]},
--                          {"user_id":"s6","lottery":0.60,"batch":0,"prefs":["A"]}]'::jsonb j)
-- select jsonb_pretty(public.ieu_match((select j from ontime), (select j from seats)));
