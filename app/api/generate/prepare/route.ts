import { NextRequest, NextResponse } from "next/server";
import { saveDispensa } from "@/lib/store";

export const maxDuration = 15;

// Duplicated from lib/claude/client.ts to avoid importing the whole module
const MAX_CHARS = 12000;

function splitTesto(testo: string): string[] {
  if (testo.length <= MAX_CHARS) return [testo];

  const paragraphs = testo.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? current + "\n\n" + para : para;
    if (candidate.length <= MAX_CHARS) { current = candidate; continue; }
    if (current) { chunks.push(current); current = ""; }
    if (para.length > MAX_CHARS) {
      const lines = para.split(/\n/);
      for (const line of lines) {
        const lineCand = current ? current + "\n" + line : line;
        if (lineCand.length <= MAX_CHARS) { current = lineCand; }
        else {
          if (current) chunks.push(current);
          if (line.length > MAX_CHARS) {
            for (let i = 0; i < line.length; i += MAX_CHARS) chunks.push(line.slice(i, i + MAX_CHARS));
            current = "";
          } else { current = line; }
        }
      }
    } else { current = para; }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const { dispensaId, testo, titolo, materia, tags } = await request.json();

    if (!testo || !dispensaId) {
      return NextResponse.json({ error: "Testo e dispensaId sono richiesti" }, { status: 400 });
    }

    await saveDispensa(dispensaId, {
      titolo: titolo || "Dispensa",
      materia: materia || undefined,
      tags: tags?.length ? tags : undefined,
    });

    const chunks = splitTesto(testo);

    console.log(`[prepare] Dispensa ${dispensaId}: ${testo.length} chars → ${chunks.length} chunk`);

    return NextResponse.json({
      dispensaId,
      totalChunks: chunks.length,
      chunks: chunks.map((c, i) => ({ index: i, length: c.length })),
      // Send the actual chunk texts so the client can forward them one at a time
      chunkTexts: chunks,
    });
  } catch (error) {
    console.error("[prepare] Errore:", error);
    return NextResponse.json({ error: "Errore preparazione" }, { status: 500 });
  }
}
