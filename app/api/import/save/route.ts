import { NextRequest, NextResponse } from "next/server";
import { saveDispensa, saveFlashcards } from "@/lib/store";
import { generaTagSolo } from "@/lib/claude/client";
export const maxDuration = 300;

interface ImportedCard {
  titolo: string;
  testo: string;
  capitolo?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { flashcards, titolo, materia, tags } = (await req.json()) as {
      flashcards: ImportedCard[];
      titolo: string;
      materia?: string;
      tags?: string[];
    };

    if (!flashcards || flashcards.length === 0) {
      return NextResponse.json({ error: "Nessuna flashcard da importare" }, { status: 400 });
    }

    const dispensaId = crypto.randomUUID();

    // 1. Save dispensa
    await saveDispensa(dispensaId, { titolo, materia, tags });

    // 2. Generate tags + image_prompts via Claude (batch, max 30 per call)
    const BATCH_SIZE = 30;
    const allMeta: { tag: string[]; image_prompt: string }[] = [];

    for (let i = 0; i < flashcards.length; i += BATCH_SIZE) {
      const batch = flashcards.slice(i, i + BATCH_SIZE);
      try {
        const meta = await generaTagSolo(batch);
        allMeta.push(...meta);
      } catch (err) {
        console.error(`[import] Errore generazione tag batch ${i}:`, err);
        // Fallback: empty tags
        allMeta.push(...batch.map(() => ({ tag: [], image_prompt: "" })));
      }
    }

    // 3. Save flashcards (include capitolo in tags if present)
    const fcRows = flashcards.map((fc, i) => {
      const baseTags = allMeta[i]?.tag || [];
      const capitoloTag = fc.capitolo?.trim();
      const tag = capitoloTag && !baseTags.some((t) => t.toLowerCase() === capitoloTag.toLowerCase())
        ? [capitoloTag, ...baseTags]
        : baseTags;
      return {
        titolo: fc.titolo,
        testo: fc.testo,
        tag,
        difficolta: "media" as const,
        ordine: i + 1,
        image_prompt: allMeta[i]?.image_prompt || "",
      };
    });

    const saved = await saveFlashcards(dispensaId, fcRows);

    return NextResponse.json({
      dispensaId,
      numFlashcard: saved.length,
    });
  } catch (err) {
    console.error("[import/save] Errore:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore salvataggio" },
      { status: 500 }
    );
  }
}
