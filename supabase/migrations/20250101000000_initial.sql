-- StudyFlash: schema iniziale

-- Tabella dispense
create table dispense (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titolo text not null,
  nome_file text not null,
  storage_path text not null,
  testo_estratto text,
  num_flashcard integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabella flashcard
create table flashcard (
  id uuid primary key default gen_random_uuid(),
  dispensa_id uuid not null references dispense(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  fronte text not null,
  retro text not null,
  difficolta text not null check (difficolta in ('facile', 'media', 'difficile')),
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

-- Tabella quiz
create table quiz_domande (
  id uuid primary key default gen_random_uuid(),
  dispensa_id uuid not null references dispense(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  domanda text not null,
  opzioni jsonb not null,
  risposta_corretta integer not null,
  spiegazione text not null,
  created_at timestamptz not null default now()
);

-- Indici per query frequenti
create index idx_dispense_user on dispense(user_id);
create index idx_flashcard_dispensa on flashcard(dispensa_id);
create index idx_flashcard_user on flashcard(user_id);
create index idx_quiz_dispensa on quiz_domande(dispensa_id);

-- RLS (Row Level Security)
alter table dispense enable row level security;
alter table flashcard enable row level security;
alter table quiz_domande enable row level security;

-- Policy: utenti vedono solo i propri dati
create policy "Utenti vedono le proprie dispense"
  on dispense for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Utenti vedono le proprie flashcard"
  on flashcard for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Utenti vedono i propri quiz"
  on quiz_domande for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage bucket per i PDF
insert into storage.buckets (id, name, public)
values ('dispense', 'dispense', false);

create policy "Utenti caricano i propri file"
  on storage.objects for insert
  with check (
    bucket_id = 'dispense'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Utenti leggono i propri file"
  on storage.objects for select
  using (
    bucket_id = 'dispense'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Trigger per aggiornare updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger dispense_updated_at
  before update on dispense
  for each row execute function update_updated_at();
