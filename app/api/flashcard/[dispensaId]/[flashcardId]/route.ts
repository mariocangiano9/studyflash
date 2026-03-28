import { NextRequest, NextResponse } from "next/server";
import { updateFlashcard, deleteFlashcard } from "@/lib/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dispensaId: string; flashcardId: string }> }
) {
  const { flashcardId } = await params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.titolo !== undefined) updates.titolo = body.titolo;
    if (body.testo !== undefined) updates.testo = body.testo;
    if (body.difficolta !== undefined) updates.difficolta = body.difficolta;
    if (body.importante !== undefined) updates.importante = body.importante;
    if (body.image_url !== undefined) updates.image_url = body.image_url;

    await updateFlashcard(flashcardId, updates);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Errore aggiornamento flashcard:", error);
    return NextResponse.json({ error: "Errore aggiornamento" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ flashcardId: string }> }
) {
  const { flashcardId } = await params;
  const deleted = await deleteFlashcard(flashcardId);

  if (!deleted) {
    return NextResponse.json({ error: "Flashcard non trovata" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
