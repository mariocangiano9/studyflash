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
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [animating, setAnimating] = useState(false);

  // Swipe state
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCardsLen = useRef(cards.length);

  // Reset index only when cards are fully replaced (filter change), not when appended
  useEffect(() => {
    if (cards.length < prevCardsLen.current) {
      // Cards were replaced (filter/search changed) — reset
      setCurrentIndex(0);
      setDirection(null);
      setAnimating(false);
    }
    prevCardsLen.current = cards.length;
  }, [cards.length]);

  // Prefetch more cards when approaching the end of loaded batch
  useEffect(() => {
    if (hasMore && currentIndex >= cards.length - 5) {
      onLoadMore();
    }
  }, [currentIndex, cards.length, hasMore, onLoadMore]);

  const goNext = useCallback(() => {
    if (animating) return;
    // If at the end of all cards (nothing more to load), restart
    if (currentIndex >= cards.length - 1 && !hasMore) {
      onRestart();
      setCurrentIndex(0);
      return;
    }
    if (currentIndex >= cards.length - 1) return; // still loading
    setDirection("left");
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((i) => i + 1);
      setDirection(null);
      setAnimating(false);
    }, 250);
  }, [animating, currentIndex, cards.length, hasMore, onRestart]);

  const goPrev = useCallback(() => {
    if (animating || currentIndex <= 0) return;
    setDirection("right");
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((i) => i - 1);
      setDirection(null);
      setAnimating(false);
    }, 250);
  }, [animating, currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (animating) return;
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

  // Mouse drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    if (animating) return;
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

  const card = cards[currentIndex];
  if (!card) return null;

  // Smooth horizontal slide, no rotation
  let cardTransform = "translateX(0)";
  let cardOpacity = 1;
  if (direction === "left") {
    cardTransform = "translateX(-110%)";
    cardOpacity = 0;
  } else if (direction === "right") {
    cardTransform = "translateX(110%)";
    cardOpacity = 0;
  } else if (dragging && dragX !== 0) {
    cardTransform = `translateX(${dragX}px)`;
    cardOpacity = Math.max(0.3, 1 - Math.abs(dragX) / 500);
  }

  return (
    <div className="relative">
      {/* Counter */}
      <div className="mb-3 text-center">
        <span className="inline-block rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-zinc-600 shadow-sm ring-1 ring-zinc-200">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {/* Card stack area */}
      <div
        ref={containerRef}
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
        {/* Stack shadows — always visible for depth effect */}
        <div
          className="absolute inset-0 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100 pointer-events-none"
          style={{
            transform: "scale(0.92) translateY(16px)",
            opacity: 0.4,
            zIndex: 1,
          }}
        />
        <div
          className="absolute inset-0 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100 pointer-events-none"
          style={{
            transform: "scale(0.96) translateY(8px)",
            opacity: 0.7,
            zIndex: 2,
          }}
        />

        {/* Active card */}
        <div
          className="relative select-none"
          style={{
            transform: cardTransform,
            opacity: cardOpacity,
            transition: dragging ? "none" : "transform 250ms ease-out, opacity 250ms ease-out",
            zIndex: 3,
            cursor: dragging ? "grabbing" : "grab",
          }}
        >
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
            onDeleted={onCardDeleted}
            onTagClick={onTagClick}
          />
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          onClick={goPrev}
          disabled={currentIndex <= 0 || animating}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-zinc-200 transition-all hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Carta precedente"
        >
          <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={goNext}
          disabled={animating}
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
