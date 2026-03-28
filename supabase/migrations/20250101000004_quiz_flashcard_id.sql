-- Link quiz_domande to flashcard (1:1 relationship)
ALTER TABLE quiz_domande ADD COLUMN IF NOT EXISTS flashcard_id uuid
  REFERENCES flashcard(id) ON DELETE CASCADE;

-- Remove old dispensa_id column (cascade handled via flashcard now)
ALTER TABLE quiz_domande DROP COLUMN IF EXISTS dispensa_id;
