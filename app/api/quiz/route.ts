import { NextRequest, NextResponse } from "next/server";
import { getQuizDomandeByDispensa, getAllQuizDomande } from "@/lib/store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dispensaId = searchParams.get("dispensaId");
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  const allDomande = dispensaId
    ? await getQuizDomandeByDispensa(dispensaId)
    : await getAllQuizDomande();

  if (allDomande.length === 0) {
    return NextResponse.json(
      { error: "Nessuna domanda quiz disponibile. Genera un quiz dalla pagina Quiz." },
      { status: 404 }
    );
  }

  const shuffled = [...allDomande].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(limit, shuffled.length));

  return NextResponse.json({
    domande: selected.map((d) => ({
      id: d.id,
      domanda: d.domanda,
      opzioni: d.opzioni,
      risposta_corretta: d.risposta_corretta,
      spiegazione: d.spiegazione,
    })),
  });
}
