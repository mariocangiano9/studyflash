-- Add last_seen_at for smart feed algorithm
ALTER TABLE flashcard ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
