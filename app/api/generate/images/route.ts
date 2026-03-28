import { NextRequest } from "next/server";
import { getFlashcardsByDispensa, updateFlashcardImageUrl } from "@/lib/store";
import { generateImagesBatch } from "@/lib/dalle";

export const maxDuration = 300;

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const { dispensaId } = await request.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseEvent(data)));
      };

      try {
        if (!dispensaId) {
          send({ type: "error", error: "dispensaId richiesto" });
          controller.close();
          return;
        }

        if (!process.env.OPENAI_API_KEY) {
          send({ type: "done", generated: 0, msg: "OPENAI_API_KEY non configurata, immagini saltate" });
          controller.close();
          return;
        }

        const flashcards = await getFlashcardsByDispensa(dispensaId);
        const imageItems = flashcards
          .filter((fc) => !fc.image_url && fc.image_prompt)
          .map((fc) => ({ id: fc.id, prompt: fc.image_prompt! }));

        if (imageItems.length === 0) {
          send({ type: "done", generated: 0, msg: "Nessuna immagine da generare" });
          controller.close();
          return;
        }

        const totalBatches = Math.ceil(imageItems.length / 3);
        let generated = 0;

        for (let i = 0; i < imageItems.length; i += 3) {
          const batch = imageItems.slice(i, i + 3);
          const batchResults = await generateImagesBatch(batch, 3);

          for (const [id, url] of batchResults) {
            await updateFlashcardImageUrl(id, url).catch(console.error);
            generated++;
          }

          const batchNum = Math.floor(i / 3) + 1;
          const pct = Math.round((batchNum / totalBatches) * 100);
          send({
            type: "progress",
            pct,
            msg: `Immagini: ${generated}/${imageItems.length}`,
            generated,
            total: imageItems.length,
          });
        }

        send({
          type: "done",
          generated,
          total: imageItems.length,
          msg: `${generated} immagini generate`,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Errore sconosciuto";
        console.error("[generate/images] Errore:", error);
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
