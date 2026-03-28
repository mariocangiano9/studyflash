import { NextResponse } from "next/server";
import { resetAllSeen } from "@/lib/store";

export async function DELETE() {
  try {
    await resetAllSeen();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}
