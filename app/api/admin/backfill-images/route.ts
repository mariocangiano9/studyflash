import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST() {
  try {
    const db = supabaseAdmin();

    // Nullify expired OpenAI temporary URLs
    const { data, error } = await db
      .from("flashcard")
      .update({ image_url: null })
      .or("image_url.like.%oaidalleapiprodscus%,image_url.like.%openai%")
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const count = data?.length || 0;
    console.log(`[backfill] Rimossi ${count} URL OpenAI scaduti`);

    return NextResponse.json({
      pulite: count,
      messaggio: `${count} flashcard con URL scaduti ripulite`,
    });
  } catch (error) {
    console.error("[backfill] Errore:", error);
    return NextResponse.json({ error: "Errore nel backfill" }, { status: 500 });
  }
}
