import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generateImage } from "@/lib/dalle";

export const maxDuration = 300;

/** GET → status: quante flashcard mancano di immagine */
export async function GET() {
  try {
    const db = supabaseAdmin();

    const { count: totale, error: e1 } = await db
      .from("flashcard")
      .select("id", { count: "exact", head: true })
      .not("image_prompt", "is", null);

    const { count: mancanti, error: e2 } = await db
      .from("flashcard")
      .select("id", { count: "exact", head: true })
      .is("image_url", null)
      .not("image_prompt", "is", null);

    if (e1 || e2) {
      return NextResponse.json({ error: (e1 || e2)!.message }, { status: 500 });
    }

    return NextResponse.json({
      totale: totale ?? 0,
      completate: (totale ?? 0) - (mancanti ?? 0),
      mancanti: mancanti ?? 0,
    });
  } catch (error) {
    console.error("[backfill] Errore status:", error);
    return NextResponse.json({ error: "Errore status" }, { status: 500 });
  }
}

/** POST?batch=50 → processa N immagini e restituisce progresso */
export async function POST(req: NextRequest) {
  try {
    const batchSize = Math.min(
      Number(req.nextUrl.searchParams.get("batch") || 50),
      100
    );

    const db = supabaseAdmin();

    // Fetch solo le flashcard da processare (limit = batch)
    const { data: cards, error } = await db
      .from("flashcard")
      .select("id, image_prompt")
      .is("image_url", null)
      .not("image_prompt", "is", null)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({
        processate: 0,
        riuscite: 0,
        fallite: 0,
        mancanti: 0,
        messaggio: "Nessuna flashcard da processare",
      });
    }

    let riuscite = 0;
    let fallite = 0;
    const PARALLEL = 3;

    console.log(`[backfill] Processo ${cards.length} flashcard...`);

    for (let i = 0; i < cards.length; i += PARALLEL) {
      const batch = cards.slice(i, i + PARALLEL);

      const results = await Promise.all(
        batch.map(async (card) => {
          const url = await generateImage(card.image_prompt!, card.id);
          return { id: card.id, url };
        })
      );

      for (const { id, url } of results) {
        if (url) {
          await db.from("flashcard").update({ image_url: url }).eq("id", id);
          riuscite++;
        } else {
          fallite++;
        }
      }

      const done = riuscite + fallite;
      if (done % 10 === 0 || done === cards.length) {
        console.log(`Backfill: ${done}/${cards.length} completate (${fallite} errori)`);
      }
    }

    // Conta quante mancano ancora
    const { count: mancanti } = await db
      .from("flashcard")
      .select("id", { count: "exact", head: true })
      .is("image_url", null)
      .not("image_prompt", "is", null);

    console.log(`[backfill] Batch completato: ${riuscite} ok, ${fallite} errori, ${mancanti ?? "?"} mancanti`);

    return NextResponse.json({
      processate: cards.length,
      riuscite,
      fallite,
      mancanti: mancanti ?? 0,
    });
  } catch (error) {
    console.error("[backfill] Errore critico:", error);
    return NextResponse.json({ error: "Errore nel backfill" }, { status: 500 });
  }
}
