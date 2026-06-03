-- ============================================================================
-- SONUSWEALTH — READ-ONLY SCHEMA INSPECTION (safe to run anytime)
-- Purpose: triage every table in `public` — RLS status, row counts, columns,
-- and the full foreign-key linkage graph. Used to (1) find UNRESTRICTED tables,
-- (2) identify orphan/test tables and what data they hold, (3) build the ER map.
-- Nothing here writes or changes anything.
-- Run each block, paste the results back.
-- ============================================================================

-- ── 1) Every table: RLS on/off + approx row count (UNRESTRICTED = rls_enabled false)
select  t.tablename                          as table_name,
        c.relrowsecurity                     as rls_enabled,
        coalesce(s.n_live_tup, 0)            as approx_rows
from    pg_tables t
join    pg_class c   on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
left join pg_stat_user_tables s on s.relname = t.tablename
where   t.schemaname = 'public'
order by c.relrowsecurity asc, t.tablename;   -- unrestricted tables surface first

-- ── 2) Columns of the NON-finio (orphan/test) tables — what do they hold?
--      (anything our app might be missing shows up here)
select  table_name, ordinal_position, column_name, data_type, is_nullable
from    information_schema.columns
where   table_schema = 'public'
  and   table_name not like 'finio\_%' escape '\'
order by table_name, ordinal_position;

-- ── 3) Full foreign-key linkage graph (which table references which) → ER map
select  tc.table_name      as from_table,
        kcu.column_name    as fk_column,
        ccu.table_name     as references_table,
        ccu.column_name    as references_column
from    information_schema.table_constraints tc
join    information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join    information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where   tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
order by from_table, fk_column;

-- ── 4) Optional: a peek at the orphan tables' actual data (first rows).
--      Uncomment per table once block 2 confirms the exact names.
-- select * from public.test_audit_ledger     limit 5;
-- select * from public.macro_economic_data   limit 5;
-- select * from public.financial_snapshots   limit 5;
