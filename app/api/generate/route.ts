import { NextRequest, NextResponse } from "next/server";
import { generaFlashcard } from "@/lib/claude/client";
import { saveDispensa, saveFlashcards, updateFlashcardImageUrl } from "@/lib/store";
import { generateImagesBatch } from "@/lib/dalle";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { dispensaId, testo, titolo, materia, tags } = await request.json();

    if (!testo || !dispensaId) {
      return NextResponse.json(
        { error: "Testo e dispensaId sono richiesti" },
        { status: 400 }
      );
    }

    await saveDispensa(dispensaId, {
      titolo: titolo || "Dispensa",
      materia: materia || undefined,
      tags: tags?.length ? tags : undefined,
    });

    const flashcardGenerate = await generaFlashcard(testo, titolo || "Dispensa");

    const flashcardRows = flashcardGenerate.map((fc, i) => ({
      titolo: fc.titolo,
      testo: fc.testo,
      tag: fc.tag || [],
      difficolta: fc.difficolta,
      ordine: fc.ordine ?? i,
      image_prompt: fc.image_prompt || "",
    }));

    const savedFlashcards = await saveFlashcards(dispensaId, flashcardRows);

    // DALL-E images — await before responding to prevent Vercel killing the process
    if (process.env.OPENAI_API_KEY) {
      const imageItems = savedFlashcards
        .filter((fc) => fc.image_prompt)
        .map((fc) => ({ id: fc.id, prompt: fc.image_prompt! }));

      if (imageItems.length > 0) {
        for (let i = 0; i < imageItems.length; i += 3) {
          const batch = imageItems.slice(i, i + 3);
          const urls = await generateImagesBatch(batch, 3);
          for (const [id, url] of urls) {
            await updateFlashcardImageUrl(id, url).catch(console.error);
          }
        }
        // Re-fetch to include image_url in response
        const { getFlashcardsByDispensa } = await import("@/lib/store");
        const updated = await getFlashcardsByDispensa(dispensaId);
        return NextResponse.json({
          dispensaId,
          numFlashcard: updated.length,
          flashcard: updated,
        });
      }
    }

    return NextResponse.json({
      dispensaId,
      numFlashcard: savedFlashcards.length,
      flashcard: savedFlashcards,
    });
  } catch (error) {
    console.error("[generate] Errore:", error);
    return NextResponse.json(
      { error: "Errore nella generazione delle flashcard" },
      { status: 500 }
    );
  }
}
