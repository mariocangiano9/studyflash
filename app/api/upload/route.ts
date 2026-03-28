import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const titolo = formData.get("titolo") as string;

    if (!file || !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "File PDF richiesto" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const { totalPages, text } = await extractText(new Uint8Array(arrayBuffer));
    const testo = (Array.isArray(text) ? text.join("\n") : text).trim();

    if (!testo) {
      return NextResponse.json(
        { error: "Impossibile estrarre testo dal PDF. Il file potrebbe essere scansionato." },
        { status: 422 }
      );
    }

    const dispensaId = crypto.randomUUID();

    console.log(`[pdf] Pagine: ${totalPages}, Chars estratti: ${testo.length}, File: ${file.name}`);

    return NextResponse.json({
      dispensaId,
      titolo,
      testo,
      numPagine: totalPages,
    });
  } catch (error) {
    console.error("Errore upload:", error);
    return NextResponse.json(
      { error: "Errore durante l'elaborazione del file" },
      { status: 500 }
    );
  }
}
