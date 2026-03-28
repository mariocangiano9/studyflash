import { NextResponse } from "next/server";
import { getAllDispense } from "@/lib/store";

export async function GET() {
  const dispense = await getAllDispense();
  return NextResponse.json({ dispense });
}
