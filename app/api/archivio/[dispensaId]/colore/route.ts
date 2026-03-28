import { NextRequest, NextResponse } from "next/server";
import { updateDispensaColore } from "@/lib/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dispensaId: string }> }
) {
  try {
    const { dispensaId } = await params;
    const { colore } = await request.json();

    if (typeof colore !== "string" || !colore.startsWith("#")) {
      return NextResponse.json({ error: "Colore non valido" }, { status: 400 });
    }

    await updateDispensaColore(dispensaId, colore);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[colore] Errore:", error);
    return NextResponse.json({ error: "Errore aggiornamento colore" }, { status: 500 });
  }
}
