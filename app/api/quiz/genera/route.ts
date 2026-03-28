import { NextRequest, NextResponse } from "next/server";
import { getFlashcardsByDispensa, saveQuizDomande } from "@/lib/store";
import { generaQuizBatch } from "@/lib/claude/client";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Support both dispensaId (single) and dispensaIds (array)
    const dispensaIds: string[] = body.dispensaIds
      ? body.dispensaIds
      : body.dispensaId
        ? [body.dispensaId]
        : [];
    const numDomande = body.numDomande;

    if (dispensaIds.length === 0) {
      return NextResponse.json({ error: "dispensaId o dispensaIds richiesto" }, { status: 400 });
    }

    // Fetch flashcards from all selected dispense
    const allFlashcardsArrays = await Promise.all(
      dispensaIds.map((id: string) => getFlashcardsByDispensa(id))
    );
    const flashcards = allFlashcardsArrays.flat();

    if (flashcards.length === 0) {
      return NextResponse.json(
        { error: "Nessuna flashcard trovata per le dispense selezionate" },
        { status: 404 }
      );
    }

    // Select flashcards based on numDomande (10, 20, or 50)
    const limit = typeof numDomande === "number" && numDomande > 0 ? numDomande : 10;
    let selected = [...flashcards];
    if (limit < flashcards.length) {
      selected = selected.sort(() => Math.random() - 0.5).slice(0, limit);
    }

    // Generate quiz questions via Claude with retry + extra flashcards
    const allMapped = flashcards.map((fc) => ({ id: fc.id, titolo: fc.titolo, testo: fc.testo }));
    const quizResults = await generaQuizBatch(
      selected.map((fc) => ({ id: fc.id, titolo: fc.titolo, testo: fc.testo })),
      allMapped
    );

    // Save to Supabase
    if (quizResults.length > 0) {
      await saveQuizDomande(
        quizResults.map((q) => ({
          flashcard_id: q.flashcard_id,
          domanda: q.domanda,
          opzioni: q.opzioni,
          risposta_corretta: q.risposta_corretta,
          spiegazione: q.spiegazione,
        }))
      );
    }

    const domande = quizResults.map((q) => ({
      id: q.flashcard_id,
      domanda: q.domanda,
      opzioni: q.opzioni,
      risposta_corretta: q.risposta_corretta,
      spiegazione: q.spiegazione,
    }));

    return NextResponse.json({ domande });
  } catch (error) {
    console.error("[quiz/genera] Errore:", error);
    return NextResponse.json(
      { error: "Errore nella generazione del quiz" },
      { status: 500 }
    );
  }
}
