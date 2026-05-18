# Database Migrations

Run migrations against the same Neon database used by Vercel:

```bash
export DIRECT_DATABASE_URL='postgresql://...'
psql "$DIRECT_DATABASE_URL" -f db/migrations/001_initial.sql
psql "$DIRECT_DATABASE_URL" -f db/migrations/002_auth.sql
psql "$DIRECT_DATABASE_URL" -f db/migrations/003_watchlists.sql
psql "$DIRECT_DATABASE_URL" -f db/migrations/004_ingestion_reports.sql
```

The optional grants only run when the `ingestion_user` role exists. If Vercel uses
a different Neon role, grant permissions to that role explicitly in Neon.
