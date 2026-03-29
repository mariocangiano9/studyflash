import { NextRequest, NextResponse } from "next/server";
import { getAllFlashcardsForFeed } from "@/lib/store";
import { buildSmartFeed } from "@/lib/feed-algorithm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dispensaIdsParam = searchParams.get("dispensaIds");
  const tag = searchParams.get("tag") || undefined;
  const saved = searchParams.get("saved") === "true" || undefined;
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const dispensaIds = dispensaIdsParam
    ? dispensaIdsParam.split(",").filter(Boolean)
    : undefined;

  const search = searchParams.get("search") || undefined;

  const allCards = await getAllFlashcardsForFeed({ dispensaIds, tag, saved, search });

  if (allCards.length === 0) {
    return NextResponse.json({ error: "Nessuna flashcard disponibile" }, { status: 404 });
  }

  const feed = buildSmartFeed(allCards);
  const page = feed.slice(offset, offset + limit);
  const hasMore = offset + limit < feed.length;

  return NextResponse.json({
    feed: page,
    total: feed.length,
    hasMore,
    offset,
  });
}
