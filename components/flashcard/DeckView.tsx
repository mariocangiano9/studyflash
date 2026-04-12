"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import FlashcardItem from "./FlashcardItem";

interface FeedCard {
  id: string;
  titolo: string;
  testo: string;
  tag?: string[] | null;
  difficolta: "facile" | "media" | "difficile";
  ordine: number;
  importante?: boolean;
  salvato?: boolean;
  image_url?: string | null;
  colore?: string | null;
  dispensa_id?: string;
  materia: string;
}

interface DeckViewProps {
  cards: FeedCard[];
  total: number;
  hasMore: boolean;
  onLoadMore: () => void;
  onRestart: () => void;
  onCardDeleted: (id: string) => void;
  onTagClick: (tag: string) => void;
}

/* Skeleton placeholder shown when a card slot has no data yet */
function CardSkeleton({ bgColor }: { bgColor?: string }) {
  return (
    <div
      className="overflow-hidden rounded-2xl shadow-md shadow-zinc-200/60"
      style={{ backgroundColor: bgColor || "#f4f4f5" }}
    >
      <div className="w-full animate-pulse bg-zinc-200" style={{ aspectRatio: "16 / 5" }} />
      <div className="px-5 pt-4 pb-5 space-y-3">
        <div className="h-4 w-20 rounded-full bg-zinc-200 animate-pulse" />
        <div className="h-5 w-3/4 rounded bg-zinc-200 animate-pulse" />
        <div className="space-y-2">
          <div className="h-3.5 w-full rounded bg-zinc-200 animate-pulse" />
          <div className="h-3.5 w-5/6 rounded bg-zinc-200 animate-pulse" />
          <div className="h-3.5 w-2/3 rounded bg-zinc-200 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-14 rounded-full bg-zinc-200 animate-pulse" />
          <div className="h-6 w-16 rounded-full bg-zinc-200 animate-pulse" />
        </div>
      </div>
      <div className="flex border-t border-zinc-100">
        <div className="flex-1 py-3" />
        <div className="flex-1 py-3" />
        <div className="flex-1 py-3" />
      </div>
    </div>
  );
}

// Layers config for the 3-card stack: [offset index, scale, translateY, opacity]
const STACK_LAYERS = [
  { scale: 1, y: 0, opacity: 1 },       // top (current)
  { scale: 0.96, y: 8, opacity: 0.7 },   // middle (next)
  { scale: 0.92, y: 16, opacity: 0.4 },  // bottom (next+1)
] as const;

