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
  onCardDeleted: (id: string) => void;
  onTagClick: (tag: string) => void;
}

export default function DeckView({ cards, onCardDeleted, onTagClick }: DeckViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [animating, setAnimating] = useState(false);
  const [finished, setFinished] = useState(false);

  // Swipe state
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset index when cards change (e.g. filter applied)
  useEffect(() => {
    setCurrentIndex(0);
    setFinished(false);
    setDirection(null);
    setAnimating(false);
  }, [cards.length]);

  const goNext = useCallback(() => {
    if (animating || currentIndex >= cards.length - 1) {
      if (currentIndex >= cards.length - 1) setFinished(true);
      return;
    }
    setDirection("left");
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((i) => i + 1);
      setDirection(null);
      setAnimating(false);
    }, 300);
  }, [animating, currentIndex, cards.length]);

  const goPrev = useCallback(() => {
    if (animating || currentIndex <= 0) return;
    setDirection("right");
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((i) => i - 1);
      setDirection(null);
      setAnimating(false);
    }, 300);
  }, [animating, currentIndex]);

  const restart = () => {
    setCurrentIndex(0);
    setFinished(false);
  };

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

  // Touch handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    if (animating) return;
    startX.current = e.touches[0].clientX;
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const diff = e.touches[0].clientX - startX.current;
    setDragX(diff);
  };

  const onTouchEnd = () => {
    if (!dragging) return;
    setDragging(false);
    const threshold = 80;
    if (dragX < -threshold) {
      goNext();
    } else if (dragX > threshold) {
      goPrev();
    }
    setDragX(0);
  };

  // Mouse drag handlers for desktop
  const onMouseDown = (e: React.MouseEvent) => {
    if (animating) return;
    startX.current = e.clientX;
    setDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const diff = e.clientX - startX.current;
    setDragX(diff);
  };

  const onMouseUp = () => {
    if (!dragging) return;
    setDragging(false);
    const threshold = 80;
    if (dragX < -threshold) {
      goNext();
    } else if (dragX > threshold) {
      goPrev();
    }
    setDragX(0);
  };

  if (cards.length === 0) return null;

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-20">
        <span className="text-5xl">🎉</span>
        <p className="text-lg font-semibold text-zinc-700">Hai visto tutte le carte!</p>
        <button
          onClick={restart}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-colors"
        >
          Ricomincia
        </button>
      </div>
    );
  }

  const card = cards[currentIndex];

  // Compute animation transform
  let cardTransform = "";
  let cardOpacity = 1;
  if (direction === "left") {
    cardTransform = "translateX(-120%) rotate(-8deg)";
    cardOpacity = 0;
  } else if (direction === "right") {
    cardTransform = "translateX(120%) rotate(8deg)";
    cardOpacity = 0;
  } else if (dragging && dragX !== 0) {
    const rotation = dragX * 0.05;
    cardTransform = `translateX(${dragX}px) rotate(${rotation}deg)`;
    cardOpacity = 1 - Math.abs(dragX) / 400;
  }

  return (
    <div className="relative">
      {/* Counter */}
      <div className="mb-3 text-center">
        <span className="inline-block rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-zinc-600 shadow-sm ring-1 ring-zinc-200">
          {currentIndex + 1} / {cards.length}
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
        {/* Background cards for stack effect */}
        {currentIndex + 2 < cards.length && (
          <div
            className="absolute inset-0 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100 pointer-events-none"
            style={{
              transform: "scale(0.92) translateY(16px)",
              opacity: 0.4,
              zIndex: 1,
            }}
          />
        )}
        {currentIndex + 1 < cards.length && (
          <div
            className="absolute inset-0 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100 pointer-events-none"
            style={{
              transform: "scale(0.96) translateY(8px)",
              opacity: 0.7,
              zIndex: 2,
            }}
          />
        )}

        {/* Active card */}
        <div
          className="relative select-none"
          style={{
            transform: cardTransform || "translateX(0)",
            opacity: cardOpacity,
            transition: dragging ? "none" : "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease",
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
