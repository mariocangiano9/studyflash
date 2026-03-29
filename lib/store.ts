import { supabaseAdmin } from "@/lib/supabase/server";

const db = () => supabaseAdmin();

const FC_COLS = "id, titolo, testo, tag, difficolta, ordine, importante, salvato, image_url, image_prompt, last_seen_at, dispensa_id, colore";

export interface StoredFlashcard {
  id: string;
  titolo: string;
  testo: string;
  tag: string[] | null;
  difficolta: "facile" | "media" | "difficile";
  ordine: number;
  importante: boolean;
  salvato: boolean;
  image_url: string | null;
  image_prompt: string | null;
  last_seen_at: string | null;
  dispensa_id?: string;
  colore?: string | null;
}

export interface StoredDispensa {
  dispensaId: string;
  titolo: string;
  materia: string | null;
  tags: string[] | null;
  colore: string | null;
  createdAt: string;
  numFlashcard: number;
}

// ── Dispense ──

export async function saveDispensa(
  dispensaId: string,
  data: { titolo: string; materia?: string; tags?: string[] }
) {
  const { error } = await db()
    .from("dispense")
    .upsert({
      id: dispensaId,
      titolo: data.titolo,
      materia: data.materia || null,
      tags: data.tags?.length ? data.tags : null,
    }, { onConflict: "id" });

  if (error) throw new Error(`Errore salvataggio dispensa: ${error.message}`);
}

export async function getDispensa(dispensaId: string) {
  const { data, error } = await db()
    .from("dispense")
    .select("id, titolo, materia, tags, created_at")
    .eq("id", dispensaId)
    .single();

  if (error || !data) return null;
  return {
    dispensaId: data.id,
    titolo: data.titolo,
    materia: data.materia,
    tags: data.tags,
    createdAt: data.created_at,
  };
}

export async function getAllDispense(): Promise<StoredDispensa[]> {
  const { data, error } = await db()
    .from("dispense")
    .select("id, titolo, materia, tags, colore, created_at, flashcard(count)")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((d) => {
    const countArr = d.flashcard as unknown as { count: number }[];
    return {
      dispensaId: d.id,
      titolo: d.titolo,
      materia: d.materia,
      tags: d.tags,
      colore: d.colore,
      createdAt: d.created_at,
      numFlashcard: countArr?.[0]?.count ?? 0,
    };
  });
}

export async function deleteDispensa(dispensaId: string): Promise<boolean> {
  const { error } = await db()
    .from("dispense")
    .delete()
    .eq("id", dispensaId);

  return !error;
}

export async function updateDispensaColore(dispensaId: string, colore: string) {
  // Update dispensa
  const { error: e1 } = await db()
    .from("dispense")
    .update({ colore })
    .eq("id", dispensaId);
  if (e1) throw new Error(`Errore aggiornamento colore dispensa: ${e1.message}`);

  // Update all flashcards of this dispensa
  const { error: e2 } = await db()
    .from("flashcard")
    .update({ colore })
    .eq("dispensa_id", dispensaId);
  if (e2) throw new Error(`Errore aggiornamento colore flashcard: ${e2.message}`);
}

export async function updateDispensaMateria(dispensaId: string, materia: string) {
  const { error } = await db()
    .from("dispense")
    .update({ materia })
    .eq("id", dispensaId);

  if (error) throw new Error(`Errore aggiornamento materia: ${error.message}`);
}

export async function updateDispensaTags(dispensaId: string, tags: string[]) {
  const tagsValue = tags.length > 0 ? tags : null;

  const { error: dispError } = await db()
    .from("dispense")
    .update({ tags: tagsValue })
    .eq("id", dispensaId);

  if (dispError) throw new Error(`Errore aggiornamento tag dispensa: ${dispError.message}`);

  const { error: fcError } = await db()
    .from("flashcard")
    .update({ tag: tagsValue })
    .eq("dispensa_id", dispensaId);

  if (fcError) throw new Error(`Errore propagazione tag flashcard: ${fcError.message}`);
}

// ── Flashcard ──

export async function saveFlashcards(
  dispensaId: string,
  flashcards: {
    titolo: string;
    testo: string;
    tag: string[];
    difficolta: string;
    ordine: number;
    image_prompt: string;
  }[]
) {
  const rows = flashcards.map((fc) => ({
    dispensa_id: dispensaId,
    titolo: fc.titolo,
    testo: fc.testo,
    tag: fc.tag,
    difficolta: fc.difficolta,
    ordine: fc.ordine,
    image_prompt: fc.image_prompt,
  }));

  const { data, error } = await db()
    .from("flashcard")
    .insert(rows)
    .select(FC_COLS);

  if (error) throw new Error(`Errore salvataggio flashcard: ${error.message}`);

  await db()
    .from("dispense")
    .update({ num_flashcard: flashcards.length })
    .eq("id", dispensaId);

  return data as StoredFlashcard[];
}

export async function deleteFlashcard(flashcardId: string): Promise<boolean> {
  const { error } = await db()
    .from("flashcard")
    .delete()
    .eq("id", flashcardId);

  return !error;
}

export async function updateFlashcardImageUrl(flashcardId: string, imageUrl: string) {
  await db()
    .from("flashcard")
    .update({ image_url: imageUrl })
    .eq("id", flashcardId);
}

export async function getFlashcardsByDispensa(dispensaId: string): Promise<StoredFlashcard[]> {
  const { data, error } = await db()
    .from("flashcard")
    .select(FC_COLS)
    .eq("dispensa_id", dispensaId)
    .order("ordine");

  if (error || !data) return [];
  return data as StoredFlashcard[];
}

