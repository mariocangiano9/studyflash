"use client";

import { useState, useEffect } from "react";

export interface ModificaData {
  titolo: string;
  testo: string;
  tag: string;
  imageUrl: string;
  difficolta: "facile" | "media" | "difficile";
}

interface ModificaModalProps {
  open: boolean;
  flashcardId: string;
  dispensaId?: string;
  initial: ModificaData;
  onClose: () => void;
  onSaved: (updated: ModificaData) => void;
  onDeleted: () => void;
}

export default function ModificaModal({
  open,
  flashcardId,
  dispensaId,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: ModificaModalProps) {
  const [draft, setDraft] = useState<ModificaData>(initial);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraft(initial);
    setConfirmDelete(false);
  }, [initial, open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const apiUrl = dispensaId
    ? `/api/flashcard/${dispensaId}/${flashcardId}`
    : `/api/flashcard/${flashcardId}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(apiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titolo: draft.titolo,
          testo: draft.testo,
          difficolta: draft.difficolta,
          image_url: draft.imageUrl || null,
        }),
      });
      onSaved(draft);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const delUrl = dispensaId
        ? `/api/flashcard/${dispensaId}/${flashcardId}`
        : apiUrl;
      await fetch(delUrl, { method: "DELETE" });
      onDeleted();
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl animate-in">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-zinc-900">Modifica flashcard</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500">Titolo</span>
            <input
              type="text"
              value={draft.titolo}
              onChange={(e) => setDraft({ ...draft, titolo: e.target.value })}
              className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500">Spiegazione</span>
            <textarea
              value={draft.testo}
              onChange={(e) => setDraft({ ...draft, testo: e.target.value })}
              rows={6}
              className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500">Tag (separati da virgola)</span>
            <input
              type="text"
              value={draft.tag}
              onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
              placeholder="diritto, costituzione"
              className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500">Immagine URL (opzionale)</span>
            <input
              type="url"
              value={draft.imageUrl}
              onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
              placeholder="https://..."
              className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500">Difficolta</span>
            <select
              value={draft.difficolta}
              onChange={(e) => setDraft({ ...draft, difficolta: e.target.value as ModificaData["difficolta"] })}
              className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="facile">Facile</option>
              <option value="media">Media</option>
              <option value="difficile">Difficile</option>
            </select>
          </label>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Salvataggio..." : "Salva"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-200"
          >
            Annulla
          </button>
        </div>

        {/* Delete */}
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
              confirmDelete
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-red-50 text-red-600 hover:bg-red-100"
            }`}
          >
            {deleting ? "Eliminazione..." : confirmDelete ? "Conferma eliminazione" : "Elimina flashcard"}
          </button>
        </div>
      </div>
    </div>
  );
}
