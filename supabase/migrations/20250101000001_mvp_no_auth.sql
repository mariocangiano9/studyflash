-- MVP senza auth: rende user_id opzionale e disabilita RLS temporaneamente
-- Aggiunge colonne per materia, preferiti e personalizzazione

-- Rimuovi RLS policies (verranno ricreate con auth)
drop policy if exists "Utenti vedono le proprie dispense" on dispense;
drop policy if exists "Utenti vedono le proprie flashcard" on flashcard;
drop policy if exists "Utenti vedono i propri quiz" on quiz_domande;

alter table dispense disable row level security;
alter table flashcard disable row level security;
alter table quiz_domande disable row level security;

-- user_id nullable per MVP
alter table dispense alter column user_id drop not null;
alter table dispense alter column user_id drop default;
alter table flashcard alter column user_id drop not null;
alter table flashcard alter column user_id drop default;
alter table quiz_domande alter column user_id drop not null;

-- nome_file e storage_path opzionali (non usiamo Storage ancora)
alter table dispense alter column nome_file drop not null;
alter table dispense alter column storage_path drop not null;
alter table dispense alter column nome_file set default '';
alter table dispense alter column storage_path set default '';

-- Nuove colonne su dispense
alter table dispense add column if not exists materia text;
alter table dispense add column if not exists tags text[];

-- Nuove colonne su flashcard per preferiti e personalizzazioni
alter table flashcard add column if not exists importante boolean not null default false;
alter table flashcard add column if not exists image_url text;
