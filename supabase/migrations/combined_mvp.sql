-- StudyFlash MVP — Run this in the Supabase SQL Editor
-- Dashboard → SQL Editor → New query → Paste → Run

-- ============================================
-- Tabella dispense
-- ============================================
create table if not exists dispense (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  titolo text not null,
  nome_file text not null default '',
  storage_path text not null default '',
  testo_estratto text,
  materia text,
  tags text[],
  num_flashcard integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- Tabella flashcard
-- ============================================
create table if not exists flashcard (
  id uuid primary key default gen_random_uuid(),
  dispensa_id uuid not null references dispense(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  fronte text not null,
  retro text not null,
  difficolta text not null check (difficolta in ('facile', 'media', 'difficile')),
  ordine integer not null default 0,
  importante boolean not null default false,
  image_url text,
  created_at timestamptz not null default now()
);

-- ============================================
-- Tabella quiz_domande
-- ============================================
create table if not exists quiz_domande (
  id uuid primary key default gen_random_uuid(),
  dispensa_id uuid not null references dispense(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  domanda text not null,
  opzioni jsonb not null,
  risposta_corretta integer not null,
  spiegazione text not null,
  created_at timestamptz not null default now()
);

-- ============================================
-- Indici
-- ============================================
create index if not exists idx_dispense_user on dispense(user_id);
create index if not exists idx_flashcard_dispensa on flashcard(dispensa_id);
create index if not exists idx_flashcard_user on flashcard(user_id);
create index if not exists idx_quiz_dispensa on quiz_domande(dispensa_id);

-- ============================================
-- Trigger updated_at
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists dispense_updated_at on dispense;
create trigger dispense_updated_at
  before update on dispense
  for each row execute function update_updated_at();

-- ============================================
-- RLS disabilitato per MVP (no auth)
-- ============================================
alter table dispense disable row level security;
alter table flashcard disable row level security;
alter table quiz_domande disable row level security;
