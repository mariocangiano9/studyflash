import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

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

    // Estrai testo dal PDF
    const arrayBuffer = await file.arrayBuffer();
    const pdfParser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
    const textResult = await pdfParser.getText();
    const testo = textResult.text.trim();
    await pdfParser.destroy();

    if (!testo) {
      return NextResponse.json(
        { error: "Impossibile estrarre testo dal PDF. Il file potrebbe essere scansionato." },
        { status: 422 }
      );
    }

    const dispensaId = crypto.randomUUID();

    console.log(`[pdf] Pagine: ${textResult.total}, Chars estratti: ${testo.length}, File: ${file.name}`);

    return NextResponse.json({
      dispensaId,
      titolo,
      testo, // Nessun limite — il chunking in Claude gestisce testi di qualsiasi lunghezza
      numPagine: textResult.total,
    });
  } catch (error) {
    console.error("Errore upload:", error);
    return NextResponse.json(
      { error: "Errore durante l'elaborazione del file" },
      { status: 500 }
    );
  }
}
