This adds a local Postgres service via Docker Compose.

Files added:
- `docker-compose.yml` — starts a Postgres 15 container and a `db_data` volume.
- `env.postgres` — contains Postgres env vars used by the compose file.

Usage:
1. Start Postgres:

```bash
cd /Users/ufinity/Documents/mol-projects/Desk-Manager
docker compose up -d
```

2. Check status:

```bash
docker compose ps
docker compose logs --tail=50 db
```

3. Run a readiness check inside the container:

```bash
docker compose exec db pg_isready -U postgres
```

Notes:
- I couldn't read your external `app-config.ts`, so I used conventional env names (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`).
- If your app expects different env var names, tell me the exact names and I will update `docker-compose.yml` or provide a `.env` mapping.
