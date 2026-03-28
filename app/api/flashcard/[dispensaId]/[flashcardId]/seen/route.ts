import { NextRequest, NextResponse } from "next/server";
import { markFlashcardSeen } from "@/lib/store";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ flashcardId: string }> }
) {
  const { flashcardId } = await params;

  try {
    await markFlashcardSeen(flashcardId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}
