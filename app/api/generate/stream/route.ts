import { NextRequest } from "next/server";
import { generaFlashcardChunked } from "@/lib/claude/client";
import { saveDispensa, saveFlashcards } from "@/lib/store";

export const maxDuration = 60;

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const { dispensaId, testo, titolo, materia, tags } = await request.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseEvent(data)));
      };

      try {
        if (!testo || !dispensaId) {
          send({ type: "error", error: "Testo e dispensaId sono richiesti" });
          controller.close();
          return;
        }

        // Step 1: Save dispensa
        send({ type: "progress", pct: 5, msg: "Caricamento dati..." });
        await saveDispensa(dispensaId, {
          titolo: titolo || "Dispensa",
          materia: materia || undefined,
          tags: tags?.length ? tags : undefined,
        });
        send({ type: "progress", pct: 10, msg: "Dispensa salvata" });

        // Step 2: Generate flashcards chunk by chunk
        send({ type: "progress", pct: 15, msg: "Analisi e suddivisione testo..." });

        const onChunkDone = (chunkIdx: number, totalChunks: number) => {
          const chunkPct = 65 / totalChunks;
          const pct = Math.round(20 + (chunkIdx + 1) * chunkPct);
          send({
            type: "progress",
            pct: Math.min(pct, 85),
            msg: `Generazione flashcard... (${chunkIdx + 1}/${totalChunks})`,
          });
        };

        send({ type: "progress", pct: 20, msg: "Generazione flashcard con Claude..." });
        const flashcardGenerate = await generaFlashcardChunked(
          testo,
          titolo || "Dispensa",
          onChunkDone
        );

        const flashcardRows = flashcardGenerate.map((fc, i) => ({
          titolo: fc.titolo,
          testo: fc.testo,
          tag: fc.tag || [],
          difficolta: fc.difficolta,
          ordine: fc.ordine ?? i,
          image_prompt: fc.image_prompt || "",
        }));

        // Step 3: Save to Supabase
        send({ type: "progress", pct: 90, msg: "Salvataggio flashcard..." });
        const savedFlashcards = await saveFlashcards(dispensaId, flashcardRows);

        // Done — images will be generated separately by the client
        send({
          type: "done",
          pct: 100,
          msg: "Flashcard generate!",
          dispensaId,
          numFlashcard: savedFlashcards.length,
          flashcard: savedFlashcards,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Errore sconosciuto";
        console.error("[generate/stream] Errore:", error);
        send({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
