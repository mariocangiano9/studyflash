import Anthropic from "@anthropic-ai/sdk";
import { FlashcardGenerata, QuizGenerato } from "@/types";

const isMockAI = process.env.MOCK_AI === "true";

const anthropic = isMockAI
  ? (null as unknown as Anthropic)
  : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MOCK_FLASHCARDS: FlashcardGenerata[] = [
  { titolo: "La Costituzione italiana", testo: "La Costituzione della Repubblica Italiana è la legge fondamentale dello Stato, entrata in vigore il 1° gennaio 1948.\n• Composta da 139 articoli e 18 disposizioni transitorie\n• Stabilisce principi fondamentali, diritti e doveri\nAd esempio, l'art. 1 sancisce che l'Italia è una Repubblica democratica fondata sul lavoro.", tag: ["costituzione", "diritto pubblico"], ordine: 1, difficolta: "facile", image_prompt: "Italian constitution document on marble desk, editorial photography, clean background" },
  { titolo: "Il principio di legalità", testo: "Il principio di legalità stabilisce che ogni atto dei pubblici poteri deve trovare fondamento in una norma di legge.\n• Cardine dello Stato di diritto\n• Impedisce l'arbitrio dell'autorità pubblica\nAd esempio, un funzionario non può imporre obblighi senza base legislativa.\nNel contesto penale si esprime nel brocardo 'nullum crimen, nulla poena sine lege'.", tag: ["legalità", "stato di diritto"], ordine: 2, difficolta: "media", image_prompt: "Scales of justice on wooden desk, soft lighting, editorial photography, clean background" },
  { titolo: "La separazione dei poteri", testo: "La separazione dei poteri attribuisce le funzioni legislativa, esecutiva e giudiziaria a organi distinti e indipendenti.\n• Garantisce equilibrio e controllo reciproco\n• Parlamento legifera, Governo esegue, Magistratura giudica\nAd esempio, una legge approvata dal Parlamento può essere dichiarata incostituzionale dalla Corte.\nNel contesto storico, fu teorizzata da Montesquieu nel XVIII secolo.", tag: ["separazione poteri", "Montesquieu"], ordine: 3, difficolta: "facile", image_prompt: "Three marble columns representing power, dramatic lighting, editorial photography, clean background" },
];

const MOCK_QUIZ: Omit<QuizGenerato, "flashcard_id">[] = [
  { domanda: "Quando è entrata in vigore la Costituzione italiana?", opzioni: ["1° gennaio 1946", "2 giugno 1946", "22 dicembre 1947", "1° gennaio 1948"], risposta_corretta: 3, spiegazione: "La Costituzione fu approvata il 22 dicembre 1947 ed entrò in vigore il 1° gennaio 1948." },
  { domanda: "Chi giudica la legittimità costituzionale delle leggi?", opzioni: ["Il Parlamento", "Il Presidente della Repubblica", "La Corte Costituzionale", "Il Consiglio di Stato"], risposta_corretta: 2, spiegazione: "La Corte Costituzionale è l'organo preposto al controllo di legittimità costituzionale." },
  { domanda: "Chi ha teorizzato la separazione dei poteri?", opzioni: ["Rousseau", "Montesquieu", "Locke", "Hobbes"], risposta_corretta: 1, spiegazione: "Montesquieu teorizzò la separazione dei poteri nel XVIII secolo." },
];

const SYSTEM_PROMPT = `Sei un professore universitario esperto di didattica. Crei post informativi da dispense universitarie italiane, come post di Instagram dedicati allo studio.`;

const MAX_CHARS_PER_CHUNK = 12000;

// ── Chunking ──

function splitTesto(testo: string): string[] {
  if (testo.length <= MAX_CHARS_PER_CHUNK) return [testo];

  const paragraphs = testo.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? current + "\n\n" + para : para;

    if (candidate.length <= MAX_CHARS_PER_CHUNK) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (para.length > MAX_CHARS_PER_CHUNK) {
      const lines = para.split(/\n/);
      for (const line of lines) {
        const lineCand = current ? current + "\n" + line : line;
        if (lineCand.length <= MAX_CHARS_PER_CHUNK) {
          current = lineCand;
        } else {
          if (current) chunks.push(current);
          // Single line exceeds limit — force split by character
          if (line.length > MAX_CHARS_PER_CHUNK) {
            for (let i = 0; i < line.length; i += MAX_CHARS_PER_CHUNK) {
              chunks.push(line.slice(i, i + MAX_CHARS_PER_CHUNK));
            }
            current = "";
          } else {
            current = line;
          }
        }
      }
    } else {
      current = para;
    }
  }

  if (current) chunks.push(current);

  // Verify: total chars of all chunks should equal original text (minus whitespace differences)
  const totalChunkChars = chunks.reduce((sum, c) => sum + c.length, 0);
  console.log(`[chunking] Testo totale: ${testo.length} chars → ${chunks.length} chunk (${totalChunkChars} chars in chunk)`);

  return chunks;
}

