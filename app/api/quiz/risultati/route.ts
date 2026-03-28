import { NextRequest, NextResponse } from "next/server";
import { getQuizRisultati, saveQuizRisultato } from "@/lib/store";

export async function GET() {
  try {
    const risultati = await getQuizRisultati();
    return NextResponse.json({ risultati });
  } catch (error) {
    console.error("[quiz/risultati] GET errore:", error);
    return NextResponse.json({ error: "Errore nel recupero risultati" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { materia, dispense_ids, num_domande, risposte_corrette, percentuale } = body;

    if (!materia || !dispense_ids?.length || num_domande == null || risposte_corrette == null || percentuale == null) {
      return NextResponse.json({ error: "Campi mancanti" }, { status: 400 });
    }

    await saveQuizRisultato({ materia, dispense_ids, num_domande, risposte_corrette, percentuale });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[quiz/risultati] POST errore:", error);
    return NextResponse.json({ error: "Errore nel salvataggio risultato" }, { status: 500 });
  }
}
