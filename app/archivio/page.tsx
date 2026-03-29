"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ModificaModal, { ModificaData } from "@/components/flashcard/ModificaModal";

interface FlashcardRow {
  id: string;
  titolo: string;
  testo: string;
  tag: string[] | null;
  difficolta: "facile" | "media" | "difficile";
  ordine: number;
  image_url: string | null;
}

interface DispensaInfo {
  dispensaId: string;
  titolo: string;
  materia?: string;
  tags?: string[] | null;
  colore?: string | null;
  numFlashcard: number;
  createdAt: string;
}

const COLORI_PALETTE = [
  "#EEF2FF", "#E0E7FF", "#DBEAFE", "#EFF6FF", "#F0F9FF", "#ECFEFF",
  "#F0FDF4", "#DCFCE7", "#D1FAE5", "#CCFBF1", "#CFFAFE", "#E0F2FE",
  "#FFFBEB", "#FEF9C3", "#FFF7ED", "#FFEDD5", "#FEE2E2", "#FFF1F2",
  "#FAF5FF", "#F5F3FF", "#FDF4FF", "#FCE7F3", "#F9FAFB", "#F3F4F6",
];

export default function ArchivioPage() {
  const [dispense, setDispense] = useState<DispensaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedCount, setSavedCount] = useState(0);
  const [eliminando, setEliminando] = useState<string | null>(null);

  // Accordion state
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flashcardMap, setFlashcardMap] = useState<Record<string, FlashcardRow[]>>({});
  const [loadingCards, setLoadingCards] = useState<string | null>(null);

  // Modal state
  const [editingCard, setEditingCard] = useState<(FlashcardRow & { dispensaId: string }) | null>(null);

  // Tag edit state
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [savingTag, setSavingTag] = useState(false);

  // Materia edit state
  const [editingMateriaId, setEditingMateriaId] = useState<string | null>(null);
  const [materiaInput, setMateriaInput] = useState("");
  const [savingMateria, setSavingMateria] = useState(false);

  // Color picker state
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/archivio")
      .then((r) => r.json())
      .then((d) => setDispense(d.dispense || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch("/api/flashcard?saved=true")
      .then((r) => r.ok ? r.json() : { feed: [] })
      .then((d) => setSavedCount(d.feed?.length ?? 0))
      .catch(() => {});
  }, []);

  const toggleExpand = useCallback(async (dispensaId: string) => {
    if (expanded === dispensaId) {
      setExpanded(null);
      return;
    }
    setExpanded(dispensaId);

    if (flashcardMap[dispensaId]) return;

    setLoadingCards(dispensaId);
    try {
      const res = await fetch(`/api/flashcard/${dispensaId}`);
      if (res.ok) {
        const data = await res.json();
        setFlashcardMap((prev) => ({ ...prev, [dispensaId]: data.flashcard || [] }));
      }
    } catch {
      // silent
    } finally {
      setLoadingCards(null);
    }
  }, [expanded, flashcardMap]);

  async function eliminaDispensa(dispensaId: string) {
    if (!confirm("Eliminare questa dispensa e tutte le sue flashcard?")) return;
    setEliminando(dispensaId);
    try {
      const res = await fetch(`/api/archivio/${dispensaId}`, { method: "DELETE" });
      if (res.ok) {
        setDispense((prev) => prev.filter((d) => d.dispensaId !== dispensaId));
        setFlashcardMap((prev) => { const n = { ...prev }; delete n[dispensaId]; return n; });
        if (expanded === dispensaId) setExpanded(null);
      }
    } finally {
      setEliminando(null);
    }
  }

  async function eliminaFlashcard(dispensaId: string, flashcardId: string) {
    if (!confirm("Sei sicuro di voler eliminare questa flashcard?")) return;
    try {
      const res = await fetch(`/api/flashcard/${dispensaId}/${flashcardId}`, { method: "DELETE" });
      if (res.ok) {
        setFlashcardMap((prev) => ({
          ...prev,
          [dispensaId]: (prev[dispensaId] || []).filter((fc) => fc.id !== flashcardId),
        }));
        setDispense((prev) =>
          prev.map((d) => d.dispensaId === dispensaId ? { ...d, numFlashcard: d.numFlashcard - 1 } : d)
        );
      }
    } catch {
      // silent
    }
  }

  function handleModalSaved(updated: ModificaData) {
    if (!editingCard) return;
    const { dispensaId, id } = editingCard;
    setFlashcardMap((prev) => ({
      ...prev,
      [dispensaId]: (prev[dispensaId] || []).map((fc) =>
        fc.id === id
          ? { ...fc, titolo: updated.titolo, testo: updated.testo, difficolta: updated.difficolta, image_url: updated.imageUrl || null }
          : fc
      ),
    }));
    setEditingCard(null);
  }

  function handleModalDeleted() {
    if (!editingCard) return;
    const { dispensaId, id } = editingCard;
    setFlashcardMap((prev) => ({
      ...prev,
      [dispensaId]: (prev[dispensaId] || []).filter((fc) => fc.id !== id),
    }));
    setDispense((prev) =>
      prev.map((d) => d.dispensaId === dispensaId ? { ...d, numFlashcard: d.numFlashcard - 1 } : d)
    );
    setEditingCard(null);
  }

  function openTagEdit(d: DispensaInfo) {
    setEditingTagId(d.dispensaId);
    setTagInput((d.tags || []).join(", "));
  }

  async function salvaTag(dispensaId: string) {
    setSavingTag(true);
    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      const res = await fetch(`/api/archivio/${dispensaId}/tag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (res.ok) {
        setDispense((prev) =>
          prev.map((d) => d.dispensaId === dispensaId ? { ...d, tags: tags.length > 0 ? tags : null } : d)
        );
        // Update cached flashcards too
        setFlashcardMap((prev) => {
          if (!prev[dispensaId]) return prev;
          return {
            ...prev,
            [dispensaId]: prev[dispensaId].map((fc) => ({ ...fc, tag: tags.length > 0 ? tags : null })),
          };
        });
        setEditingTagId(null);
      }
    } finally {
      setSavingTag(false);
    }
  }

  const MATERIE = [
    "Diritto", "Economia", "Storia", "Filosofia", "Scienze",
    "Matematica", "Fisica", "Medicina", "Letteratura",
    "Informatica", "Psicologia", "Altro",
  ];

  function openMateriaEdit(d: DispensaInfo) {
    setEditingMateriaId(d.dispensaId);
    setMateriaInput(d.materia || "");
  }

  async function salvaMateria(dispensaId: string) {
    if (!materiaInput.trim()) return;
    setSavingMateria(true);
    try {
      const res = await fetch(`/api/archivio/${dispensaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materia: materiaInput }),
      });
      if (res.ok) {
        setDispense((prev) =>
          prev.map((d) => d.dispensaId === dispensaId ? { ...d, materia: materiaInput } : d)
        );
        setEditingMateriaId(null);
      }
    } finally {
      setSavingMateria(false);
    }
  }

  async function salvaColore(dispensaId: string, colore: string) {
    setColorPickerOpen(null);
    // Optimistic update
    setDispense((prev) =>
      prev.map((d) => d.dispensaId === dispensaId ? { ...d, colore } : d)
    );
    await fetch(`/api/archivio/${dispensaId}/colore`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colore }),
    }).catch(console.error);
  }

  function formatData(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("it-IT", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch { return ""; }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (dispense.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-3xl">📂</div>
        <p className="text-lg font-medium text-zinc-500">Nessuna dispensa nell&apos;archivio</p>
        <Link href="/upload" className="text-sm font-medium text-blue-600 hover:underline">
          Carica la prima dispensa &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[600px] px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold text-zinc-900">Archivio</h1>
      <p className="mt-1 text-sm text-zinc-500">{dispense.length} dispense caricate</p>

      {/* Salvati section */}
      {savedCount > 0 && (
        <Link
          href="/feed?saved=true"
          className="mt-4 flex items-center justify-between rounded-2xl bg-blue-50 p-4 transition-colors hover:bg-blue-100"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔖</span>
            <div>
              <p className="text-sm font-semibold text-blue-900">Post salvati</p>
              <p className="text-xs text-blue-600">{savedCount} flashcard salvate</p>
            </div>
          </div>
          <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {dispense.map((d) => {
          const isExpanded = expanded === d.dispensaId;
          const cards = flashcardMap[d.dispensaId] || [];
          const isLoadingCards = loadingCards === d.dispensaId;

          return (
            <div key={d.dispensaId} className="rounded-2xl bg-white shadow-md shadow-zinc-200/60 overflow-hidden">
              {/* Header */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-zinc-900 leading-snug">{d.titolo}</h2>
                      {/* Color picker trigger */}
                      <div className="relative">
                        <button
                          onClick={() => setColorPickerOpen(colorPickerOpen === d.dispensaId ? null : d.dispensaId)}
                          className="h-5 w-5 shrink-0 rounded-full border-2 border-white shadow-sm ring-1 ring-zinc-200 transition-transform hover:scale-110"
                          style={{ backgroundColor: d.colore || "#F9FAFB" }}
                          title="Cambia colore"
                        />
                        {colorPickerOpen === d.dispensaId && (
                          <>
                            {/* Backdrop to close on outside click */}
                            <div className="fixed inset-0 z-10" onClick={() => setColorPickerOpen(null)} />
                            {/* Palette popover */}
                            <div className="absolute left-0 top-8 z-20 rounded-xl bg-white p-3 shadow-xl ring-1 ring-zinc-200">
                              <div className="grid grid-cols-6 gap-1.5" style={{ width: 228 }}>
                                {COLORI_PALETTE.map((c) => (
                                  <button
                                    key={c}
                                    onClick={() => salvaColore(d.dispensaId, c)}
                                    className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                                      (d.colore || "#F9FAFB") === c
                                        ? "border-[2.5px] border-blue-500 shadow-sm"
                                        : "border border-zinc-200"
                                    }`}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      {d.materia ? (
                        <button
                          onClick={() => openMateriaEdit(d)}
                          className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                          title="Modifica materia"
                        >
                          {d.materia}
                        </button>
                      ) : (
                        <button
                          onClick={() => openMateriaEdit(d)}
                          className="rounded-full bg-zinc-50 px-2 py-0.5 font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                        >
                          + Materia
                        </button>
                      )}
                      <span>{d.numFlashcard} flashcard</span>
                      <span>&middot;</span>
                      <span>{formatData(d.createdAt)}</span>
                    </div>
                    {editingMateriaId === d.dispensaId && (
                      <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <input
                          list="materie-list"
                          value={materiaInput}
                          onChange={(e) => setMateriaInput(e.target.value)}
                          placeholder="Es: Diritto Commerciale"
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                        <datalist id="materie-list">
                          {MATERIE.map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => salvaMateria(d.dispensaId)}
                            disabled={savingMateria || !materiaInput.trim()}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingMateria ? "Salvo..." : "Salva"}
                          </button>
                          <button
                            onClick={() => setEditingMateriaId(null)}
                            className="rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-300"
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {(d.tags || []).length > 0 ? (
                    <>
                      {(d.tags || []).map((tag) => (
                        <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                          {tag}
                        </span>
                      ))}
                      <button
                        onClick={() => openTagEdit(d)}
                        className="rounded-lg p-1 text-zinc-300 hover:text-zinc-600 transition-colors"
                        title="Modifica tag"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => openTagEdit(d)}
                      className="rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                    >
                      + Aggiungi tag
                    </button>
                  )}
                </div>

                {/* Tag edit popover */}
                {editingTagId === d.dispensaId && (
                  <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Tag separati da virgola..."
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      onKeyDown={(e) => { if (e.key === "Enter") salvaTag(d.dispensaId); }}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => salvaTag(d.dispensaId)}
                        disabled={savingTag}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingTag ? "Salvo..." : "Salva"}
                      </button>
                      <button
                        onClick={() => setEditingTagId(null)}
                        className="rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-300"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => toggleExpand(d.dispensaId)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                      isExpanded ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    <svg className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                    {isExpanded ? "Chiudi" : "Vedi flashcard"}
                  </button>
                  <Link
                    href={`/feed/${d.dispensaId}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Feed
                  </Link>
                  <Link
                    href={`/quiz?dispensaId=${d.dispensaId}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600"
                  >
                    Quiz
                  </Link>
                  <button
                    onClick={() => eliminaDispensa(d.dispensaId)}
                    disabled={eliminando === d.dispensaId}
                    className="flex items-center justify-center rounded-xl bg-zinc-100 px-3 py-2.5 text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    {eliminando === d.dispensaId ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded flashcard list */}
              {isExpanded && (
                <div className="border-t border-zinc-100">
                  {isLoadingCards ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    </div>
                  ) : cards.length === 0 ? (
                    <p className="px-5 py-6 text-center text-sm text-zinc-400">Nessuna flashcard</p>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                      {cards.map((fc, i) => (
                        <div
                          key={fc.id}
                          className={`flex items-start gap-3 px-5 py-3 ${i > 0 ? "border-t border-zinc-50" : ""}`}
                        >
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-500">
                            {fc.ordine}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-zinc-900">{fc.titolo}</p>
                            <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">
                              {fc.testo.length > 80 ? fc.testo.slice(0, 80) + "..." : fc.testo}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              onClick={() => setEditingCard({ ...fc, dispensaId: d.dispensaId })}
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                              title="Modifica"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => eliminaFlashcard(d.dispensaId, fc.id)}
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                              title="Elimina"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      {editingCard && (
        <ModificaModal
          open={true}
          flashcardId={editingCard.id}
          dispensaId={editingCard.dispensaId}
          initial={{
            titolo: editingCard.titolo,
            testo: editingCard.testo,
            tag: (editingCard.tag || []).join(", "),
            imageUrl: editingCard.image_url || "",
            difficolta: editingCard.difficolta,
          }}
          onClose={() => setEditingCard(null)}
          onSaved={handleModalSaved}
          onDeleted={handleModalDeleted}
        />
      )}
    </div>
  );
}
