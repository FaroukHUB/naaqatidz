-- Naaqati — durcissement signalé par les conseillers de sécurité Supabase (22/10/2026).
-- is_admin / current_pricing_profile : utiles aux règles RLS des utilisateurs connectés uniquement.
revoke all on function public.is_admin() from public, anon;
revoke all on function public.current_pricing_profile() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.current_pricing_profile() to authenticated, service_role;
-- Fonctions de déclencheur : jamais appelées directement.
alter function public.touch_updated_at() set search_path = '';
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.orders_guard_update() from public, anon, authenticated;
