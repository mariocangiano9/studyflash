import { NextRequest, NextResponse } from "next/server";
import { generaFlashcard } from "@/lib/claude/client";
import { saveDispensa, saveFlashcards } from "@/lib/store";

export const maxDuration = 60;

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
