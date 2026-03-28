export interface Dispensa {
  id: string;
  user_id: string;
  titolo: string;
  nome_file: string;
  storage_path: string;
  testo_estratto: string | null;
  materia: string | null;
  tags: string[] | null;
  num_flashcard: number;
  created_at: string;
  updated_at: string;
}

export interface Flashcard {
  id: string;
  dispensa_id: string;
  titolo: string;
  testo: string;
  tag: string[];
  ordine: number;
  difficolta: "facile" | "media" | "difficile";
  importante: boolean;
  image_url: string | null;
  image_prompt: string | null;
  last_seen_at: string | null;
}

export interface FlashcardGenerata {
  titolo: string;
  testo: string;
  tag: string[];
  ordine: number;
  difficolta: "facile" | "media" | "difficile";
  image_prompt: string;
}

export interface QuizDomanda {
  id: string;
  flashcard_id: string;
  user_id: string;
  domanda: string;
  opzioni: string[];
  risposta_corretta: number;
  spiegazione: string;
  created_at: string;
}

export interface QuizGenerato {
  flashcard_id: string;
  domanda: string;
  opzioni: string[];
  risposta_corretta: number;
  spiegazione: string;
}
