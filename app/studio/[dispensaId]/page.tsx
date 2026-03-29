"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import FlashcardItem from "@/components/flashcard/FlashcardItem";

interface StudioCard {
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
}

export default function StudioPage({
  params,
}: {
  params: Promise<{ dispensaId: string }>;
}) {
  const [dispensaId, setDispensaId] = useState("");
  const [dispensaTitolo, setDispensaTitolo] = useState("");
  const [cards, setCards] = useState<StudioCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    params.then((p) => setDispensaId(p.dispensaId));
  }, [params]);

  useEffect(() => {
    if (!dispensaId) return;
    fetch(`/api/flashcard/${dispensaId}`)
      .then((r) => r.json())
      .then((data) => {
        setDispensaTitolo(data.titolo || "Dispensa");
        const sorted = (data.flashcard as StudioCard[]).sort((a, b) => a.ordine - b.ordine);
        setCards(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dispensaId]);

  // Track visible card index via IntersectionObserver
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const idx = parseInt((entry.target as HTMLElement).dataset.idx || "0", 10);
        setCurrentIndex(idx);
        if (idx === cards.length - 1) setCompleted(true);
      }
    },
    [cards.length]
  );

  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    observerRef.current = new IntersectionObserver(observerCallback, { threshold: 0.5 });
    return () => observerRef.current?.disconnect();
  }, [observerCallback]);

  const cardRef = useCallback((node: HTMLElement | null) => {
    if (node && observerRef.current) observerRef.current.observe(node);
  }, []);

  const handleCardDeleted = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-4">
        <p className="text-lg font-medium text-zinc-500">Nessuna flashcard</p>
        <button onClick={() => router.push("/archivio")} className="text-sm text-blue-600 hover:underline">
          Torna all&apos;archivio
        </button>
      </div>
    );
  }

  const progress = Math.round(((currentIndex + 1) / cards.length) * 100);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Fixed header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-zinc-200">
        <div className="mx-auto max-w-[600px] px-4">
          <div className="flex items-center justify-between py-3">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-zinc-900 truncate">{dispensaTitolo}</h1>
              <p className="text-xs text-zinc-500">{currentIndex + 1} / {cards.length} flashcard</p>
            </div>
            <button
              onClick={() => router.push("/archivio")}
              className="shrink-0 flex items-center gap-1 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Esci
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100 mb-1">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Cards */}
      <div className="mx-auto max-w-[600px] px-4 py-4">
        <div className="flex flex-col gap-5">
          {cards.map((fc, i) => (
            <div key={fc.id} ref={cardRef} data-idx={i}>
              <FlashcardItem
                id={fc.id}
                titolo={fc.titolo}
                testo={fc.testo}
                tag={fc.tag}
                difficolta={fc.difficolta}
                materia={dispensaTitolo}
                dispensaId={dispensaId}
                inizialmenteImportante={fc.importante ?? false}
                inizialmenteSalvato={fc.salvato ?? false}
                imageUrl={fc.image_url}
                colore={fc.colore}
                onDeleted={handleCardDeleted}
              />
            </div>
          ))}
        </div>

        {/* Completion banner */}
        {completed && (
          <div className="mt-6 rounded-2xl bg-green-50 p-6 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-lg font-bold text-green-900">
              Hai completato tutte le {cards.length} flashcard!
            </h2>
            <button
              onClick={() => router.push("/archivio")}
              className="mt-4 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              Torna all&apos;archivio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
