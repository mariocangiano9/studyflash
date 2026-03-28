import { NextRequest, NextResponse } from "next/server";
import { deleteDispensa, updateDispensaMateria } from "@/lib/store";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ dispensaId: string }> }
) {
  const { dispensaId } = await params;
  const deleted = await deleteDispensa(dispensaId);

  if (!deleted) {
    return NextResponse.json({ error: "Dispensa non trovata" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dispensaId: string }> }
) {
  try {
    const { dispensaId } = await params;
    const { materia } = await request.json();

    if (typeof materia !== "string" || !materia.trim()) {
      return NextResponse.json({ error: "materia richiesta" }, { status: 400 });
    }

    await updateDispensaMateria(dispensaId, materia.trim());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[archivio/PATCH] Errore:", error);
    return NextResponse.json({ error: "Errore aggiornamento materia" }, { status: 500 });
  }
}
