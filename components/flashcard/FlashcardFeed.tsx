"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import FlashcardItem from "./FlashcardItem";
import DeckView from "./DeckView";

type ViewMode = "deck" | "scroll";

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

interface DispensaFilter {
  dispensaId: string;
  titolo: string;
}

const PAGE_SIZE = 50;

export default function FlashcardFeed({ dispensaId, savedMode }: { dispensaId?: string; savedMode?: boolean }) {
  // View mode with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>("deck");
  useEffect(() => {
    const saved = localStorage.getItem("studyflash-feed-view");
    if (saved === "scroll" || saved === "deck") setViewMode(saved);
  }, []);
  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("studyflash-feed-view", mode);
  };

  const [cards, setCards] = useState<FeedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errore, setErrore] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const seenRef = useRef(new Set<string>());

  // Filter state
  const [dispense, setDispense] = useState<DispensaFilter[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll-to-top
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Pull-to-refresh
  const feedRef = useRef<HTMLDivElement>(null);
  const [pullY, setPullY] = useState(0);
  const [pulling, setPulling] = useState(false);
  const touchStartY = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Load dispense list for filters (only for global feed)
  useEffect(() => {
    if (dispensaId) return;
    fetch("/api/archivio")
      .then((r) => r.json())
      .then((d) => setDispense((d.dispense || []).map((x: { dispensaId: string; titolo: string }) => ({
        dispensaId: x.dispensaId,
        titolo: x.titolo,
      }))))
      .catch(() => {});
  }, [dispensaId]);

  // Scroll listener for "back to top" button
  useEffect(() => {
    const handler = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const buildParams = useCallback((filterIds?: Set<string>, tagFilter?: string | null, searchOverride?: string) => {
    const ids = filterIds ?? selectedIds;
    const tag = tagFilter !== undefined ? tagFilter : activeTag;
    const search = searchOverride !== undefined ? searchOverride : searchActive;
    const params = new URLSearchParams();
    if (ids.size > 0) params.set("dispensaIds", Array.from(ids).join(","));
    if (tag) params.set("tag", tag);
    if (savedMode) params.set("saved", "true");
    if (search) params.set("search", search);
    return params;
  }, [selectedIds, activeTag, savedMode, searchActive]);

  const loadFeed = useCallback(async (filterIds?: Set<string>, tagFilter?: string | null) => {
    try {
      if (dispensaId) {
        const res = await fetch(`/api/flashcard/${dispensaId}`);
        if (!res.ok) throw new Error("Flashcard non trovate");
        const data = await res.json();
        const mapped = (data.flashcard as FeedCard[]).map((fc) => ({
          ...fc,
          materia: data.titolo || "Dispensa",
        }));
        setCards(mapped);
        setHasMore(false);
        setTotal(mapped.length);
      } else {
        const params = buildParams(filterIds, tagFilter);
        params.set("offset", "0");
        params.set("limit", String(PAGE_SIZE));
        const res = await fetch(`/api/flashcard?${params}`);
        if (!res.ok) throw new Error("Nessuna flashcard disponibile");
        const data = await res.json();
        setCards(data.feed);
        setHasMore(data.hasMore);
        setTotal(data.total);
      }
      setErrore("");
      seenRef.current.clear();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore");
    }
  }, [dispensaId, buildParams]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || dispensaId) return;
    setLoadingMore(true);
    try {
      const params = buildParams();
      params.set("offset", String(cards.length));
      params.set("limit", String(PAGE_SIZE));
      const res = await fetch(`/api/flashcard?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setCards((prev) => [...prev, ...data.feed]);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, dispensaId, cards.length, buildParams]);

  useEffect(() => {
    loadFeed().finally(() => setLoading(false));
  }, [loadFeed]);

  // Infinite scroll — trigger loadMore when sentinel is visible
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  // Filter toggle
  const toggleFilter = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setLoading(true);
      loadFeed(next).finally(() => setLoading(false));
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set());
    setLoading(true);
    loadFeed(new Set()).finally(() => setLoading(false));
  };

  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
    setLoading(true);
    loadFeed(selectedIds, tag).finally(() => setLoading(false));
  };

  const clearTag = () => {
    setActiveTag(null);
    setLoading(true);
    loadFeed(selectedIds, null).finally(() => setLoading(false));
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchActive(value);
      setLoading(true);
      // Reset cards and load with new search
      setCards([]);
      const params = buildParams(selectedIds, activeTag, value);
      params.set("offset", "0");
      params.set("limit", String(PAGE_SIZE));
      fetch(`/api/flashcard?${params}`)
        .then((r) => r.ok ? r.json() : { feed: [], total: 0, hasMore: false })
        .then((data) => {
          setCards(data.feed || []);
          setHasMore(data.hasMore ?? false);
          setTotal(data.total ?? 0);
          setErrore("");
        })
        .catch(() => setErrore("Errore ricerca"))
        .finally(() => setLoading(false));
    }, 400);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchActive("");
    setLoading(true);
    loadFeed().finally(() => setLoading(false));
  };

  // Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetch("/api/flashcard/seen/reset", { method: "DELETE" });
    await loadFeed();
    setRefreshing(false);
  };

  // Pull-to-refresh
  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      touchStartY.current = e.touches[0].clientY;
      setPulling(true);
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) setPullY(Math.min(diff * 0.4, 80));
  };
  const onTouchEnd = () => {
    if (pullY > 50) handleRefresh();
    setPullY(0);
    setPulling(false);
  };

  // IntersectionObserver for seen tracking
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const cardId = (entry.target as HTMLElement).dataset.cardId;
        if (!cardId || seenRef.current.has(cardId) || cardId.endsWith("-imp")) return;
        seenRef.current.add(cardId);
        const card = cards.find((c) => c.id === cardId);
        if (card?.dispensa_id) {
          fetch(`/api/flashcard/${card.dispensa_id}/${cardId}/seen`, { method: "PATCH" }).catch(() => {});
        }
      });
    },
    [cards]
  );

  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    observerRef.current = new IntersectionObserver(observerCallback, { threshold: 0.5 });
    return () => observerRef.current?.disconnect();
  }, [observerCallback]);

  const cardRef = useCallback((node: HTMLElement | null) => {
    if (node && observerRef.current) observerRef.current.observe(node);
  }, []);

  const handleCardDeleted = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  // ── Render ──

  if (loading && cards.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (errore && cards.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-4">
        <p className="text-lg font-medium text-zinc-500">{errore}</p>
        <a href="/upload" className="text-sm font-medium text-blue-600 hover:underline">
          Carica una dispensa &rarr;
        </a>
      </div>
    );
  }

  const isAllSelected = selectedIds.size === 0;

  return (
    <div
      ref={feedRef}
      className="mx-auto max-w-[600px] px-4 py-4 relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: pullY > 10 ? pullY : 0, opacity: pullY / 80 }}
      >
        <div className={`h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent ${pullY > 50 ? "animate-spin" : ""}`} />
      </div>

      {/* Filter pills + refresh button */}
      {!dispensaId && dispense.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <div className="flex-1 overflow-x-auto flex gap-2 no-scrollbar">
            <button
              onClick={selectAll}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                isAllSelected
                  ? "bg-blue-600 text-white"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              Tutte
            </button>
            {dispense.map((d) => (
              <button
                key={d.dispensaId}
                onClick={() => toggleFilter(d.dispensaId)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedIds.has(d.dispensaId)
                    ? "bg-blue-600 text-white"
                    : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {d.titolo}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-white shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
            title="Nuovo shuffle"
          >
            <svg
              className={`h-3.5 w-3.5 text-zinc-500 ${refreshing ? "animate-spin" : ""}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
          </button>
        </div>
      )}

      {/* Search bar */}
      {!dispensaId && (
        <div className="mb-3 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Cerca tra le flashcard..."
            className="w-full rounded-xl bg-white py-2.5 pl-9 pr-9 text-sm ring-1 ring-zinc-200 outline-none focus:ring-blue-400 placeholder:text-zinc-400"
          />
          {searchQuery && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Active tag filter pill */}
      {activeTag && (
        <div className="mb-3 flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700">
            <span>📌</span>
            {activeTag}
            <button onClick={clearTag} className="ml-1 hover:text-blue-900">✕</button>
          </span>
        </div>
      )}

      {/* View mode toggle */}
      <div className="mb-3 flex items-center justify-center gap-1 rounded-full bg-zinc-100 p-1 mx-auto w-fit">
        <button
          onClick={() => switchView("deck")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
            viewMode === "deck"
              ? "bg-white text-zinc-800 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <span className="text-sm">🃏</span>
          Mazzo
        </button>
        <button
          onClick={() => switchView("scroll")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
            viewMode === "scroll"
              ? "bg-white text-zinc-800 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <span className="text-sm">📜</span>
          Scroll
        </button>
      </div>

      {/* Loading overlay when filtering */}
      {loading && cards.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {/* Feed */}
      {!loading && cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <p className="text-sm text-zinc-500">Nessuna flashcard per questa selezione</p>
        </div>
      ) : viewMode === "deck" ? (
        <DeckView
          cards={cards}
          onCardDeleted={handleCardDeleted}
          onTagClick={handleTagClick}
        />
      ) : (
        <>
          <div className="flex flex-col gap-5">
            {cards.map((fc) => (
              <div key={fc.id} ref={cardRef} data-card-id={fc.id}>
                <FlashcardItem
                  id={fc.id.replace(/-imp$/, "")}
                  titolo={fc.titolo}
                  testo={fc.testo}
                  tag={fc.tag}
                  difficolta={fc.difficolta}
                  materia={fc.materia}
                  dispensaId={fc.dispensa_id}
                  inizialmenteImportante={fc.importante ?? false}
                  inizialmenteSalvato={fc.salvato ?? false}
                  imageUrl={fc.image_url}
                  colore={fc.colore}
                  onDeleted={handleCardDeleted}
                  onTagClick={handleTagClick}
                />
              </div>
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              {loadingMore && (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              )}
            </div>
          )}

          {!hasMore && cards.length > 0 && total > PAGE_SIZE && (
            <p className="py-6 text-center text-xs text-zinc-400">{total} flashcard totali</p>
          )}
        </>
      )}

      {/* Scroll to top button (only in scroll mode) */}
      {viewMode === "scroll" && (
        <button
          onClick={scrollToTop}
          className={`fixed right-4 bottom-20 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all duration-300 ${
            showScrollTop ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
          }`}
          aria-label="Torna su"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