export default function DeckView({
  cards,
  total,
  hasMore,
  onLoadMore,
  onRestart,
  onCardDeleted,
  onTagClick,
}: DeckViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);

  // Swipe/drag state
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const prevCardsLen = useRef(cards.length);

  // Reset only on filter/search (cards replaced, not appended)
  useEffect(() => {
    if (cards.length < prevCardsLen.current) {
      setCurrentIndex(0);
      setSwiping(false);
      setSwipeDir(null);
    }
    prevCardsLen.current = cards.length;
  }, [cards.length]);

  // Prefetch more cards when approaching the end
  useEffect(() => {
    if (hasMore && currentIndex >= cards.length - 5) {
      onLoadMore();
    }
  }, [currentIndex, cards.length, hasMore, onLoadMore]);

  const goNext = useCallback(() => {
    if (swiping) return;
    if (currentIndex >= cards.length - 1 && !hasMore) {
      onRestart();
      setCurrentIndex(0);
      return;
    }
    if (currentIndex >= cards.length - 1) return;
    setSwipeDir("left");
    setSwiping(true);
    setTimeout(() => {
      setCurrentIndex((i) => i + 1);
      setSwipeDir(null);
      setSwiping(false);
    }, 250);
  }, [swiping, currentIndex, cards.length, hasMore, onRestart]);

  const goPrev = useCallback(() => {
    if (swiping || currentIndex <= 0) return;
    setSwipeDir("right");
    setSwiping(true);
    setTimeout(() => {
      setCurrentIndex((i) => i - 1);
      setSwipeDir(null);
      setSwiping(false);
    }, 250);
  }, [swiping, currentIndex]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  // Touch
  const onTouchStart = (e: React.TouchEvent) => {
    if (swiping) return;
    startX.current = e.touches[0].clientX;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    setDragX(e.touches[0].clientX - startX.current);
  };
  const onTouchEnd = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragX < -80) goNext();
    else if (dragX > 80) goPrev();
    setDragX(0);
  };

  // Mouse
  const onMouseDown = (e: React.MouseEvent) => {
    if (swiping) return;
    startX.current = e.clientX;
    setDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setDragX(e.clientX - startX.current);
  };
  const onMouseUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragX < -80) goNext();
    else if (dragX > 80) goPrev();
    setDragX(0);
  };

  if (cards.length === 0) return null;

  // Build the visible stack: up to 3 cards (current, next, next+1)
  const stackIndices = [currentIndex, currentIndex + 1, currentIndex + 2];
  const lastColor = cards[currentIndex]?.colore || undefined;

  return (
    <div className="relative">
      {/* Counter */}
      <div className="mb-3 text-center">
        <span className="inline-block rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-zinc-600 shadow-sm ring-1 ring-zinc-200">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {/* Card stack */}
      <div
        className="relative mx-auto"
        style={{ minHeight: 400 }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { if (dragging) { setDragging(false); setDragX(0); } }}
      >
        {/* Render stack layers bottom-to-top (reverse so top card is last in DOM) */}
        {stackIndices.map((cardIdx, layerPos) => {
          const card = cards[cardIdx];
          const layer = STACK_LAYERS[layerPos];
          const isTop = layerPos === 0;

          // Compute styles for the top card (dragging / swiping)
          let transform: string;
          let opacity: number;
          let transition: string;

          if (isTop) {
            // Top card: apply drag/swipe transforms
            if (swipeDir === "left") {
              transform = "translateX(-110%) scale(1)";
              opacity = 0;
              transition = "transform 250ms ease-out, opacity 250ms ease-out";
            } else if (swipeDir === "right") {
              transform = "translateX(110%) scale(1)";
              opacity = 0;
              transition = "transform 250ms ease-out, opacity 250ms ease-out";
            } else if (dragging && dragX !== 0) {
              transform = `translateX(${dragX}px) scale(1)`;
              opacity = Math.max(0.3, 1 - Math.abs(dragX) / 500);
              transition = "none";
            } else {
              transform = `translateX(0) scale(${layer.scale}) translateY(${layer.y}px)`;
              opacity = layer.opacity;
              transition = "transform 250ms ease-out, opacity 250ms ease-out";
            }
          } else {
            // Background cards: when top card is swiping out, promote this layer up
            const promoted = swipeDir !== null;
            const targetLayer = promoted ? STACK_LAYERS[layerPos - 1] : layer;
            transform = `scale(${targetLayer.scale}) translateY(${targetLayer.y}px)`;
            opacity = targetLayer.opacity;
            transition = "transform 250ms ease-out, opacity 250ms ease-out";
          }

          return (
            <div
              key={`layer-${layerPos}-${cardIdx}`}
              className={`${isTop ? "relative" : "absolute inset-0"} select-none`}
              style={{
                transform,
                opacity,
                transition,
                zIndex: 3 - layerPos,
                cursor: isTop ? (dragging ? "grabbing" : "grab") : "default",
                pointerEvents: isTop ? "auto" : "none",
              }}
            >
              {card ? (
                <FlashcardItem
                  id={card.id.replace(/-imp$/, "")}
                  titolo={card.titolo}
                  testo={card.testo}
                  tag={card.tag}
                  difficolta={card.difficolta}
                  materia={card.materia}
                  dispensaId={card.dispensa_id}
                  inizialmenteImportante={card.importante ?? false}
                  inizialmenteSalvato={card.salvato ?? false}
                  imageUrl={card.image_url}
                  colore={card.colore}
                  onDeleted={isTop ? onCardDeleted : undefined}
                  onTagClick={isTop ? onTagClick : undefined}
                />
              ) : (
                <CardSkeleton bgColor={lastColor} />
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation buttons */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          onClick={goPrev}
          disabled={currentIndex <= 0 || swiping}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-zinc-200 transition-all hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Carta precedente"
        >
          <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={goNext}
          disabled={swiping}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Carta successiva"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
