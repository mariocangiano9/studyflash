import { NextRequest, NextResponse } from "next/server";
import { saveFlashcards } from "@/lib/store";
import Anthropic from "@anthropic-ai/sdk";
import { FlashcardGenerata } from "@/types";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Sei un professore universitario esperto di didattica. Crei post informativi da dispense universitarie italiane, come post di Instagram dedicati allo studio.`;

function parseJsonArray<T>(text: string): T[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);
  const arrayStart = text.indexOf("[");
  if (arrayStart === -1) throw new Error("Nessun JSON trovato");
  let partial = text.slice(arrayStart);
  const lastBrace = partial.lastIndexOf("}");
  if (lastBrace === -1) throw new Error("JSON troncato");
  return JSON.parse(partial.slice(0, lastBrace + 1) + "]");
}

export async function POST(request: NextRequest) {
  try {
    const { dispensaId, chunkText, chunkIndex, totalChunks, titolo } = await request.json();

    if (!chunkText || !dispensaId) {
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
    }

    const isMock = process.env.MOCK_AI === "true";
    const startOrdine = chunkIndex * 100 + 1;

    let flashcardGenerate: FlashcardGenerata[];

    if (isMock) {
      flashcardGenerate = [
        { titolo: `Mock ${chunkIndex + 1}`, testo: "Testo mock", tag: ["test"], ordine: startOrdine, difficolta: "facile", image_prompt: "test image" },
      ];
    } else {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      console.log(`[chunk] ${chunkIndex + 1}/${totalChunks}: ${chunkText.length} chars → invio a Claude`);

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 16384,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Segmento ${chunkIndex + 1}/${totalChunks} del documento "${titolo || "Dispensa"}".

ISTRUZIONI FONDAMENTALI:
Analizza OGNI FRASE di questo testo. Per ogni definizione, articolo, principio, istituto, procedura, concetto, evento storico, o nozione genera UNA flashcard separata. Non raggruppare mai più concetti in una flashcard. Non saltare nulla. Se hai dubbi se un concetto merita una flashcard, generala comunque.

LINGUA: sempre italiano.

STRUTTURA:
- titolo: concetto chiaro e diretto (max 8 parole, NO domande)
- testo: COMPATTO, max 8-10 righe. Struttura:
    1-2 frasi di spiegazione.
    Se enumerabile: "\\n• " (max 4-5 punti, 1 riga ciascuno).
    "\\nAd esempio, " 1 frase esempio pratico.
    "\\nNel contesto " 1 frase contesto solo se essenziale.
- tag: 2-4 keyword
- ordine: intero progressivo da ${startOrdine}
- difficolta: "facile" | "media" | "difficile"
- image_prompt: inglese, DALL-E, "editorial photography, clean background", max 20 parole

OUTPUT: solo array JSON puro.

TESTO DEL SEGMENTO:
${chunkText}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") throw new Error("Risposta inattesa");

      flashcardGenerate = parseJsonArray<FlashcardGenerata>(content.text);
      console.log(`[chunk] ${chunkIndex + 1}/${totalChunks}: ${flashcardGenerate.length} flashcard generate`);
    }

    // Save to Supabase
    const rows = flashcardGenerate.map((fc, i) => ({
      titolo: fc.titolo,
      testo: fc.testo,
      tag: fc.tag || [],
      difficolta: fc.difficolta,
      ordine: fc.ordine ?? (startOrdine + i),
      image_prompt: fc.image_prompt || "",
    }));

    const saved = await saveFlashcards(dispensaId, rows);

    return NextResponse.json({
      chunkIndex,
      numFlashcard: saved.length,
      flashcard: saved,
    });
  } catch (error) {
    console.error("[chunk] Errore:", error);
    const msg = error instanceof Error ? error.message : "Errore generazione chunk";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
