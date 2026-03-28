CREATE TABLE IF NOT EXISTS quiz_risultati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  materia text NOT NULL,
  dispense_ids uuid[] NOT NULL,
  num_domande integer NOT NULL,
  risposte_corrette integer NOT NULL,
  percentuale integer NOT NULL,
  completato_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quiz_risultati DISABLE ROW LEVEL SECURITY;