// ── JSON parsing ──

function parseJsonArray<T>(text: string): T[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);

  const arrayStart = text.indexOf("[");
  if (arrayStart === -1) throw new Error("Nessun JSON trovato nella risposta");

  let partial = text.slice(arrayStart);
  const lastBrace = partial.lastIndexOf("}");
  if (lastBrace === -1) throw new Error("JSON troncato senza oggetti completi");

  partial = partial.slice(0, lastBrace + 1) + "]";
  return JSON.parse(partial);
}

function parseJsonObject<T>(text: string): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);
  throw new Error("Nessun JSON trovato nella risposta");
}

// ── Flashcard generation per chunk ──

async function generaFlashcardChunk(
  testo: string,
  titolo: string,
  chunkIndex: number,
  totalChunks: number
): Promise<FlashcardGenerata[]> {
  const startOrdine = chunkIndex * 100 + 1;

  console.log(`[claude] Chunk ${chunkIndex + 1}/${totalChunks}: ${testo.length} caratteri, invio a Claude...`);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Questo è il SEGMENTO ${chunkIndex + 1} di ${totalChunks} del documento "${titolo}".

Genera una flashcard per OGNI singolo concetto, definizione, articolo, principio, regola o argomento presente in questo segmento. Nessuno escluso. Non fare riassunti: tratta ogni argomento come flashcard separata. Se un paragrafo contiene 3 concetti, genera 3 flashcard distinte.

LINGUA: sempre italiano, anche se il testo è in inglese.

STRUTTURA OGNI FLASHCARD:
- titolo: nome del concetto chiaro e diretto (max 8 parole, NON una domanda)
- testo: COMPATTO, max 8-10 righe su mobile. Struttura:
    1-2 frasi di spiegazione principale.
    Se ci sono elementi enumerabili (caratteristiche, requisiti, fasi, tipi...) usa elenco puntato con "\\n• " (max 4-5 punti, 1 riga ciascuno).
    1 frase di esempio pratico (inizia con "\\nAd esempio, ").
    1 frase di contesto normativo/storico SOLO se essenziale (inizia con "\\nNel contesto ").
    Usa "\\n" per gli a capo tra sezioni.
- tag: 2-4 keyword pertinenti (array di stringhe)
- ordine: intero progressivo partendo da ${startOrdine}
- difficolta: "facile" | "media" | "difficile"
- image_prompt: prompt in inglese per DALL-E, immagine evocativa del concetto, stile "editorial photography, clean background", max 20 parole

OUTPUT: solo array JSON puro, nessun testo prima o dopo, nessun markdown.
[
  {
    "titolo": "concetto chiave",
    "testo": "Spiegazione principale.\\n• Punto 1\\n• Punto 2\\nAd esempio, ...",
    "tag": ["keyword1", "keyword2"],
    "ordine": ${startOrdine},
    "difficolta": "media",
    "image_prompt": "descriptive english prompt for editorial image"
  }
]

TESTO DEL SEGMENTO:
${testo}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Risposta inattesa da Claude");

  const parsed = parseJsonArray<FlashcardGenerata>(content.text);
  console.log(`[claude] Chunk ${chunkIndex + 1}/${totalChunks}: ${parsed.length} flashcard generate`);
  return parsed;
}

// ── Chunk with retry ──

async function generaFlashcardChunkConRetry(
  testo: string,
  titolo: string,
  chunkIndex: number,
  totalChunks: number
): Promise<FlashcardGenerata[]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await generaFlashcardChunk(testo, titolo, chunkIndex, totalChunks);
    } catch (err) {
      console.error(`[claude] Chunk ${chunkIndex + 1}/${totalChunks} tentativo ${attempt}/2 FALLITO:`, err);
      if (attempt === 2) {
        console.error(`[claude] Chunk ${chunkIndex + 1} SKIPPATO dopo 2 tentativi`);
        return [];
      }
    }
  }
  return [];
}

// ── Public API: generate flashcards (parallel, no progress) ──

