import { NextRequest, NextResponse } from "next/server";
import { updateDispensaTags } from "@/lib/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dispensaId: string }> }
) {
  try {
    const { dispensaId } = await params;
    const { tags } = await request.json();

    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: "tags deve essere un array" }, { status: 400 });
    }

    const cleaned = tags.map((t: string) => t.trim()).filter(Boolean);
    await updateDispensaTags(dispensaId, cleaned);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[archivio/tag] Errore:", error);
    return NextResponse.json({ error: "Errore aggiornamento tag" }, { status: 500 });
  }
}
