"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FlashcardFeed from "@/components/flashcard/FlashcardFeed";

function FeedContent() {
  const searchParams = useSearchParams();
  const saved = searchParams.get("saved") === "true";
  return <FlashcardFeed savedMode={saved || undefined} />;
}

export default function FeedPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
      </div>
    }>
      <FeedContent />
    </Suspense>
  );
}