export async function generaFlashcard(
  testo: string,
  titolo: string
): Promise<FlashcardGenerata[]> {
  if (isMockAI) return MOCK_FLASHCARDS;

  const chunks = splitTesto(testo);
  const results = await Promise.all(
    chunks.map((chunk, i) => generaFlashcardChunkConRetry(chunk, titolo, i, chunks.length))
  );

  const flat = results.flat();
  flat.sort((a, b) => a.ordine - b.ordine);

  const successChunks = results.filter((r) => r.length > 0).length;
  console.log(`[claude] TOTALE: ${flat.length} flashcard da ${successChunks}/${chunks.length} chunk riusciti`);

  return flat;
}

// ── Public API: generate flashcards with progress callback ──

export async function generaFlashcardChunked(
  testo: string,
  titolo: string,
  onChunkDone?: (chunkIdx: number, totalChunks: number) => void
): Promise<FlashcardGenerata[]> {
  if (isMockAI) {
    onChunkDone?.(0, 1);
    return MOCK_FLASHCARDS;
  }

  const chunks = splitTesto(testo);
  const results: FlashcardGenerata[][] = [];

  const promises = chunks.map(async (chunk, i) => {
    const result = await generaFlashcardChunkConRetry(chunk, titolo, i, chunks.length);
    onChunkDone?.(i, chunks.length);
    return { index: i, result };
  });

  const settled = await Promise.all(promises);
  for (const { result } of settled.sort((a, b) => a.index - b.index)) {
    results.push(result);
  }

  const flat = results.flat();
  flat.sort((a, b) => a.ordine - b.ordine);

  const successChunks = results.filter((r) => r.length > 0).length;
  console.log(`[claude] TOTALE: ${flat.length} flashcard da ${successChunks}/${chunks.length} chunk riusciti`);

  return flat;
}

// ── Quiz generation ──

async function generaQuizPerFlashcard(
  flashcardId: string,
  titolo: string,
  testo: string
): Promise<QuizGenerato> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Data questa flashcard:
TITOLO: ${titolo}
TESTO: ${testo}

Genera UNA domanda di comprensione che a volte riguarda il titolo/concetto principale e a volte un dettaglio specifico del testo.
4 opzioni: 1 corretta + 3 sbagliate plausibili (non ovviamente sbagliate).
Rispondi solo in JSON:
{
  "domanda": "...",
  "opzioni": ["...", "...", "...", "..."],
  "risposta_corretta": 0,
  "spiegazione": "..."
}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Risposta inattesa da Claude");

  const parsed = parseJsonObject<Omit<QuizGenerato, "flashcard_id">>(content.text);

  // Shuffle options
  const correctAnswer = parsed.opzioni[parsed.risposta_corretta];
  const shuffled = [...parsed.opzioni];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return {
    ...parsed,
    flashcard_id: flashcardId,
    opzioni: shuffled,
    risposta_corretta: shuffled.indexOf(correctAnswer),
  };
}

async function generaQuizConRetry(
  fc: { id: string; titolo: string; testo: string },
  maxRetries = 2
): Promise<QuizGenerato | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generaQuizPerFlashcard(fc.id, fc.titolo, fc.testo);
    } catch (err) {
      console.error(`[quiz] Flashcard ${fc.id} tentativo ${attempt}/${maxRetries} fallito:`, err);
      if (attempt === maxRetries) return null;
    }
  }
  return null;
}

export async function generaQuizBatch(
  flashcards: { id: string; titolo: string; testo: string }[],
  allFlashcards?: { id: string; titolo: string; testo: string }[]
): Promise<QuizGenerato[]> {
  if (isMockAI) {
    return flashcards.map((fc, i) => ({
      ...(MOCK_QUIZ[i % MOCK_QUIZ.length]),
      flashcard_id: fc.id,
    }));
  }

  const targetCount = flashcards.length;
  const results = await Promise.all(
    flashcards.map((fc) => generaQuizConRetry(fc))
  );

  const successful = results.filter((r): r is QuizGenerato => r !== null);
  console.log(`[quiz] Prima passata: ${successful.length}/${targetCount} riuscite`);

  if (successful.length >= targetCount || !allFlashcards) return successful;

  const usedIds = new Set(flashcards.map((fc) => fc.id));
  const extras = allFlashcards.filter((fc) => !usedIds.has(fc.id));
  const needed = targetCount - successful.length;
  const extraBatch = extras.sort(() => Math.random() - 0.5).slice(0, needed);

  if (extraBatch.length > 0) {
    const extraResults = await Promise.all(
      extraBatch.map((fc) => generaQuizConRetry(fc))
    );
    successful.push(...extraResults.filter((r): r is QuizGenerato => r !== null));
  }

  return successful;
}
