import { NextRequest, NextResponse } from "next/server";
import { getDispensa, getFlashcardsByDispensa } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dispensaId: string }> }
) {
  const { dispensaId } = await params;
  const dispensa = await getDispensa(dispensaId);

  if (!dispensa) {
    return NextResponse.json({ error: "Dispensa non trovata" }, { status: 404 });
  }

  const flashcard = await getFlashcardsByDispensa(dispensaId);
  if (flashcard.length === 0) {
    return NextResponse.json({ error: "Nessuna flashcard trovata" }, { status: 404 });
  }

  return NextResponse.json({
    titolo: dispensa.titolo,
    flashcard,
  });
}
