import { defineConfig } from "drizzle-kit";

const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.POSTGRES_USER || process.env.PGUSER || "postgres";
  const pass =
    process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || "postgres";
  const host = process.env.POSTGRES_HOST || "localhost";
  const port = process.env.POSTGRES_PORT || process.env.PGPORT || "5432";
  const db =
    process.env.POSTGRES_DB || process.env.PGDATABASE || "desk_manager";
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}`;
};

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl() + "?sslmode=no-verify",
    ssl: true,
  },
});
