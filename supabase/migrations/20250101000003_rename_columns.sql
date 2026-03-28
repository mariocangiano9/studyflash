-- Rename fronte/retro to titolo/testo, add image_prompt and tag
ALTER TABLE flashcard RENAME COLUMN fronte TO titolo;
ALTER TABLE flashcard RENAME COLUMN retro TO testo;
ALTER TABLE flashcard ADD COLUMN IF NOT EXISTS image_prompt text;
ALTER TABLE flashcard ADD COLUMN IF NOT EXISTS tag text[];
