-- Add the third Casa Padel court and the fourth La Jaula court.
--
-- The original venue_portal seed (20260520120000) only created 2 courts for
-- Casa Padel and 3 for La Jaula. In reality Casa Padel has 3 courts and La
-- Jaula has 4. With too few court rows, pickAvailableCourt() runs out of free
-- courts early and blocks creating additional simultaneous matches at the same
-- time slot. These rows were added manually in production; this migration makes
-- them permanent and reproducible on a fresh database.

insert into public.venue_courts (venue_id, name, sort_order)
select v.venue_id, v.name, v.sort_order
from (
  values
    ('casa-padel', 'Cancha 3', 3),
    ('la-jaula', 'Cancha 4', 4)
) as v(venue_id, name, sort_order)
where not exists (
  select 1 from public.venue_courts c
  where c.venue_id = v.venue_id and c.name = v.name
);
