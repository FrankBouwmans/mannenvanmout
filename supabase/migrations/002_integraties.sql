-- =====================================================================
--  MANNEN VAN MOUT – uitbreiding voor Grainfather/Brewfather-import
--  Plak in Supabase → SQL Editor → New query → Run. Veilig om opnieuw te draaien.
-- =====================================================================
alter table public.brews        add column if not exists source      text;  -- 'beerxml', 'brewfather' of leeg
alter table public.brews        add column if not exists external_id text;  -- Brewfather batch-id
alter table public.measurements add column if not exists source      text;  -- 'brewfather' = gesynchroniseerd

create unique index if not exists brews_source_external_uidx
  on public.brews (source, external_id) where external_id is not null;
