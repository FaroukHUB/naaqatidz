#!/usr/bin/env bash
# Pile Supabase locale SANS `supabase start` (utile si les images Docker GoTrue/PostgREST ne sont pas téléchargeables) :
# Postgres officiel Supabase (Docker) + binaires Supabase Auth et PostgREST + passerelle Node (/auth/v1, /rest/v1).
# Usage normal recommandé : `npx supabase start` (voir docs/tests.md). Ce script est une alternative.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
BIN="${BIN_DIR:-/var/tmp/nq-bin}"   # contient ./auth (supabase/auth v2.197.0, x86) et ./postgrest (v12.2.3)
eval "$(node "$HERE/keys.mjs" | sed 's/^/export /')"
docker rm -f nq-supa-pg >/dev/null 2>&1 || true
docker run -d --name nq-supa-pg -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:54330:5432 supabase/postgres:17.11.0.004 >/dev/null
until PGPASSWORD=postgres psql -h 127.0.0.1 -p 54330 -U postgres -c "select 1" >/dev/null 2>&1; do sleep 2; done; sleep 3
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54330 -U supabase_admin -d postgres -c "alter role supabase_auth_admin with password 'postgres'; alter role authenticator with password 'postgres';"
(cd "$BIN" && GOTRUE_DB_DRIVER=postgres GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:postgres@127.0.0.1:54330/postgres?search_path=auth" \
  GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  GOTRUE_SITE_URL=http://localhost:3000 API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 GOTRUE_API_HOST=127.0.0.1 PORT=9999 \
  GOTRUE_DISABLE_SIGNUP=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=2500 \
  GOTRUE_SMTP_ADMIN_EMAIL=admin@example.com ./auth > /var/tmp/nq-auth.log 2>&1 &)
until curl -s http://127.0.0.1:9999/health >/dev/null; do sleep 1; done
for f in "$ROOT"/supabase/migrations/*.sql "$ROOT/supabase/seed.sql"; do PGPASSWORD=postgres psql -q -h 127.0.0.1 -p 54330 -U postgres -v ON_ERROR_STOP=1 -f "$f"; done
(PGRST_DB_URI="postgres://authenticator:postgres@127.0.0.1:54330/postgres" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=3001 PGRST_SERVER_HOST=127.0.0.1 "$BIN/postgrest" > /var/tmp/nq-pgrst.log 2>&1 &)
(node "$HERE/gateway.mjs" > /var/tmp/nq-gw.log 2>&1 &)
sleep 2
for u in admin dz dz2 fr; do
  curl -s -X POST http://127.0.0.1:54321/auth/v1/admin/users -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" -d "{\"email\":\"$u@test.local\",\"password\":\"Motdepasse-test-123\",\"email_confirm\":true}" >/dev/null
done
PGPASSWORD=postgres psql -q -h 127.0.0.1 -p 54330 -U postgres -c "
update profiles set role='admin', status='active' where email='admin@test.local';
update profiles set status='active', validated_country='DZ', pricing_profile='reseller_dz', company_name='Boutique test DZ' where email in ('dz@test.local','dz2@test.local');
update profiles set status='active', validated_country='FR', pricing_profile='reseller_fr', company_name='Boutique test FR' where email='fr@test.local';"
echo "Pile prête. .env.local :"
echo "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"
echo "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY"
echo "SUPABASE_SECRET_KEY=$SERVICE_KEY"
