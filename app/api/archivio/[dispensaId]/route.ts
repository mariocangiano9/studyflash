import { NextRequest, NextResponse } from "next/server";
import { deleteDispensa, updateDispensaMateria, updateDispensaTitolo } from "@/lib/store";

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
    const body = await request.json();

    if (body.titolo !== undefined) {
      if (typeof body.titolo !== "string" || !body.titolo.trim()) {
        return NextResponse.json({ error: "titolo richiesto" }, { status: 400 });
      }
      await updateDispensaTitolo(dispensaId, body.titolo.trim());
      return NextResponse.json({ success: true });
    }

    if (body.materia !== undefined) {
      if (typeof body.materia !== "string" || !body.materia.trim()) {
        return NextResponse.json({ error: "materia richiesta" }, { status: 400 });
      }
      await updateDispensaMateria(dispensaId, body.materia.trim());
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  } catch (error) {
    console.error("[archivio/PATCH] Errore:", error);
    return NextResponse.json({ error: "Errore aggiornamento" }, { status: 500 });
  }
}
