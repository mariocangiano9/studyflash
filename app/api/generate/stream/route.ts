import { NextRequest } from "next/server";
import { generaFlashcardChunked } from "@/lib/claude/client";
import { saveDispensa, saveFlashcards, updateFlashcardImageUrl } from "@/lib/store";
import { generateImagesBatch } from "@/lib/dalle";

export const maxDuration = 300;

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

        // Step 1: Save dispensa (0-10%)
        send({ type: "progress", pct: 5, msg: "Caricamento dati..." });
        await saveDispensa(dispensaId, {
          titolo: titolo || "Dispensa",
          materia: materia || undefined,
          tags: tags?.length ? tags : undefined,
        });
        send({ type: "progress", pct: 10, msg: "Dispensa salvata" });

        // Step 2: Chunking (10-25%)
        send({ type: "progress", pct: 15, msg: "Analisi e suddivisione testo..." });

        // Step 3: Generate flashcards chunk by chunk (25-80%)
        const onChunkDone = (chunkIdx: number, totalChunks: number) => {
          const chunkPct = 55 / totalChunks;
          const pct = Math.round(25 + (chunkIdx + 1) * chunkPct);
          send({
            type: "progress",
            pct: Math.min(pct, 80),
            msg: `Generazione flashcard... (${chunkIdx + 1}/${totalChunks})`,
          });
        };

        send({ type: "progress", pct: 25, msg: "Generazione flashcard con Claude..." });
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

        send({ type: "progress", pct: 82, msg: "Salvataggio flashcard..." });
        const savedFlashcards = await saveFlashcards(dispensaId, flashcardRows);

        // Step 4: DALL-E images (85-100%)
        if (process.env.OPENAI_API_KEY) {
          const imageItems = savedFlashcards
            .filter((fc) => fc.image_prompt)
            .map((fc) => ({ id: fc.id, prompt: fc.image_prompt! }));

          if (imageItems.length > 0) {
            send({ type: "progress", pct: 85, msg: "Generazione immagini DALL-E..." });
            const totalBatches = Math.ceil(imageItems.length / 3);

            for (let i = 0; i < imageItems.length; i += 3) {
              const batch = imageItems.slice(i, i + 3);
              const batchResults = await generateImagesBatch(batch, 3);
              for (const [id, url] of batchResults) {
                await updateFlashcardImageUrl(id, url).catch(console.error);
              }
              const batchNum = Math.floor(i / 3) + 1;
              const pct = Math.round(85 + (batchNum / totalBatches) * 14);
              send({
                type: "progress",
                pct: Math.min(pct, 99),
                msg: `Immagini: batch ${batchNum}/${totalBatches}`,
              });
            }
          }
        }

        // Done
        send({
          type: "done",
          pct: 100,
          msg: "Completato!",
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
