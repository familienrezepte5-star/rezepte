-- Familienrezepte: Tabelle für alle Rezepte.
-- Zugriff läuft ausschließlich über die Edge Function "rezepte" (Service-Rolle).
-- Row Level Security ist an und es gibt absichtlich keine Policies:
-- Mit dem öffentlichen anon-Key kann niemand direkt lesen oder schreiben.

create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  source_url  text,
  image_url   text,
  servings    int  not null default 4 check (servings between 1 and 100),
  ingredients text[] not null default '{}',
  steps       text not null default '',
  tags        text[] not null default '{}',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Ein Chefkoch-Link soll nur einmal in der Sammlung vorkommen.
create unique index if not exists recipes_source_url_key
  on public.recipes (source_url) where source_url is not null;

alter table public.recipes enable row level security;
revoke all on public.recipes from anon, authenticated;
