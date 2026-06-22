-- Hotfix: 20260622120000 agregó invited_by_player_id como un SEGUNDO foreign key
-- match_players -> profiles. Eso hace AMBIGUO el embed PostgREST `profiles(...)`
-- sobre match_players (responde HTTP 300 Multiple Choices), rompiendo la página
-- de detalle del partido y notifyMatchFull en el código ya desplegado.
--
-- Quitamos el FK pero conservamos la columna. La integridad no es crítica (el id
-- se setea en código a un profile válido) y el nombre del invitador se resuelve
-- con una query aparte por id, no por embed.
alter table public.match_players
  drop constraint if exists match_players_invited_by_player_id_fkey;