export async function getAllFlashcardsForFeed(opts?: { dispensaIds?: string[]; tag?: string; saved?: boolean }): Promise<(StoredFlashcard & { materia: string })[]> {
  const PAGE_SIZE = 1000;
  const allData: Record<string, unknown>[] = [];
  let from = 0;

  // Paginate to fetch ALL rows (Supabase default limit = 1000)
  while (true) {
    let query = db()
      .from("flashcard")
      .select(`${FC_COLS}, dispense!inner(titolo, materia)`)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (opts?.dispensaIds && opts.dispensaIds.length > 0) {
      query = query.in("dispensa_id", opts.dispensaIds);
    }
    if (opts?.tag) {
      query = query.contains("tag", [opts.tag]);
    }
    if (opts?.saved) {
      query = query.eq("salvato", true);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) break;

    allData.push(...data);
    if (data.length < PAGE_SIZE) break; // Last page
    from += PAGE_SIZE;
  }

  return allData.map((fc) => {
    const dispensa = fc.dispense as unknown as { titolo: string; materia: string | null };
    return {
      ...(fc as unknown as StoredFlashcard),
      materia: dispensa.materia || dispensa.titolo,
    };
  });
}

export async function getAllFlashcards(): Promise<(StoredFlashcard & { materia: string })[]> {
  return getAllFlashcardsForFeed();
}

export async function updateFlashcard(
  flashcardId: string,
  updates: Partial<{
    titolo: string;
    testo: string;
    difficolta: string;
    importante: boolean;
    image_url: string | null;
    last_seen_at: string | null;
  }>
) {
  const { error } = await db()
    .from("flashcard")
    .update(updates)
    .eq("id", flashcardId);

  if (error) throw new Error(`Errore aggiornamento flashcard: ${error.message}`);
}

export async function markFlashcardSeen(flashcardId: string) {
  await db()
    .from("flashcard")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", flashcardId);
}

export async function resetAllSeen() {
  await db()
    .from("flashcard")
    .update({ last_seen_at: null })
    .not("last_seen_at", "is", null);
}

// ── Quiz Domande ──

export async function saveQuizDomande(
  domande: {
    flashcard_id: string;
    domanda: string;
    opzioni: string[];
    risposta_corretta: number;
    spiegazione: string;
  }[]
) {
  if (domande.length === 0) return;

  const { error } = await db()
    .from("quiz_domande")
    .insert(domande);

  if (error) throw new Error(`Errore salvataggio quiz: ${error.message}`);
}

export interface StoredQuizDomanda {
  id: string;
  flashcard_id: string;
  domanda: string;
  opzioni: string[];
  risposta_corretta: number;
  spiegazione: string;
}

export async function getQuizDomandeByDispensa(dispensaId: string): Promise<StoredQuizDomanda[]> {
  const { data, error } = await db()
    .from("quiz_domande")
    .select("id, flashcard_id, domanda, opzioni, risposta_corretta, spiegazione, flashcard!inner(dispensa_id)")
    .eq("flashcard.dispensa_id", dispensaId);

  if (error || !data) return [];
  return data.map((d) => ({
    id: d.id,
    flashcard_id: d.flashcard_id,
    domanda: d.domanda,
    opzioni: d.opzioni as string[],
    risposta_corretta: d.risposta_corretta,
    spiegazione: d.spiegazione,
  }));
}

// ── Quiz Risultati ──

export async function saveQuizRisultato(risultato: {
  materia: string;
  dispense_ids: string[];
  num_domande: number;
  risposte_corrette: number;
  percentuale: number;
}) {
  const { error } = await db()
    .from("quiz_risultati")
    .insert(risultato);

  if (error) throw new Error(`Errore salvataggio risultato quiz: ${error.message}`);
}

export interface QuizRisultatoPerMateria {
  materia: string;
  media_percentuale: number;
  num_quiz: number;
  trend: "migliorato" | "peggiorato" | "stabile" | "primo";
}

export async function getQuizRisultati(): Promise<QuizRisultatoPerMateria[]> {
  const { data, error } = await db()
    .from("quiz_risultati")
    .select("materia, percentuale, completato_at")
    .order("completato_at", { ascending: true });

  if (error || !data || data.length === 0) return [];

  const perMateria: Record<string, { percentuali: number[] }> = {};
  for (const r of data) {
    if (!perMateria[r.materia]) perMateria[r.materia] = { percentuali: [] };
    perMateria[r.materia].percentuali.push(r.percentuale);
  }

  return Object.entries(perMateria).map(([materia, { percentuali }]) => {
    const media = Math.round(percentuali.reduce((a, b) => a + b, 0) / percentuali.length);
    let trend: QuizRisultatoPerMateria["trend"] = "primo";
    if (percentuali.length >= 2) {
      const ultimo = percentuali[percentuali.length - 1];
      const penultimo = percentuali[percentuali.length - 2];
      trend = ultimo > penultimo ? "migliorato" : ultimo < penultimo ? "peggiorato" : "stabile";
    }
    return { materia, media_percentuale: media, num_quiz: percentuali.length, trend };
  });
}

export async function getAllQuizDomande(): Promise<StoredQuizDomanda[]> {
  const { data, error } = await db()
    .from("quiz_domande")
    .select("id, flashcard_id, domanda, opzioni, risposta_corretta, spiegazione");

  if (error || !data) return [];
  return data.map((d) => ({
    id: d.id,
    flashcard_id: d.flashcard_id,
    domanda: d.domanda,
    opzioni: d.opzioni as string[],
    risposta_corretta: d.risposta_corretta,
    spiegazione: d.spiegazione,
  }));
}
