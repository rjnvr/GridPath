-- NextAuth (Auth.js) tables for the @auth/pg-adapter.
-- Schema from https://authjs.dev/getting-started/adapters/pg

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text unique,
  "emailVerified" timestamptz,
  image text
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references users(id) on delete cascade,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  id_token text,
  scope text,
  session_state text,
  token_type text,
  unique (provider, "providerAccountId")
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references users(id) on delete cascade,
  "sessionToken" text not null unique,
  expires timestamptz not null
);

create table if not exists verification_token (
  identifier text not null,
  token text not null,
  expires timestamptz not null,
  primary key (identifier, token)
);

create index if not exists accounts_userid_idx on accounts ("userId");
create index if not exists sessions_userid_idx on sessions ("userId");

-- The web app uses DIRECT_DATABASE_URL (ingestion_user) for auth writes.
-- Make sure that role can read/write these tables.
grant select, insert, update, delete on users, accounts, sessions, verification_token to ingestion_user;
