import { NextRequest, NextResponse } from "next/server";
import { getAllFlashcardsForFeed } from "@/lib/store";
import { buildSmartFeed } from "@/lib/feed-algorithm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dispensaIdsParam = searchParams.get("dispensaIds");
  const tag = searchParams.get("tag") || undefined;
  const saved = searchParams.get("saved") === "true" || undefined;
  const dispensaIds = dispensaIdsParam
    ? dispensaIdsParam.split(",").filter(Boolean)
    : undefined;

  const allCards = await getAllFlashcardsForFeed({ dispensaIds, tag, saved });

  if (allCards.length === 0) {
    return NextResponse.json({ error: "Nessuna flashcard disponibile" }, { status: 404 });
  }

  const feed = buildSmartFeed(allCards);
  const allSeen = allCards.every((c) => c.last_seen_at !== null);

  return NextResponse.json({ feed, allSeen });
}
